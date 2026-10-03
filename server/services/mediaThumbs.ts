import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { PB_URL, S3_ENDPOINT } from '../config';
import { getCloudflareConfig } from '../integrationsStore';

/**
 * Small, cached previews for media tiles in the dashboard.
 *
 * Every tile used to make this server download the full original from R2
 * (often several MB) and re-run the resize, on every single request, so a
 * playlist with 20 items meant 20 full downloads each time it was opened.
 * Results are now kept in memory and on local disk, so after the first view
 * a tile is served straight from cache.
 *
 * Videos get a real poster frame (via ffmpeg) instead of the dashboard
 * loading the video itself into a <video> tag, which is what made video
 * tiles slow and sometimes broken (unsupported codecs such as iPhone HEVC
 * .mov, or too many decoders open at once on Android WebView).
 */

export interface Thumb {
  buffer: Buffer;
  contentType: string;
}

const CACHE_DIR = path.join(os.tmpdir(), 'signage-thumbs');
const DISK_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MEM_MAX_BYTES = 48 * 1024 * 1024;
const FAILURE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20_000;
const FFMPEG_TIMEOUT_MS = 25_000;
const MAX_CONCURRENT_FFMPEG = 2;

try { fs.mkdirSync(CACHE_DIR, { recursive: true }); } catch { /* disk cache is best-effort */ }

// ── Allowed hosts ───────────────────────────────────────────────────────────
// The proxy is unauthenticated, so it only fetches from our own media hosts.
// R2 can be configured in Admin > Integrations rather than .env; that public
// URL used to be missing here, so every thumbnail was refused (403) and the
// dashboard fell back to downloading the full-size original.

let hostCache: { hosts: Set<string>; at: number } | null = null;

async function allowedHosts(): Promise<Set<string>> {
  if (hostCache && Date.now() - hostCache.at < 60_000) return hostCache.hosts;
  const hosts = new Set<string>();
  const add = (url: string | undefined) => {
    if (!url) return;
    try { hosts.add(new URL(url).hostname.toLowerCase()); } catch { /* ignore malformed config */ }
  };
  add(PB_URL);
  add(process.env.R2_PUBLIC_URL);
  add(S3_ENDPOINT);
  try {
    const cfg = await getCloudflareConfig();
    add(cfg.publicUrl);
    add(cfg.endpoint);
  } catch { /* fall back to env hosts */ }
  hostCache = { hosts, at: Date.now() };
  return hosts;
}

export async function isAllowedMediaUrl(url: string): Promise<boolean> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  return (await allowedHosts()).has(parsed.hostname.toLowerCase());
}

// ── Cache ───────────────────────────────────────────────────────────────────

const mem = new Map<string, Thumb>();
let memBytes = 0;
const failures = new Map<string, number>();
const inflight = new Map<string, Promise<Thumb | null>>();

function cacheKey(kind: string, url: string, width: number): string {
  return crypto.createHash('sha1').update(`${kind}|${width}|${url}`).digest('hex');
}

function memGet(key: string): Thumb | undefined {
  const hit = mem.get(key);
  if (hit) { mem.delete(key); mem.set(key, hit); } // refresh LRU position
  return hit;
}

function memSet(key: string, thumb: Thumb) {
  if (thumb.buffer.length > MEM_MAX_BYTES / 8) return;
  mem.set(key, thumb);
  memBytes += thumb.buffer.length;
  for (const [k, v] of mem) {
    if (memBytes <= MEM_MAX_BYTES) break;
    mem.delete(k);
    memBytes -= v.buffer.length;
  }
}

async function diskGet(key: string): Promise<Thumb | null> {
  try {
    const buffer = await fs.promises.readFile(path.join(CACHE_DIR, `${key}.jpg`));
    return { buffer, contentType: 'image/jpeg' };
  } catch {
    return null;
  }
}

function diskSet(key: string, thumb: Thumb) {
  if (thumb.contentType !== 'image/jpeg') return;
  const file = path.join(CACHE_DIR, `${key}.jpg`);
  const tmp = `${file}.${process.pid}.tmp`;
  fs.promises.writeFile(tmp, thumb.buffer)
    .then(() => fs.promises.rename(tmp, file))
    .catch(() => { fs.promises.unlink(tmp).catch(() => {}); });
}

// Drop disk entries older than two weeks, so deleted media doesn't pile up.
async function pruneDisk() {
  try {
    const now = Date.now();
    for (const name of await fs.promises.readdir(CACHE_DIR)) {
      const file = path.join(CACHE_DIR, name);
      const stat = await fs.promises.stat(file).catch(() => null);
      if (stat && now - stat.mtimeMs > DISK_MAX_AGE_MS) await fs.promises.unlink(file).catch(() => {});
    }
  } catch { /* best-effort */ }
}
setTimeout(pruneDisk, 60_000).unref();
setInterval(pruneDisk, 12 * 60 * 60 * 1000).unref();

