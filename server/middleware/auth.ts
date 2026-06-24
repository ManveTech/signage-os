import crypto from 'crypto';
import { JWT_SECRET } from '../config';

export function verifyJwt(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expectedSigBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedSigBuf.length) {
      return null;
    }
    if (!crypto.timingSafeEqual(sigBuf, expectedSigBuf)) {
      return null;
    }
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
}

export function signJwt(payload: any): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');
  return `${headerB64}.${payloadB64}.${signature}`;
}

export function authenticateToken(req: any, res: any, next: any) {
  const path = req.path || '';
  if (
    path === '/devices/sync' || 
    path === '/devices/heartbeat' || 
    path === '/devices/pairing-code' ||
    path === '/devices/offline' ||
    path === '/api/v1/devices/sync' || 
    path === '/api/v1/devices/heartbeat' || 
    path === '/api/v1/devices/pairing-code' ||
    path === '/api/v1/devices/offline' ||
    path.endsWith('/devices/sync') ||
    path.endsWith('/devices/heartbeat') ||
    path.endsWith('/devices/pairing-code') ||
    path.endsWith('/devices/offline') ||
    (req.method === 'POST' && (path === '/screen_logs' || path === '/api/v1/screen_logs' || path.endsWith('/screen_logs')))
  ) {
    return next();
  }
  
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token is required.' });
  }

  // Simulated fallback tokens — DEV ONLY, never active in production
  if (process.env.NODE_ENV !== 'production') {
    if (token === 'offline_simulated_admin_token') {
      req.user = { id: 'admin_sys_usr', email: 'admin@demo.com', role: 'admin' };
      return next();
    }
    if (token.startsWith('offline_simulated_client_token_')) {
      const email = token.substring('offline_simulated_client_token_'.length);
      req.user = { id: `client_${email}`, email, role: 'client' };
      return next();
    }
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired session token.' });
  }

  req.user = payload;
  next();
}
