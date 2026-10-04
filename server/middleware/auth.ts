import crypto from 'crypto';
import { JWT_SECRET } from '../config';
import { bestLicenseAccess } from '../services/licenseAccess';
import { pb } from '../db';
import { resolveUserOrgId } from '../services/ownership';

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
  // Password-reset links are signed with the same key; they must only ever
  // reset a password, never act as a login.
  if (!payload || payload.purpose) {
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

    // Billing, support and the user's own account always stay reachable —
    // a client whose access is paused needs exactly these to pay or ask for
    // help. TVs use /devices/* (no login) and are never gated.
    const path: string = req.path || '';
    const isGet = req.method === 'GET';
    const isPaymentRoute = path === '/payments' || path.startsWith('/payments/');
    const isOwnUserRecord = !!req.user?.id && (path === `/users/${req.user.id}` || path === `/users/${req.user.id}/avatar`);
    const isSupportRoute = path === '/tickets' || path.startsWith('/tickets/') ||
      (isGet && (path.startsWith('/faqs') || path.startsWith('/support_docs')));
    const isBillingRead = isGet && (path === '/licenses' || path.startsWith('/licenses/') || path === '/invoices' ||
      path.startsWith('/invoices/') || path === '/business-details' || path === '/organizations' || path.startsWith('/organizations/'));
    const isAccountRoute = path === '/me/settings';
    if (isPaymentRoute || isOwnUserRecord || isSupportRoute || isBillingRead || isAccountRoute) {
      return next();
    }

    const userEmail = req.user.email;
    // Fetch user's assigned license from PocketBase
    let licenses = await pb.collection('licenses').getFullList({
      filter: pb.filter('assignedUserEmail = {:email}', { email: userEmail }),
      sort: '-created'
    });
    // Team members (content managers, viewers) have no licence of their own
    // — their organisation's applies, so they're paused along with it.
    if (licenses.length === 0) {
      const orgId = await resolveUserOrgId(userEmail);
      if (orgId) {
        licenses = await pb.collection('licenses').getFullList({
          filter: pb.filter('assignedOrgId = {:orgId} && assignedUserEmail != ""', { orgId }),
          sort: '-created'
        });
      }
    }

    if (licenses.length === 0) {
      // No license assigned - allow access (configurable business rule)
      console.warn(`[License] No license found for user: ${userEmail}`);
      return next();
    }

    const { license, access } = bestLicenseAccess(licenses as any[])!;
    if (access.state === 'blocked') {
      return res.status(402).json({
        error: 'License expired or payment required',
        code: 'license_paused',
        reason: access.reason,
        message: access.reason === 'first_payment'
          ? 'Pay your first invoice to start using your dashboard.'
          : 'Your plan has expired. Renew it from Billing to continue — your screens keep playing.',
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
