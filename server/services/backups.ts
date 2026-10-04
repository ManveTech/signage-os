import { pb, ensurePBAuth } from '../db';
import { getCloudflareConfig } from '../integrationsStore';

/**
 * Automatic database backups, using PocketBase's own backup scheduler: a
 * daily zip of every record (and files PocketBase stores itself, like
 * avatars), with the oldest pruned. Media in R2 is not inside the zip —
 * only its addresses; the files stay in the media bucket.
 *
 * Off-site: when BACKUP_BUCKET is set, backups go to that S3/R2 bucket
 * instead of the server's own disk — the point of a backup is surviving the
 * server. It must be a PRIVATE bucket: a backup holds everything, password
 * hashes included, and PocketBase names backups predictably. It reuses the
 * media storage's R2 endpoint and keys unless BACKUP_S3_* are given, and is
 * refused if it's the same bucket as media (which is public).
 *
 * Without a bucket, backups are still made, on the server's disk — that
 * covers mistakes (a deleted client, bad data) but not losing the server,
 * and the dashboard says so.
 *
 *   Backups bucket         Admin > Integrations > File storage, or BACKUP_BUCKET
 *   BACKUP_S3_ENDPOINT / BACKUP_S3_REGION / BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET
 *                          optional; default to the media storage's R2 settings
 *   BACKUP_CRON            default "30 21 * * *" (UTC) = 3:00 am India time
 *   BACKUP_KEEP            how many to keep, default 14
 *   BACKUPS_ENABLED=false  turns automatic backups off
 */

export type BackupSetup = {
  enabled: boolean;
  offsite: boolean;
  bucket: string;
  cron: string;
  keep: number;
  warning?: string;
};

let lastSetup: BackupSetup | null = null;

async function desiredSetup(): Promise<{ setup: BackupSetup; s3: any }> {
  const cron = (process.env.BACKUP_CRON || '30 21 * * *').trim();
  const keep = Math.max(1, parseInt(process.env.BACKUP_KEEP || '14', 10) || 14);
  if ((process.env.BACKUPS_ENABLED || '').trim() === 'false') {
    return { setup: { enabled: false, offsite: false, bucket: '', cron: '', keep, warning: 'Automatic backups are turned off (BACKUPS_ENABLED=false).' }, s3: { enabled: false } };
  }

  const media = await getCloudflareConfig().catch(() => null);
  // Set in Admin > Integrations > File storage, or BACKUP_BUCKET.
  const bucket = (media?.backupBucket || process.env.BACKUP_BUCKET || '').trim();
  if (!bucket) {
    return {
      setup: { enabled: true, offsite: false, bucket: '', cron, keep, warning: "Backups are kept on the server's own disk only. Add a private backups bucket in File storage so they survive losing the server." },
      s3: { enabled: false }
    };
  }

  if (media?.bucket && media.bucket === bucket) {
    return {
      setup: { enabled: true, offsite: false, bucket, cron, keep, warning: 'The backups bucket is the public media bucket — refused, backups would be downloadable by anyone. Use a separate private bucket.' },
      s3: { enabled: false }
    };
  }
  const endpoint = (process.env.BACKUP_S3_ENDPOINT || media?.endpoint || '').trim();
  const accessKey = (process.env.BACKUP_S3_ACCESS_KEY || media?.accessKeyId || '').trim();
  const secret = (process.env.BACKUP_S3_SECRET || media?.secretAccessKey || '').trim();
  const region = (process.env.BACKUP_S3_REGION || media?.region || 'auto').trim();
  if (!endpoint || !accessKey || !secret) {
    return {
      setup: { enabled: true, offsite: false, bucket, cron, keep, warning: 'A backups bucket is set but there are no storage keys (set the R2 storage integration, or BACKUP_S3_ENDPOINT / BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET). Backups stay on the server for now.' },
      s3: { enabled: false }
    };
  }
  return {
    setup: { enabled: true, offsite: true, bucket, cron, keep },
    s3: { enabled: true, bucket, region, endpoint, accessKey, secret, forcePathStyle: true }
  };
}

/** Applies the backup schedule and storage to PocketBase. Called at start-up. */
export async function configureBackups(): Promise<BackupSetup> {
  const { setup, s3 } = await desiredSetup();
  try {
    await ensurePBAuth();
    await pb.settings.update({
      backups: { cron: setup.enabled ? setup.cron : '', cronMaxKeep: setup.keep, s3 }
    });
    console.log(`[Backups] ${setup.enabled ? `Daily backups on (${setup.cron} UTC, keeping ${setup.keep}) — ${setup.offsite ? `off-site in "${setup.bucket}"` : "on the server's disk only"}` : 'Automatic backups are off'}.`);
    if (setup.warning) console.warn(`[Backups] ${setup.warning}`);
  } catch (err: any) {
    setup.warning = `Backups could not be configured: ${err.message}`;
    console.error('[Backups]', setup.warning);
  }
  lastSetup = setup;
  return setup;
}

/** GET /backups — admin: how backups are set up, and the ones that exist. */
export async function listBackups(req: any, res: any) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Access denied.' });
  try {
    await ensurePBAuth();
    const items = (await pb.backups.getFullList())
      .map((b: any) => ({ key: b.key, size: b.size, modified: b.modified }))
      .sort((a: any, b: any) => String(b.modified).localeCompare(String(a.modified)));
    res.json({ ...(lastSetup || (await desiredSetup()).setup), items, lastBackupAt: items[0]?.modified || null });
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Could not read backups.' });
  }
}

/** POST /backups — admin: make a backup right now. */
export async function createBackupNow(req: any, res: any) {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') return res.status(403).json({ message: 'Access denied.' });
  try {
    await ensurePBAuth();
    const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
    const name = `manual_${stamp}.zip`;
    await pb.backups.create(name);
    res.status(201).json({ key: name });
  } catch (err: any) {
    // PocketBase allows one backup at a time.
    const busy = /already|in progress|try again/i.test(err?.message || '');
    res.status(busy ? 409 : 500).json({ message: busy ? 'A backup is already running — try again in a minute.' : (err.message || 'Backup failed.') });
  }
}
