/**
 * Captures the screenshots used by the built-in help guides.
 *
 * Drives a headless Chrome over the DevTools protocol against a local
 * dashboard signed in as the demo client from seed.py, and for every shot
 * records where the highlighted controls sit — so the boxes and arrows in
 * the guides are measured, not eyeballed.
 *
 * Writes public/help/<shot>.webp and server/data/helpShots.json.
 * See README.md in this folder for how to run it.
 */
import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const APP = process.env.APP_URL || 'http://localhost:5175';
const API = process.env.API_URL || 'http://127.0.0.1:5099/api/v1';
const PB = process.env.PB_URL || 'http://127.0.0.1:8095';
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const EMAIL = 'priya@cafearoma.in';
const PASSWORD = 'ClientPass123';
const W = 1280, H = 800, DPR = 1.5;
const OUT_IMG = path.join(ROOT, 'public/help');
const OUT_JSON = path.join(ROOT, 'server/data/helpShots.json');
const TMP = fs.mkdtempSync('/tmp/help-capture-');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── What to capture ────────────────────────────────────────────────────────
// Each step: { click }, { type: [query, value] }, { select: [query, value] },
// { scroll: query }, { files: [[name, publicPath], ...] }, { wait }, { eval, log }.
// A query is { text } (smallest visible element containing it), { exact },
// { sel } (CSS) or { placeholder }. Marks: { kind: 'box' | 'arrow', n?, ...query }.
const SHOTS = [
  { name: 'sign-in', loggedOut: true, route: '/login',
    marks: [{ kind: 'box', n: 1, placeholder: 'you@company.com' }, { kind: 'box', n: 2, placeholder: 'Enter your password' }, { kind: 'arrow', n: 3, sel: 'button[type=submit]' }] },
  { name: 'first-password', route: '/dashboard', firstLogin: true,
    marks: [{ kind: 'box', n: 1, placeholder: 'At least 8 characters' }, { kind: 'box', n: 2, placeholder: 'Re-enter new password' }, { kind: 'arrow', n: 3, sel: 'button[type=submit]' }] },
  { name: 'dashboard', route: '/dashboard',
    marks: [{ kind: 'box', n: 1, exact: 'My Screens', up: 'button' }, { kind: 'box', n: 2, exact: 'My Channel', up: 'button' }, { kind: 'box', n: 3, exact: 'License & Billing', up: 'button' }] },

  { name: 'screens-add-button', route: '/screens',
    marks: [{ kind: 'arrow', n: 1, exact: 'Add Screen', up: 'button' }] },
  { name: 'add-screen-name', route: '/screens/add',
    steps: [{ type: [{ placeholder: 'e.g. Mall Entrance A' }, 'Billing counter'] }, { click: { exact: 'Portrait' } }],
    marks: [{ kind: 'box', n: 1, placeholder: 'e.g. Mall Entrance A' }, { kind: 'box', n: 2, exact: 'Portrait', up: 'button' }, { kind: 'arrow', n: 3, exact: 'Continue', up: 'button' }] },
  { name: 'add-screen-content', route: '/screens/add',
    steps: [{ type: [{ placeholder: 'e.g. Mall Entrance A' }, 'Billing counter'] }, { click: { exact: 'Continue' } }, { wait: 500 }, { click: { exact: 'Skip' } }, { wait: 500 },
            { select: [{ sel: '#screen-playlist' }, 'Morning menu'] }],
    marks: [{ kind: 'box', n: 1, sel: '#screen-group' }, { kind: 'box', n: 2, sel: '#screen-playlist' }] },
  { name: 'add-screen-connect', route: '/screens/add',
    steps: [{ type: [{ placeholder: 'e.g. Mall Entrance A' }, 'Billing counter'] }, { click: { exact: 'Continue' } }, { wait: 500 }, { click: { exact: 'Skip' } }, { wait: 500 },
            { click: { exact: 'Continue' } }, { wait: 500 }, { type: [{ sel: '#pair-code' }, 'K7Q2MX'] }],
    marks: [{ kind: 'box', n: 1, sel: '#pair-code' }, { kind: 'arrow', n: 2, exact: 'Connect TV', up: 'button' }, { kind: 'box', n: 3, exact: 'Connect later', up: 'button' }] },

  { name: 'screens-status', route: '/screens',
    marks: [{ kind: 'box', n: 1, sel: '[data-help="status-filters"]', fallback: { text: 'Online' } }, { kind: 'box', n: 2, exact: 'Window display', up: 'button' }] },
  { name: 'screen-offline', route: '/screens',
    steps: [{ click: { exact: 'Window display' } }, { wait: 700 }],
    marks: [{ kind: 'box', n: 1, text: 'Last seen' }, { kind: 'arrow', n: 2, exact: 'Check status', up: 'button' }, { kind: 'box', n: 3, exact: 'Sync now', up: 'button' }] },
  { name: 'screen-actions', route: '/screens',
    steps: [{ click: { exact: 'Counter display' } }, { wait: 700 }],
    marks: [{ kind: 'arrow', n: 1, exact: 'Change playlist', up: 'button' }] },
  { name: 'screen-unlink', route: '/screens',
    steps: [{ click: { exact: 'Counter display' } }, { wait: 700 }, { scroll: { exact: 'Unlink TV' } }, { wait: 300 }],
    marks: [{ kind: 'arrow', n: 1, exact: 'Unlink TV', up: 'button' }, { kind: 'box', n: 2, exact: 'Remove screen', up: 'button', last: true }] },
  { name: 'screen-pair', route: '/screens',
    steps: [{ click: { exact: 'Kitchen screen' } }, { wait: 700 }],
    marks: [{ kind: 'arrow', n: 1, exact: 'Pair a TV', up: 'button' }] },

  { name: 'media-library', route: '/media',
    marks: [{ kind: 'arrow', n: 1, exact: 'Upload', up: 'button' }, { kind: 'box', n: 2, exact: 'Upload to playlist', up: 'button' }] },
  { name: 'media-upload-to-playlist', route: '/media',
    steps: [{ click: { exact: 'Upload to playlist' } }, { files: [['monsoon-offer.webp', '/help-seed/07-lobby-standee.webp'], ['cold-brew.webp', '/help-seed/04-cafe-standee.webp']] }, { wait: 800 },
            { click: { exact: 'Morning menu' } }],
    marks: [{ kind: 'box', n: 1, text: 'monsoon-offer.webp', up: 'li,div' }, { kind: 'box', n: 2, exact: 'Morning menu', up: 'button' }, { kind: 'box', n: 3, sel: '#slide-seconds' }, { kind: 'arrow', n: 4, text: 'Upload & add to', up: 'button' }] },

  { name: 'playlists', route: '/playlists',
    marks: [{ kind: 'arrow', n: 1, text: 'New playlist', up: 'button', fallback: { text: 'Create' } }] },
  { name: 'playlist-editor', route: '/playlists',
    steps: [{ click: { exact: 'Morning menu' } }, { wait: 700 }, { click: { exact: 'Edit playlist' } }, { wait: 2500 }],
    marks: [{ kind: 'box', n: 1, exact: 'MEDIA ASSETS', up: 'div[class*="border"][class*="rounded"]' }, { kind: 'box', n: 2, text: 'Play time:', up: 'div[class*="border"]' }, { kind: 'box', n: 3, exact: 'Morning menu', up: 'button' }] },
  { name: 'playlist-assign', route: '/playlists',
    steps: [{ click: { exact: 'Morning menu' } }, { wait: 700 }],
    marks: [{ kind: 'arrow', n: 1, exact: 'Choose screens', up: 'button', fallback: { exact: 'Assign to screens' } }, { kind: 'box', n: 2, exact: 'Assign to a group', up: 'button' }] },

  { name: 'groups', route: '/screens/groups', ready: { exact: 'Bandra outlet' },
    marks: [{ kind: 'arrow', n: 1, exact: 'New Group', up: 'button' }, { kind: 'box', n: 2, text: 'Add to group', up: 'button,select,[role=combobox]', last: true }] },
  { name: 'group-detail', route: '/screens/groups',
    steps: [{ click: { exact: 'Bandra outlet' } }, { wait: 700 }],
    marks: [{ kind: 'box', n: 1, exact: 'Change playlist', up: 'button' }, { kind: 'box', n: 2, exact: 'Add screens', up: 'button' }] },

  { name: 'billing', route: '/license-billing',
    marks: [{ kind: 'box', n: 1, exact: 'Includes', up: 'div' }, { kind: 'box', n: 2, exact: 'What you’re using', up: 'div', fallback: { text: 'What you' } }, { kind: 'arrow', n: 3, text: 'Renew early', up: 'button' }] },
  { name: 'settings-alerts', route: '/settings/general',
    marks: [{ kind: 'arrow', n: 1, text: 'Email me when a screen goes offline' }] },
];

