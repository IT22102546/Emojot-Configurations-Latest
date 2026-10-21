/**
 * Kiosk settings. Change these per deployment; no other file needs editing.
 */
export const config = {
  /**
   * The Emojot Sensor the tablet shows. Leave empty to use the built-in demo
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
   * 10 while testing; set the final value once agreed with the bank.
   */
  idleSeconds: 10,

  /** Seconds the warning counts down before returning to the Sensor. */
  warningSeconds: 15,

  /**
   * After a timeout, reload the Sensor so the next customer starts fresh.
   * "Back to Sensor" keeps the Sensor as the customer left it.
   */
  reloadSensorOnTimeout: true,
};
