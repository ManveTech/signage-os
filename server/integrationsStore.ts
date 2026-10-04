import { pb, ensurePBAuth } from './db';
import {
  S3_ENABLED, S3_BUCKET, S3_REGION, S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET,
  SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER_EMAIL, SMTP_SENDER_NAME
} from './config';

export type IntegrationType = 'cloudflare' | 'smtp' | 'oauth_google' | 'business';

export interface IntegrationRecord {
  id: string;
  type: IntegrationType;
  config: Record<string, any>;
  enabled: boolean;
  lastTestStatus: 'untested' | 'success' | 'failure';
  lastTestError: string;
  lastTestedAt: string;
}

// Config saved from the Integrations dashboard lives in PocketBase's
// `integrations` collection, admin-only at the PocketBase-rules layer (see
// db.ts) — this is the only code path that reads it. A short in-memory cache
// avoids a DB round trip on every single R2 upload/email send, since these
// settings change rarely; invalidateIntegrationCache() clears it immediately
// after a save so the new config takes effect on the very next request
// without needing a server restart.
const CACHE_TTL_MS = 30_000;
const cache = new Map<IntegrationType, { record: IntegrationRecord | null; expiresAt: number }>();

export async function getIntegration(type: IntegrationType): Promise<IntegrationRecord | null> {
  const cached = cache.get(type);
  if (cached && cached.expiresAt > Date.now()) return cached.record;

  let result: IntegrationRecord | null = null;
  try {
    const authenticated = await ensurePBAuth();
    if (authenticated) {
      const record: any = await pb.collection('integrations').getFirstListItem(
        pb.filter('type = {:type}', { type })
      );
      result = {
        id: record.id,
        type,
        config: record.config || {},
        enabled: !!record.enabled,
        lastTestStatus: record.lastTestStatus || 'untested',
        lastTestError: record.lastTestError || '',
        lastTestedAt: record.lastTestedAt || ''
      };
    }
  } catch {
    // No saved row yet for this type — fall back to .env below.
    result = null;
  }

  cache.set(type, { record: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

export function invalidateIntegrationCache(type: IntegrationType): void {
  cache.delete(type);
}

export interface CloudflareConfig {
  enabled: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl: string;
  /** Private bucket for database backups (services/backups.ts). */
  backupBucket: string;
}

// Dashboard-saved config (when enabled) takes priority over .env — that's
// the point of this panel: once an admin configures and enables it here,
// it's what the server actually uses, with .env only as the fallback for
// deployments that haven't set this up through the dashboard yet.
export async function getCloudflareConfig(): Promise<CloudflareConfig> {
  const rec = await getIntegration('cloudflare');
  if (rec && rec.enabled) {
    return {
      enabled: true,
      bucket: rec.config.bucket || '',
      region: rec.config.region || 'auto',
      endpoint: rec.config.endpoint || '',
      accessKeyId: rec.config.accessKeyId || '',
      secretAccessKey: rec.config.secretAccessKey || '',
      publicUrl: rec.config.publicUrl || '',
      backupBucket: rec.config.backupBucket || (process.env.BACKUP_BUCKET || '').trim()
    };
  }
  return {
    enabled: S3_ENABLED,
    bucket: S3_BUCKET,
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET,
    publicUrl: (process.env.R2_PUBLIC_URL || '').trim(),
    backupBucket: (process.env.BACKUP_BUCKET || '').trim()
  };
}

export interface SmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const rec = await getIntegration('smtp');
  if (rec && rec.enabled) {
    return {
      enabled: true,
      host: rec.config.host || '',
      port: Number(rec.config.port) || 587,
      username: rec.config.username || '',
      password: rec.config.password || '',
      senderEmail: rec.config.senderEmail || '',
      senderName: rec.config.senderName || 'SignageOS'
    };
  }
  return {
    enabled: !!(SMTP_HOST && SMTP_USERNAME),
    host: SMTP_HOST,
    port: SMTP_PORT,
    username: SMTP_USERNAME,
    password: SMTP_PASSWORD,
    senderEmail: SMTP_SENDER_EMAIL,
    senderName: SMTP_SENDER_NAME
  };
}

export interface GoogleOAuthConfig {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
}

export async function getGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
  const rec = await getIntegration('oauth_google');
  if (rec && rec.enabled) {
    return {
      enabled: true,
      clientId: rec.config.clientId || '',
      clientSecret: rec.config.clientSecret || ''
    };
  }
  return { enabled: false, clientId: '', clientSecret: '' };
}

// Upserts the config for a given integration type, preserving any secret
// field the caller sent back as the masking sentinel (the dashboard never
// re-displays a saved secret in plaintext — see controllers/integrations.ts).
export async function saveIntegration(
  type: IntegrationType,
  config: Record<string, any>,
  enabled: boolean
): Promise<IntegrationRecord> {
  const authenticated = await ensurePBAuth();
  if (!authenticated) throw new Error('PocketBase admin authentication failed');

  let existing: any = null;
  try {
    existing = await pb.collection('integrations').getFirstListItem(pb.filter('type = {:type}', { type }));
  } catch { /* no row yet */ }

  const record = existing
    ? await pb.collection('integrations').update(existing.id, { config, enabled })
    : await pb.collection('integrations').create({ type, config, enabled, lastTestStatus: 'untested', lastTestError: '', lastTestedAt: '' });

  invalidateIntegrationCache(type);

  return {
    id: record.id,
    type,
    config: record.config || {},
    enabled: !!record.enabled,
    lastTestStatus: record.lastTestStatus || 'untested',
    lastTestError: record.lastTestError || '',
    lastTestedAt: record.lastTestedAt || ''
  };
}

export async function recordTestResult(type: IntegrationType, ok: boolean, error: string): Promise<void> {
  const authenticated = await ensurePBAuth();
  if (!authenticated) return;

  let existing: any = null;
  try {
    existing = await pb.collection('integrations').getFirstListItem(pb.filter('type = {:type}', { type }));
  } catch { /* no row yet — nothing to record onto */ }

  const patch = {
    lastTestStatus: ok ? 'success' : 'failure',
    lastTestError: ok ? '' : error,
    lastTestedAt: new Date().toISOString()
  };

  if (existing) {
    await pb.collection('integrations').update(existing.id, patch);
  } else {
    await pb.collection('integrations').create({ type, config: {}, enabled: false, ...patch });
  }
  invalidateIntegrationCache(type);
}