// ── DevTools plumbing ──────────────────────────────────────────────────────
let ws, nextId = 1;
const pending = new Map();
function send(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`${r.exceptionDetails.text}: ${r.exceptionDetails.exception?.description || expression.slice(0, 120)}`);
  return r.result.value;
}

// Runs in the page. Finds elements by text/selector, types into React inputs.
const HELPERS = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity !== 0; };
  const norm = s => (s || '').replace(/\\s+/g, ' ').trim();
  window.__find = q => {
    let el = null;
    if (q.sel) { const all = [...document.querySelectorAll(q.sel)].filter(vis); el = q.last ? all[all.length - 1] : all[0]; }
    else if (q.placeholder) el = [...document.querySelectorAll('[placeholder="' + q.placeholder + '"]')].find(vis);
    else {
      const all = [...document.querySelectorAll('body *')].filter(e => {
        const t = norm(e.innerText);
        return t && (q.exact ? t === q.exact : t.includes(q.text)) && vis(e);
      });
      all.sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
      el = q.last ? all.filter(e => !all.some(o => o !== e && e.contains(o))).pop() : all[0];
    }
    if (el && q.up) el = el.closest(q.up) || el;
    if (!el && q.fallback) return window.__find(q.fallback);
    return el || null;
  };
  window.__rect = q => { const el = window.__find(q); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
  window.__click = q => { const el = window.__find(q); if (!el) return false; (el.closest('button,a,[role=button],label,[role=checkbox]') || el).click(); return true; };
  window.__setValue = (q, v) => {
    const el = window.__find(q); if (!el) return false;
    const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    if (el.tagName === 'SELECT') { const opt = [...el.options].find(o => o.text === v || o.value === v); v = opt ? opt.value : v; }
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
    return true;
  };
})()`;

async function api(pathname, body) {
  const r = await fetch(API + pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

// The status checker marks a screen offline after three minutes without a
// heartbeat, and nothing here sends one — so refresh the two "online" screens.
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

let synced = false;
async function open(route, session) {
  await send('Page.navigate', { url: `${APP}/#/login` });
  await sleep(1200);
  // Signed-out shots start clean. Signed-in ones keep the browser's copy of
  // the account's data between shots: re-downloading it every time trips the
  // API's 100-requests-a-minute limit and pages come up empty.
  await evaluate(`(() => {
    ${session ? '' : 'localStorage.clear();'}
    ${session ? Object.entries(session).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n') : `localStorage.removeItem('signageos_token');`}
  })()`);
  await send('Page.navigate', { url: `${APP}/#${route}` });
  await sleep(1500);
  // A real sign-in pulls the account's data into the browser before the
  // dashboard reads it; starting from a stored session skips that, so do it once.
  if (session && !synced) {
    await evaluate(`import('/src/lib/syncHelper.ts').then(m => m.syncAllFromDatabase({ force: true }))`).catch(e => console.warn('  sync:', e.message));
    synced = true;
  }
  await send('Page.reload', { ignoreCache: false });
  await sleep(3500);
  await evaluate(HELPERS);
}