/** Shared lookup: memory → disk → produce (deduped across concurrent requests). */
async function cached(kind: string, url: string, width: number, produce: () => Promise<Thumb | null>): Promise<Thumb | null> {
  const key = cacheKey(kind, url, width);
  const hit = memGet(key);
  if (hit) return hit;

  const failedAt = failures.get(key);
  if (failedAt && Date.now() - failedAt < FAILURE_TTL_MS) return null;

  const pending = inflight.get(key);
  if (pending) return pending;

  const job = (async () => {
    const fromDisk = await diskGet(key);
    if (fromDisk) { memSet(key, fromDisk); return fromDisk; }
    const made = await produce().catch((err) => {
      console.warn(`[thumbs] ${kind} failed for ${url}:`, err?.message || err);
      return null;
    });
    if (made) {
      memSet(key, made);
      diskSet(key, made);
      failures.delete(key);
    } else {
      failures.set(key, Date.now());
    }
    return made;
  })().finally(() => inflight.delete(key));

  inflight.set(key, job);
  return job;
}

// ── sharp ───────────────────────────────────────────────────────────────────

let sharpPromise: Promise<any> | null = null;
function loadSharp(): Promise<any> {
  // Dynamic import so a missing `sharp` binary degrades to a plain proxy
  // instead of crashing the server.
  if (!sharpPromise) {
    const spec = 'sharp';
    sharpPromise = import(spec).then((m: any) => m.default || m).catch(() => null);
  }
  return sharpPromise;
}

async function toJpeg(input: Buffer, width: number): Promise<Buffer | null> {
  const sharp = await loadSharp();
  if (!sharp) return null;
  return sharp(input)
    .rotate() // honour EXIF orientation before metadata is stripped
    .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, progressive: true, mozjpeg: true })
    .toBuffer();
}

// ── Images ──────────────────────────────────────────────────────────────────

const RESIZABLE_IMAGE = /^image\/(jpe?g|png|webp)$/i;

/**
 * A resized JPEG for an image URL, or null when it can't be resized (GIF,
 * unknown type, sharp missing) — the caller then serves the original.
 */
export function getImageThumb(url: string, width: number): Promise<Thumb | null> {
  return cached('img', url, width, async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!RESIZABLE_IMAGE.test(type)) return null;
    const out = await toJpeg(Buffer.from(await res.arrayBuffer()), width);
    return out ? { buffer: out, contentType: 'image/jpeg' } : null;
  });
}

// ── Videos ──────────────────────────────────────────────────────────────────

let ffmpegAvailable: Promise<boolean> | null = null;
function hasFfmpeg(): Promise<boolean> {
  if (!ffmpegAvailable) {
    ffmpegAvailable = new Promise((resolve) => {
      try {
        const p = spawn('ffmpeg', ['-version'], { stdio: 'ignore' });
        p.on('error', () => resolve(false));
        p.on('exit', (code) => resolve(code === 0));
      } catch {
        resolve(false);
      }
    });
    ffmpegAvailable.then((ok) => {
      if (!ok) console.warn('[thumbs] ffmpeg not found — video tiles will load the video itself instead of a poster');
    });
  }
  return ffmpegAvailable;
}

let running = 0;
const waiting: Array<() => void> = [];
async function withFfmpegSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_FFMPEG) await new Promise<void>((r) => waiting.push(r));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

/** Grab one frame at `seekSeconds` as a JPEG. ffmpeg reads the URL with range requests, so only a small part of the video is downloaded. */
function grabFrame(url: string, seekSeconds: number, width: number): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const args = [
      '-hide_banner', '-loglevel', 'error',
      '-ss', String(seekSeconds),
      '-i', url,
      '-frames:v', '1',
      '-vf', `scale='min(${width},iw)':-2`,
      '-q:v', '4',
      '-f', 'image2pipe', '-vcodec', 'mjpeg',
      'pipe:1',
    ];
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => proc.kill('SIGKILL'), FFMPEG_TIMEOUT_MS);
    proc.stdout.on('data', (c: Buffer) => chunks.push(c));
    proc.on('error', () => { clearTimeout(timer); resolve(null); });
    proc.on('close', () => {
      clearTimeout(timer);
      const out = Buffer.concat(chunks);
      resolve(out.length > 0 ? out : null);
    });
  });
}

/** A poster JPEG for a video URL, or null if ffmpeg is unavailable or the frame can't be read. */
export async function getVideoPoster(url: string, width: number): Promise<Thumb | null> {
  if (!(await hasFfmpeg())) return null;
  return cached('poster', url, width, () => withFfmpegSlot(async () => {
    // 1s in skips the black/fade-in first frame most clips start with;
    // very short clips have no frame there, so retry from the start.
    const frame = (await grabFrame(url, 1, width)) || (await grabFrame(url, 0, width));
    if (!frame) return null;
    const out = (await toJpeg(frame, width).catch(() => null)) || frame;
    return { buffer: out, contentType: 'image/jpeg' };
  }));
}
