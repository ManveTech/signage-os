import { API_BASE } from '../config';

function getHeaders() {
  const token = localStorage.getItem('signageos_token');
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
  memoryMedia = media;
}

export type PushResult =
  | { ok: true; status: number; data: any }
  | { ok: false; status: number; error: string };

export async function syncAllFromDatabase() {
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

  // Sync collections in parallel with retry logic
  await Promise.all(
    collections.map(async (col) => {
      try {
        await retryWithBackoff(async () => {
          const res = await fetch(`${API_BASE}/${col.path}`, {
            headers: getHeaders()
          });

          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }

          const data = await res.json();
          if (col.key === 'signageos_media') {
            setMemoryMedia(data);
          } else {
            localStorage.setItem(col.key, JSON.stringify(data));
          }
        });
      } catch (err: any) {
        const errorMsg = err?.message || 'Unknown error';
        console.error(`Failed to sync collection ${col.path} after retries:`, errorMsg);
        errors.push({ collection: col.path, error: errorMsg });
      }
    })
  );

  // Return errors for caller to handle
  if (errors.length > 0) {
    console.warn(`Sync completed with ${errors.length} error(s):`, errors);
  }

  return { success: errors.length === 0, errors };
}

// Sync a single collection from server and update localStorage / in-memory cache
export async function syncCollection(collectionPath: string, localStorageKey: string): Promise<any[]> {
  try {
    const data = await retryWithBackoff(async () => {
      const res = await fetch(`${API_BASE}/${collectionPath}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    });

    if (localStorageKey === 'signageos_media') {
      setMemoryMedia(data);
    } else {
      localStorage.setItem(localStorageKey, JSON.stringify(data));
    }
    return data;
  } catch (err: any) {
    console.error(`Failed to sync collection ${collectionPath} after retries:`, err.message);
  }

  // Fallback: return from memory or localStorage
  if (localStorageKey === 'signageos_media') {
    return memoryMedia;
  }
  const stored = localStorage.getItem(localStorageKey);
  return stored ? JSON.parse(stored) : [];
}

// Fetch a specific user record by ID from server
export async function fetchUserById(userId: string): Promise<any | null> {
  try {
    return await retryWithBackoff(async () => {
      const res = await fetch(`${API_BASE}/users/${userId}`, {
        headers: getHeaders()
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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

    const responseData = method !== 'DELETE' ? await res.json() : null;
    return { ok: true, status: res.status, data: responseData };
  } catch (err: any) {
    const message = err?.message || 'Network error';
    console.error(`Network error pushing to database for ${collectionPath}:`, err);
    return { ok: false, status: 0, error: message };
  }
}
