# SLP – Emojot: Register Interest & Session Booking

When a visitor clicks **Register interest** on the SLP landing page, a popup opens with three steps:

1. **Details:** Name, Company Name, Work Email, Contact Number (with a country-code picker).
2. **Book a session:** a 30-min slot. A time is shown if at least one member of the team group is free.
3. **Confirmed:** the visitor sees the date, time and the Google Meet link.

**What happens automatically**
- After step 1, we get a "New registration (session pending)" email, so we keep the lead even if they don't book.
- After booking, the session is assigned **round-robin** to the next team member who is free at that time:
  - the assigned member gets a "New session assigned to you" email (copy to the notify address), with the customer details, the time and the Meet link;
  - the visitor **and** the assigned member get a Google Calendar invite with the Meet link;
  - the session is added to the **"SLP – Emojot Sessions"** calendar (created automatically).
- The slot is re-checked when they confirm, so two people can't book the same time.

## Files

| File | What it is |
|---|---|
| `emojot-register-popup.html` | The popup code that goes on the website (Wix → Settings → Custom Code → Body - end, landing page only) |
| `preview.html` | Test page. Double-click it to try the popup locally. **It is live:** bookings create real events and send real emails |
| `apps-script/Code.gs` | Backend (Google Apps Script): checks calendar availability, creates the event and Meet link, sends the emails |
| `apps-script/appsscript.json` | Apps Script settings (Dubai timezone, Google Calendar API, web app access) |

## Hosting on Vercel (Wix loads the popup from there)
`emojot-register-popup.html` is still the file you edit. `build.js` turns it into `vercel/popup.js` and regenerates `preview.html` (the same test page as on Vercel, with the popup built in).

1. After any change: `node build.js`
2. Deploy: `cd vercel && npx vercel deploy --prod`
3. Wix → Settings → Custom Code (landing page only, Body - end) needs just one line, set once:
   `<script src="https://<your-project>.vercel.app/popup.js" defer></script>`

Visitors get changes within about 5 minutes of a deploy, with no re-pasting into Wix. The project's own page (`vercel/index.html`) has a test button, and bookings made there are real.

## Current setup
- The backend runs on **slp@emojot.com** (since 16 Oct 2026). Calendar invites and emails come from that account. Mail sent to slp@ is routed to leads@emojot.com by a Gmail rule.
- Team: the 25 members of **leads@emojot.com**, listed in `TEAM_MEMBERS`. slp@ can't read the group's member list, so **adding or removing someone means editing `TEAM_MEMBERS`** and redeploying a new version.
- Turns rotate through the team. **viraj@emojot.com** gets 2 turns per round (`PRIORITY_MEMBERS`, `PRIORITY_WEIGHT`). Anyone busy at the booked time is skipped.
- Each member's own calendar free/busy is checked, so their meetings block their slots.
- Registration emails, plus a copy of every booking, go to **leads@emojot.com** (`NOTIFY_EMAILS`).
- Availability: Mon–Fri, 10:00–17:00 Dubai time, 30-min slots, at least 18 hours' notice, up to 30 days ahead.
- The old backend on sanjanan@emojot.com should be archived once the new one is confirmed working.

## Changing settings
1. Edit `CONFIG` at the top of `Code.gs` in the Apps Script editor (script.google.com). You can change:
   - who gets the emails;
   - extra team members to invite to every session;
   - working hours and days;
   - blocked dates;
   - an optional Google Sheet log.
2. Save, then go to **Deploy → Manage deployments → ✎ → Version: New version → Deploy**.
   Always use *Manage deployments*. **New deployment** creates a new URL, and then the website code would need updating.

## Moving it to another Google account (e.g. a shared Emojot account)
1. Go to script.google.com → New project. Paste in `Code.gs`, and replace `appsscript.json` with ours. To see that file: Project Settings → *Show "appsscript.json" manifest file*.
2. Run `testSetup` once and allow the permissions. The log lists the team, whose calendars are readable, and the sessions calendar. Optionally run `testEmail` to check the notification email.
3. **Deploy → New deployment → Web app**, with Execute as: *Me* and Who has access: *Anyone*. Copy the URL.
4. Put the URL in `BOOKING_API_URL` in `emojot-register-popup.html` and update the website code.

## Note
If the notification address is the same account that runs the script, Gmail may file the notifications under **Sent** instead of the Inbox. A Gmail filter fixes this.
