# Seylan Kiosk – Location registry

A Google Apps Script web app plus a Google Sheet that controls which tablet gets which branch Sensor.

- One APK for every branch. On first launch, staff pick the branch and enter that branch's PIN.
- Each branch can be taken by **1 tablet**. Kollupitiya, Wellawatte and Havelock Town (the "x2" branches) allow **2**.
- With the same APK, a taken branch can't be set up on another tablet.
- A **new APK** with a new `buildId` in `src/config.ts` starts with every branch free again.
- A reinstalled tablet gets its own branch back automatically (it is recognised by its Android ID).
- **One-time PINs:** every branch has one 6-digit PIN per tablet it allows (PIN column of the Locations sheet; x2 branches show two, e.g. `482913, 730561`). A PIN sets up **one** tablet for **that** branch only, ever. It is then replaced with a fresh PIN straight away, and any PIN in the Claims history ("PIN used") never works again, even after a branch is freed or with a new APK. There is no master PIN.
- PINs live only in the sheet and the script, never in the APK. 5 wrong PINs lock that tablet out for 15 minutes.

## Set up (once)

Sign in to the Google account that should own the registry, ideally a shared Emojot account.

1. Go to https://script.google.com → **New project** → name it `Seylan Kiosk Registry`.
2. Replace `Code.gs` with `registry/Code.gs`.
   - Optional: Project Settings → *Show "appsscript.json"* → replace it with `registry/appsscript.json`.
3. Choose **setupRegistry** in the function dropdown → **▶ Run** → allow the permissions.
   - The log prints the link to the new **"Seylan Kiosk Registry"** spreadsheet, with all 63 locations and one-time PINs for each.
4. **Deploy → New deployment → Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy the Web app URL into `registryUrl` in the app's `src/config.ts`.

## The spreadsheet

| Sheet | Columns | Edit it to… |
|---|---|---|
| **Locations** | Location ID, Location, Sensor URL, Max tablets, Active, PIN | Add a branch (new row), change a Sensor link, allow more tablets, stop the service at a branch (untick Active, see below), or change a branch's PINs (type new ones, comma separated, or clear the cell and run `setupRegistry` for fresh ones) |
| **Claims** | Build ID, Location ID, Location, Device ID, Device name, Claimed at, PIN used, Released | See which tablet has which branch. **Tick Released** to reset a tablet (see below). Don't delete rows: they are the PIN history |
| **Builds** | Build ID, Active, First seen | One row per APK build (added automatically). **Untick Active** to retire that whole APK (see below) |
| **Lockouts** | Tablet ID, PIN type, Branch tried, Wrong attempts, Locked until, Last attempt | Tablets that entered wrong PINs. 5 wrong = locked out for 15 minutes. **Delete a row** to let that tablet try again at once |

Changes in the sheet apply immediately; there's no need to redeploy.

Keep the sheet private: it holds the branch PINs. Send each branch only its own current PIN, just before its tablet is set up.

## Stop the service at a branch

1. In **Locations**, **untick Active** on the branch's row.
2. Within 30 seconds (or at once if the app is restarted), that branch's tablets show **"Service unavailable"** instead of the Sensor. They stay set up, and the branch can't be set up on new tablets.
3. To resume, **tick Active** again. The tablets go back to the Sensor on their next check. No PIN or new setup is needed.

A stopped tablet stays stopped even if it restarts without internet.

## Reset a tablet (wrong branch, broken or replaced tablet)

1. In **Claims**, find the tablet's row and **tick Released**.
2. The branch is free again straight away. Set up the right tablet with the branch's current PIN from the Locations sheet.
3. The released tablet goes back to the setup screen on its own: when the app next starts, or within 30 seconds (`claimCheckSeconds` in `src/config.ts`). Restarting the app does it at once.

The used PIN stays in the row, so it can never set up a tablet again.

## Retire a whole APK build

1. In **Builds**, **untick Active** on the build's row (e.g. `seylan-2026-10-v1`).
2. Within 30 seconds (or at once if the app is restarted), every tablet on that APK shows **"This app version is no longer in use"** instead of the Sensor, and that APK can't set up tablets any more.
3. Tick it again to bring the build back.

Only APKs built with this feature react on screen. Older APKs (the first test build) can still no longer set up tablets once retired, but keep showing their Sensor.

## New APK, all branches free again

1. In the app, change `buildId` in `src/config.ts`, e.g. `seylan-2026-10-v1` → `seylan-2026-11-v2`.
2. Build and install the new APK. Every tablet shows the setup screen again, and all branches are free for this build.

Claims from the old build stay in the sheet for the record.

## Updating the script

After editing `Code.gs`, use **Deploy → Manage deployments → ✎ → Version: New version → Deploy**. The URL stays the same.

## Kiosk lock

The app locks the tablet to itself on start (Android lock task mode). Customers can't leave it.

**Staff access:** tap the **bottom-left corner 5 times quickly** → enter the **exit PIN** → **Unlock for 10 min**. A "Kiosk unlocked · Lock now" bar shows while unlocked; the tablet locks itself again after 10 minutes (`kioskRelockMinutes`) or when the app restarts. The menu also shows the branch, build and tablet ID.

The exit PIN is in Apps Script → **Project Settings → Script properties → `EXIT_PIN`** (created by `setupRegistry`; change it there any time). It is checked online, so unlocking needs internet.

### Two lock levels

| | Screen pinning (default) | Full kiosk (device owner) |
|---|---|---|
| Setup | None | Once per tablet, from a laptop (below) |
| First start | Android asks to pin the app once; tap **Got it** | Locks silently |
| Blocked | Home and recent apps. Unpinning needs Back + Recents held together, so turn on **Settings → Security → App pinning → Ask for PIN before unpinning** | Home, recent apps, notifications, status bar, lock screen, power menu |
| After a restart | Open the app again | Opens the kiosk by itself |

The app uses full kiosk automatically on a device-owner tablet, and screen pinning everywhere else.

### Set up full kiosk on a tablet (once)

Device owner can only be set on a tablet **without a Google account** on it, so do this on a new or factory-reset tablet:

1. Factory reset the tablet and finish setup **without adding a Google account** (skip it).
2. Turn on **Developer options** (Settings → About → tap *Build number* 7 times) → **USB debugging**.
3. Install the APK and connect the tablet to a laptop with [Android platform-tools](https://developer.android.com/tools/releases/platform-tools) (`adb`).
4. Run:
   ```
   adb shell dpm set-device-owner com.emojot.seylanbank/expo.modules.kioskmode.KioskAdminReceiver
   ```
   It should print `Success: Device owner set to package ...`.
5. Open the app and set up the branch. Turn USB debugging off again.

To take a tablet out of full kiosk for good, factory reset it. For many tablets, an MDM (Android Enterprise, Scalefusion, Hexnode, …) can do the device-owner step and install APK updates remotely.
