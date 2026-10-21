/**
 * SLP – Emojot | Booking backend for the "Register interest" popup
 * ----------------------------------------------------------------
 * Runs as a Google Apps Script web app on the Emojot Google Workspace account.
 *
 *   GET  ?action=slots      → free 30-min slots for the next N days (reads Google Calendar free/busy)
 *   POST {action:'lead'}    → step 1 done: email the team (+ optional Sheet log)
 *   POST {action:'book'}    → re-checks the slot, creates the Calendar event with a Google Meet link,
 *                             invites the guest + team, emails the team (+ optional Sheet log)
 *
 * Setup: see README.md → "Google Calendar booking (Apps Script)".
 *
 * Works in two modes:
 *   • Google Calendar API service enabled (Services + or appsscript.json) → free/busy query + Google Meet link
 *   • Not enabled → falls back to CalendarApp: still checks busy time and sends invites, but no auto Meet link
 */

var CONFIG = {
  // Calendar the bookings are created in ('primary' = the account that deploys this script)
  CALENDAR_ID: 'primary',

  // Calendars / people whose busy time should block a slot. Add the team members who take these calls,
  // e.g. ['primary', 'sales@emojot.com', 'jane@emojot.com']. (Workspace users share free/busy by default.)
  CHECK_BUSY_CALENDARS: ['primary'],

  // Extra Emojot people added as guests to every session
  TEAM_GUESTS: [],

  // Who receives the "new registration" and "session booked" emails (comma separated)
  NOTIFY_EMAILS: 'sanjanan@emojot.com',

  // Optional: Google Sheet ID to log every registration + booking (leave '' to skip)
  SHEET_ID: '',

  // Availability rules (all in TIMEZONE)
  TIMEZONE: 'Asia/Dubai',
  WORK_DAYS: [1, 2, 3, 4, 5],        // 0=Sun … 6=Sat
  DAY_START: '10:00',
  DAY_END: '17:00',                  // last slot ends at DAY_END
  MEETING_MINUTES: 30,
  SLOT_STEP_MINUTES: 30,
  BUFFER_MINUTES: 0,                 // free gap required before/after existing meetings
  MIN_NOTICE_HOURS: 18,
  MAX_DAYS_AHEAD: 30,
  BLOCKED_DATES: [],                 // ['2026-12-02', '2026-12-03']
  HOLIDAY_CALENDAR_ID: '',           // optional, e.g. 'en.ae#holiday@group.v.calendar.google.com' (must be in your calendar list)

  MEETING_TITLE: 'SLP – Emojot introductory session',
  ADD_GOOGLE_MEET: true
};

/* ============================== HTTP ============================== */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'slots';
    if (action === 'slots') return json_({ ok: true, timezone: CONFIG.TIMEZONE, minutes: CONFIG.MEETING_MINUTES, slots: getSlotsCached_() });
    if (action === 'ping') return json_({ ok: true });
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.botcheck) return json_({ ok: true });                     // honeypot: pretend success
    if (body.action === 'lead') return json_(handleLead_(body));
    if (body.action === 'book') return json_(handleBook_(body));
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server', message: String(err) });
  }
}

/* ============================== LEAD ============================== */

function handleLead_(b) {
  var lead = cleanLead_(b);
  if (!lead) return { ok: false, error: 'invalid' };

  // Don't send duplicate "registered" emails if someone resubmits the same details
  var cache = CacheService.getScriptCache(), key = 'lead:' + lead.email.toLowerCase();
  if (cache.get(key)) return { ok: true, duplicate: true };
  cache.put(key, '1', 600);

  notify_('New registration: ' + lead.company + ' (session pending)', 'REGISTERED, session not booked yet', lead, []);
  log_('Registered', lead, '', '');
  return { ok: true };
}

/* ============================== BOOK ============================== */

