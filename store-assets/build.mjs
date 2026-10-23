/**
 * Builds the Google Play listing graphics from the raw phone captures.
 *
 *   node store-assets/capture.mjs   → raw/*.png + raw/lift.json (needs the local demo stack)
 *   node store-assets/build.mjs     → the files below, rendered in headless Chrome
 *
 * Output (all in store-assets/):
 *   BlueStar-screenshot-1..6.png   1080×1920 phone screenshots
 *   BlueStar-feature-1024x500.png  feature graphic (and a 2048×1000 copy)
 *   BlueStar-icon-512.png          store icon
 *
 * Each slide is an HTML page (slide-N.html, kept so a headline can be tweaked
 * and re-rendered). BlueStar's own look: light background with a deep-blue
 * panel, a bold left-aligned headline (Outfit, the dashboard's sans), the
 * real screen in a tilted phone, one card floated out beside it, and one of
 * BlueStar's own products (the website's cut-out photos) standing in front.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIFT = JSON.parse(fs.readFileSync(path.join(HERE, 'raw/lift.json'), 'utf8'));
const PRODUCTS = '../marketing-site/public/products';

const NAVY = '#0b2545', BLUE = '#2563eb', BG = '#f3f6fc';
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=block" rel="stylesheet">`;

// ── The slides ──────────────────────────────────────────────────────────────
// [raw shot, label, headline (<b> = the blue word), caption, product photo, product height]
const SLIDES = [
  ['dashboard', 'Your network', 'Every screen, <b>at a glance</b>', 'See what’s online, what’s playing and what needs you.', 'standee.webp', 640],
  ['screens', 'My screens', 'Know when a screen <b>goes quiet</b>', 'Live online and offline status for every display, at every location.', 'info-kiosk.webp', 620],
  ['screen', 'Remote control', 'Change what plays, <b>from your phone</b>', 'Switch or schedule a playlist, sync or pause any screen in a tap.', 'self-service-kiosk.webp', 470],
  ['media', 'Media library', 'Your content, <b>ready to play</b>', 'Upload images and videos straight from your phone.', 'a-type-standee.webp', 600],
  ['playlist', 'Playlists', 'Build a playlist <b>in minutes</b>', 'Arrange slides, set how long each plays, and send it to your screens.', 'podium.webp', 600],
  ['billing', 'Licence & billing', 'Your plan, renewals <b>and invoices</b>', 'Check what you’re using, renew securely and save GST invoices as PDF.', 'led-video-wall.webp', 620],
];

// Phone: 600 px wide with a 16 px bezel → a 568 px screen = 390 CSS px × K.
const PW = 600, BEZ = 16, K = (PW - BEZ * 2) / 390;

function slideHtml(i, shot, label, title, sub, product, productH) {
  const L = LIFT[shot];
  // The floated card: the same crop of the screenshot, a little larger,
  // pulled out to the left of the phone at the height it sits on screen.
  const g = 1.12;
  const card = L ? (() => {
    const w = L.w * K * g, h = L.h * K * g;
    // Kept above the product photo (whose top is at 1920 - 120 - productH).
    const top = Math.max(Math.min(700 + L.y * K - (h - L.h * K) / 2, 1800 - productH - 40 - h), 740);
    return `<div class="card" style="left:${Math.max(48, 470 - w * 0.55).toFixed(0)}px;top:${top.toFixed(0)}px;width:${w.toFixed(0)}px;height:${h.toFixed(0)}px;border-radius:${(L.r * K * g).toFixed(0)}px;
      background-image:url(raw/${shot}.png);background-size:${(390 * K * g).toFixed(1)}px auto;background-position:${(-L.x * K * g).toFixed(1)}px ${(-L.y * K * g).toFixed(1)}px"></div>`;
  })() : '';
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
body{position:relative;background:${BG};font-family:Outfit,sans-serif;color:${NAVY}}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(11,37,69,.09) 2px,transparent 2.5px);background-size:36px 36px;
 -webkit-mask-image:linear-gradient(to bottom,#000 0%,rgba(0,0,0,.4) 40%,transparent 60%)}
.panel{position:absolute;left:0;right:0;top:1040px;bottom:0;background:linear-gradient(160deg,#1d4ed8 0%,#123a8f 45%,${NAVY} 100%);border-top-left-radius:220px}
.panel:after{content:'';position:absolute;right:-180px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(96,165,250,.45),rgba(96,165,250,0) 70%)}
.head{position:absolute;left:84px;right:84px;top:110px}
.label{display:inline-flex;align-items:center;gap:14px;background:#fff;border:2px solid #dbe5f7;border-radius:999px;padding:12px 26px 12px 14px;
 font:600 28px/1 Outfit;color:${NAVY};box-shadow:0 6px 18px rgba(11,37,69,.06)}
.label span{background:${BLUE};color:#fff;border-radius:999px;padding:8px 14px;font-weight:700;font-size:24px}
.title{font:800 98px/1.02 Outfit;letter-spacing:-.025em;margin:40px 0 0;max-width:900px;text-wrap:balance}
.title b{font-weight:800;color:${BLUE}}
.sub{font:400 36px/1.4 Outfit;color:#4b5b75;margin:28px 0 0;max-width:820px;text-wrap:balance}
.phone{position:absolute;left:400px;top:690px;width:${PW}px;height:1300px;border-radius:72px;background:#0c1424;padding:${BEZ}px;box-sizing:border-box;
 transform:rotate(-4deg);transform-origin:50% 0;box-shadow:0 50px 100px rgba(11,37,69,.35),0 0 0 2px rgba(255,255,255,.08) inset}
.phone .screen{width:100%;height:100%;border-radius:58px;overflow:hidden;background:#f7f9fc}.phone img{width:100%;display:block}
.card{position:absolute;background-repeat:no-repeat;background-color:#fff;
 box-shadow:0 0 0 4px #fff,0 0 0 7px ${BLUE},0 36px 70px rgba(11,37,69,.38)}
.product{position:absolute;left:40px;bottom:120px;height:${productH}px;filter:drop-shadow(0 30px 30px rgba(0,0,0,.35))}
.floor{position:absolute;left:30px;bottom:96px;width:420px;height:70px;border-radius:50%;background:radial-gradient(ellipse,rgba(0,0,0,.35),rgba(0,0,0,0) 70%)}
</style></head><body>
<div class="dots"></div>
<div class="panel"></div>
<div class="head"><div class="label"><span>0${i}</span>${label}</div><h1 class="title">${title}</h1><p class="sub">${sub}</p></div>
<div class="phone"><div class="screen"><img src="raw/${shot}.png"></div></div>
<div class="floor"></div>
<img class="product" src="${PRODUCTS}/${product}">
${card}
</body></html>`;
}

const FEATURE = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
body{position:relative;background:${BG};font-family:Outfit,sans-serif;color:${NAVY}}
.dots{position:absolute;inset:0;background-image:radial-gradient(rgba(11,37,69,.08) 1.5px,transparent 2px);background-size:22px 22px}
.panel{position:absolute;left:560px;top:0;right:0;bottom:0;background:linear-gradient(160deg,#1d4ed8,#123a8f 50%,${NAVY});border-top-left-radius:160px;border-bottom-left-radius:0}
.left{position:absolute;left:60px;top:84px;width:470px}
.brand{display:flex;align-items:center;gap:16px}
.brand img{width:76px;height:76px;border-radius:18px;background:#fff;padding:7px;box-sizing:border-box;box-shadow:0 8px 22px rgba(11,37,69,.15)}
.name{font:800 40px/1 Outfit;letter-spacing:-.02em}
.tag{font:800 50px/1.04 Outfit;letter-spacing:-.025em;margin:34px 0 0}
.tag b{color:${BLUE};font-weight:800}
.chips{margin-top:26px;display:flex;gap:8px;flex-wrap:wrap}
.chips span{background:#fff;border:1.5px solid #dbe5f7;border-radius:999px;padding:7px 14px;font:600 15px/1 Outfit}
.phone{position:absolute;left:700px;top:40px;width:280px;height:600px;border-radius:38px;background:#0c1424;padding:8px;box-sizing:border-box;
 transform:rotate(-6deg);box-shadow:0 30px 70px rgba(0,0,0,.45)}
.phone div{width:100%;height:100%;border-radius:31px;overflow:hidden;background:#f7f9fc}.phone img{width:100%;display:block}
.product{position:absolute;left:560px;bottom:-6px;height:330px;filter:drop-shadow(0 18px 18px rgba(0,0,0,.35))}
</style></head><body>
<div class="dots"></div>
<div class="panel"></div>
<div class="left">
  <div class="brand"><img src="../src/assets/bluestar-icon.png"><div class="name">BlueStar DigiTech</div></div>
  <div class="tag">Your digital signage, <b>in your pocket.</b></div>
  <div class="chips"><span>Screens</span><span>Media</span><span>Playlists</span><span>Billing</span></div>
</div>
<div class="phone"><div><img src="raw/dashboard.png"></div></div>
<img class="product" src="${PRODUCTS}/standee.webp">
</body></html>`;

// Play's icon is a full square (it applies its own rounding): the mark on
// white, as on the phone's launcher icon.
const ICON = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:512px;height:512px;overflow:hidden;background:#fff}
img{position:absolute;left:56px;top:56px;width:400px;height:400px}
</style></head><body><img src="../src/assets/bluestar-icon.png"></body></html>`;

// ── Render ──────────────────────────────────────────────────────────────────
let ws, nextId = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject, method });
  ws.send(JSON.stringify({ id, method, params }));
});

async function render(htmlFile, out, width, height, scale = 1) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  await send('Page.navigate', { url: 'file://' + path.join(HERE, htmlFile) });
  await sleep(1500);
  await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => Promise.all([...document.images].map(i => i.complete || new Promise(r => { i.onload = i.onerror = r; }))))', awaitPromise: true });
  await sleep(300);
  const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width, height, scale: 1 } });
  fs.writeFileSync(path.join(HERE, out), Buffer.from(data, 'base64'));
  console.log('rendered', out);
}

async function main() {
  SLIDES.forEach((s, i) => fs.writeFileSync(path.join(HERE, `slide-${i + 1}.html`), slideHtml(i + 1, ...s)));
  fs.writeFileSync(path.join(HERE, 'feature.html'), FEATURE);
  fs.writeFileSync(path.join(HERE, 'icon.html'), ICON);

  const tmp = fs.mkdtempSync('/tmp/store-build-');
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9343', `--user-data-dir=${tmp}`, '--allow-file-access-from-files',
    '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
      await sleep(250);
      target = await fetch('http://127.0.0.1:9343/json/list').then(r => r.json()).then(l => l.find(t => t.type === 'page')).catch(() => null);
    }
    if (!target) throw new Error('Chrome did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(`${p.method}: ${m.error.message}`)) : p.resolve(m.result); }
    });
    await send('Page.enable');
    for (let i = 1; i <= SLIDES.length; i++) await render(`slide-${i}.html`, `BlueStar-screenshot-${i}.png`, 1080, 1920);
    await render('feature.html', 'BlueStar-feature-1024x500.png', 1024, 500);
    await render('feature.html', 'BlueStar-feature-2048x1000.png', 1024, 500, 2);
    await render('icon.html', 'BlueStar-icon-512.png', 512, 512);
  } finally {
    ws?.close();
    chrome.kill();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
