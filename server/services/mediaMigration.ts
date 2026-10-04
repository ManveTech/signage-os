import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type PocketBase from 'pocketbase';

/**
 * Moving media from one R2/S3 bucket to another: copy every object (skipping
 * ones already there), check a copied file loads from the new public
 * address, then rewrite the old public URL to the new one everywhere it's
 * stored. The old bucket is only ever read. Used by the dashboard's "Move
 * existing media" button and by scripts/migrate-media.ts.
 */

export type BucketRef = { endpoint: string; bucket: string; accessKey: string; secret: string; publicUrl: string };

export type MigrationProgress = {
  state: 'idle' | 'copying' | 'checking' | 'rewriting' | 'done' | 'failed';
  total: number;
  copied: number;
  skipped: number;
  failed: number;
  bytes: number;
  records: number;
  fields: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
};

export const emptyProgress = (): MigrationProgress => ({ state: 'idle', total: 0, copied: 0, skipped: 0, failed: 0, bytes: 0, records: 0, fields: 0 });

const clientFor = (b: BucketRef) => new S3Client({
  region: 'auto',
  // An endpoint copied from Cloudflare often ends in /<bucket>; the SDK adds that itself.
  endpoint: b.endpoint.replace(new RegExp(`/${b.bucket}/?$`), ''),
  credentials: { accessKeyId: b.accessKey, secretAccessKey: b.secret },
  forcePathStyle: true,
});

export async function migrateMedia(opts: {
  from: BucketRef;
  to: BucketRef;
  pb: PocketBase;
  apply: boolean;
  progress?: MigrationProgress;
  log?: (msg: string) => void;
}): Promise<MigrationProgress> {
  const { from, to, pb, apply } = opts;
  const p = opts.progress || emptyProgress();
  const log = opts.log || (() => {});
  const oldUrl = from.publicUrl.replace(/\/$/, '');
  const newUrl = to.publicUrl.replace(/\/$/, '');
  Object.assign(p, emptyProgress(), { state: 'copying', startedAt: new Date().toISOString() });
  try {
    if (!oldUrl || !newUrl || oldUrl === newUrl) throw new Error('The old and new public addresses must both be set, and different.');
    const src = clientFor(from), dst = clientFor(to);

    // 1. Copy
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const page = await src.send(new ListObjectsV2Command({ Bucket: from.bucket, ContinuationToken: token }));
      for (const obj of page.Contents || []) {
        const key = obj.Key!;
        keys.push(key); p.total = keys.length;
        const existing = await dst.send(new HeadObjectCommand({ Bucket: to.bucket, Key: key })).catch(() => null);
        if (existing && existing.ContentLength === obj.Size) { p.skipped++; continue; }
        try {
          const got = await src.send(new GetObjectCommand({ Bucket: from.bucket, Key: key }));
          const body = Buffer.from(await got.Body!.transformToByteArray());
          await dst.send(new PutObjectCommand({ Bucket: to.bucket, Key: key, Body: body, ContentType: got.ContentType, CacheControl: got.CacheControl }));
          p.copied++; p.bytes += body.length;
          if (p.copied % 25 === 0) log(`…${p.copied} copied`);
        } catch (e: any) {
          p.failed++; log(`! ${key}: ${e.message}`);
        }
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    log(`Copy: ${p.total} files — ${p.copied} copied (${(p.bytes / 1024 / 1024).toFixed(1)} MB), ${p.skipped} already there, ${p.failed} failed.`);
    if (p.failed) throw new Error(`${p.failed} file(s) failed to copy — run it again.`);

    // 2. Check the new address serves the files
    p.state = 'checking';
    const sample = keys.find(k => !k.endsWith('/'));
    if (sample) {
      const url = `${newUrl}/${sample.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url).catch((e: any) => ({ ok: false, status: e.message } as any));
      if (!res.ok) throw new Error(`Files don't load from ${newUrl} yet (${res.status}). Check the custom domain is Active and public access is on, then try again.`);
      log(`Check: ${url} loads.`);
    }

    // 3. Rewrite stored addresses
    p.state = 'rewriting';
    const collections = (await pb.collections.getFullList()).filter((c: any) => c.type !== 'view' && !c.name.startsWith('_'));
    for (const coll of collections as any[]) {
      const rows = await pb.collection(coll.name).getFullList({ batch: 500 }).catch(() => [] as any[]);
      for (const row of rows) {
        const update: Record<string, any> = {};
        for (const f of coll.fields || []) {
          const v = row[f.name];
          if (typeof v === 'string' && v.includes(oldUrl)) update[f.name] = v.split(oldUrl).join(newUrl);
          else if (v && typeof v === 'object') {
            const s = JSON.stringify(v);
            if (s.includes(oldUrl)) update[f.name] = JSON.parse(s.split(oldUrl).join(newUrl));
          }
        }
        const n = Object.keys(update).length;
        if (!n) continue;
        p.records++; p.fields += n;
        if (p.records <= 5) log(`  ${coll.name}/${row.id}: ${Object.keys(update).join(', ')}`);
        if (apply) await pb.collection(coll.name).update(row.id, update);
      }
    }
    log(`Addresses: ${p.records} records (${p.fields} fields) ${apply ? 'rewritten to the new address' : 'would change — dry run'}.`);
    p.state = 'done';
  } catch (err: any) {
    p.state = 'failed';
    p.error = err.message || String(err);
    log(`Failed: ${p.error}`);
  }
  p.finishedAt = new Date().toISOString();
  return p;
}
