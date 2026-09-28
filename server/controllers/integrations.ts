import { pb, ensurePBAuth } from '../db';
import { getIntegration, saveIntegration, recordTestResult, IntegrationType } from '../integrationsStore';
import { testR2Connection } from '../r2';
import { testSmtpConnection } from '../email';

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
const SECRET_FIELD: Record<IntegrationType, string> = {
  cloudflare: 'secretAccessKey',
  smtp: 'password',
  oauth_google: 'clientSecret'
};
export const SECRET_MASK = '__SECRET_UNCHANGED__';

function maskConfig(type: IntegrationType, config: Record<string, any>): Record<string, any> {
  const field = SECRET_FIELD[type];
  const masked = { ...config };
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
      return {
        type,
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
