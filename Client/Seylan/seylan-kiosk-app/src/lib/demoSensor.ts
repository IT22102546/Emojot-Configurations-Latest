import { config } from '../config';
import { colors } from '../theme';

/**
 * Stand-in Sensor used while config.sensorUrl is empty, so the whole journey
 * can be tested in Expo Go. "Browse the Product" opens in a new tab on purpose:
 * it exercises the same path a real Sensor link with target="_blank" takes.
 */
export const DEMO_SENSOR_HTML = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: radial-gradient(circle at 20% 10%, ${colors.violet}33, transparent 45%),
                radial-gradient(circle at 85% 90%, ${colors.pink}2e, transparent 45%), ${colors.background};
    color: ${colors.text}; font-family: -apple-system, Roboto, "Segoe UI", sans-serif; padding: 24px;
  }
  .card { width: 100%; max-width: 560px; text-align: center; }
  .logo { font-size: 30px; font-weight: 800; letter-spacing: -1px; margin-bottom: 36px; }
  .logo .emo { color: ${colors.blue}; } .logo .jot { color: ${colors.pink}; }
  h1 { font-size: 28px; line-height: 1.25; margin: 0 0 8px; }
  p { color: ${colors.textMuted}; margin: 0 0 28px; }
  .faces { display: flex; justify-content: center; gap: 12px; margin-bottom: 36px; flex-wrap: wrap; }
  .face { width: 64px; height: 64px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.18);
          background: ${colors.surface}; font-size: 30px; line-height: 62px; }
  .face.on { border-color: ${colors.purple}; box-shadow: 0 0 18px ${colors.purple}99; }
  a.browse { display: inline-block; padding: 16px 30px; border-radius: 999px; color: #fff; font-weight: 700;
             text-decoration: none; background: linear-gradient(135deg, ${colors.pink}, ${colors.purple});
             box-shadow: 0 0 24px ${colors.pink}66; }
  .note { margin-top: 28px; font-size: 13px; color: rgba(255,255,255,0.45); }
</style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="emo">emo</span><span class="jot">jot</span></div>
    <h1>How was your visit today?</h1>
    <p>Tap a face to tell us.</p>
    <div class="faces">
      <button class="face" onclick="pick(this)">😞</button>
      <button class="face" onclick="pick(this)">😐</button>
      <button class="face" onclick="pick(this)">🙂</button>
      <button class="face" onclick="pick(this)">😄</button>
      <button class="face" onclick="pick(this)">🤩</button>
    </div>
    <a class="browse" href="${config.browseStartUrl}" target="_blank">Browse the Product</a>
    <div class="note">Demo Sensor. Set sensorUrl in src/config.ts to use the real one.</div>
  </div>
  <script>
    function pick(el) {
      document.querySelectorAll('.face').forEach(function (f) { f.classList.remove('on'); });
      el.classList.add('on');
    }
  </script>
</body>
</html>`;
