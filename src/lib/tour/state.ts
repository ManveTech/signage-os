import { API_BASE } from '../../config';
import { getAuthToken } from '../authStorage';

/**
 * Which first-run tours an account has been through.
 *
 * The account record is the source of truth (users.toursSeen), so the tour
 * shows on an account's first sign-in only — not again on every new device
 * or after clearing the browser. Sign-in copies the list into localStorage
 * (rememberToursFromLogin) and the dashboards read it from there, keyed by
 * email so switching accounts on one device doesn't share the flag.
 */

export type TourName = 'admin-dashboard' | 'user-dashboard';

const ACCOUNT_LIST_KEY = 'signageos_tours_seen';

function storageKey(tour: TourName, email: string): string {
  return `signageos_tour_seen_${tour}_${email.toLowerCase()}`;
}

export function hasSeenTour(tour: TourName, email: string): boolean {
  try {
    return localStorage.getItem(storageKey(tour, email)) === 'true';
  } catch {
    // Failing closed: if storage can't be read, don't force a tour open over
    // someone trying to work. A tour they miss is recoverable — the Support
    // page's "Take the tour" button starts it — where one they can't
    // dismiss is not.
    return true;
  }
}

/** Called at sign-in with the account's own list, so a new device knows. */
export function rememberToursFromLogin(email: string, toursSeen: unknown): void {
  const list = Array.isArray(toursSeen) ? (toursSeen as TourName[]) : [];
  try {
    localStorage.setItem(ACCOUNT_LIST_KEY, JSON.stringify(list));
    for (const tour of list) localStorage.setItem(storageKey(tour, email), 'true');
  } catch { /* the account still has it; this device just asks again */ }
}

export function markTourSeen(tour: TourName, email: string): void {
  let list: TourName[] = [];
  try {
    localStorage.setItem(storageKey(tour, email), 'true');
    list = JSON.parse(localStorage.getItem(ACCOUNT_LIST_KEY) || '[]');
  } catch {
    // Worst case the tour is offered again next time. Not worth surfacing.
  }
  if (list.includes(tour)) return;
  list = [...list, tour];
  try { localStorage.setItem(ACCOUNT_LIST_KEY, JSON.stringify(list)); } catch { /* see above */ }

  // Save it on the account so other devices know too. Best effort: if it
  // fails, this browser still remembers and the next one shows it once more.
  const userId = localStorage.getItem('signageos_user_id');
  const token = getAuthToken();
  if (!userId || !token) return;
  fetch(`${API_BASE}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    credentials: 'include',
    body: JSON.stringify({ toursSeen: list }),
  }).catch(() => {});
}
