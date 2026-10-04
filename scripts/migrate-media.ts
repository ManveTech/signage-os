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
import { migrateMedia } from '../server/services/mediaMigration';
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

const pb = new PocketBase(env('POCKETBASE_URL'));
await pb.collection('_superusers').authWithPassword(env('PB_ADMIN_EMAIL'), env('PB_ADMIN_PASSWORD'));
const result = await migrateMedia({ from: OLD, to: NEW, pb, apply, log: (m) => console.log(m) });
if (result.state === 'failed') process.exit(1);
if (!apply) console.log('Dry run — run again with --apply to rewrite the addresses.');
