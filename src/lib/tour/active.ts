/**
 * Which tour is on screen, and how to end it.
 *
 * Its own module with no dependencies, so the Android back-button handler
 * (hooks/useCapacitor.ts) can end a tour without importing the runner — and
 * with it driver.js and its styles — into the bundle every page loads.
 */
let stopActive: (() => void) | null = null;

export function setActiveTour(stop: (() => void) | null): void {
  stopActive = stop;
}

/** Whether a tour is on screen right now. */
export function isTourRunning(): boolean {
  return stopActive !== null;
}

/**
 * Ends whatever tour is running, from outside it — Android's back button.
 * Returns whether there was one, so the caller knows the press was used.
 */
export function stopActiveTour(): boolean {
  if (!stopActive) return false;
  stopActive();
  return true;
}
