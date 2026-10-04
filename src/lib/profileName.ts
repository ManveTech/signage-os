import { API_BASE } from '../config';
import { getHeaders } from './syncHelper';

/**
 * Keeps the name shown in the header and sidebar in step with the account.
 * It was only ever saved after editing the Profile page, so everyone else
 * saw a name made up from their email ("Phoenix User", "Super Admin").
 */
export function storeProfileName(email: string, isAdmin: boolean, name?: string): void {
  if (!name) return;
  if (isAdmin) localStorage.setItem('signageos_admin_name', name);
  else localStorage.setItem(`signageos_user_name_${email}`, name);
  window.dispatchEvent(new Event('signageos_user_profile_updated'));
  window.dispatchEvent(new Event('signageos_admin_profile_updated'));
}

/** Reads the signed-in account's name from the server (once per page load). */
export async function refreshProfileName(isAdmin: boolean): Promise<void> {
  const id = localStorage.getItem('signageos_user_id');
  const email = localStorage.getItem('signageos_user_email') || '';
  if (!id) return;
  try {
    const res = await fetch(`${API_BASE}/users/${id}`, { headers: getHeaders() });
    if (!res.ok) return;
    const user = await res.json();
    storeProfileName(email, isAdmin, user.name);
  } catch { /* offline — keep what's shown */ }
}
