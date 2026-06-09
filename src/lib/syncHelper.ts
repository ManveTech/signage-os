const API_BASE = 'http://localhost:5000/api/v1';

function getHeaders() {
  const token = localStorage.getItem('signageos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
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

  for (const col of collections) {
    try {
      const res = await fetch(`${API_BASE}/${col.path}`, {
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(col.key, JSON.stringify(data));
      }
    } catch (err) {
      console.error(`Failed to sync collection ${col.path}:`, err);
    }
  }
}

// Sync a single collection from server and update localStorage
export async function syncCollection(collectionPath: string, localStorageKey: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/${collectionPath}`, {
      headers: getHeaders()
    });
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(localStorageKey, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.error(`Failed to sync collection ${collectionPath}:`, err);
  }
  // Fallback: return from localStorage
  const stored = localStorage.getItem(localStorageKey);
  return stored ? JSON.parse(stored) : [];
}

// Fetch a specific user record by ID from server
export async function fetchUserById(userId: string): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      headers: getHeaders()
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.error(`Failed to fetch user ${userId}:`, err);
  }
  return null;
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