function handleBook_(b) {
  var lead = cleanLead_(b);
  var date = String(b.date || ''), minutes = parseInt(b.minutes, 10);
  if (!lead || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(minutes)) return { ok: false, error: 'invalid' };

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Re-check against the live calendar inside the lock → no double bookings
    var slots = computeSlots_();
    if (!slots[date] || slots[date].indexOf(minutes) < 0) {
      CacheService.getScriptCache().remove('slots');
      return { ok: false, error: 'taken' };
    }

    var start = wallClock_(date, minutes);
    var end = new Date(start.getTime() + CONFIG.MEETING_MINUTES * 60000);
    var when = Utilities.formatDate(start, CONFIG.TIMEZONE, "EEEE, d MMMM yyyy 'at' h:mm a") + ' (Dubai time)';

    var guests = [{ email: lead.email, displayName: lead.name }].concat(
      CONFIG.TEAM_GUESTS.map(function (e) { return { email: e }; }));

    var resource = {
      summary: CONFIG.MEETING_TITLE + ': ' + lead.company,
      description: [
        'Online introductory session with the Emojot team.',
        '',
        'Name: ' + lead.name,
        'Company: ' + lead.company,
        'Email: ' + lead.email,
        'Phone: ' + lead.phone + (lead.country ? ' (' + lead.country + ')' : ''),
        lead.visitorLocal ? 'Guest local time: ' + lead.visitorLocal : ''
      ].join('\n'),
      start: { dateTime: start.toISOString(), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.TIMEZONE },
      attendees: guests,
      guestsCanModify: false,
      reminders: { useDefault: true }
    };
    if (CONFIG.ADD_GOOGLE_MEET) {
      resource.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }

    var meet = '', eventLink = '';
    if (hasCalendarApi_()) {
      // sendUpdates:'all' → Google emails the calendar invite (with Meet link) to the guest + team
      var ev = Calendar.Events.insert(resource, CONFIG.CALENDAR_ID, { conferenceDataVersion: 1, sendUpdates: 'all' });
      meet = ev.hangoutLink || '';
      if (!meet && ev.conferenceData && ev.conferenceData.entryPoints) {
        ev.conferenceData.entryPoints.forEach(function (p) { if (p.entryPointType === 'video') meet = p.uri; });
      }
      eventLink = ev.htmlLink || '';
    } else {
      // Fallback without the advanced service: invite is still emailed, Meet link must be added by the team
      calendar_(CONFIG.CALENDAR_ID).createEvent(resource.summary, start, end, {
        description: resource.description,
        guests: guests.map(function (g) { return g.email; }).join(','),
        sendInvites: true
      });
    }
    CacheService.getScriptCache().remove('slots');

    notify_('Session booked: ' + lead.company + ', ' + when, 'SESSION BOOKED', lead, [
      ['Session', when],
      ['Guest local time', lead.visitorLocal || ''],
      ['Google Meet', meet],
      ['Calendar event', eventLink]
    ]);
    log_('Booked', lead, when, meet);

    return { ok: true, start: start.toISOString(), end: end.toISOString(), meetLink: meet };
  } finally {
    lock.releaseLock();
  }
}

/* ============================== SLOTS ============================== */

function getSlotsCached_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('slots');
  if (hit) return JSON.parse(hit);
  var slots = computeSlots_();
  cache.put('slots', JSON.stringify(slots), 60);   // 60s cache; cleared on every booking
  return slots;
}

