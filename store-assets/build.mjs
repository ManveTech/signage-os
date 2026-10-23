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
 * and re-rendered): headline, the real screen in a phone, and one card lifted
 * off it. Same recipe as the VelnoranX listing, in BlueStar's navy and blue,
 * with the dashboard's own fonts (Instrument Serif / Instrument Sans).
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIFT = JSON.parse(fs.readFileSync(path.join(HERE, 'raw/lift.json'), 'utf8'));

const NAVY = '#0b2545', DEEP = '#061630', BLUE = '#2563eb', SKY = '#7fb2ff', INK = '#eef3ff';
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&display=block" rel="stylesheet">`;

// ── Isometric hardware, drawn in the brand blues ────────────────────────────
const C = Math.cos(Math.PI / 6), S = 0.5;
const TOP = '#E9F0FF', LEFT = '#C3D5F7', RIGHT = '#93B0E4', EDGE = '#34558f';
const P = (x, y, z, k, ox, oy) => [ox + (x - y) * C * k, oy + (x + y) * S * k - z * k];
const poly = (pts, fill, extra = '') =>
  `<polygon points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${EDGE}" stroke-width="1.4" stroke-linejoin="round" ${extra}/>`;
function box(x0, y0, z0, w, d, h, k, ox, oy, top = TOP, left = LEFT, right = RIGHT) {
  const p = (x, y, z) => P(x0 + x, y0 + y, z0 + z, k, ox, oy);
  return poly([p(0, d, 0), p(w, d, 0), p(w, d, h), p(0, d, h)], left)
    + poly([p(w, 0, 0), p(w, d, 0), p(w, d, h), p(w, 0, h)], right)
    + poly([p(0, 0, h), p(w, 0, h), p(w, d, h), p(0, d, h)], top);
}
const face = (x0, x1, z0, z1, y, k, ox, oy, fill, extra = '') =>
  poly([P(x0, y, z0, k, ox, oy), P(x1, y, z0, k, ox, oy), P(x1, y, z1, k, ox, oy), P(x0, y, z1, k, ox, oy)], fill, extra);
const shadow = (cx, cy, rx) => `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(rx * 0.32).toFixed(0)}" fill="#000" opacity=".4" filter="url(#blur)"/>`;

/** A floor-standing digital standee: slim body, tall screen, small base. */
function standee(ox, oy, k) {
  let o = shadow(ox + 0.1 * k, oy + 0.9 * k, 0.75 * k);
  o += box(-0.1, -0.1, 0, 0.9, 0.6, 0.08, k, ox, oy);
  o += box(0, 0, 0.08, 0.7, 0.35, 2.3, k, ox, oy);
  o += face(0.08, 0.62, 0.35, 2.25, 0.35, k, ox, oy, 'url(#scr)');
  return o;
}
/** A self-service kiosk: angled screen on a column. */
function kiosk(ox, oy, k) {
  let o = shadow(ox + 0.1 * k, oy + 0.95 * k, 0.9 * k);
  o += box(0, 0, 0, 1.0, 0.8, 1.2, k, ox, oy);
  o += face(0.3, 0.7, 0.35, 0.5, 0.8, k, ox, oy, '#1e3a6e');
  o += box(0.05, 0.05, 1.2, 0.9, 0.7, 0.75, k, ox, oy);
  o += face(0.14, 0.86, 1.28, 1.88, 0.75, k, ox, oy, 'url(#scr)');
  return o;
}
/** A wall-mounted display panel. */
function panel(ox, oy, k) {
  let o = shadow(ox + 0.4 * k, oy + 0.75 * k, 0.8 * k);
  o += box(0, 0, 0.6, 1.6, 0.12, 0.95, k, ox, oy);
  o += face(0.07, 1.53, 0.66, 1.49, 0.12, k, ox, oy, 'url(#scr)');
  return o;
}
const DRAW = { standee, kiosk, panel };
const REACH = { standee: [0.6, 0.8], kiosk: [0.8, 1.0], panel: [0.2, 1.7] };
const sparkle = (x, y, r) => {
  const q = r * 0.22;
  return `<path d="M${x},${y - r} Q${x + q},${y - q} ${x + r},${y} Q${x + q},${y + q} ${x},${y + r} Q${x - q},${y + q} ${x - r},${y} Q${x - q},${y - q} ${x},${y - r}Z" fill="#DCE8FF" opacity=".9"/>`;
};
const DEFS = `<defs><filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
<linearGradient id="scr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset=".55" stop-color="#1d4ed8"/><stop offset="1" stop-color="#0b2545"/></linearGradient></defs>`;
const SWIRLS = `<g fill="none" stroke="${SKY}" stroke-linecap="round">
<path d="M-40,1180 C 180,1060 260,1500 540,1380 S 900,980 1120,1120" stroke-opacity=".28" stroke-width="2"/>
<path d="M-40,1230 C 200,1110 250,1560 560,1430 S 920,1040 1120,1170" stroke-opacity=".18" stroke-width="1.5"/>
<path d="M-40,1280 C 220,1170 240,1620 580,1480 S 940,1100 1120,1220" stroke-opacity=".12" stroke-width="1.2"/>
<path d="M60,760 C 160,700 120,560 260,520" stroke-opacity=".26" stroke-width="1.6"/>
<path d="M1020,700 C 930,640 980,520 860,470" stroke-opacity=".26" stroke-width="1.6"/></g>`;

