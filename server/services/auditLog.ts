import { pb, ensurePBAuth } from '../db';

export interface AuditLogEntry {
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string;
}

/**
 * Records a sensitive action to the audit_logs collection. Fire-and-forget by
 * design — an audit write failing must never block or fail the action it's
 * recording, so callers don't need to await this or handle its errors.
 */
export function logAudit(entry: AuditLogEntry): void {
  (async () => {
    try {
      await ensurePBAuth();
      await pb.collection('audit_logs').create(entry);
    } catch (err: any) {
      console.error('[AuditLog] Failed to record audit entry:', entry.action, err.message);
    }
  })();
}

/** Best-effort client IP extraction, accounting for a reverse proxy (Coolify/nginx) in front of the app. */
export function getClientIp(req: any): string {
  // req.ip is the real visitor's address: Express resolves the proxy hop and
  // middleware/realClientIp.ts the Cloudflare one. X-Forwarded-For's first
  // entry, used before, is whatever the client chose to send.
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

// --- Categories -------------------------------------------------------------
// Every action name is `<subject>.<verb>`, so the category is derivable from
// the prefix and nothing has to be stored alongside it — adding an action to
// an existing subject needs no schema change and no backfill of old rows.
//
// The split is not cosmetic: it decides how long an entry is kept (see
// RETENTION_DAYS). Security and money are worth a year; content churn is
// noise after a quarter and carries an IP address we have no reason to hold
// onto for longer.

export type AuditCategory = 'auth' | 'account' | 'billing' | 'content' | 'email' | 'system';

const PREFIXES_BY_CATEGORY: Record<AuditCategory, string[]> = {
  auth: ['login', 'logout', 'password_reset', 'password'],
  account: ['user', 'organization', 'admin'],
  billing: ['payment', 'payment_webhook', 'billing', 'license', 'licenses', 'invoice', 'invoices'],
  content: ['playlist', 'playlists', 'media', 'media_items', 'screen', 'screens', 'screen_group', 'screen_groups', 'schedule'],
  email: ['email'],
  system: ['app_release', 'help', 'faqs', 'support_docs', 'ticket', 'tickets', 'lead', 'leads', 'integration', 'backup']
};

const CATEGORY_BY_PREFIX: Record<string, AuditCategory> = {};
for (const [category, prefixes] of Object.entries(PREFIXES_BY_CATEGORY)) {
  for (const p of prefixes) CATEGORY_BY_PREFIX[p] = category as AuditCategory;
}

/** Which bucket an action belongs to. Anything unrecognised counts as system. */
export function categoryOf(action: string): AuditCategory {
  const prefix = String(action || '').split('.')[0];
  return CATEGORY_BY_PREFIX[prefix] || 'system';
}

export const AUDIT_CATEGORIES = Object.keys(PREFIXES_BY_CATEGORY) as AuditCategory[];

/** A PocketBase filter clause matching every action in these categories. */
export function categoryFilter(categories: AuditCategory[]): string {
  const prefixes = categories.flatMap(c => PREFIXES_BY_CATEGORY[c] || []);
  if (prefixes.length === 0) return '';
  // `~` with an explicit % anchors to the start, so "user.%" can't also match
  // a hypothetical "org.user_removed".
  return `(${prefixes.map(p => `action ~ "${p}.%"`).join(' || ')})`;
}

// --- Change summaries -------------------------------------------------------

/**
 * Fields never worth recording a change to: either secret, or so large that
 * the summary would be unreadable and the audit row enormous. Base64 logos and
 * playlist slide arrays are the main offenders — a playlist save would
 * otherwise write a few hundred KB of data URL into the log.
 */
const SKIP_FIELDS = new Set([
  'password', 'passwordConfirm', 'oldPassword', 'token', 'tokenKey', 'secret', 'apiKey',
  'websiteLogo', 'logo', 'avatar', 'thumbnail', 'thumbnailUrl',
  'slides', 'mediaIds', 'sleepSchedule', 'schedule',
  'created', 'updated', 'collectionId', 'collectionName', 'expand',
  'lastHeartbeat', 'onlineSince', 'cumulativeUptime', 'cumulativeLoops', 'storageUsed'
]);

const MAX_VALUE_CHARS = 40;
const MAX_FIELDS_IN_SUMMARY = 6;

function short(value: any): string {
  if (value === null || value === undefined || value === '') return 'empty';
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (typeof value === 'object') return 'changed';
  const str = String(value);
  return str.length > MAX_VALUE_CHARS ? `${str.slice(0, MAX_VALUE_CHARS)}…` : str;
}

/**
 * A readable one-line summary of what actually changed between two records,
 * e.g. `name: Lobby → Lobby TV, volume: 80 → 100`.
 *
 * Only fields present in `after` are considered, so a partial PATCH doesn't
 * read as "everything else was cleared", and a field whose value is unchanged
 * is left out — the dashboard saves whole records, so most keys in a typical
 * update are identical to what was already stored.
 */
export function describeChanges(before: any, after: any): string {
  if (!before || !after) return '';
  const changes: string[] = [];
  let omitted = 0;

  for (const key of Object.keys(after)) {
    if (SKIP_FIELDS.has(key)) continue;
    const from = before[key];
    const to = after[key];
    // Compared as JSON so objects and arrays don't register as changed on
    // every save purely because they're different references.
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    if (changes.length >= MAX_FIELDS_IN_SUMMARY) { omitted++; continue; }
    changes.push(`${key}: ${short(from)} → ${short(to)}`);
  }

  if (changes.length === 0) return '';
  if (omitted > 0) changes.push(`+${omitted} more`);
  return changes.join(', ');
}

/**
 * The human name of a record, for an audit entry about it. Empty when the
 * record has no name worth showing — callers pass this straight to `detail`,
 * and short()'s "empty" placeholder would read as a value rather than the
 * absence of one.
 */
export function describeRecord(record: any): string {
  if (!record) return '';
  const name = record.name || record.title || record.email || record.fileName || record.version || '';
  return name ? short(name) : '';
}

// --- Retention --------------------------------------------------------------

/**
 * How long each category is kept. Security and billing history is worth a
 * year; routine content edits are noise long before that, and every row holds
 * an IP address, so keeping them indefinitely would mean holding personal data
 * with no reason to.
 */
export const RETENTION_DAYS: Record<AuditCategory, number> = {
  auth: 365,
  account: 365,
  billing: 365,
  email: 365,
  content: 90,
  system: 90
};
