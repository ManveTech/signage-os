import { pb, ensurePBAuth } from '../db';
import { getIntegration, saveIntegration, recordTestResult, IntegrationType, getSmtpConfig, getCloudflareConfig, getGoogleOAuthConfig } from '../integrationsStore';
import { testR2Connection } from '../r2';
import { testSmtpConnection, sendSmtpTestEmail } from '../email';
import { configureBackups } from '../services/backups';
import { migrateMedia, emptyProgress, BucketRef } from '../services/mediaMigration';
import { S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET } from '../config';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

const VALID_TYPES: IntegrationType[] = ['cloudflare', 'smtp', 'oauth_google'];

// The one field per integration type that's a real secret — never
// re-displayed to the browser once saved. GET responses replace it with
// this sentinel so the dashboard can show "a secret is set" without ever
// exposing the value again; a PUT that echoes the sentinel back unchanged
// tells saveIntegration to keep whatever's already stored instead of
// overwriting it with the literal placeholder string.
// ('business' holds the invoice billing details — no secrets, not listed
// on the Integrations page; see controllers/businessDetails.ts.)
const SECRET_FIELD: Partial<Record<IntegrationType, string>> = {
  cloudflare: 'secretAccessKey',
  smtp: 'password',
  oauth_google: 'clientSecret'
};
export const SECRET_MASK = '__SECRET_UNCHANGED__';

function maskConfig(type: IntegrationType, config: Record<string, any>): Record<string, any> {
  const field = SECRET_FIELD[type];
  const masked = { ...config };
  if (!field) return masked;
  if (masked[field]) {
    masked[field] = SECRET_MASK;
  } else {
    masked[field] = '';
  }
  return masked;
}

export async function listIntegrations(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const results = await Promise.all(VALID_TYPES.map(async (type) => {
      const rec = await getIntegration(type);
      // Which settings are actually live: the ones saved here, the server's
      // environment variables (used when nothing is enabled here), or none.
      const live = type === 'smtp' ? await getSmtpConfig()
        : type === 'cloudflare' ? await getCloudflareConfig()
        : await getGoogleOAuthConfig();
      const source = rec?.enabled ? 'dashboard' : live.enabled ? 'environment' : 'off';
      return {
        type,
        source,
        config: maskConfig(type, rec?.config || {}),
        enabled: rec?.enabled || false,
        lastTestStatus: rec?.lastTestStatus || 'untested',
        lastTestError: rec?.lastTestError || '',
        lastTestedAt: rec?.lastTestedAt || ''
      };
    }));
    res.json(results);
  } catch (error: any) {
    console.error('Error listing integrations:', error);
    res.status(500).json({ error: error.message || 'Error fetching integrations' });
  }
}

