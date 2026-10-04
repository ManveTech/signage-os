import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dns from 'dns';
import { EventSource } from 'eventsource';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Polyfill EventSource for PocketBase SDK real-time SSE in Node.js
(global as any).EventSource = EventSource;

// Force Node.js to prioritize IPv4 DNS resolution to prevent ENETUNREACH errors on IPv6 networks
dns.setDefaultResultOrder('ipv4first');

// Since Node 15, an unhandled promise rejection terminates the whole process by
// default — one stray unawaited/uncaught async error anywhere in the app would
// otherwise take down every connected TV and dashboard user, not just the
// failing request. Log and keep running instead.
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process] Uncaught Exception:', err);
});

import { PORT, CORS_ALLOWED_ORIGINS } from './config';
import { authenticatePBAdmin, startAuthKeepAlive } from './db';
import apiRouter from './routes';
import { startScheduler } from './scheduler';
import { listenToCollectionChanges } from './cache_invalidator';
import { ensureRedisRunning, isRedisReady, redis } from './redis';
import { apiLimiter } from './middleware/rateLimiter';
import { getActiveConference, setActiveConference, clearActiveConference, clearActiveConferencesForConference } from './videoConferenceState';
import { createAdapter } from '@socket.io/redis-adapter';
import { verifySession } from './middleware/auth';
import { loadOwnedConference, parseTargetScreenIds } from './controllers/videoConference';
import { pb } from './db';
import { MEDIA_UPLOAD_BODY_LIMIT_BYTES } from './uploadLimits';

const app = express();

// This app is meant to run behind exactly one reverse proxy (Coolify/nginx —
// see getClientIp()'s comment in services/auditLog.ts, which already assumed
// this). Without `trust proxy` set, Express ignores X-Forwarded-For and
// req.ip resolves to the proxy's own address for every request — which is
// exactly what apiLimiter/authLimiter/uploadLimiter/paymentLimiter key on by
// default. In production that collapses every distinct user into one shared
// rate-limit bucket: five failed logins from anyone would lock out the whole
// app's login for 15 minutes. `1` trusts exactly one hop (the proxy in
// front), so it reads the real client IP from the proxy's X-Forwarded-For
// without also trusting a header an internet client could set directly —
// that only holds if this process is never reachable except through that
// proxy (true for a Docker-networked Coolify deployment; if it's ever
// changed to expose this port directly to the internet, this must change
// too or IP-based limiting becomes spoofable).
app.set('trust proxy', 1);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ALLOWED_ORIGINS.includes('*') ? '*' : CORS_ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make Socket.io instance globally available for video conferencing
(global as any).io = io;

// Redis adapter — without this, io.to(room).emit(...) only reaches sockets
// connected to THIS process. That's fine today with one instance, but it's
// the prerequisite for ever running more than one (item 2 of the scaling
// plan: no horizontal scaling is possible for realtime features until this
// is in place). Falls back to Socket.IO's default in-memory adapter if Redis
// isn't reachable — single-instance behavior is unchanged either way.
try {
  // maxRetriesPerRequest: null is ioredis's documented setting for exactly
  // this case — a pub/sub client should queue and retry forever in the
  // background rather than reject its command with MaxRetriesPerRequestError
  // when Redis is briefly unreachable. Without it, that rejection surfaces as
  // an unhandled promise rejection from inside the adapter constructor itself
  // (not something this try/catch can catch, since it happens async).
  const pubClient = redis.duplicate({ maxRetriesPerRequest: null });
  const subClient = redis.duplicate({ maxRetriesPerRequest: null });
  io.adapter(createAdapter(pubClient, subClient));
  pubClient.on('error', (err) => console.warn('[Socket.IO Redis Adapter] pubClient error:', err.message));
  subClient.on('error', (err) => console.warn('[Socket.IO Redis Adapter] subClient error:', err.message));
  console.log('[Socket.IO Redis Adapter] Configured — falls back to in-memory behavior until Redis connects.');
} catch (err: any) {
  console.warn('[Socket.IO Redis Adapter] Failed to configure, using default in-memory adapter:', err.message);
}

// Baseline security headers (HSTS, X-Content-Type-Options, X-Frame-Options, etc.).
// CSP and cross-origin-embedder-policy are left off for now — a strict CSP needs
// the SPA's actual script/style/media sources audited first, and COEP would
// break getUserMedia/cross-origin media used by video conferencing.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — Must be the VERY FIRST middleware so preflight OPTIONS requests return Access-Control-Allow-* headers immediately
const corsAllowAll = CORS_ALLOWED_ORIGINS.includes('*');
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && (corsAllowAll || CORS_ALLOWED_ORIGINS.includes(origin))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  // else: origin present but not in CORS_ALLOWED_ORIGINS — no ACAO header is set,
  // so the browser blocks the cross-origin response instead of allowing it through.

  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Assigned-To-User-Email, X-Screen-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Cookie parser middleware - must be before routes that need req.cookies
