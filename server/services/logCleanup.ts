import { pb, ensurePBAuth } from '../db';
import { AUDIT_CATEGORIES, RETENTION_DAYS, LONG_RETENTION_DAYS, categoryFilter } from './auditLog';

/**
 * Device logs (screen_logs) outlive what they describe: deleting a screen
 * never touched its logs, and removing a client without "delete all their
 * data" left theirs behind, so Device Logs kept listing screens and people
 * that no longer exist.
 *
 * deleteScreenLogs runs when a screen is deleted. pruneOrphanLogs sweeps up
 * the rest shortly after start and twice a day: a log goes when its screen no
 * longer exists (or it never named one), or when it belongs to an email no
 * account has any more. Server-wide entries (screenId "system") are kept.
 */

async function deleteIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 20) {
    await Promise.all(ids.slice(i, i + 20).map(id => pb.collection('screen_logs').delete(id).catch(() => {})));
  }
}

export async function deleteScreenLogs(screenId: string): Promise<number> {
  if (!screenId) return 0;
  const logs = await pb.collection('screen_logs').getFullList({
    filter: pb.filter('screenId = {:id}', { id: screenId }), fields: 'id'
  }).catch(() => [] as any[]);
  await deleteIds(logs.map((l: any) => l.id));
  return logs.length;
}

export async function pruneOrphanLogs(): Promise<number> {
  try {
    await ensurePBAuth();
    const [screens, users] = await Promise.all([
      pb.collection('screens').getFullList({ fields: 'id' }),
      pb.collection('users').getFullList({ fields: 'email' }),
    ]);
    // No accounts at all means a bad read (the admin's own is always there) —
    // never wipe every log on that. No screens is real: every log goes.
    if (users.length === 0) return 0;
    const screenIds = new Set(screens.map((s: any) => s.id));
    const emails = new Set(users.map((u: any) => String(u.email || '').toLowerCase()));

    const orphans: string[] = [];
    for (let page = 1; ; page++) {
      const res = await pb.collection('screen_logs').getList(page, 500, { fields: 'id,screenId,assignedToUserEmail', skipTotal: true });
      for (const l of res.items as any[]) {
        const screenGone = l.screenId !== 'system' && !screenIds.has(l.screenId || '');
        const ownerGone = l.assignedToUserEmail && !emails.has(String(l.assignedToUserEmail).toLowerCase());
        if (screenGone || ownerGone) orphans.push(l.id);
      }
      if (res.items.length < 500) break;
    }
    await deleteIds(orphans);
    if (orphans.length) console.log(`[Logs] Removed ${orphans.length} device log entr${orphans.length === 1 ? 'y' : 'ies'} for deleted screens or accounts.`);
    return orphans.length;
  } catch (err: any) {
    console.warn('[Logs] Cleanup skipped:', err.message);
    return 0;
  }
}

/**
 * Audit entries age out on their category's retention (services/auditLog.ts):
 * a year for sign-ins, accounts, billing and email, 90 days for content edits.
 *
 * Unlike the orphan sweep above, nothing here keys off whether the thing an
 * entry describes still exists — an audit log's whole purpose is to outlive
 * what it records, so a deleted screen's deletion entry has to stay. Age is
 * the only reason an entry ever goes, and the shorter content retention is
 * also why: every row holds an IP address, and holding one for a year to say
 * someone renamed a playlist isn't a reason we could justify.
 */
async function deleteAuditIds(ids: string[]) {
  for (let i = 0; i < ids.length; i += 20) {
    await Promise.all(ids.slice(i, i + 20).map(id => pb.collection('audit_logs').delete(id).catch(() => {})));
  }
}

export async function pruneAuditLogs(): Promise<number> {
  try {
    await ensurePBAuth();
    let removed = 0;

    for (const category of AUDIT_CATEGORIES) {
      const days = RETENTION_DAYS[category];
      const cutoff = new Date(Date.now() - days * 86400_000)
        .toISOString().slice(0, 19).replace('T', ' ');
      let clause = categoryFilter([category]);
      if (!clause) continue;
      // Deletions are kept for the long window whatever category they fall
      // in, so a short-retention sweep must step over them — see isDeletion().
      if (days < LONG_RETENTION_DAYS) {
        clause = `${clause} && action !~ "%.deleted"`;
      }

      // Page 1 each time: deleting the batch shifts everything that's left
      // forward, so walking page numbers would skip rows.
      for (let round = 0; round < 50; round++) {
        const res = await pb.collection('audit_logs').getList(1, 200, {
          filter: pb.filter(`${clause} && created < {:cutoff}`, { cutoff }),
          fields: 'id',
          skipTotal: true
        });
        if (res.items.length === 0) break;
        await deleteAuditIds(res.items.map((l: any) => l.id));
        removed += res.items.length;
        if (res.items.length < 200) break;
      }
    }

    if (removed) console.log(`[Logs] Removed ${removed} audit entr${removed === 1 ? 'y' : 'ies'} past retention.`);
    return removed;
  } catch (err: any) {
    console.warn('[Logs] Audit cleanup skipped:', err.message);
    return 0;
  }
}

setTimeout(pruneOrphanLogs, 2 * 60_000).unref();
setInterval(pruneOrphanLogs, 12 * 60 * 60 * 1000).unref();
setTimeout(pruneAuditLogs, 5 * 60_000).unref();
setInterval(pruneAuditLogs, 24 * 60 * 60 * 1000).unref();
