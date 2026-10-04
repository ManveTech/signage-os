/**
 * Moves media from the old Cloudflare R2 bucket to a new one, then points
 * the database at the new address. Safe to re-run; the old bucket is never
 * changed or deleted.
 *
 *   1. copy   — every object, old bucket → new bucket (skips ones already there, same size)
 *   2. check  — a copied file loads from the new public address
 *   3. rewrite — stored URLs: OLD_PUBLIC_URL → NEW_PUBLIC_URL, in every collection
 *                (dry run unless --apply)
 *
 * Old bucket: OLD_S3_* (default: the S3_* values in .env).
 * New bucket: NEW_S3_ENDPOINT, NEW_S3_BUCKET, NEW_S3_ACCESS_KEY, NEW_S3_SECRET,
 *             NEW_PUBLIC_URL (e.g. https://media.bluestardigitech.com)
 * Database:   POCKETBASE_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD (from .env)
 *
 *   npx tsx scripts/migrate-media.ts            # copy + check + show what would change
 *   npx tsx scripts/migrate-media.ts --apply    # …and rewrite the URLs
 */
import 'dotenv/config';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import PocketBase from 'pocketbase';

const apply = process.argv.includes('--apply');
const env = (k: string, fallback = '') => (process.env[k] || fallback).trim();

const OLD = {
  endpoint: env('OLD_S3_ENDPOINT', env('S3_ENDPOINT')),
  bucket: env('OLD_S3_BUCKET', env('S3_BUCKET')),
  accessKey: env('OLD_S3_ACCESS_KEY', env('S3_ACCESS_KEY')),
  secret: env('OLD_S3_SECRET', env('S3_SECRET')),
  publicUrl: env('OLD_PUBLIC_URL', env('R2_PUBLIC_URL')).replace(/\/$/, ''),
};
const NEW = {
  endpoint: env('NEW_S3_ENDPOINT'),
  bucket: env('NEW_S3_BUCKET'),
  accessKey: env('NEW_S3_ACCESS_KEY'),
  secret: env('NEW_S3_SECRET'),
  publicUrl: env('NEW_PUBLIC_URL').replace(/\/$/, ''),
};

function need(label: string, cfg: Record<string, string>) {
  const missing = Object.entries(cfg).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) { console.error(`Missing ${label} settings: ${missing.join(', ')}`); process.exit(1); }
}
need('old bucket', OLD); need('new bucket', NEW);
if (OLD.publicUrl === NEW.publicUrl) { console.error('Old and new public URLs are the same.'); process.exit(1); }

const client = (c: typeof OLD) => new S3Client({ region: 'auto', endpoint: c.endpoint.replace(new RegExp(`/${c.bucket}/?$`), ''), credentials: { accessKeyId: c.accessKey, secretAccessKey: c.secret }, forcePathStyle: true });
const src = client(OLD), dst = client(NEW);

async function copyAll(): Promise<string[]> {
  let token: string | undefined, copied = 0, skipped = 0, failed = 0, bytes = 0;
  const keys: string[] = [];
  do {
    const page = await src.send(new ListObjectsV2Command({ Bucket: OLD.bucket, ContinuationToken: token }));
    for (const obj of page.Contents || []) {
      const key = obj.Key!; keys.push(key);
      const existing = await dst.send(new HeadObjectCommand({ Bucket: NEW.bucket, Key: key })).catch(() => null);
      if (existing && existing.ContentLength === obj.Size) { skipped++; continue; }
      try {
        const got = await src.send(new GetObjectCommand({ Bucket: OLD.bucket, Key: key }));
        const body = Buffer.from(await got.Body!.transformToByteArray());
        await dst.send(new PutObjectCommand({ Bucket: NEW.bucket, Key: key, Body: body, ContentType: got.ContentType, CacheControl: got.CacheControl }));
        copied++; bytes += body.length;
        if (copied % 25 === 0) console.log(`  …${copied} copied`);
      } catch (e: any) { failed++; console.error(`  ! ${key}: ${e.message}`); }
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  console.log(`1. Copy: ${keys.length} files — ${copied} copied (${(bytes / 1024 / 1024).toFixed(1)} MB), ${skipped} already there, ${failed} failed.`);
  if (failed) { console.error('Some files failed to copy — re-run before rewriting addresses.'); process.exit(1); }
  return keys;
}

async function checkPublic(keys: string[]) {
  const sample = keys.find(k => !k.endsWith('/'));
  if (!sample) { console.log('2. Check: bucket is empty, nothing to check.'); return; }
  const url = `${NEW.publicUrl}/${sample.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url, { method: 'GET' }).catch((e) => ({ ok: false, status: e.message } as any));
  if (!res.ok) { console.error(`2. Check FAILED: ${url} → ${res.status}. Is the custom domain Active and public access on?`); process.exit(1); }
  console.log(`2. Check: ${url} loads (${res.status}).`);
}

async function rewrite() {
  const pb = new PocketBase(env('POCKETBASE_URL'));
  await pb.collection('_superusers').authWithPassword(env('PB_ADMIN_EMAIL'), env('PB_ADMIN_PASSWORD'));
  const collections = (await pb.collections.getFullList()).filter((c: any) => c.type !== 'view' && !c.name.startsWith('_'));
  let records = 0, fields = 0;
  for (const coll of collections as any[]) {
    const rows = await pb.collection(coll.name).getFullList({ batch: 500 }).catch(() => [] as any[]);
    for (const row of rows) {
      const update: Record<string, any> = {};
      for (const f of coll.fields || []) {
        const v = row[f.name];
        if (typeof v === 'string' && v.includes(OLD.publicUrl)) update[f.name] = v.split(OLD.publicUrl).join(NEW.publicUrl);
        else if (v && typeof v === 'object') {
          const s = JSON.stringify(v);
          if (s.includes(OLD.publicUrl)) update[f.name] = JSON.parse(s.split(OLD.publicUrl).join(NEW.publicUrl));
        }
      }
      const n = Object.keys(update).length;
      if (!n) continue;
      records++; fields += n;
      if (records <= 5) console.log(`   ${coll.name}/${row.id}: ${Object.keys(update).join(', ')}`);
      if (apply) await pb.collection(coll.name).update(row.id, update);
    }
  }
  console.log(`3. Addresses: ${records} records (${fields} fields) point at the old bucket. ${apply ? 'Rewritten to the new address.' : 'Dry run — run again with --apply to rewrite.'}`);
}

const keys = await copyAll();
await checkPublic(keys);
await rewrite();