// ── The slides ──────────────────────────────────────────────────────────────
// Phone: left 210, top 600, 660 wide, 18px bezel → 624px screen = 390 CSS px × 1.6.
const SX = 228, SY = 618, K = 624 / 390;
const SLIDES = [
  ['dashboard', 'YOUR NETWORK', 'Every screen,<br>at a glance', 'See what’s online, what’s playing and what needs you.',
    [['kiosk', 40, 870, 66], ['panel', 40, 1500, 52], ['standee', 950, 760, 54], ['kiosk', 930, 1520, 50]]],
  ['screens', 'MY SCREENS', 'Know the moment<br>a screen goes quiet', 'Live online and offline status for every display, at every location.',
    [['standee', 960, 820, 60], ['kiosk', 40, 760, 52], ['panel', 30, 1480, 50], ['kiosk', 950, 1560, 44]]],
  ['screen', 'REMOTE CONTROL', 'Change what plays,<br>from your phone', 'Switch or schedule a playlist, sync or pause any screen in a tap.',
    [['kiosk', 40, 820, 66], ['standee', 960, 700, 56], ['panel', 900, 1450, 48], ['standee', 70, 1480, 46]]],
  ['media', 'MEDIA LIBRARY', 'Your content,<br>ready to play', 'Upload images and videos straight from your phone.',
    [['panel', 30, 820, 54], ['standee', 960, 860, 58], ['kiosk', 50, 1480, 54], ['kiosk', 940, 1560, 44]]],
  ['playlist', 'PLAYLISTS', 'Build a playlist<br>in minutes', 'Arrange slides, set how long each plays, and send it to your screens.',
    [['standee', 50, 820, 60], ['kiosk', 940, 760, 56], ['panel', 900, 1480, 50], ['kiosk', 40, 1540, 46]]],
  ['billing', 'LICENCE & BILLING', 'Your plan, renewals<br>and invoices', 'Check what you’re using, renew securely and save GST invoices as PDF.',
    [['kiosk', 950, 820, 62], ['standee', 50, 760, 54], ['panel', 30, 1470, 50], ['standee', 960, 1500, 46]]],
];

