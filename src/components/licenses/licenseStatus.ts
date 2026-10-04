import type { License } from '../../lib/licensingStore';

export type LicenseStateKey = 'active' | 'expiring' | 'expired' | 'pending' | 'unassigned';

export function daysUntil(date?: string): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function formatDate(date?: string): string {
  if (!date) return '—';
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return date;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatInr(n?: number): string {
  return `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

export function relativeDays(days: number | null): string {
  if (days === null) return 'No expiry date';
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`;
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  return `${days} days left`;
}

/** Expiry date a new license gets when none is picked: one billing period from today. */
/** YYYY-MM-DD in the user's own time zone (toISOString is UTC — before
 * 5:30 am in India it gave yesterday's date). */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Exactly one month/year after `from` (31 Jan + 1 month = 28/29 Feb, like the server). */
export function defaultExpiry(tenure: 'monthly' | 'yearly', from = new Date()): string {
  const months = tenure === 'yearly' ? 12 : 1;
  const y = from.getFullYear(), m = from.getMonth() + months, d = from.getDate();
  const lastDay = new Date(y, m + 1, 0).getDate();
  return localDate(new Date(y, m, Math.min(d, lastDay)));
}

/**
 * What a license actually is right now. The stored status stays "active"
 * after the expiry date passes until something renews or edits it, so the
 * date is checked too — otherwise lapsed licenses showed as Active.
 */
export function licenseState(lic: License): { key: LicenseStateKey; label: string; className: string; days: number | null } {
  const days = daysUntil(lic.expiryDate);
  if (lic.status === 'pending_payment') {
    return { key: 'pending', label: 'Awaiting payment', className: 'bg-amber-50 text-amber-700 border-amber-100', days };
  }
  if (lic.status === 'expired' || (days !== null && days < 0)) {
    // Within the grace period the client still has full access.
    const inGrace = days !== null && days >= -7 && !!lic.assignedUserEmail;
    return { key: 'expired', label: inGrace ? `Expired · grace ${7 + days}d` : lic.assignedUserEmail ? 'Expired · paused' : 'Expired', className: 'bg-rose-50 text-rose-700 border-rose-100', days };
  }
  if (!lic.assignedUserEmail) {
    return { key: 'unassigned', label: 'Unassigned', className: 'bg-slate-100 text-slate-600 border-slate-200', days };
  }
  if (days !== null && days <= 30) {
    return { key: 'expiring', label: days === 0 ? 'Expires today' : `${days}d left`, className: 'bg-orange-50 text-orange-700 border-orange-100', days };
  }
  return { key: 'active', label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', days };
}

/** "₹1,000 / month" */
export function planLabel(lic: Pick<License, 'price' | 'tenure'>): string {
  return `${formatInr(lic.price)} / ${lic.tenure === 'yearly' ? 'year' : 'month'}`;
}

/**
 * Dashboard access for a client's licence — mirrors server
 * services/licenseAccess.ts (keep the two in step). TVs are never affected.
 *   ok      — paid up
 *   grace   — expired up to GRACE_DAYS ago: full access + renew banner
 *   blocked — past grace, or a new licence's first invoice is unpaid:
 *             only Billing, Help and Profile until they pay
 */
export const GRACE_DAYS = 7;

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const plusDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export type LicenseAccess = { state: 'ok' | 'grace' | 'blocked'; reason?: 'first_payment' | 'expired'; daysLeft: number | null; graceEnds?: string; graceDaysLeft?: number };

export function licenseAccess(lic: Pick<License, 'status' | 'expiryDate'> & { created?: string }): LicenseAccess {
  const today = istToday();
  const expiry = lic.expiryDate ? String(lic.expiryDate).slice(0, 10) : '';
  const daysLeft = expiry ? dayDiff(today, expiry) : null;
  const created = lic.created ? String(lic.created).slice(0, 10) : '';
  if (lic.status === 'pending_payment' && expiry && created && expiry <= created) {
    return { state: 'blocked', reason: 'first_payment', daysLeft };
  }
  const lapsed = lic.status === 'expired' || lic.status === 'pending_payment' || (daysLeft !== null && daysLeft < 0);
  if (!lapsed) return { state: 'ok', daysLeft };
  if (!expiry) return { state: 'blocked', reason: 'expired', daysLeft };
  const graceEnds = plusDays(expiry, GRACE_DAYS);
  const graceDaysLeft = dayDiff(today, graceEnds);
  return graceDaysLeft >= 0
    ? { state: 'grace', reason: 'expired', daysLeft, graceEnds, graceDaysLeft }
    : { state: 'blocked', reason: 'expired', daysLeft, graceEnds };
}