app.use(cookieParser());

// Apply global rate limiting to all API requests (except health checks)
app.use('/api', apiLimiter);

// Global Middleware
// 100 MB limit covers all normal API payloads; media uploads get their own
// larger limit (see mediaUploadJsonParser below).
// The verify callback stashes the exact raw bytes on req.rawBody — needed to
// cryptographically verify the Razorpay webhook signature, which is computed
// over the raw request body, not the re-serialized parsed object.
const defaultJsonParser = express.json({
  limit: '100mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
});
// Media uploads (base64 in JSON) can be far larger than any other request —
// they get their own parser with a higher limit, scoped to that one route,
// instead of raising the limit for every endpoint.
const mediaUploadJsonParser = express.json({ limit: MEDIA_UPLOAD_BODY_LIMIT_BYTES });
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/api/v1/media_items') {
    return mediaUploadJsonParser(req, res, next);
  }
  return defaultJsonParser(req, res, next);
});
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Handle JSON body-parser syntax errors gracefully
app.use((err: any, req: any, res: any, next: any) => {
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400 && 'body' in err) {
    console.error('[JSON Parser] Malformed JSON payload received:', err.message);
    return res.status(400).json({ error: 'Malformed JSON payload' });
  }
  next(err);
});

// Favicon handler to silence browser 404 console errors
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health check endpoints
import { healthCheck, readinessCheck, livenessCheck } from './controllers/health';
// /health does a real PocketBase query, a Redis ping, and an R2 connection
// test on every hit — unlike /ready and /live (cheap, and must stay
// unthrottled since k8s-style probes hit them on a tight per-pod schedule),
// it's expensive enough to rate-limit against an unauthenticated caller
// hammering it.
app.get('/health', apiLimiter, healthCheck);
app.get('/health/ready', readinessCheck);  // Kubernetes readiness probe
app.get('/health/live', livenessCheck);    // Kubernetes liveness probe

// Legacy health check for backward compatibility
app.get('/api/v1/health', async (req, res) => {
  let redisStatus = 'disconnected';
  let redisPing = 'error';

  if (isRedisReady()) {
    try {
      const pong = await redis.ping();
      redisStatus = 'connected';
      redisPing = pong;
    } catch (err: any) {
      redisStatus = 'error';
      redisPing = err.message || 'unknown error';
    }
  }

  res.status(200).json({
    status: 'OK',
    redis: {
      status: redisStatus,
      ping: redisPing
    }
  });
});

import path from 'path';

// Mount all API endpoints under /api/v1
app.use('/api/v1', apiRouter);

// Serve frontend static build files from dist/ with proper Cache-Control rules
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// SPA Catch-all Fallback: Return index.html for non-API GET requests so client-side router handles URLs on refresh
app.get('*', (req: any, res: any, next: any) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(distPath, 'index.html'), (err: any) => {
    if (err) {
      res.status(404).send('Application build not found. Please run npm run build.');
    }
  });
});

// Reverse lookup so we know which screen a given socket represents when it
// tells us (via video:leave-conference) that it's intentionally leaving.
const socketScreenIds = new Map<string, string>();
// Which caller socket(s) are currently "in" each conference (joined via
// video:join-conference). If every caller socket for a conference disconnects
// without ever calling video:end-conference — closed tab, browser crash, or
// just the /end REST endpoint being hit without a matching socket emit — we
// use this to detect the call is really over and clean up activeConferences
// so a reconnecting display doesn't get stuck endlessly trying to rejoin a
// call nobody is on the other end of anymore.
const conferenceCallerSockets = new Map<string, Set<string>>();

// A caller's socket.id changes on every reconnect (network blip, laptop sleep,
// etc.), so losing the last caller socket doesn't necessarily mean the caller
// is gone for good — give them a window to reconnect and re-emit
// video:join-conference before we tear down the screen's rejoin state.
const CALLER_GONE_GRACE_MS = 15000;
const pendingCallerGoneCleanup = new Map<string, ReturnType<typeof setTimeout>>();

