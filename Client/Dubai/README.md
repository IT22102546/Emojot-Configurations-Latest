# SLP – Emojot: "Register interest" popup with session booking

`emojot-register-popup.html` is a single snippet. It turns every **Register interest** button on the Wix landing page into a 3-step popup:

1. **Your details**: Name, Company Name, Work Email, Contact Number.
2. **Book session**: the visitor picks a date and a 30-min slot (Dubai time, with their local time shown underneath). This step comes straight after step 1, so the visitor books in the same flow.
3. **Confirmed**: a summary, plus *Add to Google Calendar* and an *.ics* download.

If someone tries to close the popup on step 2, a "You're one step away" prompt asks them to book first. If they leave anyway and click Register interest again, the popup reopens on step 2 with their details already filled in.

## Emails you receive

| When | Subject |
|---|---|
| After step 1 | `New registration: <Company> (session pending)` |
| After booking | `Session booked: <Company>, <date & time>` |

You get the step-1 email even if the visitor never books, so you can follow up. Set `EMAIL_ON_REGISTER: false` to receive only the booking email.

## Setup

### 1. Get an email key (free, about 2 minutes)
1. Go to https://web3forms.com, enter the inbox that should receive the leads (e.g. the sales inbox), and get the **Access Key**.
2. In `emojot-register-popup.html`, set `WEB3FORMS_KEY: '<your key>'`.

Until a key is set, the popup runs in **test mode**: the flow works, but nothing is sent. The data is printed in the browser console.

### 2. Add it to the Wix site
Custom Code needs a Wix **Premium plan with a connected domain**.

1. Wix dashboard → **Settings → Custom Code** (under *Development & integrations*) → **+ Add Custom Code**.
2. Paste the full contents of `emojot-register-popup.html`.
3. Name it `Emojot Register Popup`.
4. **Add Code to Pages:** choose *Choose specific pages* and select the landing page.
5. **Place Code in:** *Body - end*.
6. Click **Apply**, then **Publish** the site.

You don't need to change the existing buttons. The script finds any button or link whose text is "Register interest", including the hero button's "Register insterest" typo. It also opens for:
- any link pointing to `#register`, and
- the page URL `…/your-page#register`, which opens the popup on load (handy for emails and campaigns).

> If the site is on a plan without Custom Code: create a **Lightbox**, add **Embed Code → Embed HTML** to it, paste the same snippet, and link the Register interest buttons to that Lightbox. Inside an iframe the snippet detects this automatically and shows the form inline.

## Config (top of the `<script>`)

| Setting | Default | Meaning |
|---|---|---|
| `WORK_DAYS` | Mon–Fri | UAE weekend is Sat/Sun |
| `DAY_START` / `DAY_END` | 10:00 / 17:00 | Dubai time |
| `MEETING_MINUTES`, `SLOT_STEP_MINUTES` | 30 / 30 | |
| `MIN_NOTICE_HOURS` | 18 | Earliest bookable time from now |
| `MAX_DAYS_AHEAD` | 30 | |
| `BLOCKED_DATES` | `[]` | e.g. public holidays: `['2026-12-02','2026-12-03']` |
| `BLOCK_FREE_EMAIL` | `false` | `true` rejects gmail/yahoo/hotmail… |
| `LOGO_URL` | `''` | Optional white logo for the dark header |

## Google Calendar booking (Apps Script): live availability

Do this once, signed in as the Emojot Google Workspace account whose calendar should take the bookings.

With `BOOKING_API_URL` set, the popup:
- shows only slots that are **actually free** in Google Calendar;
- re-checks the slot at booking time, so two people can never book the same time;
- creates the **Calendar event with a Google Meet link** and emails the invite to the guest and your team;
- emails your team (the step-1 lead and the booking) and can log everything to a Google Sheet.

### 1. Create the script
1. Go to https://script.google.com → **New project**. Name it `Emojot Booking`.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
3. Enable the **Google Calendar API** service (needed for automatic Google Meet links):
   - **Services (+)** → **Google Calendar API** → **Add**, or, if that dialog doesn't open (common when signed into several Google accounts):
   - **Project Settings (⚙)** → tick **Show "appsscript.json" manifest file in editor** → open `appsscript.json` in the editor → replace it with `apps-script/appsscript.json` → Save.
   - If you skip this, the script still works (busy-time check + email invites) but bookings won't get a Meet link.
4. **Project Settings (⚙)** → set **Time zone** to `(GMT+04:00) Dubai`.

### 2. Edit `CONFIG` at the top of `Code.gs`
| Setting | What to put |
|---|---|
| `NOTIFY_EMAILS` | The inbox(es) that get the registration and booking emails |
| `CHECK_BUSY_CALENDARS` | `'primary'` plus the email of each person who takes these calls; their busy time blocks slots |
| `TEAM_GUESTS` | Team members to invite to every session |
| `SHEET_ID` | Optional: the ID from a Google Sheet URL to log all leads and bookings |
| Hours / days / notice | Same meaning as the popup's settings |

### 3. Authorize and test
Choose **testSetup** in the function dropdown → **▶ Run** → allow the permissions.
The log should show something like `Calendar OK. 21 bookable days…`.

### 4. Deploy
**Deploy → New deployment** → type **Web app**:
- Execute as: **Me**
- Who has access: **Anyone**

Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).

> If "Anyone" isn't offered, your Workspace admin has restricted it. Ask them to allow it in Admin console → Apps → Google Workspace → Drive and Docs → Sharing settings.

### 5. Connect the popup
In `emojot-register-popup.html`, set `BOOKING_API_URL: 'https://script.google.com/macros/s/…/exec'`. `WEB3FORMS_KEY` is then not used.
Check it in `preview.html` (run `./build-preview.sh` first), then send the file to the Wix team.

If you later change `Code.gs`, use **Deploy → Manage deployments → Edit (✎) → Version: New version**. This keeps the same URL, so the Wix code doesn't change.

## Notes and limits
- With `BOOKING_API_URL` empty, the popup falls back to fixed rules (no calendar check) and sends emails through Web3Forms.
- Apps Script email quota on Workspace is 1,500 recipients per day, which is plenty for this.
- Colours come from the page itself: dark green `#04331d`, gold CTA `#cfa64b`, teal `#17675b`, heading green `#3c6e35`, mint panel `#eef6f1`, font Mulish.

## Local preview
Double-click `preview.html` and click **Register interest**.
After editing `emojot-register-popup.html`, run `./build-preview.sh` to refresh the preview.

> Opening `emojot-register-popup.html` itself shows a blank page. That's expected: it is only the snippet. Use `preview.html` or the live Wix page.
