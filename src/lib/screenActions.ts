import { API_BASE } from '../config';
import { getAuthToken } from './authStorage';

async function post(path: string, body?: unknown): Promise<any> {
  const token = getAuthToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || `Request failed (${res.status})`);
  return data;
}

export type PingResult = {
  online: boolean;
  /** Answered over the heartbeat channel only (TV app too old for live checks). */
  viaHeartbeat?: boolean;
  unlinked?: boolean;
  latencyMs?: number;
  lastSeen?: string | null;
  message?: string;
  checkedAt?: string;
  device?: {
    appVersion?: string;
    playing?: boolean;
    paused?: boolean;
    currentAsset?: string;
    assetsReady?: number;
    assetsTotal?: number;
    downloading?: boolean;
  };
};

/** Asks the TV, live, whether it's there — and updates its stored status to match. */
export function pingScreen(screenId: string): Promise<PingResult> {
  return post(`/screens/${screenId}/ping`);
}

/** Detaches the TV but keeps the screen (settings, playlist, group) for re-pairing. */
export function unlinkScreen(screenId: string): Promise<any> {
  return post(`/screens/${screenId}/unlink`);
}

/** Attaches the TV currently showing `pairingCode` to an existing (unlinked) screen. */
export function pairTvToScreen(screenId: string, pairingCode: string): Promise<any> {
  return post('/screens/reconnect', { screenId, pairingCode: pairingCode.trim().toUpperCase() });
}
