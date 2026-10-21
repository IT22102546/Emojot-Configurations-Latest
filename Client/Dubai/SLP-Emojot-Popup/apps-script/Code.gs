/**
 * SLP – Emojot | Booking backend for the "Register interest" popup
 * ----------------------------------------------------------------
 * Runs as a Google Apps Script web app on slp@emojot.com (mail to that inbox is routed to leads@emojot.com).
 *
 *   GET  ?action=slots      → 30-min slots for the next N days where at least one team member is free
 *   POST {action:'lead'}    → step 1 done: email NOTIFY_EMAILS (+ optional Sheet log)
 *   POST {action:'book'}    → re-checks the slot, assigns a free team member (round-robin),
 *                             creates the Calendar event with a Google Meet link, invites the customer
 *                             + assigned member, emails the assigned member (+ copy to NOTIFY_EMAILS)
 *
 * Team = members of TEAM_GROUP (Google Group). Each member's own Google Calendar free/busy is checked.
 * Bookings are stored in a separate calendar ("SLP – Emojot Sessions") in the script owner's account,
 * so a session assigned to one person never blocks the others.
 *
 * Requires the "Google Calendar API" advanced service (Services + → Google Calendar API, or appsscript.json).
 */

var CONFIG = {
  // Google Group whose members take the sessions (round-robin among whoever is free)
  TEAM_GROUP: 'leads@emojot.com',
  // Members of leads@emojot.com, listed here because slp@ can't read the group's member list.
  // When this list is filled, TEAM_GROUP is ignored; empty it to use the group again.
  TEAM_MEMBERS: [
    'andun@emojot.com', 'aqeelg@emojot.com', 'asharyap@emojot.com', 'dewminil@emojot.com',
    'dewshik@emojot.com', 'dilushik@emojot.com', 'dinithiw@emojot.com', 'dulainj@emojot.com',
    'gimhaniw@emojot.com', 'glenp@emojot.com', 'imasham@emojot.com', 'manura@emojot.com',
    'methasae@emojot.com', 'onels@emojot.com', 'ravindu@emojot.com', 'salmanf@emojot.com',
    'sampath@emojot.com', 'sanjanan@emojot.com', 'selinikm@emojot.com', 'shahani@emojot.com',
    'shaveenf@emojot.com', 'sinaliw@emojot.com', 'sunandid@emojot.com', 'thamindug@emojot.com',
    'viraj@emojot.com'
  ],
  // Everyone takes turns; these people get PRIORITY_WEIGHT turns per round instead of one
  PRIORITY_MEMBERS: ['viraj@emojot.com'],
  PRIORITY_WEIGHT: 2,
  // Used only if the group can't be read (e.g. permission not granted yet)
  TEAM_FALLBACK: [],
  EXCLUDE_MEMBERS: ['slp@emojot.com'],   // group members who should NOT get sessions

  // Gets every "New registration" email + a copy of every booking (comma separated).
  // Send straight to the group, not to slp@: mail the script sends to its own account lands in Sent, not the inbox.
  NOTIFY_EMAILS: 'leads@emojot.com',
  CC_NOTIFY_ON_BOOKING: true,

  // Extra people added as guests to every session (on top of the assigned member)
  TEAM_GUESTS: [],

  // Calendar created automatically in the script owner's account to hold all sessions
  BOOKING_CALENDAR_NAME: 'SLP – Emojot Sessions',

  // Optional: Google Sheet ID to log every registration + booking (leave '' to skip)
  SHEET_ID: '',

  // Availability rules (all in TIMEZONE)
  TIMEZONE: 'Asia/Dubai',
  WORK_DAYS: [1, 2, 3, 4, 5],        // 0=Sun … 6=Sat
  DAY_START: '10:00',
  DAY_END: '17:00',                  // last slot ends at DAY_END
  MEETING_MINUTES: 30,
  SLOT_STEP_MINUTES: 30,
  BUFFER_MINUTES: 0,                 // free gap required before/after a member's other meetings
  MIN_NOTICE_HOURS: 18,
  MAX_DAYS_AHEAD: 30,
  BLOCKED_DATES: [],                 // ['2026-12-02', '2026-12-03']

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

  sendMail_(CONFIG.NOTIFY_EMAILS, '', 'New registration: ' + lead.company + ' (session pending)',
    'REGISTERED, session not booked yet', lead, []);
  log_('Registered', lead, '', '', '');
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
    // Re-check against everyone's live calendars inside the lock → no double bookings
    var range = range_();
    var avail = availability_(range.start, range.end);
    var slots = computeSlots_(avail);
    if (!slots[date] || slots[date].indexOf(minutes) < 0) {
      CacheService.getScriptCache().remove('slots');
      return { ok: false, error: 'taken' };
    }

    var start = wallClock_(date, minutes);
    var end = new Date(start.getTime() + CONFIG.MEETING_MINUTES * 60000);
    var pick = pickRoundRobin_(avail.members, freeMembersAt_(avail, start.getTime(), end.getTime()));
    if (!pick) return { ok: false, error: 'taken' };
    var assignee = pick.member;

    var when = Utilities.formatDate(start, CONFIG.TIMEZONE, "EEEE, d MMMM yyyy 'at' h:mm a") + ' GST (Dubai time)';
    var guests = [{ email: lead.email, displayName: lead.name }, { email: assignee }]
      .concat(CONFIG.TEAM_GUESTS.map(function (g) { return { email: g }; }));

    var resource = {
      summary: CONFIG.MEETING_TITLE + ': ' + lead.company,
      description: [
        'Online introductory session with the Emojot team.',
        '',
        'Name: ' + lead.name,
        'Company: ' + lead.company,
        'Email: ' + lead.email,
        'Phone: ' + lead.phone + (lead.country ? ' (' + lead.country + ')' : ''),
        'Emojot host: ' + assignee
      ].join('\n'),
      start: { dateTime: start.toISOString(), timeZone: CONFIG.TIMEZONE },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.TIMEZONE },
      attendees: guests,
      guestsCanModify: false,
      visibility: 'private',             // only the guests (customer + assigned member) see the details
      reminders: { useDefault: true },
      extendedProperties: { private: { assignee: assignee, source: 'slp-popup' } }
    };
    if (CONFIG.ADD_GOOGLE_MEET) {
      resource.conferenceData = { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } };
    }

    // sendUpdates:'all' → Google emails the calendar invite (with Meet link) to the customer + assigned member
    var ev = Calendar.Events.insert(resource, bookingCalendarId_(), { conferenceDataVersion: 1, sendUpdates: 'all' });
    PropertiesService.getScriptProperties().setProperty('RR_POS', String(pick.pos));
    CacheService.getScriptCache().remove('slots');

    var meet = ev.hangoutLink || '';
    if (!meet && ev.conferenceData && ev.conferenceData.entryPoints) {
      ev.conferenceData.entryPoints.forEach(function (p) { if (p.entryPointType === 'video') meet = p.uri; });
    }

    var cc = CONFIG.CC_NOTIFY_ON_BOOKING ? CONFIG.NOTIFY_EMAILS : '';
    sendMail_(assignee, cc, 'New session assigned to you: ' + lead.company + ', ' + when, 'SESSION BOOKED', lead, [
      ['Assigned to', assignee],
      ['Session', when],
      ['Google Meet', meet]
    ]);
    log_('Booked', lead, when, meet, assignee);

    return { ok: true, start: start.toISOString(), end: end.toISOString(), meetLink: meet };
  } finally {
    lock.releaseLock();
  }
}

