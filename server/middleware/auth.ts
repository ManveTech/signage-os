import crypto from 'crypto';
import { JWT_SECRET } from '../config';
import { pb } from '../db';

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
  const authHeader = req.headers['authorization'];
  const headerToken = authHeader && authHeader.split(' ')[1];

  // Check for token in httpOnly cookie first, then fall back to Authorization header
  const token = req.cookies?.auth_token || headerToken;

  const isBypassedPath =
    path === '/devices/sync' ||
    path === '/devices/heartbeat' ||
    path === '/devices/pairing-code' ||
    path === '/devices/offline' ||
    path === '/devices/clear-command' ||
    path === '/screens/disconnect' ||
    path === '/api/v1/devices/sync' ||
    path === '/api/v1/devices/heartbeat' ||
    path === '/api/v1/devices/pairing-code' ||
    path === '/api/v1/devices/offline' ||
    path === '/api/v1/devices/clear-command' ||
    path === '/api/v1/screens/disconnect' ||
    path.endsWith('/devices/sync') ||
    path.endsWith('/devices/heartbeat') ||
    path.endsWith('/devices/pairing-code') ||
    path.endsWith('/devices/offline') ||
    path.endsWith('/devices/clear-command') ||
    path.endsWith('/screens/disconnect') ||
    (req.method === 'POST' && (path === '/screen_logs' || path === '/api/v1/screen_logs' || path.endsWith('/screen_logs')));

  if (isBypassedPath && !token) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ message: 'Access token is required.' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(403).json({ message: 'Invalid or expired session token.' });
  }

  req.user = payload;
  next();
}

/**
 * Middleware to enforce license validation for client users
 * Admin users bypass this check
 */
export async function enforceLicense(req: any, res: any, next: any) {
  try {
    // Skip license check for admins
    if (req.user?.role === 'admin' || req.user?.role === 'super_admin') {
      return next();
    }

    // Skip license check if no user in request (public endpoints)
    if (!req.user?.email) {
      return next();
    }

    const userEmail = req.user.email;

    // Fetch user's assigned license from PocketBase
    const licenses = await pb.collection('licenses').getFullList({
      filter: `assignedUserEmail = "${userEmail}"`,
      sort: '-created'
    });

    if (licenses.length === 0) {
      // No license assigned - allow access (configurable business rule)
      console.warn(`[License] No license found for user: ${userEmail}`);
      return next();
    }

    const license = licenses[0];
    const today = new Date().toISOString().split('T')[0];

    // Check if license is expired or payment pending
    const isExpired =
      license.status === 'expired' ||
      license.status === 'pending_payment' ||
      (license.expiryDate && license.expiryDate < today);

    if (isExpired) {
      return res.status(402).json({
        error: 'License expired or payment required',
        message: 'Your license has expired or requires payment renewal. Please contact your administrator.',
        licenseStatus: license.status,
        expiryDate: license.expiryDate
      });
    }

    // Attach license info to request for downstream use
    req.license = license;
    next();
  } catch (error: any) {
    console.error('[License Enforcement] Error checking license:', error.message);
    // On error, allow request to proceed (fail open) but log the issue
    next();
  }
}
