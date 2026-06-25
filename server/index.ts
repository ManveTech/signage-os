import express from 'express';
import dns from 'dns';
import { EventSource } from 'eventsource';

// Polyfill EventSource for PocketBase SDK real-time SSE in Node.js
(global as any).EventSource = EventSource;

// Force Node.js to prioritize IPv4 DNS resolution to prevent ENETUNREACH errors on IPv6 networks
dns.setDefaultResultOrder('ipv4first');

import { PORT } from './config';
import { authenticatePBAdmin, startAuthKeepAlive } from './db';
import apiRouter from './routes';
import { startScheduler } from './scheduler';
import { listenToCollectionChanges } from './cache_invalidator';
import { ensureRedisRunning } from './redis';

const app = express();

// CORS — restrict to configured origin in production, allow all in dev
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Assigned-To-User-Email');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Mount all API endpoints under /api/v1
app.use('/api/v1', apiRouter);

// Start server only after PocketBase admin auth is ready
async function startServer() {
  try {
    await ensureRedisRunning();
  } catch (err: any) {
    console.error('[Redis Boot] Failed to ensure Redis is running:', err.message);
  }
  await authenticatePBAdmin();
  app.listen(PORT, () => {
    console.log(`[dotenv] injecting env variables`);
    console.log(`Express auth proxy server running on http://localhost:${PORT}`);
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
