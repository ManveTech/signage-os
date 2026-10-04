/**
 * What a client can do with their licence right now. TVs are never affected
 * — this only gates the dashboard.
 *
 *   ok      — paid up.
 *   grace   — expired less than GRACE_DAYS ago: full access, with a banner
 *             and reminder emails.
 *   blocked — expired longer than that, or a new licence whose first
 *             invoice ("Charge now") hasn't been paid: only billing,
 *             support and their own profile until they pay.
 *
 * Keep in step with src/components/licenses/licenseStatus.ts (licenseAccess).
 */

export const GRACE_DAYS = 7;

/** Today in India (the business's time zone) as YYYY-MM-DD. */
export function istToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type LicenseAccess = {
  state: 'ok' | 'grace' | 'blocked';
  reason?: 'first_payment' | 'expired';
  /** Days until expiry (negative once expired). */
  daysLeft: number | null;
  /** Last day of full access when in grace. */
  graceEnds?: string;
};

export function licenseAccess(lic: { status?: string; expiryDate?: string; created?: string }, today = istToday()): LicenseAccess {
  const expiry = lic.expiryDate ? String(lic.expiryDate).slice(0, 10) : '';
  const daysLeft = expiry ? daysBetween(today, expiry) : null;

  // "Charge now" licences are created with their expiry on the creation
  // day and wait for the first payment — pay first, no grace period.
  const created = lic.created ? String(lic.created).slice(0, 10) : '';
  if (lic.status === 'pending_payment' && expiry && created && expiry <= created) {
    return { state: 'blocked', reason: 'first_payment', daysLeft };
  }

  const lapsed = lic.status === 'expired' || lic.status === 'pending_payment' || (daysLeft !== null && daysLeft < 0);
  if (!lapsed) return { state: 'ok', daysLeft };

  // No date to count from: treat as paused until paid.
  if (!expiry) return { state: 'blocked', reason: 'expired', daysLeft };
  const graceEnds = addDays(expiry, GRACE_DAYS);
  return today <= graceEnds
    ? { state: 'grace', reason: 'expired', daysLeft, graceEnds }
    : { state: 'blocked', reason: 'expired', daysLeft, graceEnds };
}

const RANK = { ok: 2, grace: 1, blocked: 0 } as const;

/**
 * A client can hold several licences (e.g. an add-on for more screens).
 * Access follows the best of them: one paid-up licence keeps the dashboard
 * open, even while a new add-on waits for its first payment. (It used to
 * follow only the newest licence, so adding an unpaid add-on locked out a
 * paying client.) Returns the licence that decides access.
 */
export function bestLicenseAccess<T extends { status?: string; expiryDate?: string; created?: string }>(
  licenses: T[], today = istToday()
): { license: T; access: LicenseAccess } | null {
  let best: { license: T; access: LicenseAccess } | null = null;
  for (const license of licenses) {
    const access = licenseAccess(license, today);
    if (!best || RANK[access.state] > RANK[best.access.state] ||
        (RANK[access.state] === RANK[best.access.state] && String(license.expiryDate || '') > String(best.license.expiryDate || ''))) {
      best = { license, access };
    }
  }
  return best;
}
