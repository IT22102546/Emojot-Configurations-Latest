/**
 * Kiosk settings. Change these per deployment; no other file needs editing.
 */
export const config = {
  /**
   * Location registry (registry/Code.gs deployed as a web app). When set, each
   * tablet is set up once for one branch (one-time branch PIN, checked by the registry),
   * and no other tablet can take that branch with this APK.
   * Leave empty to skip setup and always use sensorUrl below.
   */
  registryUrl: 'https://script.google.com/macros/s/AKfycbzi_ALiYvn-uh-o_sIlLKw2RDBg-XjRYMxJGQlUjP4sgd6q-UTYaEAiXlhKDNqstAm2sA/exec',

  /**
   * Identifies this APK in the registry. Change it for each new APK that should
   * start with every location free again (e.g. 'seylan-2026-11-v2').
   */
  buildId: 'seylan-2026-10-v2',
  /**
   * How often (seconds) a set-up tablet checks the registry. If its claim was
   * released in the sheet, it goes back to the setup screen; if its branch's
   * service was stopped (Active unticked), it shows "Service unavailable".
   */
  claimCheckSeconds: 30,

  /**
   * Lock the tablet to this app (Android lock task mode). Staff open the admin
   * menu with 5 quick taps in the bottom-left corner and the exit PIN
   * (EXIT_PIN in the registry). See README › Kiosk lock.
   */
  kioskLock: true,

  /** Minutes an unlocked tablet stays unlocked before it locks itself again. */
  kioskRelockMinutes: 10,

  /**
   * Sensor used when registryUrl is empty. Leave empty to use the built-in demo
   * Sensor (src/lib/demoSensor.ts), which is handy for testing in Expo Go.
   */
  sensorUrl: 'https://emo.run/Seylankandanatab',

  /**
   * Domains the Sensor may load. The emo.run short link redirects to
   * emojot.com/seylancsatupdated and then emojot.com/emojot_mobile/mobile.jsp.
   */
  sensorDomains: ['emo.run', 'emojot.com'],

  /**
   * Seylan's site. Links from the Sensor to browseDomains open in the browse
   * view, and nothing outside browseDomains can load there.
   */
  browseStartUrl: 'https://www.seylan.lk/',
  browseDomains: ['seylan.lk'],

  /**
   * Where the "View products" button sits over the Sensor (from the bottom-right
   * corner). Bottom clears the Sensor's "Powered by Emojot" footer.
   */
  viewProductsOffset: { right: 20, bottom: 92 },

  /**
   * Seconds without a touch on Seylan's site before "Are you still there?".
   */
  idleSeconds: 60,

  /** Seconds the warning counts down before returning to the Sensor. */
  warningSeconds: 15,

  /**
   * After a timeout, reload the Sensor so the next customer starts fresh.
   * "Back to Sensor" keeps the Sensor as the customer left it.
   */
  reloadSensorOnTimeout: true,
};
