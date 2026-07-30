# Tizen Player — Performance & Offline Playback

Notes on the low-memory / offline-first work for Samsung QBC-class panels
(~2 GB RAM, weak SoC). Context for why the Tizen player stalled while the
Android player stayed smooth, and what changed.

## Root cause

The Android player uses Coil (`AsyncImage` + `.fillMaxSize()` + `allowHardware`),
which **downsamples** each image to the screen size and decodes it into GPU
memory. The Tizen player set `<img>.src` to the **full-resolution source** (often
a 4K / multi-MB image), so the panel had to download and decode the whole thing.
On 2 GB hardware that took 10–60 s per slide, and because the slide timer only
started *after* paint, durations were wrong too.

## What changed

### 1. Display-sized images (biggest win)
`tizen/js/player.js` now requests a 1920px-long-edge variant instead of the source:

- **PocketBase files** (`/api/files/...`) → `?thumb=1920x1920f` (on-the-fly,
  aspect-preserving, no crop; PocketBase caches after first request).
- **R2 / external images** → routed through `/api/v1/public/proxy-media?...&w=1920`,
  which resizes with `sharp` (see server change below).
- **Videos** are never thumbnailed — serve a 1080p H.264 (baseline/main) MP4 for
  QBC hardware decoders; 4K/HEVC will stutter or fail. *(Server-side, not yet
  automated.)*

Result: the TV downloads/decodes a ~2 MP JPEG. Decode is near-instant, so slides
show for their configured duration.

### 2. Server-side resize in the media proxy
`server/routes/index.ts` → `/public/proxy-media` accepts an optional `w=` param
and downscales JPEG/PNG/WebP with `sharp` (`fit: inside`, `withoutEnlargement`,
re-encoded as progressive JPEG q82). Animated GIFs / SVGs / videos pass through
untouched. `sharp` is imported dynamically with a graceful fallback — if it isn't
installed the route still works, it just serves the original bytes.

> **Deploy step:** run `npm install` so `sharp` (added to `package.json`) is
> present on the server that runs `npm run server`. Without it, R2 images are
> proxied full-size (still correct, just not smaller).

### 3. Offline-first local caching
`syncLocalFiles` downloads every asset once into persistent `wgt-private` storage
and rewrites `asset.url` to the `file://` URI, which is persisted to
`localStorage`. On boot the player paints the cached playlist **immediately**
(`tizen/app.js`) and only then syncs config in the background, so it loops with
no network. Hardening added:

- **Streamed writes** — downloads are written to the Tizen `FileStream` chunk by
  chunk (`writeBytes`), so a large file is never fully held in memory (this is
  what previously OOM'd big videos via the old base64 path).
- **Write verification** — after download the file size is checked against
  `Content-Length`; a truncated file is deleted and the asset keeps its remote
  URL so the next online sync retries it (never persists a broken offline entry).
- **No blob fallback on TV** — `blob:` URLs die on restart and don't work
  offline, so they're only used in the browser/dev path, never on a real panel.
- **Stable cache keys** — files are keyed by `mediaId`, not slide index, so
  reordering a playlist or reusing media no longer re-downloads everything.
- **Orphan cleanup** — cached files no longer referenced by the active playlist
  are deleted, so storage doesn't fill up and start rejecting writes.

### 4. Lighter, non-blocking rotation
- Removed the `rollingDecodedMap` (kept 3 extra full-res decoded images in RAM).
  Only the two on-screen `<img>` buffers are decoded now; the next slide is
  prefetched into the hidden buffer.
- Added an image **load watchdog** + immediate **onerror skip**: a slow or
  unreachable asset advances to the next slide instead of freezing the screen
  (with a small delay to avoid a CPU spin when an entire playlist is offline).

## How to verify on a TV

Open the remote web inspector and watch the console:

- `[Player] Cached <name> (<bytes>)` — a download that landed and verified.
- `[Player] Total: N, Cached: X, Downloading: Y` — the sync summary; on a warm
  cache `Downloading` should be `0`.
- `[TIMING] Slide … | Paint <ms> | Drift <ms>` — paint should be small (tens of
  ms) and drift near zero. Large paint latency ⇒ image still too big (check the
  resize is being applied).
- Pull the network cable after the first full download: playback should keep
  looping from disk.

## Still worth doing (server-side, not in this change)

- Generate/transcode a **1080p H.264 MP4** variant for videos on upload.
- Consider a storage budget / LRU eviction if playlists get very large.
