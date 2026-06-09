import express from 'express';
import dns from 'dns';
// Force Node.js to prioritize IPv4 DNS resolution to prevent ENETUNREACH errors on IPv6 networks
dns.setDefaultResultOrder('ipv4first');

import { PORT } from './config';
import { authenticatePBAdmin } from './db';
import apiRouter from './routes';

const app = express();

// Global Middleware
app.use(express.json());

// Custom CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Mount all API endpoints under /api/v1
app.use('/api/v1', apiRouter);

// Start server only after PocketBase admin auth is ready
async function startServer() {
  await authenticatePBAdmin();
  app.listen(PORT, () => {
    console.log(`[dotenv] injecting env variables`);
    console.log(`Express auth proxy server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