async function main() {
  fs.mkdirSync(OUT_IMG, { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9339', `--user-data-dir=${TMP}/profile`, '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', `--window-size=${W},${H}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let target;
    for (let i = 0; i < 120 && !target; i++) {
      await sleep(250);
      target = await fetch('http://127.0.0.1:9339/json/list').then(r => r.json()).then(l => l.find(t => t.type === 'page')).catch(() => null);
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
    await send('DOM.enable');
    // Clicking an upload button would otherwise open a native file picker.
    await send('Page.setInterceptFileChooserDialog', { enabled: true });
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: false });

    const login = await api('/auth/login', { email: EMAIL, password: PASSWORD });
    if (!login.token) throw new Error('Demo client login failed — run seed.py first');
    const session = {
      signageos_token: login.token, signageos_user_email: EMAIL, signageos_user_role: 'client', signageos_user_id: login.user.id,
      signageos_first_time_login: 'false', [`signageos_user_name_${EMAIL}`]: login.user.name, [`signageos_tour_seen_user-dashboard_${EMAIL}`]: 'true',
    };

    const manifest = {};
    const only = process.argv.slice(2);
    for (const shot of SHOTS) {
      if (only.length && !only.includes(shot.name)) continue;
      await keepScreensOnline();
      await open(shot.route, shot.loggedOut ? null : { ...session, ...(shot.firstLogin ? { signageos_first_time_login: 'true' } : {}) });
      // Wait for the page's data: the first thing this shot clicks or marks.
      const ready = shot.ready || shot.steps?.find(st => st.click)?.click || shot.marks?.[0];
      for (let i = 0; ready && i < 20 && !(await evaluate(`!!window.__find(${JSON.stringify(ready)})`)); i++) await sleep(500);
      for (const step of shot.steps || []) {
        if (step.wait) await sleep(step.wait);
        else if (step.click) {
          // The page may still be loading its data; give it a few seconds.
          let clicked = false;
          for (let i = 0; i < 12 && !clicked; i++) { clicked = await evaluate(`window.__click(${JSON.stringify(step.click)})`); if (!clicked) await sleep(500); }
          if (!clicked) throw new Error(`${shot.name}: nothing to click for ${JSON.stringify(step.click)}`);
          await sleep(500);
        }
        else if (step.type || step.select) { const [q, v] = step.type || step.select; if (!(await evaluate(`window.__setValue(${JSON.stringify(q)}, ${JSON.stringify(v)})`))) throw new Error(`${shot.name}: no field ${JSON.stringify(q)}`); await sleep(300); }
        else if (step.scroll) { await evaluate(`window.__find(${JSON.stringify(step.scroll)})?.scrollIntoView({ block: 'center' })`); }
        else if (step.files) {
          // Hand real files to the upload field the way a file picker would.
          const paths = step.files.map(([name, src]) => { const dest = path.join(TMP, name); fs.copyFileSync(path.join(ROOT, 'public', src), dest); return dest; });
          const { root } = await send('DOM.getDocument', { depth: 0 });
          const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type=file][multiple]' });
          await send('DOM.setFileInputFiles', { nodeId, files: paths });
          await sleep(800);
        }
        else if (step.eval) { const v = await evaluate(step.eval); if (step.log) console.log(`  ${shot.name}:`, v); }
      }
      await sleep(600);
      const marks = [];
      for (const m of shot.marks || []) {
        const r = await evaluate(`window.__rect(${JSON.stringify(m)})`);
        if (!r) { console.warn(`  ! ${shot.name}: mark not found ${JSON.stringify(m)}`); continue; }
        const pct = v => Math.round(v * 1000) / 1000;
        marks.push({ kind: m.kind, ...(m.n ? { n: m.n } : {}), x: pct(r.x / W * 100), y: pct(r.y / H * 100), w: pct(r.w / W * 100), h: pct(r.h / H * 100) });
      }
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      const png = path.join(TMP, `${shot.name}.png`);
      fs.writeFileSync(png, Buffer.from(data, 'base64'));
      execFileSync('cwebp', ['-quiet', '-q', '80', '-resize', '1600', '0', png, '-o', path.join(OUT_IMG, `${shot.name}.webp`)]);
      manifest[shot.name] = { src: `/help/${shot.name}.webp`, w: W, h: H, marks };
      console.log(`✓ ${shot.name} (${marks.length} marks)`);
    }

    const existing = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : {};
    fs.writeFileSync(OUT_JSON, JSON.stringify({ ...existing, ...manifest }, null, 2) + '\n');
  } finally {
    ws?.close();
    chrome.kill();
    // Chrome keeps writing its profile for a moment after being told to quit.
    await sleep(1500);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* left in /tmp; harmless */ }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
