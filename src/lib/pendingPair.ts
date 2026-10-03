/**
 * A TV's pairing QR opens `<dashboard>/#/pair?code=ABC123`. The code is held
 * here (this browser tab only, for 15 minutes) through sign-in, until the
 * Add screen flow uses it to connect the TV.
 */

const KEY = 'signageos_pending_pair';
const TTL_MS = 15 * 60 * 1000;

/** The 6-character code from a scanned QR — either a pairing link or the bare code (older TVs). */
export function parsePairCode(value: string): string {
  const text = (value || '').trim();
  const fromUrl = text.match(/[?&]code=([A-Za-z0-9]+)/);
  return (fromUrl ? fromUrl[1] : text).replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
}

export function setPendingPairCode(code: string): void {
  const clean = parsePairCode(code);
  if (clean.length < 4) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ code: clean, at: Date.now() })); } catch { /* storage blocked */ }
}

export function getPendingPairCode(): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw);
    if (!code || Date.now() - at > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingPairCode(): void {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}
