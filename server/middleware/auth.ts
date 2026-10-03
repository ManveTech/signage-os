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
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    // Every token this app issues (session login, password reset) is meant to
    // expire — but this was the one place that would have actually enforced
    // it, and it only checked the signature. Session tokens were signed with
    // no `exp` at all, and callers (authenticateToken) never checked it
    // either, so a leaked/stolen token — especially one sent as a Bearer
    // header rather than the httpOnly cookie, which is all that protects the
    // mobile app's copy — stayed valid forever. Centralizing the check here
    // covers every caller, including the password-reset token verification.
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) {
      return null;
    }
    return payload;
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
    path === '/screens/disconnect' ||
    path === '/api/v1/devices/sync' ||
    path === '/api/v1/devices/heartbeat' ||
    path === '/api/v1/devices/pairing-code' ||
    path === '/api/v1/devices/offline' ||
    path === '/api/v1/screens/disconnect' ||
    path.endsWith('/devices/sync') ||
    path.endsWith('/devices/heartbeat') ||
    path.endsWith('/devices/pairing-code') ||
    path.endsWith('/devices/offline') ||
    path.endsWith('/screens/disconnect') ||
    (req.method === 'POST' && (path === '/screen_logs' || path === '/api/v1/screen_logs' || path.endsWith('/screen_logs'))) ||
    // Razorpay's servers call this directly and carry no session cookie/JWT —
    // handleWebhook is responsible for verifying the X-Razorpay-Signature
    // header instead, so this bypass must never be added without that check.
    (req.method === 'POST' && (path === '/payments/webhook' || path === '/api/v1/payments/webhook' || path.endsWith('/payments/webhook')));

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

    // An expired/unpaid account must still be able to see its own license
    // and billing data and actually pay — previously this blocked /payments
    // (and the /licenses read the paywall itself depends on), so the only
    // customers who needed to renew were exactly the ones who couldn't.
    // Reads stay open (the dashboard shows the paywall over them); writes
    // other than payments and the user's own profile/password are blocked.
    const path: string = req.path || '';
    const isPaymentRoute = path === '/payments' || path.startsWith('/payments/');
    const isOwnUserRecord = !!req.user?.id && (path === `/users/${req.user.id}` || path === `/users/${req.user.id}/avatar`);
    // Support stays reachable too: a customer whose license lapsed (or whose
    // payment failed) is exactly who needs to open a ticket. The tickets
    // routes do their own ownership checks.
    const isSupportRoute = (req.method === 'POST') && (path === '/tickets' || /^\/tickets\/[^/]+\/messages$/.test(path));
    if (req.method === 'GET' || isPaymentRoute || isOwnUserRecord || isSupportRoute) {
      return next();
    }

    const userEmail = req.user.email;

    // Fetch user's assigned license from PocketBase
    const licenses = await pb.collection('licenses').getFullList({
      filter: pb.filter('assignedUserEmail = {:email}', { email: userEmail }),
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
