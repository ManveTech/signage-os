import express from 'express';
import cookieParser from 'cookie-parser';
import dns from 'dns';
import { EventSource } from 'eventsource';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

// Polyfill EventSource for PocketBase SDK real-time SSE in Node.js
(global as any).EventSource = EventSource;

// Force Node.js to prioritize IPv4 DNS resolution to prevent ENETUNREACH errors on IPv6 networks
dns.setDefaultResultOrder('ipv4first');

import { PORT, CORS_ALLOWED_ORIGINS } from './config';
import { authenticatePBAdmin, startAuthKeepAlive } from './db';
import apiRouter from './routes';
import { startScheduler } from './scheduler';
import { listenToCollectionChanges } from './cache_invalidator';
import { ensureRedisRunning, isRedisReady, redis } from './redis';
import { apiLimiter } from './middleware/rateLimiter';

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

// CORS — Must be the VERY FIRST middleware so preflight OPTIONS requests return Access-Control-Allow-* headers immediately
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

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
app.use(express.json({ limit: '100mb' }));
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

// Serve frontend static build files from dist/
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

// SPA Catch-all Fallback: Return index.html for non-API GET requests so client-side router handles URLs on refresh
app.get('*', (req: any, res: any, next: any) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'), (err: any) => {
    if (err) {
      res.status(404).send('Application build not found. Please run npm run build.');
    }
  });
});

// Setup Socket.io event handlers for video conferencing
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Display joins a room by display ID
  socket.on('register-display', (displayId: string) => {
    socket.join(`screen-${displayId}`);
    console.log(`[Socket.io] Display ${displayId} registered (socket: ${socket.id})`);
  });

  // The caller joins a per-conference room right after creating the conference,
  // so displays have a place to send their answer/ICE candidates back to
  // without needing to know the caller's socket id.
  socket.on('video:join-conference', (data: any) => {
    const conferenceId = typeof data === 'string' ? data : data?.conferenceId;
    if (!conferenceId) return;
    socket.join(`conference-${conferenceId}`);
    console.log(`[Socket.io] Socket ${socket.id} joined conference-${conferenceId}`);
  });

  // Handle WebRTC signals between caller and displays.
  // toScreenId set -> caller sending to a specific display (offer/ICE).
  // toScreenId absent -> display sending back to the caller (answer/ICE),
  // routed via the per-conference room the caller joined above.
  socket.on('webrtc:signal', (data: any) => {
    const { conferenceId, toScreenId, signal } = data;

    if (toScreenId) {
      console.log(`[Socket.io] WebRTC signal from caller for screen ${toScreenId}`);
      io.to(`screen-${toScreenId}`).emit('webrtc:signal', {
        conferenceId,
        signal
      });
    } else if (conferenceId) {
      console.log(`[Socket.io] WebRTC signal from display for conference ${conferenceId}`);
      socket.to(`conference-${conferenceId}`).emit('webrtc:signal', {
        conferenceId,
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
    });
  });

  // Handle conference end
  socket.on('video:end-conference', (data: any) => {
    const { conferenceId, targetScreenIds } = data;
    console.log(`[Socket.io] Conference ${conferenceId} ended`);

    targetScreenIds?.forEach((screenId: string) => {
      io.to(`screen-${screenId}`).emit('conference:ended', { conferenceId });
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
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
