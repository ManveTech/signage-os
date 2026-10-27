/**
 * Telling our own screens apart from a client's.
 *
 * A screen records one owner email. The admin dashboard used to treat a screen
 * as "mine" only when that email matched whichever admin was signed in — but
 * the admins are all the same business, not separate tenants. With more than
 * one admin login that had two consequences, the second much worse than the
 * first:
 *
 *   1. My Screens showed only the screens that admin had personally added.
 *   2. Screens added by another admin fell through to *Client* Screens, since
 *      the test for a client was simply "owner isn't me" — so our own
 *      displays appeared among real customers' and were counted as theirs.
 *
 * Ownership is therefore judged against every admin account, not the current
 * one. Clients are unaffected: their dashboards legitimately scope to their
 * own email, and none of this is used there.
 */

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

/** Every admin account's email, lowercased. Empty if the list hasn't synced. */
export function adminEmails(): Set<string> {
  try {
    const users = JSON.parse(localStorage.getItem('signageos_users') || '[]');
    const emails = (Array.isArray(users) ? users : [])
      .filter((u: any) => ADMIN_ROLES.has(u?.role))
      .map((u: any) => String(u?.email || '').toLowerCase())
      .filter(Boolean);
    return new Set<string>(emails);
  } catch {
    return new Set<string>();
  }
}

/**
 * Build a test for "this screen is ours, not a client's".
 *
 * Call once per render rather than per screen — it reads and parses the user
 * list, so using it directly inside a filter would do that for every row.
 *
 * The signed-in admin's own address is always included, so this degrades to
 * the old behaviour if the user list hasn't arrived yet instead of briefly
 * claiming the admin owns nothing.
 */
export function makeOursTest(currentAdminEmail: string): (ownerEmail?: string) => boolean {
  // Only an admin session may treat another admin's records as its own. A
  // client's must stay strictly their own address: this browser's stored user
  // list can still be left over from an admin signed in here earlier, and
  // without this check that would show a client our records as theirs.
  const isAdminSession = ADMIN_ROLES.has(localStorage.getItem('signageos_user_role') || '');
  const emails = isAdminSession ? adminEmails() : new Set<string>();
  const me = (currentAdminEmail || '').toLowerCase();
  if (me) emails.add(me);
  return (ownerEmail?: string) => {
    const owner = (ownerEmail || '').toLowerCase();
    return !!owner && emails.has(owner);
  };
}
