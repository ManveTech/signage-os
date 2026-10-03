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
export function defaultExpiry(tenure: 'monthly' | 'yearly', from = new Date()): string {
  const d = new Date(from);
  if (tenure === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString().split('T')[0];
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
    return { key: 'expired', label: 'Expired', className: 'bg-rose-50 text-rose-700 border-rose-100', days };
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
