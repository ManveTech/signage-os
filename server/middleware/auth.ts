import crypto from 'crypto';
import { JWT_SECRET } from '../config';
import { bestLicenseAccess } from '../services/licenseAccess';
import { pb, ensurePBAuth } from '../db';
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

/**
 * Sessions are signed tokens that last 7 days. Each one is also checked
 * against the live account, so deleting a user, changing their role or
 * deactivating them ends their sessions straight away instead of at expiry.
 * The lookup is cached for a short while; if the database can't be reached
 * the session is let through rather than logging everyone out.
 */
const SESSION_CHECK_MS = 30_000;
const sessionCache = new Map<string, { role: string; status: string; exists: boolean; at: number }>();

/** Forget the cached account so the next request re-checks it (after delete / role change). */
export function forgetSession(userId: string | undefined): void {
  if (!userId) return;
  sessionCache.delete(userId);
  // Live connections of a session that just ended are closed too.
  const io = (global as any).io;
  io?.fetchSockets?.().then(async (sockets: any[]) => {
    for (const sk of sockets) {
      if (sk.data?.user?.id === userId && !(await sessionStillValid(sk.data.user))) sk.disconnect(true);
    }
  }).catch(() => {});
}

async function sessionStillValid(payload: any): Promise<boolean> {
  if (!payload?.id) return false;
  const now = Date.now();
  let entry = sessionCache.get(payload.id);
  if (!entry || now - entry.at > SESSION_CHECK_MS) {
    try {
      await ensurePBAuth();
      const user = await pb.collection('users').getOne(payload.id, { fields: 'id,role,status' });
      entry = { role: user.role || 'client', status: user.status || 'active', exists: true, at: now };
    } catch (err: any) {
      if (err?.status !== 404) return true; // database unreachable — don't end sessions over it
      entry = { role: '', status: '', exists: false, at: now };
    }
    sessionCache.set(payload.id, entry);
    if (sessionCache.size > 10_000) sessionCache.clear();
  }
  if (!entry.exists) return false;
  if (entry.role !== (payload.role || 'client')) return false;
  return !['inactive', 'suspended', 'disabled'].includes(String(entry.status).toLowerCase());
}

function endSession(res: any) {
  res.clearCookie('auth_token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
  return res.status(401).json({ code: 'session_ended', message: 'Your session has ended. Please sign in again.' });
}

/** Socket handshakes use the same rule. */
export async function verifySession(token: string): Promise<any | null> {
  const payload = verifyJwt(token);
  if (!payload || payload.purpose) return null;
  return (await sessionStillValid(payload)) ? payload : null;
}

export async function authenticateToken(req: any, res: any, next: any) {
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

  if (!(await sessionStillValid(payload))) {
    return endSession(res);
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
      // No licence (never given one, or it was revoked): paused like an
      // expired plan — billing, support and their profile stay open.
      return res.status(402).json({
        error: 'No active license',
        code: 'license_paused',
        reason: 'no_license',
        message: "You don't have an active plan. Contact us to get one."
      });
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