// → { '2026-10-12': [600, 630, …] }   (minutes after midnight, TIMEZONE wall-clock)
function computeSlots_() {
  var tz = CONFIG.TIMEZONE, now = new Date();
  var earliest = now.getTime() + CONFIG.MIN_NOTICE_HOURS * 3600000;
  var firstDay = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var rangeStart = wallClock_(firstDay, 0);
  var rangeEnd = new Date(rangeStart.getTime() + (CONFIG.MAX_DAYS_AHEAD + 2) * 86400000);

  var busy = getBusy_(rangeStart, rangeEnd);
  var blocked = getHolidays_(rangeStart, rangeEnd);
  CONFIG.BLOCKED_DATES.forEach(function (d) { blocked[d] = true; });

  var buf = CONFIG.BUFFER_MINUTES * 60000, len = CONFIG.MEETING_MINUTES * 60000;
  var dayStart = hm_(CONFIG.DAY_START), dayEnd = hm_(CONFIG.DAY_END);
  var out = {};

  for (var i = 0; i <= CONFIG.MAX_DAYS_AHEAD; i++) {
    var date = Utilities.formatDate(new Date(rangeStart.getTime() + i * 86400000 + 12 * 3600000), tz, 'yyyy-MM-dd');
    if (blocked[date]) continue;
    var dow = +Utilities.formatDate(wallClock_(date, 720), tz, 'u') % 7;   // 'u': 1=Mon…7=Sun → 0=Sun
    if (CONFIG.WORK_DAYS.indexOf(dow) < 0) continue;

    var free = [];
    for (var m = dayStart; m + CONFIG.MEETING_MINUTES <= dayEnd; m += CONFIG.SLOT_STEP_MINUTES) {
      var s = wallClock_(date, m).getTime(), e = s + len;
      if (s < earliest) continue;
      var clash = busy.some(function (b) { return s < b.end + buf && e > b.start - buf; });
      if (!clash) free.push(m);
    }
    if (free.length) out[date] = free;
  }
  return out;
}

function getBusy_(from, to) {
  var ids = CONFIG.CHECK_BUSY_CALENDARS.slice();
  if (ids.indexOf(CONFIG.CALENDAR_ID) < 0) ids.push(CONFIG.CALENDAR_ID);
  if (!hasCalendarApi_()) return getBusyFallback_(ids, from, to);
  var res = Calendar.Freebusy.query({
    timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: CONFIG.TIMEZONE,
    items: ids.map(function (id) { return { id: id }; })
  });
  var busy = [];
  Object.keys(res.calendars || {}).forEach(function (id) {
    var c = res.calendars[id];
    if (c.errors && c.errors.length) throw new Error('Cannot read free/busy for ' + id + ': ' + JSON.stringify(c.errors));
    (c.busy || []).forEach(function (b) { busy.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }); });
  });
  return busy;
}

// CalendarApp version of free/busy: timed events count as busy unless marked "Free" or declined;
// all-day events count only when marked "Busy" (Google's default for all-day events is "Free").
function getBusyFallback_(ids, from, to) {
  var busy = [];
  ids.forEach(function (id) {
    calendar_(id).getEvents(from, to).forEach(function (ev) {
      var transparency = '';
      try { transparency = String(ev.getTransparency()); } catch (e) {}
      if (transparency === 'TRANSPARENT') return;
      if (ev.isAllDayEvent() && transparency !== 'OPAQUE') return;
      try { if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; } catch (e) {}
      busy.push({ start: ev.getStartTime().getTime(), end: ev.getEndTime().getTime() });
    });
  });
  return busy;
}

function calendar_(id) {
  var cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
  if (!cal) throw new Error('Cannot open calendar ' + id + '. Share it with this account or subscribe to it first.');
  return cal;
}

function hasCalendarApi_() {
  return typeof Calendar !== 'undefined' && !!Calendar.Events && !!Calendar.Freebusy;
}

function getHolidays_(from, to) {
  var out = {};
  if (!CONFIG.HOLIDAY_CALENDAR_ID) return out;
  var cal = CalendarApp.getCalendarById(CONFIG.HOLIDAY_CALENDAR_ID);
  if (!cal) { console.warn('Holiday calendar not found: ' + CONFIG.HOLIDAY_CALENDAR_ID); return out; }
  cal.getEvents(from, to).forEach(function (ev) {
    if (!ev.isAllDayEvent()) return;
    for (var d = ev.getAllDayStartDate().getTime(); d < ev.getAllDayEndDate().getTime(); d += 86400000) {
      out[Utilities.formatDate(new Date(d + 12 * 3600000), CONFIG.TIMEZONE, 'yyyy-MM-dd')] = true;
    }
  });
  return out;
}

/* ============================== HELPERS ============================== */

