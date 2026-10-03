import { pb } from '../db';
import { redis, isRedisReady } from '../redis';
import { sendNoticeEmail } from '../email';
import { APP_URL } from '../config';

/**
 * "Your screen went offline" emails, for owners who turned them on in
 * Settings (users.alertScreenOffline). At most one per screen per 30 minutes,
 * so a TV with a flaky connection doesn't flood anyone's inbox.
 */

const THROTTLE_SECONDS = 30 * 60;
const recentlySent = new Map<string, number>(); // used when Redis is down

async function claimSlot(screenId: string): Promise<boolean> {
  const key = `alert:offline:${screenId}`;
  if (isRedisReady()) {
    const ok = await redis.set(key, '1', 'EX', THROTTLE_SECONDS, 'NX').catch(() => null);
    return ok === 'OK';
  }
  const last = recentlySent.get(screenId) || 0;
  if (Date.now() - last < THROTTLE_SECONDS * 1000) return false;
  recentlySent.set(screenId, Date.now());
  return true;
}

export function alertScreenOffline(screen: any, reason: string): void {
  void (async () => {
    const owner = screen?.assignedToUserEmail;
    if (!owner || !screen?.id) return;
    const user: any = await pb.collection('users')
      .getFirstListItem(pb.filter('email = {:email}', { email: owner }))
      .catch(() => null);
    if (!user?.alertScreenOffline) return;
    if (!(await claimSlot(screen.id))) return;

    const result = await sendNoticeEmail({
      toEmail: owner,
      clientName: user.name || '',
      subject: `“${screen.name}” is offline`,
      headline: `“${screen.name}” went offline`,
      message: 'The screen stopped responding, so it may be switched off or have lost its internet connection. It will show online again by itself as soon as it reconnects.',
      rows: [
        ['Screen', screen.name || 'Screen'],
        ...(screen.location && screen.location !== 'Not Specified' ? [['Location', screen.location] as [string, string]] : []),
        ['Noticed', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST'],
        ['Reason', reason],
      ],
      ctaLabel: 'Open your screens',
      ctaUrl: APP_URL
        ? `${APP_URL.replace(/\/$/, '')}/#${user.role === 'admin' || user.role === 'super_admin' ? '/admin/my-screens' : '/screens'}`
        : undefined,
    });
    if (result !== 'sent') console.warn(`[Alerts] Offline email for ${screen.id} not sent: ${result}`);
  })().catch(err => console.error('[Alerts] Offline alert failed:', err?.message || err));
}