// Optional handshake auth — TV displays have no JWT (there's no per-device
// credential today, same as the /devices/* REST bypass list above them), so
// a connection is never rejected for lacking one. Dashboard/caller clients
// do send one; when it's present and valid it's attached to the socket so
// the conference-room-entry handlers below can check real ownership instead
// of trusting whatever conferenceId a socket happens to send.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token) {
    const payload = await verifySession(token).catch(() => null);
    if (payload) {
      (socket.data as any).user = payload;
    }
  }
  next();
});

/**
 * Socket authorization for calls. Ownership of a conference is checked once
 * per socket and remembered; its screen list is cached and re-read when a
 * screen isn't in it (screens can be added mid-call via the REST API), so
 * ICE candidates don't each cost a database read.
 */
type SocketCallCache = { owned: Set<string>; targets: Map<string, string[]> };
function callCache(socket: any): SocketCallCache {
  if (!socket.data.calls) socket.data.calls = { owned: new Set(), targets: new Map() };
  return socket.data.calls;
}

async function conferenceTargets(socket: any, conferenceId: string, refresh = false): Promise<string[]> {
  const cache = callCache(socket);
  if (!refresh && cache.targets.has(conferenceId)) return cache.targets.get(conferenceId)!;
  const record: any = await pb.collection('video_conferences').getOne(conferenceId).catch(() => null);
  const targets = record && record.status !== 'ended' ? parseTargetScreenIds(record.targetScreenIds) : [];
  cache.targets.set(conferenceId, targets);
  return targets;
}

/** True if the screen is part of the conference (re-reading the list once if not). */
async function isConferenceTarget(socket: any, conferenceId: string, screenId: string): Promise<boolean> {
  if ((await conferenceTargets(socket, conferenceId)).includes(screenId)) return true;
  return (await conferenceTargets(socket, conferenceId, true)).includes(screenId);
}

/**
 * Runs a socket's handlers one at a time, in arrival order. The checks above
 * are async, and without this an ICE candidate could overtake the offer it
 * belongs to while the offer's ownership check is still running.
 */
function inOrder(socket: any, task: () => Promise<void>): void {
  const prev: Promise<void> = socket.data.queue || Promise.resolve();
  socket.data.queue = prev.then(task).catch((err: any) => console.error('[Socket.io] handler error:', err?.message || err));
}

/** True if this socket's logged-in user owns the conference (or is an admin). */
async function ownsConference(socket: any, conferenceId: string): Promise<boolean> {
  if (typeof conferenceId !== 'string' || !conferenceId) return false;
  const cache = callCache(socket);
  if (cache.owned.has(conferenceId)) return true;
  if (!socket.data.user) return false;
  try {
    await loadOwnedConference(conferenceId, socket.data.user);
    cache.owned.add(conferenceId);
    return true;
  } catch {
    return false;
  }
}

