/**
 * Which tours this browser has already been shown.
 *
 * Kept in localStorage, keyed by the account's own email so switching users
 * on the same device doesn't inherit someone else's "already seen" state.
 * (VelnoranX's equivalent persists this server-side on the user record so it
 * survives a cleared browser — a reasonable upgrade later, but a schema
 * change and a new endpoint aren't warranted just to remember a tour
 * preference flag.)
 */

export type TourName = 'admin-dashboard' | 'user-dashboard';

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

export function markTourSeen(tour: TourName, email: string): void {
  try {
    localStorage.setItem(storageKey(tour, email), 'true');
  } catch {
    // Worst case the tour is offered again next time. Not worth surfacing.
  }
}