function slideHtml(shot, eyebrow, title, sub, objs) {
  const placed = objs.map(([kind, x, y, k]) => {
    k *= 1.18;
    const [l, r] = REACH[kind];
    return [kind, Math.min(Math.max(x, l * C * k + 24), 1056 - r * C * k), y, k];
  });
  const art = placed.map(([kind, x, y, k]) => DRAW[kind](x, y, k)).join('') + sparkle(96, 520, 14) + sparkle(1010, 420, 10);
  let lift = '';
  const L = LIFT[shot];
  if (L) {
    const g = 1.06, cw = L.w * K, ch = L.h * K;
    const cx = SX + L.x * K - cw * (g - 1) / 2, cy = SY + L.y * K - ch * (g - 1) / 2;
    lift = `<div class="lift" style="left:${cx.toFixed(1)}px;top:${cy.toFixed(1)}px;width:${(cw * g).toFixed(1)}px;height:${(ch * g).toFixed(1)}px;border-radius:${(L.r * K * g).toFixed(0)}px;
      background-image:url(raw/${shot}.png);background-size:${(624 * g).toFixed(1)}px auto;background-position:${(-L.x * K * g).toFixed(1)}px ${(-L.y * K * g).toFixed(1)}px"></div>`;
  }
  return `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1080px;height:1920px;overflow:hidden}
body{position:relative;background:radial-gradient(120% 70% at 50% 8%,#14396e 0%,${NAVY} 50%,${DEEP} 100%);font-family:'Instrument Sans',sans-serif}
.layer{position:absolute;inset:0}
.head{position:absolute;top:118px;left:0;right:0;text-align:center}
.eyebrow{color:${SKY};font:600 30px/1 'Instrument Sans';letter-spacing:.3em;padding-left:.3em}
.title{color:${INK};font-family:'Instrument Serif',serif;font-weight:400;font-size:104px;line-height:1.0;margin:34px 0 0;letter-spacing:-.01em}
.sub{color:rgba(238,243,255,.74);font:400 35px/1.4 'Instrument Sans';margin:30px auto 0;max-width:840px;text-wrap:balance}
.phone{position:absolute;left:210px;top:600px;width:660px;height:1428px;border-radius:84px;background:#050c1a;padding:18px;box-sizing:border-box;
 box-shadow:0 0 0 2px rgba(127,178,255,.35),0 60px 120px rgba(0,0,0,.6),inset 0 0 0 2px #1b2a45}
.screen{width:100%;height:100%;border-radius:68px;overflow:hidden;background:#f7f9fc}.screen img{width:100%;display:block}
.lift{position:absolute;background-repeat:no-repeat;
 box-shadow:0 0 0 3px ${BLUE},0 0 0 10px rgba(37,99,235,.22),0 30px 60px rgba(0,0,0,.5),0 0 70px rgba(96,165,250,.45)}
.fade{position:absolute;bottom:0;left:0;right:0;height:300px;background:linear-gradient(to bottom,rgba(6,22,48,0),${DEEP} 85%)}
</style></head><body>
<svg class="layer" width="1080" height="1920">${DEFS}${SWIRLS}</svg>
<div class="head"><div class="eyebrow">${eyebrow}</div><h1 class="title">${title}</h1><p class="sub">${sub}</p></div>
<div class="phone"><div class="screen"><img src="raw/${shot}.png"></div></div>
${lift}
<div class="fade"></div>
<svg class="layer" width="1080" height="1920">${DEFS}${art}</svg>
</body></html>`;
}

const FEATURE = `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>
html,body{margin:0;width:1024px;height:500px;overflow:hidden}
body{position:relative;background:radial-gradient(90% 120% at 18% 30%,#14396e 0%,${NAVY} 48%,${DEEP} 100%);font-family:'Instrument Sans',sans-serif;color:${INK}}
.left{position:absolute;left:64px;top:96px;width:520px}
.brand{display:flex;align-items:center;gap:20px}
.brand img{width:92px;height:92px;border-radius:22px;background:#fff;padding:9px;box-sizing:border-box;box-shadow:0 10px 30px rgba(0,0,0,.35)}
.name{font-family:'Instrument Serif',serif;font-size:60px;line-height:1;letter-spacing:-.01em}
.rule{height:1px;background:linear-gradient(90deg,rgba(127,178,255,.6),rgba(127,178,255,0));margin:30px 0 26px}
.tag{font-size:31px;line-height:1.3;color:rgba(238,243,255,.9);margin:0}
.chips{margin-top:24px;color:${SKY};font:600 15px/1 'Instrument Sans';letter-spacing:.24em}
.phone{position:absolute;left:640px;top:46px;width:330px;height:714px;border-radius:44px;background:#050c1a;padding:10px;box-sizing:border-box;
 transform:rotate(9deg);box-shadow:0 0 0 2px rgba(127,178,255,.4),0 40px 90px rgba(0,0,0,.6)}
.phone div{width:100%;height:100%;border-radius:35px;overflow:hidden;background:#f7f9fc}.phone img{width:100%;display:block}
</style></head><body>
<div class="left">
  <div class="brand"><img src="../src/assets/bluestar-icon.png"><div class="name">BlueStar DigiTech</div></div>
  <div class="rule"></div>
  <p class="tag">Your digital signage,<br>in your pocket.</p>
  <div class="chips">SCREENS · MEDIA · PLAYLISTS · BILLING</div>
</div>
<div class="phone"><div><img src="raw/dashboard.png"></div></div>
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
  SLIDES.forEach((s, i) => fs.writeFileSync(path.join(HERE, `slide-${i + 1}.html`), slideHtml(...s)));
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