export async function updateIntegration(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const type = req.params.type as IntegrationType;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Unknown integration type: ${type}` });
  }
  try {
    const { config, enabled } = req.body;
    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'config object is required.' });
    }

    const secretField = SECRET_FIELD[type];
    const finalConfig = { ...config };
    if (finalConfig[secretField] === SECRET_MASK) {
      const existing = await getIntegration(type);
      finalConfig[secretField] = existing?.config?.[secretField] || '';
    }

    const saved = await saveIntegration(type, finalConfig, !!enabled);
    // The backups bucket lives in the File storage settings.
    if (type === 'cloudflare') await configureBackups().catch(() => {});
    res.json({
      type,
      config: maskConfig(type, saved.config),
      enabled: saved.enabled,
      lastTestStatus: saved.lastTestStatus,
      lastTestError: saved.lastTestError,
      lastTestedAt: saved.lastTestedAt
    });
  } catch (error: any) {
    console.error(`Error updating ${type} integration:`, error);
    res.status(500).json({ error: error.message || 'Error updating integration' });
  }
}

export async function testIntegrationConnection(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  const type = req.params.type as IntegrationType;
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: `Unknown integration type: ${type}` });
  }

  try {
    // Test whatever config the admin has on the form right now (even if not
    // saved yet), falling back to what's already stored so a saved,
    // untouched integration can still be re-tested from the same button.
    const bodyConfig = req.body?.config;
    const secretField = SECRET_FIELD[type];
    const existing = await getIntegration(type);
    const cfg: Record<string, any> = { ...(existing?.config || {}), ...(bodyConfig || {}) };
    if (cfg[secretField] === SECRET_MASK) {
      cfg[secretField] = existing?.config?.[secretField] || '';
    }

    let result: { ok: boolean; error?: string; note?: string };
    if (type === 'cloudflare') {
      result = await testR2Connection({
        bucket: cfg.bucket || '',
        region: cfg.region || 'auto',
        endpoint: cfg.endpoint || '',
        accessKeyId: cfg.accessKeyId || '',
        secretAccessKey: cfg.secretAccessKey || ''
      });
    } else if (type === 'smtp') {
      result = await testSmtpConnection({
        host: cfg.host || '',
        port: Number(cfg.port) || 587,
        username: cfg.username || '',
        password: cfg.password || ''
      });
    } else {
      // oauth_google: there is no non-interactive way to verify a client
      // id/secret pair without actually running a real Google sign-in — the
      // best a server-side check can do is confirm the client id is
      // well-formed and that Google's own OAuth endpoint is reachable. Real
      // verification happens the first time someone signs in with it.
      const clientId = String(cfg.clientId || '');
      const clientSecret = String(cfg.clientSecret || '');
      if (!clientId || !clientSecret) {
        result = { ok: false, error: 'clientId and clientSecret are both required.' };
      } else if (!clientId.endsWith('.apps.googleusercontent.com')) {
        result = { ok: false, error: 'clientId does not look like a Google OAuth client ID (should end with .apps.googleusercontent.com).' };
      } else {
        try {
          const discoveryRes = await fetch('https://accounts.google.com/.well-known/openid-configuration');
          result = discoveryRes.ok
            ? { ok: true, note: 'Format looks valid and Google\'s OAuth service is reachable. Full verification only happens on the first real sign-in.' }
            : { ok: false, error: 'Could not reach Google\'s OAuth discovery endpoint.' };
        } catch (e: any) {
          result = { ok: false, error: e.message || 'Could not reach Google\'s OAuth discovery endpoint.' };
        }
      }
    }

    await recordTestResult(type, result.ok, result.error || '');
    res.json(result);
  } catch (error: any) {
    console.error(`Error testing ${type} integration:`, error);
    res.status(500).json({ ok: false, error: error.message || 'Error testing integration' });
  }
}

/**
 * POST /integrations/smtp/send-test — sends a real email to the signed-in
 * admin with the settings on screen (saved or not), so "it works" means an
 * email actually arrived, not just that the server accepted a login.
 */
export async function sendTestEmail(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const existing = await getIntegration('smtp');
    const live = await getSmtpConfig();
    const body = req.body?.config && typeof req.body.config === 'object' ? req.body.config : {};
    const cfg: Record<string, any> = { ...(existing?.config || {}), ...body };
    if (!cfg.password || cfg.password === SECRET_MASK) cfg.password = existing?.config?.password || '';
    // Nothing saved here — fall back to what the server is using.
    if (!cfg.host) Object.assign(cfg, { host: live.host, port: live.port, username: live.username, password: live.password, senderEmail: live.senderEmail, senderName: live.senderName });
    const result = await sendSmtpTestEmail({
      host: String(cfg.host || ''),
      port: Number(cfg.port) || 587,
      username: String(cfg.username || ''),
      password: String(cfg.password || ''),
      senderEmail: String(cfg.senderEmail || cfg.username || ''),
      senderName: String(cfg.senderName || 'SignageOS')
    }, req.user.email);
    await recordTestResult('smtp', result.ok, result.error || '');
    res.json({ ...result, to: req.user.email });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message || 'Could not send the test email' });
  }
}

// ── Moving existing media to the storage saved here ─────────────────────────
// The old storage is the server's environment settings (S3_* / R2_PUBLIC_URL);
// the new one is what's saved and switched on in File storage. One move at a
// time; the old bucket is only read.

const migration = emptyProgress();

async function migrationPlan(): Promise<{ from: BucketRef; to: BucketRef } | null> {
  const rec = await getIntegration('cloudflare');
  if (!rec?.enabled) return null;
  const to: BucketRef = {
    endpoint: rec.config.endpoint || '', bucket: rec.config.bucket || '',
    accessKey: rec.config.accessKeyId || '', secret: rec.config.secretAccessKey || '',
    publicUrl: rec.config.publicUrl || '',
  };
  const from: BucketRef = {
    endpoint: S3_ENDPOINT, bucket: S3_BUCKET, accessKey: S3_ACCESS_KEY, secret: S3_SECRET,
    publicUrl: (process.env.R2_PUBLIC_URL || '').trim(),
  };
  if (Object.values(from).some(v => !v) || Object.values(to).some(v => !v)) return null;
  const same = from.endpoint.replace(/\/$/, '') === to.endpoint.replace(/\/$/, '') && from.bucket === to.bucket;
  if (same || from.publicUrl === to.publicUrl) return null;
  return { from, to };
}

/** GET /integrations/cloudflare/migration — is there old media to move, and how far along. */
export async function getMediaMigration(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  const plan = await migrationPlan().catch(() => null);
  res.json({
    available: !!plan,
    from: plan ? { bucket: plan.from.bucket, publicUrl: plan.from.publicUrl } : null,
    to: plan ? { bucket: plan.to.bucket, publicUrl: plan.to.publicUrl } : null,
    progress: migration,
  });
}

/** POST /integrations/cloudflare/migration — copy everything across and rewrite addresses. */
export async function startMediaMigration(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  if (['copying', 'checking', 'rewriting'].includes(migration.state)) return res.status(409).json({ error: 'A move is already running.' });
  const plan = await migrationPlan().catch(() => null);
  if (!plan) return res.status(400).json({ error: 'Save and switch on the new storage first — there is nothing to move.' });
  await ensurePBAuth();
  // Runs in the background; the dashboard polls the progress.
  migrateMedia({ ...plan, pb, apply: true, progress: migration, log: (m) => console.log(`[Media move] ${m}`) })
    .catch((e) => { migration.state = 'failed'; migration.error = e.message; });
  res.status(202).json({ progress: migration });
}
