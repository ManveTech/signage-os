import { pb, ensurePBAuth } from '../db';
import { AUDIT_CATEGORIES, AuditCategory, categoryFilter, categoryOf } from '../services/auditLog';

/**
 * Reading the audit trail.
 *
 * Entries are written from all over the server by logAudit() and have never
 * been readable anywhere — the collection isn't mounted through
 * createCrudRouter, so until this endpoint existed the log was write-only.
 *
 * Admin-only, and read-only by design: there is no create, update or delete
 * here and the PocketBase rules refuse all three from any client, so nobody
 * can quietly edit the record of what they did. Entries age out on retention
 * (see pruneAuditLogs) and that is the only way one ever disappears.
 */

const isAdminUser = (user: any) => user?.role === 'admin' || user?.role === 'super_admin';

const MAX_PER_PAGE = 200;
const DEFAULT_PER_PAGE = 50;

/** An ISO date (yyyy-mm-dd) from user input, or null. */
function isoDate(value: unknown): string | null {
  const str = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const d = new Date(`${str}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : str;
}

/**
 * GET /audit-logs
 *
 * ?category=auth,billing   one or more of the fixed category names
 * ?actor=someone@x.com     exact actor email
 * ?action=login.failed     exact action name
 * ?q=lobby                 substring across actor, action, target and detail
 * ?from=2026-01-01&to=2026-01-31
 * ?page=1&perPage=50
 */
export async function listAuditLogs(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ message: 'Access denied.' });

  try {
    await ensurePBAuth();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const perPage = Math.min(MAX_PER_PAGE, Math.max(1, parseInt(req.query.perPage) || DEFAULT_PER_PAGE));

    const clauses: string[] = [];
    const params: Record<string, any> = {};

    const requested = String(req.query.category || '')
      .split(',')
      .map(s => s.trim())
      .filter(s => AUDIT_CATEGORIES.includes(s as AuditCategory)) as AuditCategory[];
    // All categories selected is the same as none — skip the (long) filter.
    if (requested.length > 0 && requested.length < AUDIT_CATEGORIES.length) {
      const clause = categoryFilter(requested);
      if (clause) clauses.push(clause);
    }

    if (req.query.actor) {
      clauses.push('actorEmail = {:actor}');
      params.actor = String(req.query.actor).toLowerCase().trim();
    }

    if (req.query.action) {
      clauses.push('action = {:action}');
      params.action = String(req.query.action).trim();
    }

    const from = isoDate(req.query.from);
    if (from) {
      clauses.push('created >= {:from}');
      params.from = `${from} 00:00:00`;
    }
    const to = isoDate(req.query.to);
    if (to) {
      // Inclusive of the whole end day — a range of one day should return that
      // day's entries, not nothing.
      clauses.push('created <= {:to}');
      params.to = `${to} 23:59:59`;
    }

    const q = String(req.query.q || '').trim();
    if (q) {
      clauses.push('(actorEmail ~ {:q} || action ~ {:q} || targetId ~ {:q} || targetType ~ {:q} || detail ~ {:q} || ip ~ {:q})');
      params.q = q;
    }

    const filter = clauses.length > 0 ? pb.filter(clauses.join(' && '), params) : undefined;

    const result = await pb.collection('audit_logs').getList(page, perPage, {
      filter,
      sort: '-created'
    });

    res.json({
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      // Category is derived from the action name rather than stored, so old
      // entries written before categories existed get one too.
      items: result.items.map((item: any) => ({ ...item, category: categoryOf(item.action) }))
    });
  } catch (err: any) {
    console.error('[auditLogs] list failed:', err?.message);
    res.status(500).json({ message: err?.message || 'Could not load the activity log.' });
  }
}

/**
 * GET /audit-logs/summary
 *
 * Counts per category plus the distinct actors, for the view's filter chips —
 * so the chips can show "Sign-ins 412" and the actor dropdown can list only
 * people who actually appear in the log.
 */
export async function getAuditLogSummary(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ message: 'Access denied.' });

  try {
    await ensurePBAuth();
    const days = Math.min(365, Math.max(1, parseInt(req.query.days) || 30));
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 19).replace('T', ' ');

    const counts: Record<string, number> = {};
    for (const c of AUDIT_CATEGORIES) counts[c] = 0;
    const actors = new Set<string>();
    let total = 0;

    // Only the two fields the tally needs, 500 at a time — the log can be
    // large and this runs every time the view opens.
    for (let page = 1; ; page++) {
      const res2 = await pb.collection('audit_logs').getList(page, 500, {
        filter: pb.filter('created >= {:since}', { since }),
        fields: 'action,actorEmail',
        skipTotal: true
      });
      for (const item of res2.items as any[]) {
        counts[categoryOf(item.action)]++;
        if (item.actorEmail) actors.add(String(item.actorEmail));
        total++;
      }
      if (res2.items.length < 500) break;
      // A hard stop so an enormous log can't hold the request open.
      if (page >= 40) break;
    }

    res.json({ days, total, counts, actors: Array.from(actors).sort() });
  } catch (err: any) {
    console.error('[auditLogs] summary failed:', err?.message);
    res.status(500).json({ message: err?.message || 'Could not load the activity summary.' });
  }
}