// Turn order for one round: everyone once (alphabetical), priority members PRIORITY_WEIGHT times,
// spread evenly through the round. e.g. weight 2 → [others… , viraj, others… , viraj]
function rotation_(members) {
  var priority = CONFIG.PRIORITY_MEMBERS.map(function (e) { return e.toLowerCase(); })
    .filter(function (m) { return members.indexOf(m) >= 0; });
  var others = members.filter(function (m) { return priority.indexOf(m) < 0; });
  var w = Math.max(1, CONFIG.PRIORITY_WEIGHT || 1), seq = [];
  for (var k = 0; k < w; k++) {
    seq = seq.concat(others.slice(Math.round(k * others.length / w), Math.round((k + 1) * others.length / w)), priority);
  }
  return seq;
}

// Next turn after the last one that is free at that time → { member, pos }
function pickRoundRobin_(members, free) {
  if (!free.length) return null;
  var seq = rotation_(members);
  var last = parseInt(PropertiesService.getScriptProperties().getProperty('RR_POS'), 10);
  var startIdx = isNaN(last) ? 0 : last + 1;
  for (var i = 0; i < seq.length; i++) {
    var pos = (startIdx + i) % seq.length;
    if (free.indexOf(seq[pos]) >= 0) return { member: seq[pos], pos: pos };
  }
  return null;
}