function cleanLead_(b) {
  function s(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
  var lead = {
    name: s(b.name), company: s(b.company), email: s(b.email), phone: s(b.phone, 40), country: s(b.country, 60),
    visitorTZ: s(b.visitorTZ, 60), visitorLocal: s(b.visitorLocal, 80), page: s(b.page, 300)
  };
  if (lead.name.length < 2 || lead.company.length < 2) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return null;
  if (lead.phone.replace(/\D/g, '').length < 6) return null;
  return lead;
}

function notify_(subject, status, lead, extra) {
  var rows = [['Status', status], ['Name', lead.name], ['Company Name', lead.company], ['Work Email', lead.email],
    ['Contact Number', lead.phone], ['Country', lead.country]].concat(extra).concat([
    ['Visitor timezone', lead.visitorTZ], ['Page', lead.page],
    ['Submitted', Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') + ' Dubai']]);
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<h2 style="color:#04331d;margin:0 0 12px">' + esc_(subject) + '</h2><table cellpadding="6" style="border-collapse:collapse">' +
    rows.filter(function (r) { return r[1]; }).map(function (r) {
      var v = /^https?:\/\//.test(r[1]) ? '<a href="' + esc_(r[1]) + '">' + esc_(r[1]) + '</a>' : esc_(r[1]);
      return '<tr><td style="color:#17675b;font-weight:bold;border-bottom:1px solid #e3ece7">' + esc_(r[0]) +
        '</td><td style="border-bottom:1px solid #e3ece7">' + v + '</td></tr>';
    }).join('') + '</table></div>';
  MailApp.sendEmail({ to: CONFIG.NOTIFY_EMAILS, subject: subject, htmlBody: html, replyTo: lead.email, name: 'SLP – Emojot Landing Page' });
}

function log_(status, lead, when, meet) {
  if (!CONFIG.SHEET_ID) return;
  try {
    var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(['Timestamp', 'Status', 'Name', 'Company', 'Email', 'Phone', 'Country', 'Session (Dubai)', 'Meet link', 'Visitor TZ', 'Page']);
    sh.appendRow([new Date(), status, lead.name, lead.company, lead.email, lead.phone, lead.country, when, meet, lead.visitorTZ, lead.page]);
  } catch (err) { console.error('Sheet log failed', err); }
}

// 'yyyy-MM-dd' + minutes (wall-clock in TIMEZONE) → Date
function wallClock_(date, minutes) {
  var h = Math.floor(minutes / 60), m = minutes % 60;
  return Utilities.parseDate(date + ' ' + (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm');
}
function hm_(s) { var p = s.split(':'); return +p[0] * 60 + +p[1]; }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ============================== ADMIN ============================== */

// Run once from the editor (▶ Run → testSetup) to grant permissions and check the setup.
function testSetup() {
  var slots = computeSlots_();
  var days = Object.keys(slots);
  console.log('Calendar OK. ' + days.length + ' bookable days. First: ' + (days[0] || 'none') +
    (days[0] ? ' → ' + slots[days[0]].length + ' free slots' : ''));
  console.log('Notification emails go to: ' + CONFIG.NOTIFY_EMAILS);
  console.log(hasCalendarApi_()
    ? 'Mode: Google Calendar API service ✓ (bookings get a Google Meet link)'
    : 'Mode: CalendarApp fallback (no auto Meet link). Enable "Google Calendar API" under Services, or via appsscript.json, to add Meet links.');
}

// Run from the editor (▶ Run → testEmail) to check the notification email arrives.
function testEmail() {
  notify_('Test notification: Emojot booking popup', 'TEST', {
    name: 'Test User', company: 'Test Company', email: Session.getEffectiveUser().getEmail(),
    phone: '+971 50 123 4567', country: 'United Arab Emirates', visitorTZ: 'Asia/Dubai', page: 'testEmail()'
  }, []);
  console.log('Sent to: ' + CONFIG.NOTIFY_EMAILS + ' (from ' + Session.getEffectiveUser().getEmail() + ')');
  console.log('Remaining email quota today: ' + MailApp.getRemainingDailyQuota());
}
