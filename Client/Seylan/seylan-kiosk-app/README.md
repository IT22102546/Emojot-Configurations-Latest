# Seylan Bank Kiosk (Emojot)

Android kiosk app for Seylan Bank branches:

1. The Emojot **Sensor** loads.
2. A glowing **View products** button floats over the Sensor. Tapping it (or the Sensor's own "Browse the
   Product" link) opens Seylan's website inside a controlled in-app browser. Nothing opens it automatically.
3. If nobody touches Seylan's site for `idleSeconds`, an **"Are you still there?"** card appears: the
   animated Emojot bot inside a neon countdown ring, with "Continue browsing" and "Return to start".
   Tapping anywhere keeps browsing.
4. If there is still no touch, the app returns to the Sensor and clears the browsing session for the
   next customer.

Expo SDK 58 · React Native 0.88 · TypeScript · EAS project `seylan-bank` (sanjananimeshemojots-team)

## Run it in Expo Go

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** on an Android tablet or phone (same Wi-Fi as the computer).
Set `sensorUrl` to `''` to use a built-in demo Sensor instead of the real one.

The idle time is 10 seconds while testing; set the final value in `src/config.ts`.

## Branch setup (one APK for all branches)

With `registryUrl` set in `src/config.ts`, the first launch shows a **Set up this tablet** screen: staff pick
the branch from the 63 Seylan locations and enter the admin PIN. The registry (`registry/`, a Google Apps
Script + Sheet) makes sure each branch is used by only its allowed number of tablets for this APK build
(2 for Kollupitiya, Wellawatte and Havelock Town, 1 for the rest). The choice is saved on the tablet, which
then always opens that branch's Sensor. A new APK with a new `buildId` frees every branch again.
See `registry/README.md` for the one-time setup.

## Settings: `src/config.ts`

| Setting | Default | Meaning |
|---|---|---|
| `registryUrl` | `''` | Location registry web app URL; empty = no setup screen, use `sensorUrl` |
| `buildId` | `seylan-2026-10-v1` | This APK's ID in the registry; change it for a new APK that frees all branches |
| `sensorUrl` | `https://emo.run/Seylankandanatab` | Sensor used when there is no registry (`''` = built-in demo) |
| `sensorDomains` | `emo.run`, `emojot.com` | Domains the Sensor may load |
| `browseStartUrl` / `browseDomains` | `https://www.seylan.lk/` / `seylan.lk` | Links to these open in the browse view; nothing else can load there |
| `idleSeconds` | 10 (testing) | Time without a touch on Seylan's site before "Are you still there?" |
| `warningSeconds` | 15 | Countdown on "Are you still there?" before returning |
| `reloadSensorOnTimeout` | true | After a timeout, reload the Sensor for the next customer |

## How it works

| File | Role |
|---|---|
| `src/store/kioskStore.ts` | Zustand store: which screen is showing, the browse page, and the session counters that reset each customer |
| `src/components/KioskScreen.tsx` | Journey: Sensor and browse idle timers, warning, Android back button |
| `src/components/SensorView.tsx` | Sensor WebView; catches links to Seylan (including new-tab links) |
| `src/components/BrowseView.tsx` | Private WebView for Seylan: allowlist, PDF block, new tabs kept in place, activity reporting |
| `src/lib/injected.ts` | Script added to each Seylan page: reports touches/keys, turns `window.open` into normal navigation |
| `src/hooks/useIdleTimer.ts` | Idle → countdown → timeout on Seylan's site |
| `src/components/ViewProductsButton.tsx` | "View products" button over the Sensor, in Seylan red like the Sensor's own buttons (position: `viewProductsOffset`) |
| `src/components/StillThereCard.tsx` | "Are you still there?" card: animated Emojot bot in an SVG countdown ring |
| `src/components/SeylanButton.tsx` / `icons.tsx` | Seylan-red button used for "View products" and "Back to Sensor"; bank, home and arrow icons |
| `src/components/LoadingScreen.tsx` | Seylan Bank loading screen: Seylan logo in a spinning Seylan-red ring on white, "Powered by emojot" |
| `src/theme.ts` | Emojot colours from emojot.com and the Inter typeface |

- Each customer gets a fresh **incognito** browse view (new React key), so cookies, cache and form
  data never carry over.
- Only touches, pointer, keys and wheel count as activity. Page scroll events are ignored because
  site scripts fire them too.
- The Android back button steps back inside Seylan's site, then returns to the Sensor; it never
  closes the app.

## Expo Go vs. installed app

Everything above runs in Expo Go. For the tablets, build an APK with EAS:

```bash
npx eas-cli@latest build -p android --profile preview
```

Full kiosk lock (customers cannot leave the app) comes from the bank's MDM single-app mode, or
Android screen pinning. It is not part of Expo Go.

## Checks

```bash
npx tsc --noEmit      # typecheck
npx expo lint         # lint
npx expo-doctor       # dependency/config check
```