/* ============================== AVAILABILITY ============================== */

function getSlotsCached_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('slots');
  if (hit) return JSON.parse(hit);
  var r = range_();
  var slots = computeSlots_(availability_(r.start, r.end));
  cache.put('slots', JSON.stringify(slots), 60);   // 60s cache; cleared on every booking
  return slots;
}

function range_() {
  var firstDay = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  var start = wallClock_(firstDay, 0);
  return { firstDay: firstDay, start: start, end: new Date(start.getTime() + (CONFIG.MAX_DAYS_AHEAD + 2) * 86400000) };
}

// → { '2026-10-12': [600, 630, …] }   slots where at least one member is free (minutes, TIMEZONE wall-clock)
function computeSlots_(avail) {
  var tz = CONFIG.TIMEZONE, r = range_();
  var earliest = Date.now() + CONFIG.MIN_NOTICE_HOURS * 3600000;
  var blocked = {};
  CONFIG.BLOCKED_DATES.forEach(function (d) { blocked[d] = true; });
  var len = CONFIG.MEETING_MINUTES * 60000, dayStart = hm_(CONFIG.DAY_START), dayEnd = hm_(CONFIG.DAY_END);
  var out = {};

  for (var i = 0; i <= CONFIG.MAX_DAYS_AHEAD; i++) {
    var date = Utilities.formatDate(new Date(r.start.getTime() + i * 86400000 + 12 * 3600000), tz, 'yyyy-MM-dd');
    if (blocked[date]) continue;
    var dow = +Utilities.formatDate(wallClock_(date, 720), tz, 'u') % 7;   // 'u': 1=Mon…7=Sun → 0=Sun
    if (CONFIG.WORK_DAYS.indexOf(dow) < 0) continue;

    var free = [];
    for (var m = dayStart; m + CONFIG.MEETING_MINUTES <= dayEnd; m += CONFIG.SLOT_STEP_MINUTES) {
      var s = wallClock_(date, m).getTime();
      if (s < earliest) continue;
      if (freeMembersAt_(avail, s, s + len).length) free.push(m);
    }
    if (free.length) out[date] = free;
  }
  return out;
}

function freeMembersAt_(avail, s, e) {
  var buf = CONFIG.BUFFER_MINUTES * 60000;
  return avail.members.filter(function (m) {
    return !avail.busy[m].some(function (b) { return s < b.end + buf && e > b.start - buf; });
  });
}

// Busy times per member = their own calendar free/busy + sessions already assigned to them
function availability_(from, to) {
  var members = teamMembers_(), busy = {}, ok = [];
  members.forEach(function (m) { busy[m] = []; });

  // Free/busy accepts at most 20 calendars per request, so ask in batches
  for (var i = 0; i < members.length; i += 15) {
    var res = Calendar.Freebusy.query({
      timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: CONFIG.TIMEZONE,
      items: members.slice(i, i + 15).map(function (m) { return { id: m }; })
    });
    Object.keys(res.calendars || {}).forEach(function (id) {
      var key = id.toLowerCase(), c = res.calendars[id];
      if (!busy[key]) return;
      if (c.errors && c.errors.length) { console.warn('Skipping ' + id + ' (calendar not visible): ' + JSON.stringify(c.errors)); return; }
      ok.push(key);
      (c.busy || []).forEach(function (b) { busy[key].push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }); });
    });
  }

  var items = Calendar.Events.list(bookingCalendarId_(), {
    timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: true, maxResults: 2500
  }).items || [];
  items.forEach(function (ev) {
    var a = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.assignee;
    if (!a || !busy[a] || ev.status === 'cancelled' || !ev.start.dateTime) return;
    busy[a].push({ start: new Date(ev.start.dateTime).getTime(), end: new Date(ev.end.dateTime).getTime() });
  });

  ok.sort();
  return { members: ok, busy: busy };
}

