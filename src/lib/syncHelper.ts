import { API_BASE } from '../config';
import { getAuthToken } from './authStorage';

export function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param baseDelay Initial delay in milliseconds
 * @returns Result of the function or throws after all retries exhausted
 */
class HttpError extends Error {
  status: number;
  constructor(status: number, statusText: string) {
    super(`HTTP ${status}: ${statusText}`);
    this.status = status;
  }
}

/**
 * Retry a function with exponential backoff — but only for failures a retry
 * can fix (network errors, 5xx). A 401/403/404/429 used to be retried three
 * more times too, which on a launch that loads ~15 collections turned one
 * expired session into 60 requests and tripped the server's rate limiter.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const retryable = !(error instanceof HttpError) || error.status >= 500;
      if (!retryable) break;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Generate valid 15-character alphanumeric PocketBase ID
export function generatePocketBaseId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a password that always meets PocketBase's 8-character minimum
export function generateClientPassword(clientName: string): string {
  const firstName = clientName.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') || 'client';
  const digits = Math.floor(100000 + Math.random() * 900000);
  let password = `${firstName}${digits}`;
  if (password.length < 8) {
    password = password.padEnd(8, '0');
  }
  return password;
}
export let memoryMedia: any[] = [];
export function setMemoryMedia(media: any[]) {
  // Always keep an array — every media screen calls .filter/.map on this.
  memoryMedia = Array.isArray(media) ? media : [];
}

export type PushResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number; error: string };

export async function syncAllFromDatabase(options: { force?: boolean } = {}) {
  const collections = [
    { path: 'users', key: 'signageos_users' },
    { path: 'screens', key: 'signageos_screens' },
    { path: 'screen_groups', key: 'signageos_groups' },
    { path: 'media_items', key: 'signageos_media' },
    { path: 'playlists', key: 'signageos_playlists' },
    { path: 'licenses', key: 'signageos_licenses' },
    { path: 'organizations', key: 'signageos_organizations' },
    { path: 'tickets', key: 'signageos_tickets' },
    { path: 'faqs', key: 'signageos_faqs' },
    { path: 'support_docs', key: 'signageos_docs' },
    { path: 'payments', key: 'signageos_payments' },
    { path: 'invoices', key: 'signageos_invoices' },
    { path: 'leads', key: 'signageos_leads' }
  ];

  const errors: { collection: string; error: string }[] = [];

  // Admin-only collections always 403 for a client account — skip them
  // instead of requesting (and logging a failure for) each one on every launch.
  const isAdmin = localStorage.getItem('signageos_user_role') === 'admin';
  const ADMIN_ONLY = new Set(['users', 'leads', 'payments']);

  await Promise.all(
    collections
      .filter(col => isAdmin || !ADMIN_ONLY.has(col.path))
      .map(async (col) => {
        try {
          await fetchCollection(col.path, col.key, !!options.force);
        } catch (err: any) {
          const errorMsg = err?.message || 'Unknown error';
          console.error(`Failed to sync collection ${col.path}:`, errorMsg);
          errors.push({ collection: col.path, error: errorMsg });
        }
      })
  );

  if (errors.length > 0) {
    console.warn(`Sync completed with ${errors.length} error(s):`, errors);
  }

  return { success: errors.length === 0, errors };
}

// Every screen syncs the collections it needs when it opens, on top of the
// full sync at login — so moving between tabs re-downloaded the same
// collections over and over (and several at once on the dashboard). A
// request already in flight is shared, and data fetched in the last few
// seconds is reused; pull-to-refresh passes force to bypass both.
const FRESH_MS = 20_000;
const inFlight = new Map<string, Promise<any[]>>();
const lastSyncedAt = new Map<string, number>();

function readCache(localStorageKey: string): any[] {
  if (localStorageKey === 'signageos_media') return memoryMedia;
  try {
    const stored = localStorage.getItem(localStorageKey);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

async function fetchCollection(collectionPath: string, localStorageKey: string, force = false): Promise<any[]> {
  const cacheKey = `${collectionPath}|${localStorageKey}`;
  if (!force) {
    const pending = inFlight.get(cacheKey);
    if (pending) return pending;
    const at = lastSyncedAt.get(cacheKey);
    if (at && Date.now() - at < FRESH_MS) return readCache(localStorageKey);
  }

  const request = (async () => {
    const data = await retryWithBackoff(async () => {
      const res = await fetch(`${API_BASE}/${collectionPath}`, { headers: getHeaders() });
      if (!res.ok) throw new HttpError(res.status, res.statusText);
      return await res.json();
    });
    if (localStorageKey === 'signageos_media') {
      setMemoryMedia(data);
    } else {
      localStorage.setItem(localStorageKey, JSON.stringify(data));
    }
    lastSyncedAt.set(cacheKey, Date.now());
    return data;
  })();

  inFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    inFlight.delete(cacheKey);
  }
}

// Many screens save with their own fetch() calls rather than pushToDatabase,
// so the reuse window above could otherwise hand back pre-save data right
// after a save. Any write to the API clears it — reads after a write always
// go to the server.
if (typeof window !== 'undefined' && !(window as any).__sgWriteAwareFetch) {
  (window as any).__sgWriteAwareFetch = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const response = await originalFetch(input, init);
    // The server pauses the dashboard (402) once a plan's grace period ends.
    // Clients see this from their own licence; team members have none of
    // their own, so the dashboard learns it from here.
    // The account was deleted, its role changed or it was deactivated.
    if (response.status === 401) {
      response.clone().json().then(body => {
        if (body?.code === 'session_ended') window.dispatchEvent(new Event('signageos_session_ended'));
      }).catch(() => {});
    }
    if (response.status === 402) {
      response.clone().json().then(body => {
        if (body?.code === 'license_paused') window.dispatchEvent(new CustomEvent('signageos_license_paused', { detail: body }));
      }).catch(() => {});
    }
    if (method !== 'GET' && method !== 'HEAD') {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith(API_BASE) || url.startsWith('/api/')) lastSyncedAt.clear();
    }
    return response;
  };
}

/** Call after writing to a collection so the next read fetches fresh data. */
export function invalidateCollection(collectionPath: string): void {
  for (const key of Array.from(lastSyncedAt.keys())) {
    if (key.startsWith(`${collectionPath}|`)) lastSyncedAt.delete(key);
  }
}

