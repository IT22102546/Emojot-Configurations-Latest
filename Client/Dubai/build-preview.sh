#!/bin/sh
# Rebuilds preview.html (mock landing page + the popup snippet inlined) so it opens by double-click.
cd "$(dirname "$0")"
{
cat <<'HTML'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Popup Preview</title>
<style>
  body{margin:0;font-family:Mulish,Arial,sans-serif;color:#222;background:#fff}
  nav{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding:18px 48px;box-shadow:0 2px 8px rgba(0,0,0,.06)}
  nav b{color:#04331d;font-size:22px} nav a{margin-left:22px;color:#3c6e35;text-decoration:none;border-bottom:1px solid #cfa64b;font-size:14px}
  .hero{padding:60px 48px;max-width:620px} .hero h1{font-size:26px}
  .btn{display:inline-block;background:#cfa64b;color:#fff;padding:10px 18px;text-decoration:none;font-size:14px}
  footer{background:#04331d;color:#fff;padding:40px 48px;margin-top:200px;display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
</style></head>
<body>
<nav><b>SLP × emojot</b><div><a href="#about">About</a><a href="#offer">Offer details</a><a href="#reg">Register interest</a></div></nav>
<section class="hero">
  <h1>We are proud partners to Dubai Department of Economy and Tourism…</h1>
  <p>Mock of the Wix page. Every “Register interest” link/button opens the popup.</p>
  <a class="btn" href="#">Register insterest</a>
</section>
<footer><div><h2>Are you interested?</h2><p>See what faster guest response could look like for your business.</p></div>
<a class="btn" href="#">Register interest</a></footer>
<!-- ===== popup snippet (copied from emojot-register-popup.html) ===== -->
HTML
cat emojot-register-popup.html
printf '\n</body></html>\n'
} > preview.html
echo "preview.html rebuilt"