// Setup Socket.io event handlers for video conferencing
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Display joins a room by display ID
  socket.on('register-display', async (payload: any) => {
    // Current TV builds send { screenId, hardwareUuid } and are checked
    // against the screen record, so another client can't join a screen's
    // room and answer its status checks. Older builds send just the id.
    // The TV proves it is the screen's device with its hardware id. Without
    // this, anyone who knew a screen id could join its room and receive its
    // incoming calls.
    const displayId: string = typeof payload === 'string' ? payload : String(payload?.screenId || '');
    const hardwareUuid: string = typeof payload === 'object' ? String(payload?.hardwareUuid || '') : '';
    if (!displayId) return;
    const record: any = await pb.collection('screens').getOne(displayId).catch(() => null);
    if (!record || !record.hardware_uuid || !hardwareUuid || record.hardware_uuid !== hardwareUuid) {
      console.warn(`[Socket.io] Refused register-display for ${displayId}: ${!record ? 'unknown screen' : 'hardware id missing or mismatched'}`);
      socket.emit('register-display:refused', { screenId: displayId });
      return;
    }
    socket.join(`screen-${displayId}`);
    socketScreenIds.set(socket.id, displayId);
    console.log(`[Socket.io] Display ${displayId} registered (socket: ${socket.id})`);

    // If this screen was mid-conference when it disconnected (app killed and
    // reopened, page reloaded, etc.), replay the call so it rejoins instead
    // of sitting on signage while the caller is still waiting on it.
    const active = await getActiveConference(displayId);
    if (active) {
      console.log(`[Socket.io] Display ${displayId} reconnected mid-conference ${active.conferenceId}, replaying conference:initiated`);
      socket.emit('conference:initiated', active);
      if (active.conferenceId) {
        io.to(`conference-${active.conferenceId}`).emit('screen:rejoined', {
          screenId: displayId,
          conferenceId: active.conferenceId
        });
      }
    }
  });

  // The caller joins a per-conference room right after creating the conference,
  // so displays have a place to send their answer/ICE candidates back to
  // without needing to know the caller's socket id.
  socket.on('video:join-conference', async (data: any) => {
    const conferenceId = typeof data === 'string' ? data : data?.conferenceId;
    if (!conferenceId) return;

    // Without this, any socket — authenticated as a different tenant, or not
    // authenticated at all — could join another organization's conference
    // room by conferenceId alone and receive its WebRTC signaling.
    if (!(await ownsConference(socket, conferenceId))) {
      console.warn(`[Socket.io] Socket ${socket.id} denied join for conference ${conferenceId} — not the owner.`);
      return;
    }

    socket.join(`conference-${conferenceId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined conference-${conferenceId}`);

    let callerSockets = conferenceCallerSockets.get(conferenceId);
    if (!callerSockets) {
      callerSockets = new Set();
      conferenceCallerSockets.set(conferenceId, callerSockets);
    }
    callerSockets.add(socket.id);

    // The caller reconnected within the grace window — cancel the pending wipe.
    const pendingCleanup = pendingCallerGoneCleanup.get(conferenceId);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      pendingCallerGoneCleanup.delete(conferenceId);
      console.log(`[Socket.io] Caller for conference ${conferenceId} reconnected, cancelling scheduled cleanup`);
    }
  });

  // Handle WebRTC signals between caller and displays.
  // toScreenId set -> caller sending to a specific display (offer/ICE): the
  //   caller must own the conference and the screen must be part of it.
  // toScreenId absent -> display sending back to the caller (answer/ICE): the
  //   socket must be a registered TV that is part of the conference, and the
  //   screenId is taken from its registration, not the payload.
  socket.on('webrtc:signal', (data: any) => inOrder(socket, async () => {
    const { conferenceId, toScreenId, signal } = data || {};
    if (typeof conferenceId !== 'string' || !conferenceId) return;

    if (toScreenId) {
      if (!(await ownsConference(socket, conferenceId)) || !(await isConferenceTarget(socket, conferenceId, String(toScreenId)))) {
        console.warn(`[Socket.io] Dropped webrtc:signal from ${socket.id} to screen ${toScreenId} — not this caller's call.`);
        return;
      }
      io.to(`screen-${toScreenId}`).emit('webrtc:signal', { conferenceId, signal });
      return;
    }

    const screenId = socketScreenIds.get(socket.id);
    if (!screenId || !(await isConferenceTarget(socket, conferenceId, screenId))) {
      console.warn(`[Socket.io] Dropped webrtc:signal from ${socket.id} for conference ${conferenceId} — not a display in this call.`);
      return;
    }
    // screenId identifies which display this answer/candidate belongs to —
    // required so the caller can route it to that screen's own peer
    // connection when a conference targets more than one screen at once.
    socket.to(`conference-${conferenceId}`).emit('webrtc:signal', { conferenceId, screenId, signal });
  }));

  // Handle conference initiation. Only the owner can ring screens, and only
  // the screens that are actually part of the conference.
  socket.on('video:initiate-conference', async (data: any) => {
    const conferenceId = data?.conferenceId;
    if (!(await ownsConference(socket, conferenceId))) {
      console.warn(`[Socket.io] Socket ${socket.id} denied initiate for conference ${conferenceId} — not the owner.`);
      return;
    }
    const targets = await conferenceTargets(socket, conferenceId, true);
    const requested: string[] = Array.isArray(data?.targetScreenIds) ? data.targetScreenIds.map(String) : targets;
    const screenIds = requested.filter(id => targets.includes(id));
    console.log(`[Socket.io] Conference ${conferenceId} initiated for screens:`, screenIds);

    const payload = { ...data, targetScreenIds: screenIds };
    for (const screenId of screenIds) {
      io.to(`screen-${screenId}`).emit('conference:initiated', payload);
      await setActiveConference(screenId, payload);
    }
  });

  // Handle conference end (the REST /end endpoint is the usual path; this
  // socket event is kept for older dashboards). Owner only.
  socket.on('video:end-conference', async (data: any) => {
    const conferenceId = data?.conferenceId;
    if (!(await ownsConference(socket, conferenceId))) {
      console.warn(`[Socket.io] Socket ${socket.id} denied end for conference ${conferenceId} — not the owner.`);
      return;
    }
    const targets = await conferenceTargets(socket, conferenceId, true);
    console.log(`[Socket.io] Conference ${conferenceId} ended`);

    for (const screenId of targets) {
      io.to(`screen-${screenId}`).emit('conference:ended', { conferenceId });
      await clearActiveConference(screenId);
    }
    conferenceCallerSockets.delete(conferenceId);
    const pendingCleanup = pendingCallerGoneCleanup.get(conferenceId);
    if (pendingCleanup) {
      clearTimeout(pendingCleanup);
      pendingCallerGoneCleanup.delete(conferenceId);
    }
  });

  // A display intentionally leaving (not a crash/kill) — stop tracking it as
  // active so a future reconnect doesn't try to replay a call it opted out of.
  socket.on('video:leave-conference', async (data: any) => {
    const conferenceId = typeof data === 'string' ? data : data?.conferenceId;
    const screenId = socketScreenIds.get(socket.id);
    console.log(`[Socket.io] Socket ${socket.id} (screen: ${screenId}) left conference ${conferenceId}`);

    if (screenId) {
      const active = await getActiveConference(screenId);
      if (active?.conferenceId === conferenceId) {
        await clearActiveConference(screenId);
      }
    }
  });

  // In-call text chat, sent by the caller. Owner only, and only to screens
  // in the call; the conference room echo reaches the caller's other tabs.
  socket.on('chat:message', (data: any) => inOrder(socket, async () => {
    const conferenceId = data?.conferenceId;
    if (!(await ownsConference(socket, conferenceId))) return;
    const message = {
      conferenceId,
      senderName: String(data?.senderName || '').slice(0, 80),
      text: String(data?.text || '').slice(0, 1000),
      ts: Number(data?.ts) || Date.now()
    };
    if (!message.text) return;
    socket.to(`conference-${conferenceId}`).emit('chat:message', message);
    const targets = await conferenceTargets(socket, conferenceId);
    const requested: string[] = Array.isArray(data?.targetScreenIds) ? data.targetScreenIds.map(String) : targets;
    for (const screenId of requested) {
      if (targets.includes(screenId)) io.to(`screen-${screenId}`).emit('chat:message', message);
    }
  }));

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    // Deliberately leave activeConferences untouched here for the DISPLAY side
    // — a disconnect is indistinguishable from an app crash/kill, and the
    // whole point of this map is to let the screen rejoin its call when it
    // reconnects.
    socketScreenIds.delete(socket.id);

    // For the CALLER side, though, a vanished socket with no caller sockets
    // left in the conference room means nobody is actually running the call
    // anymore (closed tab, crash — including the case where /end was hit via
    // REST without a matching video:end-conference emit). Without this, a
    // screen would replay-rejoin a conference forever with no caller to
    // answer it, and (now that the display's own end-call button is gone)
    // no way to escape back to signage.
    for (const [confId, callerSockets] of conferenceCallerSockets.entries()) {
      if (callerSockets.delete(socket.id) && callerSockets.size === 0) {
        conferenceCallerSockets.delete(confId);
        console.log(`[Socket.io] Last caller socket for conference ${confId} disconnected, scheduling cleanup in ${CALLER_GONE_GRACE_MS}ms in case it reconnects`);
        const timeout = setTimeout(async () => {
          pendingCallerGoneCleanup.delete(confId);
          const clearedScreenIds = await clearActiveConferencesForConference(confId);
          clearedScreenIds.forEach((screenId) => {
            console.log(`[Socket.io] Caller for conference ${confId} is gone, notifying screen ${screenId}`);
            io.to(`screen-${screenId}`).emit('conference:ended', { conferenceId: confId });
          });
        }, CALLER_GONE_GRACE_MS);
        pendingCallerGoneCleanup.set(confId, timeout);
      }
    }
  });
});

// Safety-net error handler — catches anything a route handler throws/forwards
// without its own try/catch, so a single bad request returns a clean 500
// instead of an unhandled exception or a hung connection.
app.use((err: any, req: any, res: any, next: any) => {
  console.error('[Unhandled Route Error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server only after PocketBase admin auth is ready
async function startServer() {
  try {
    await ensureRedisRunning();
  } catch (err: any) {
    console.error('[Redis Boot] Failed to ensure Redis is running:', err.message);
  }
  await authenticatePBAdmin();
  httpServer.listen(PORT, () => {
    console.log(`[dotenv] injecting env variables`);
    console.log(`Express auth proxy server running on http://localhost:${PORT}`);
    console.log(`Socket.io server initialized on http://localhost:${PORT}`);
    // Keep PocketBase admin token alive — refreshes every 10 minutes
    startAuthKeepAlive();
    // Start playlist scheduling cron
    startScheduler();
    // Initialize cache invalidation via SSE
    listenToCollectionChanges();
  });
}

startServer();

export default app;
