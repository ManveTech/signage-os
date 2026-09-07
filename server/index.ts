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

const app = express();
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
// 100 MB limit covers all normal API payloads including large base64 media uploads.
// The verify callback stashes the exact raw bytes on req.rawBody — needed to
// cryptographically verify the Razorpay webhook signature, which is computed
// over the raw request body, not the re-serialized parsed object.
app.use(express.json({
  limit: '100mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
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
app.get('/health', healthCheck);           // Comprehensive health check
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

// Setup Socket.io event handlers for video conferencing
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Display joins a room by display ID
  socket.on('register-display', async (displayId: string) => {
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
  socket.on('video:join-conference', (data: any) => {
    const conferenceId = typeof data === 'string' ? data : data?.conferenceId;
    if (!conferenceId) return;
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
  // toScreenId set -> caller sending to a specific display (offer/ICE).
  // toScreenId absent -> display sending back to the caller (answer/ICE),
  // routed via the per-conference room the caller joined above.
  socket.on('webrtc:signal', (data: any) => {
    const { conferenceId, toScreenId, screenId, signal } = data;

    if (toScreenId) {
      console.log(`[Socket.io] WebRTC signal from caller for screen ${toScreenId}`);
      io.to(`screen-${toScreenId}`).emit('webrtc:signal', {
        conferenceId,
        signal
      });
    } else if (conferenceId) {
      // screenId identifies which display this answer/candidate belongs to —
      // required so the caller can route it to that screen's own peer
      // connection when a conference targets more than one screen at once.
      console.log(`[Socket.io] WebRTC signal from display ${screenId} for conference ${conferenceId}`);
      socket.to(`conference-${conferenceId}`).emit('webrtc:signal', {
        conferenceId,
        screenId,
        signal
      });
    }
  });

  // Handle conference initiation
  socket.on('video:initiate-conference', (data: any) => {
    const { conferenceId, targetScreenIds } = data;
    console.log(`[Socket.io] Conference ${conferenceId} initiated for screens:`, targetScreenIds);

    targetScreenIds?.forEach((screenId: string) => {
      io.to(`screen-${screenId}`).emit('conference:initiated', data);
      setActiveConference(screenId, data);
    });
  });

  // Handle conference end
  socket.on('video:end-conference', (data: any) => {
    const { conferenceId, targetScreenIds } = data;
    console.log(`[Socket.io] Conference ${conferenceId} ended`);

    targetScreenIds?.forEach((screenId: string) => {
      io.to(`screen-${screenId}`).emit('conference:ended', { conferenceId });
      clearActiveConference(screenId);
    });
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

  // In-call text chat. Caller includes targetScreenIds (routes to the display's
  // room); the display just has conferenceId (routes to the caller's conference room).
  socket.on('chat:message', (data: any) => {
    const { conferenceId, targetScreenIds } = data;
    if (conferenceId) {
      socket.to(`conference-${conferenceId}`).emit('chat:message', data);
    }
    targetScreenIds?.forEach((screenId: string) => {
      io.to(`screen-${screenId}`).emit('chat:message', data);
    });
  });

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
