import { pb, ensurePBAuth } from '../db';
import { sendBillingReminderEmail } from '../email';
import { APP_URL } from '../config';
import { GRACE_DAYS, istToday, daysBetween, addDays, licenseAccess, bestLicenseAccess } from './licenseAccess';

/**
 * Automatic renewal reminders. Each licence gets at most one email per
 * stage per renewal date (recorded in licenses.remindersSent):
 *
 *   invoice   — a new "Charge now" licence: its first invoice
 *   before    — 7 days (or less) before expiry
 *   due       — on the expiry day (or within 2 days after)
 *   grace     — 3 days after expiry, while access continues
 *   paused    — once the grace period ends and dashboard access stops
 *
 * Runs hourly; only sends during the day in India. If the server was down
 * for a stage, that stage is skipped rather than sending several at once.
 */

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

type Stage = 'invoice' | 'before' | 'due' | 'grace' | 'paused';

export function reminderStage(lic: any, today = istToday()): Stage | null {
  if (!lic.assignedUserEmail || !lic.expiryDate || !(Number(lic.price) > 0)) return null;
  const access = licenseAccess(lic, today);
  if (access.reason === 'first_payment') return 'invoice';
  const d = daysBetween(today, String(lic.expiryDate).slice(0, 10));
  if (d >= 1 && d <= 7) return 'before';
  if (d <= 0 && d >= -2) return 'due';
  if (d <= -3 && access.state === 'grace') return 'grace';
  if (access.state === 'blocked') return 'paused';
  return null;
}

/**
 * `covered`: the client has another licence that keeps their dashboard open,
 * so this one lapsing doesn't pause anything — the email says so.
 */
function emailFor(stage: Stage, lic: any, covered = false) {
  const expiry = String(lic.expiryDate).slice(0, 10);
  const graceEnds = addDays(expiry, GRACE_DAYS);
  const plan = `${inr(lic.price)} / ${lic.tenure === 'yearly' ? 'year' : 'month'}`;
  const rows: [string, string][] = [['License', lic.name || '—'], ['Plan', plan]];
  if (covered && (stage === 'due' || stage === 'grace')) {
    return {
      subject: `"${lic.name}" ${stage === 'due' && daysBetween(istToday(), expiry) === 0 ? 'is due today' : 'has expired'}`,
      headline: 'Time to renew',
      message: `Your licence "${lic.name}" was due on ${fmt(expiry)}. Renew it from the Billing page to keep it active.`,
      rows: [...rows, ['Due date', fmt(expiry)]],
      cta: 'Renew now',
    };
  }
  switch (stage) {
    case 'invoice':
      return {
        subject: `Your invoice for ${lic.name || 'your signage licence'}`,
        headline: 'Your licence is ready — one step left',
        message: 'Pay your first invoice from the Billing page to start using your dashboard. Your licence runs from the day you pay.',
        rows: [...rows, ['Amount due', inr(lic.price)]],
        cta: 'Pay now',
      };
    case 'before':
      return {
        subject: `Your licence renews on ${fmt(expiry)}`,
        headline: 'Time to renew',
        message: `Your licence "${lic.name}" is due for renewal on ${fmt(expiry)}. Renewing early adds the new period after the current one, so you lose nothing.`,
        rows: [...rows, ['Renewal date', fmt(expiry)]],
        cta: 'Renew now',
      };
    case 'due':
      return {
        subject: `Your licence ${daysBetween(istToday(), expiry) === 0 ? 'expires today' : 'has expired'}`,
        headline: 'Your licence is due',
        message: `Renew by ${fmt(graceEnds)} to keep using your dashboard. Your screens keep playing either way.`,
        rows: [...rows, ['Expired / expires', fmt(expiry)], ['Dashboard access until', fmt(graceEnds)]],
        cta: 'Renew now',
      };
    case 'grace':
      return {
        subject: `Renew by ${fmt(graceEnds)} to keep dashboard access`,
        headline: 'Your licence has expired',
        message: `Your dashboard stays open until ${fmt(graceEnds)}. After that it pauses until you renew — your screens keep playing.`,
        rows: [...rows, ['Expired on', fmt(expiry)], ['Dashboard access until', fmt(graceEnds)]],
        cta: 'Renew now',
      };
    case 'paused':
      return {
        subject: 'Your dashboard access is paused',
        headline: 'Renew to continue',
        message: 'Your licence has expired and the grace period has ended, so dashboard access is paused. Your screens are still playing. Renew from the Billing page to get back in straight away.',
        rows: [...rows, ['Expired on', fmt(expiry)]],
        cta: 'Renew now',
      };
  }
}

let running = false;

export async function runBillingReminders(now = new Date()): Promise<{ sent: number; skipped: number }> {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(now));
  if (hour < 9 || hour >= 20 || running) return { sent: 0, skipped: 0 };
  running = true;
  let sent = 0, skipped = 0;
  try {
    await ensurePBAuth();
    const today = istToday(now);
    const licenses = await pb.collection('licenses').getFullList({ filter: 'assignedUserEmail != ""' });
    const byClient = new Map<string, any[]>();
    for (const lic of licenses as any[]) byClient.set(lic.assignedUserEmail, [...(byClient.get(lic.assignedUserEmail) || []), lic]);
    for (const lic of licenses as any[]) {
      const stage = reminderStage(lic, today);
      if (!stage) continue;
      // Another licence keeps this client's dashboard open: no "paused"
      // email, and due/grace emails don't talk about losing access.
      const overall = bestLicenseAccess(byClient.get(lic.assignedUserEmail) || [lic], today);
      const covered = !!overall && overall.license.id !== lic.id && overall.access.state === 'ok';
      if (covered && stage === 'paused') continue;
      const expiry = String(lic.expiryDate).slice(0, 10);
      const record: Record<string, string[]> = lic.remindersSent && typeof lic.remindersSent === 'object' ? lic.remindersSent : {};
      if ((record[expiry] || []).includes(stage)) continue;

      const e = emailFor(stage, lic, covered);
      const result = await sendBillingReminderEmail({
        toEmail: lic.assignedUserEmail,
        clientName: lic.assignedOrgName,
        subject: e.subject,
        headline: e.headline,
        message: e.message,
        rows: e.rows as [string, string][],
        ctaLabel: e.cta,
        ctaUrl: APP_URL ? `${APP_URL.replace(/\/$/, '')}/#/license-billing` : undefined,
      });
      if (result !== 'sent') {
        // Email not set up (or the server refused): try again next hour.
        skipped++;
        if (result === 'not_configured') break;
        continue;
      }
      // Only this renewal date's history is kept.
      await pb.collection('licenses').update(lic.id, { remindersSent: { [expiry]: [...(record[expiry] || []), stage] } }).catch(() => {});
      sent++;
      console.log(`[Reminders] Sent "${stage}" to ${lic.assignedUserEmail} for "${lic.name}" (expiry ${expiry}).`);
    }
  } catch (err: any) {
    console.error('[Reminders] Run failed:', err.message);
  } finally {
    running = false;
  }
  return { sent, skipped };
}