function teamMembers_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('team');
  if (hit) return JSON.parse(hit);
  var list = CONFIG.TEAM_MEMBERS.length ? CONFIG.TEAM_MEMBERS : (function () {
    try {
      return GroupsApp.getGroupByEmail(CONFIG.TEAM_GROUP).getUsers().map(function (u) { return u.getEmail(); });
    } catch (err) {
      if (CONFIG.TEAM_FALLBACK.length) {
        console.warn('Cannot read ' + CONFIG.TEAM_GROUP + ', using TEAM_FALLBACK. Run testSetup to grant access. (' + err + ')');
        return CONFIG.TEAM_FALLBACK;
      }
      throw new Error('Cannot read members of ' + CONFIG.TEAM_GROUP + '. Run testSetup to grant access, ' +
        'or list the emails in CONFIG.TEAM_MEMBERS. (' + err + ')');
    }
  })();
  var exclude = CONFIG.EXCLUDE_MEMBERS.map(function (e) { return e.toLowerCase(); });
  var seen = {};
  list = list.map(function (e) { return String(e).trim().toLowerCase(); })
    .filter(function (e) { if (!e || seen[e] || exclude.indexOf(e) >= 0) return false; seen[e] = true; return true; })
    .sort();
  if (!list.length) throw new Error('No team members found for ' + CONFIG.TEAM_GROUP);
  cache.put('team', JSON.stringify(list), 600);   // 10 min
  return list;
}

// Separate calendar (in the script owner's account) that holds all sessions; created on first use
function bookingCalendarId_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('BOOKING_CAL_ID');
  if (id && CalendarApp.getCalendarById(id)) return id;
  var existing = CalendarApp.getOwnedCalendarsByName(CONFIG.BOOKING_CALENDAR_NAME);
  var cal = existing.length ? existing[0] : CalendarApp.createCalendar(CONFIG.BOOKING_CALENDAR_NAME, { timeZone: CONFIG.TIMEZONE });
  props.setProperty('BOOKING_CAL_ID', cal.getId());
  if (!existing.length) unshareCalendar_(cal.getId());
  return cal.getId();
}

// Who besides the owner can see the sessions calendar (domain, groups, people, public)
function sharingRules_(calId) {
  var me = Session.getEffectiveUser().getEmail().toLowerCase();
  return (Calendar.Acl.list(calId).items || []).filter(function (r) {
    return !(r.scope.type === 'user' && String(r.scope.value).toLowerCase() === me);
  });
}

function unshareCalendar_(calId) {
  return sharingRules_(calId).map(function (r) {
    Calendar.Acl.remove(calId, r.id);
    return r.scope.type + (r.scope.value ? ' ' + r.scope.value : '') + ' (' + r.role + ')';
  });
}

/* ============================== HELPERS ============================== */

function cleanLead_(b) {
  function s(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 200); }
  var lead = {
    name: s(b.name), company: s(b.company), email: s(b.email), phone: s(b.phone, 40), country: s(b.country, 60),
    visitorTZ: s(b.visitorTZ, 60), page: s(b.page, 300)
  };
  if (lead.name.length < 2 || lead.company.length < 2) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email)) return null;
  if (lead.phone.replace(/\D/g, '').length < 6) return null;
  return lead;
}

