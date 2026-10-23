/**
 * Captures the raw phone screenshots for the Play Store listing.
 *
 * Same setup as scripts/help-guides (see its README): a throwaway local
 * PocketBase + api seeded with the demo client from seed.py (Café Aroma),
 * and the dashboard dev server on :5175. Never point this at production —
 * the listing should show demo data, not a real client's.
 *
 * Writes store-assets/raw/<shot>.png at 1170×2532 (390×844 CSS px at 3×,
 * a typical phone), which build.mjs then frames into the store slides.
 */
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const APP = process.env.APP_URL || 'http://localhost:5175';
const API = process.env.API_URL || 'http://127.0.0.1:5099/api/v1';
const PB = process.env.PB_URL || 'http://127.0.0.1:8095';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EMAIL = 'priya@cafearoma.in';
const PASSWORD = 'ClientPass123';
const W = 390, H = 844, DPR = 3;
const OUT = path.join(HERE, 'raw');
const RECTS = path.join(OUT, 'lift.json');
const TMP = fs.mkdtempSync('/tmp/store-capture-');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = [
  // `lift`: the card the store slide raises off the screen (build.mjs).
  { name: 'dashboard', route: '/dashboard', ready: 'Dashboard', lift: 'Your screens' },
  { name: 'screens', route: '/screens', ready: 'Counter display', lift: 'Window display' },
  { name: 'screen', route: '/screens', ready: 'Counter display', click: ['Counter display'], lift: 'Change playlist' },
  { name: 'media', route: '/media', ready: 'Upload', lift: 'Weekend offer' },
  { name: 'playlist', route: '/playlists', ready: 'Morning menu', click: ['Morning menu', 'Edit playlist'], settle: 5000 }, // past the "Loaded playlist" toast
  { name: 'billing', route: '/license-billing', ready: 'Includes', lift: 'Renews on' },
];

let ws, nextId = 1;
const pending = new Map();
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject, method });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
}
// Smallest visible element whose whole text is `t`, clicked through to its button.
const FIND = t => `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
  const all = [...document.querySelectorAll('body *')].filter(e => (e.innerText || '').replace(/\\s+/g, ' ').trim() === ${JSON.stringify(t)} && vis(e));
  all.sort((a, b) => { const x = a.getBoundingClientRect(), y = b.getBoundingClientRect(); return x.width * x.height - y.width * y.height; });
  return all[0] || null;
})()`;

/** Two demo screens show as online, as a live account would. */
async function keepScreensOnline() {
  const auth = await (await fetch(`${PB}/api/collections/_superusers/auth-with-password`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identity: 'admin@local.test', password: 'LocalTest123!' }),
  })).json();
  const list = await (await fetch(`${PB}/api/collections/screens/records?perPage=50`, { headers: { Authorization: auth.token } })).json();
  const now = new Date().toISOString();
  for (const s of list.items.filter(s => ['Counter display', 'Entrance standee'].includes(s.name))) {
    await fetch(`${PB}/api/collections/screens/records/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: auth.token },
      body: JSON.stringify({ status: 'online', lastHeartbeat: now, onlineSince: s.onlineSince || now }),
    });
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', '--remote-debugging-port=9341', `--user-data-dir=${TMP}/profile`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank'], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
      await sleep(250);
      target = await fetch('http://127.0.0.1:9341/json/list').then(r => r.json()).then(l => l.find(t => t.type === 'page')).catch(() => null);
    }
    if (!target) throw new Error('Chrome did not start');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(`${p.method}: ${m.error.message}`)) : p.resolve(m.result); }
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });

    const login = await (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PASSWORD }) })).json();
    if (!login.token) throw new Error('Demo client login failed — run scripts/help-guides/seed.py first');
    const session = {
      signageos_token: login.token, signageos_user_email: EMAIL, signageos_user_role: 'client', signageos_user_id: login.user.id,
      signageos_first_time_login: 'false', [`signageos_user_name_${EMAIL}`]: login.user.name, [`signageos_tour_seen_user-dashboard_${EMAIL}`]: 'true',
    };

    let synced = false;
    const only = process.argv.slice(2);
    for (const shot of SHOTS) {
      if (only.length && !only.includes(shot.name)) continue;
      await keepScreensOnline();
      await send('Page.navigate', { url: `${APP}/#/login` });
      await sleep(1000);
      await evaluate(`(() => { ${Object.entries(session).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('')} })()`);
      await send('Page.navigate', { url: `${APP}/#${shot.route}` });
      await sleep(1500);
      if (!synced) {
        await evaluate(`import('/src/lib/syncHelper.ts').then(m => m.syncAllFromDatabase({ force: true }))`).catch(() => {});
        synced = true;
      }
      await send('Page.reload', {});
      await sleep(3500);
      for (let i = 0; i < 20 && !(await evaluate(`!!${FIND(shot.ready)}`)); i++) await sleep(500);
      for (const t of shot.click || []) {
        let ok = false;
        for (let i = 0; i < 12 && !ok; i++) {
          ok = await evaluate(`(() => { const e = ${FIND(t)}; if (!e) return false; (e.closest('button,a,[role=button]') || e).click(); return true; })()`);
          if (!ok) await sleep(500);
        }
        if (!ok) throw new Error(`${shot.name}: nothing to click for "${t}"`);
        await sleep(2000);
      }
      await sleep(shot.settle || 800);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(path.join(OUT, `${shot.name}.png`), Buffer.from(data, 'base64'));
      if (shot.lift) {
        // The nearest rounded, card-sized box around the label, in CSS px.
        const r = await evaluate(`(() => {
          let e = ${FIND(shot.lift)};
          while (e && e !== document.body) {
            const b = e.getBoundingClientRect(), cs = getComputedStyle(e);
            if (parseFloat(cs.borderTopLeftRadius) >= 10 && b.width >= 150 && b.height >= 44) return { x: b.left, y: b.top, w: b.width, h: b.height, r: parseFloat(cs.borderTopLeftRadius) };
            e = e.parentElement;
          }
          return null;
        })()`);
        const all = fs.existsSync(RECTS) ? JSON.parse(fs.readFileSync(RECTS, 'utf8')) : {};
        all[shot.name] = r;
        fs.writeFileSync(RECTS, JSON.stringify(all, null, 2) + '\n');
      }
      console.log('captured', shot.name);
    }
  } finally {
    ws?.close();
    chrome.kill();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
