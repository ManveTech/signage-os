/**
 * Turning audit actions into English.
 *
 * Entries are stored as `<subject>.<verb>` — `user.role_changed`,
 * `playlists.created` — which is right for filtering and wrong for reading. A
 * log nobody can read at a glance doesn't get read, so each action gets a
 * sentence and a colour here.
 *
 * Unknown actions are not a problem: an action with no entry below falls back
 * to a tidied version of its own name, so a new one added on the server shows
 * up as "Media items created" rather than breaking the view or going missing.
 * The category list mirrors services/auditLog.ts on the server — keep the two
 * in step.
 */

export type AuditCategory = 'auth' | 'account' | 'billing' | 'content' | 'email' | 'system';

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  auth: 'Sign-ins',
  account: 'Accounts',
  billing: 'Billing',
  content: 'Content',
  email: 'Email',
  system: 'System'
};

/** Tailwind classes per category, for the chips and the row markers. */
export const CATEGORY_STYLES: Record<AuditCategory, { chip: string; dot: string }> = {
  auth: { chip: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-500' },
  account: { chip: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  billing: { chip: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  content: { chip: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  email: { chip: 'bg-sky-50 text-sky-700 border-sky-200', dot: 'bg-sky-500' },
  system: { chip: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' }
};

export const CATEGORY_ORDER: AuditCategory[] = ['auth', 'account', 'content', 'billing', 'email', 'system'];

/**
 * Actions worth flagging: a failure, a refusal, or something that changed who
 * can do what. These get a red marker so a page of ordinary activity doesn't
 * hide the one line that matters.
 */
const NOTABLE = new Set([
  'login.failed',
  'login.google_failed',
  'login.google_no_account',
  'password_reset.requested_unknown_email',
  'password_reset.email_failed',
  'payment_webhook.signature_invalid',
  'user.role_changed',
  'user.deleted',
  'email.failed',
  'email.not_configured'
]);

export function isNotable(action: string): boolean {
  return NOTABLE.has(action);
}

/** Readable name for each known action. */
const ACTION_LABELS: Record<string, string> = {
  'login.success': 'Signed in',
  'login.failed': 'Failed sign-in',
  'login.google_success': 'Signed in with Google',
  'login.google_failed': 'Google sign-in failed',
  'login.google_no_account': 'Google sign-in — no account',
  'password_reset.requested': 'Password reset requested',
  'password_reset.completed': 'Password reset completed',
  'password_reset.email_failed': 'Password reset email failed',
  'password_reset.requested_unknown_email': 'Password reset for an unknown email',

  'user.created': 'Created a user',
  'user.deleted': 'Deleted a user',
  'user.updated_by_admin': 'Edited a user',
  'user.role_changed': 'Changed a role',
  'user.avatar_updated': 'Changed their photo',
  'user.avatar_updated_by_admin': 'Changed a user photo',
  'users.created': 'Created a user',
  'users.updated': 'Edited a user',
  'users.deleted': 'Deleted a user',
  'organization.updated': 'Edited an organization',
  'organizations.created': 'Created an organization',
  'organizations.updated': 'Edited an organization',
  'organizations.deleted': 'Deleted an organization',

  'payment.verified': 'Payment verified',
  'payment.verified_via_webhook': 'Payment verified (online)',
  'payment.recorded_manually': 'Payment recorded by hand',
  'payment_webhook.signature_invalid': 'Rejected a payment webhook',
  'payments.created': 'Added a payment',
  'payments.deleted': 'Deleted a test payment',
  'billing.reminder_sent': 'Billing reminder sent',
  'licenses.created': 'Created a licence',
  'licenses.updated': 'Edited a licence',
  'licenses.deleted': 'Deleted a licence',
  'invoices.created': 'Created an invoice',
  'invoices.updated': 'Edited an invoice',
  'invoices.deleted': 'Deleted a test invoice',

  'screens.created': 'Added a screen',
  'screens.updated': 'Edited a screen',
  'screens.deleted': 'Removed a screen',
  'screen_groups.created': 'Created a group',
  'screen_groups.updated': 'Edited a group',
  'screen_groups.deleted': 'Deleted a group',
  'playlists.created': 'Created a playlist',
  'playlists.updated': 'Edited a playlist',
  'playlists.deleted': 'Deleted a playlist',
  'media_items.created': 'Added media',
  'media_items.updated': 'Edited media',
  'media_items.deleted': 'Deleted media',

  'email.sent': 'Email sent',
  'email.failed': 'Email failed',
  'email.not_configured': 'Email not sent — none set up',

  'app_release.published': 'Published a TV build',
  'app_release.deleted': 'Deleted a TV build',
  'help.defaults_added': 'Added the default help content',
  'tickets.created': 'Opened a ticket',
  'tickets.updated': 'Updated a ticket',
  'tickets.deleted': 'Deleted a ticket',
  'faqs.created': 'Added an FAQ',
  'faqs.updated': 'Edited an FAQ',
  'faqs.deleted': 'Deleted an FAQ',
  'support_docs.created': 'Added a guide',
  'support_docs.updated': 'Edited a guide',
  'support_docs.deleted': 'Deleted a guide',
  'leads.created': 'New enquiry',
  'leads.updated': 'Updated an enquiry',
  'leads.deleted': 'Deleted an enquiry'
};

/** `media_items.created` → `Media items created`, for anything not listed above. */
function fallbackLabel(action: string): string {
  const text = String(action || '').replace(/[._]/g, ' ').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'Activity';
}

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] || fallbackLabel(action);
}

/**
 * Which bucket an action belongs to. Mirrors categoryOf() on the server, which
 * is what the category filter actually uses — this copy is for showing a chip
 * next to a row without a second request.
 */
const CATEGORY_BY_PREFIX: Record<string, AuditCategory> = {
  login: 'auth', logout: 'auth', password_reset: 'auth', password: 'auth',
  user: 'account', users: 'account', organization: 'account', organizations: 'account', admin: 'account',
  payment: 'billing', payment_webhook: 'billing', billing: 'billing', license: 'billing',
  licenses: 'billing', invoice: 'billing', invoices: 'billing', payments: 'billing',
  playlist: 'content', playlists: 'content', media: 'content', media_items: 'content',
  screen: 'content', screens: 'content', screen_group: 'content', screen_groups: 'content', schedule: 'content',
  email: 'email'
};

export function categoryOf(action: string): AuditCategory {
  return CATEGORY_BY_PREFIX[String(action || '').split('.')[0]] || 'system';
}

/** "2 minutes ago", "3 Feb" — relative while it's recent, then a date. */
export function timeAgo(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(String(iso).replace(' ', 'T'));
  if (isNaN(then.getTime())) return '—';
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: then.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

/** The full timestamp, for the tooltip and the expanded row. */
export function fullTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  return isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

/** The person who did it, as a name rather than a blank. */
export function actorLabel(actorEmail?: string): string {
  const email = String(actorEmail || '').trim();
  if (!email) return 'System';
  return email;
}