function sendMail_(to, cc, subject, status, lead, extra) {
  var rows = [['Status', status]].concat(extra).concat([
    ['Name', lead.name], ['Company Name', lead.company], ['Work Email', lead.email],
    ['Contact Number', lead.phone], ['Country', lead.country], ['Page', lead.page],
    ['Submitted', Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm') + ' GST']]);
  var html = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222">' +
    '<h2 style="color:#04331d;margin:0 0 12px">' + esc_(subject) + '</h2><table cellpadding="6" style="border-collapse:collapse">' +
    rows.filter(function (r) { return r[1]; }).map(function (r) {
      var v = /^https?:\/\//.test(r[1]) ? '<a href="' + esc_(r[1]) + '">' + esc_(r[1]) + '</a>' : esc_(r[1]);
      return '<tr><td style="color:#17675b;font-weight:bold;border-bottom:1px solid #e3ece7">' + esc_(r[0]) +
        '</td><td style="border-bottom:1px solid #e3ece7">' + v + '</td></tr>';
    }).join('') + '</table></div>';
  var opts = { to: to, subject: subject, htmlBody: html, replyTo: lead.email, name: 'SLP – Emojot Bookings' };
  if (cc && cc.toLowerCase() !== to.toLowerCase()) opts.cc = cc;
  MailApp.sendEmail(opts);
}

function log_(status, lead, when, meet, assignee) {
  if (!CONFIG.SHEET_ID) return;
  try {
    var sh = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheets()[0];
    if (sh.getLastRow() === 0) sh.appendRow(['Timestamp', 'Status', 'Name', 'Company', 'Email', 'Phone', 'Country', 'Session (GST)', 'Assigned to', 'Meet link', 'Page']);
    sh.appendRow([new Date(), status, lead.name, lead.company, lead.email, lead.phone, lead.country, when, assignee, meet, lead.page]);
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
  CacheService.getScriptCache().removeAll(['team', 'slots']);
  var members = teamMembers_();
  console.log('Team (' + members.length + '): ' + members.join(', '));
  console.log('Priority (' + CONFIG.PRIORITY_WEIGHT + ' turns per round): ' + (CONFIG.PRIORITY_MEMBERS.join(', ') || 'none'));
  var r = range_(), avail = availability_(r.start, r.end);
  var skipped = members.filter(function (m) { return avail.members.indexOf(m) < 0; });
  console.log('Calendars readable: ' + avail.members.length + (skipped.length ? ' | NOT readable (skipped): ' + skipped.join(', ') : ''));
  var slots = computeSlots_(avail), days = Object.keys(slots);
  console.log(days.length + ' bookable days. First: ' + (days[0] || 'none') + (days[0] ? ' → ' + slots[days[0]].length + ' slots' : ''));
  console.log('Sessions calendar: ' + CONFIG.BOOKING_CALENDAR_NAME + ' (' + bookingCalendarId_() + ')');
  console.log('Turn order: ' + rotation_(avail.members).join(' → '));
  console.log('Last turn position: ' + (PropertiesService.getScriptProperties().getProperty('RR_POS') || '(none yet)'));
  console.log('Registration emails + booking copies go to: ' + CONFIG.NOTIFY_EMAILS);
}

// Run from the editor (▶ Run → testEmail) to check the notification email arrives.
function testEmail() {
  sendMail_(CONFIG.NOTIFY_EMAILS, '', 'Test notification: SLP – Emojot Bookings', 'TEST', {
    name: 'Test User', company: 'Test Company', email: Session.getEffectiveUser().getEmail(),
    phone: '+971 50 123 4567', country: 'United Arab Emirates', page: 'testEmail()'
  }, []);
  console.log('Sent to: ' + CONFIG.NOTIFY_EMAILS + ' (from ' + Session.getEffectiveUser().getEmail() + ')');
  console.log('Remaining email quota today: ' + MailApp.getRemainingDailyQuota());
}

// Run from the editor: shows who can see the "SLP – Emojot Sessions" calendar besides this account.
function checkSessionsCalendarSharing() {
  var id = bookingCalendarId_(), rules = sharingRules_(id);
  console.log(CONFIG.BOOKING_CALENDAR_NAME + ' (' + id + ')');
  console.log(rules.length ? 'Shared with: ' + rules.map(function (r) {
    return r.scope.type + (r.scope.value ? ' ' + r.scope.value : '') + ' (' + r.role + ')';
  }).join(', ') : 'Not shared with anyone. Only this account can see it.');
}

// Run from the editor: removes all sharing from the sessions calendar, so sessions only appear
// for the people invited to them (customer + assigned member).
function makeSessionsCalendarPrivate() {
  var removed = unshareCalendar_(bookingCalendarId_());
  console.log(removed.length ? 'Removed sharing: ' + removed.join(', ') : 'Nothing to remove. It was already private.');
}