// Sync a single collection from server and update localStorage / in-memory cache
export async function syncCollection(collectionPath: string, localStorageKey: string, options: { force?: boolean } = {}): Promise<any[]> {
  try {
    return await fetchCollection(collectionPath, localStorageKey, !!options.force);
  } catch (err: any) {
    console.error(`Failed to sync collection ${collectionPath}:`, err.message);
  }
  // Fallback: return from memory or localStorage
  return readCache(localStorageKey);
}

// Fetch a specific user record by ID from server
export async function fetchUserById(userId: string): Promise<any | null> {
  try {
    return await retryWithBackoff(async () => {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new HttpError(res.status, res.statusText);
      }

      return await res.json();
    });
  } catch (err: any) {
    console.error(`Failed to fetch user ${userId} after retries:`, err.message);
    return null;
  }
}

export async function pushToDatabase(collectionPath: string, id: string, data: any, method: 'POST' | 'PUT' | 'DELETE'): Promise<PushResult> {
  try {
    const url = method === 'POST' ? `${API_BASE}/${collectionPath}` : `${API_BASE}/${collectionPath}/${id}`;

    const payload = data ? { ...data } : undefined;
    if (payload) {
      delete payload.created;
      delete payload.updated;
      delete payload.collectionId;
      delete payload.collectionName;
    }

    const res = await fetch(url, {
      method,
      headers: getHeaders(),
      body: method !== 'DELETE' && payload ? JSON.stringify(payload) : undefined
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to push to database for ${collectionPath} (${method}):`, errorText);
      return { ok: false, status: res.status, error: errorText };
    }

    invalidateCollection(collectionPath);
    const responseData = method !== 'DELETE' ? await res.json() : null;
    return { ok: true, status: res.status, data: responseData };
  } catch (err: any) {
    const message = err?.message || 'Network error';
    console.error(`Network error pushing to database for ${collectionPath}:`, err);
    return { ok: false, status: 0, error: message };
  }
}
