/**
 * Runs inside every page of the browse view (Seylan's site cannot be changed,
 * but the app can add this script to each page it loads).
 *
 * - Reports customer activity to the app, at most once a second.
 *   Only real input counts: touches, pointer, keys and wheel. Plain "scroll"
 *   is left out because page scripts (carousels, smooth scrolling) fire it
 *   too and would keep the kiosk awake forever.
 * - Turns window.open into a normal navigation, so nothing opens a new window.
 */
export const ACTIVITY_SCRIPT = `
(function () {
  if (window.__seylanKiosk) return;
  window.__seylanKiosk = true;

  var last = 0;
  function ping() {
    var now = Date.now();
    if (now - last < 1000) return;
    last = now;
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'activity' }));
    }
  }

  ['touchstart', 'pointerdown', 'keydown', 'wheel'].forEach(function (name) {
    document.addEventListener(name, ping, { capture: true, passive: true });
  });

  window.open = function (url) {
    if (url) window.location.href = String(url);
    return null;
  };
})();
true;
`;

export type WebMessage = { type: 'activity' };

export function parseMessage(data: string): WebMessage | null {
  try {
    const parsed = JSON.parse(data);
    return parsed && parsed.type === 'activity' ? parsed : null;
  } catch {
    return null;
  }
}
