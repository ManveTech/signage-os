import { getIntegration, saveIntegration } from '../integrationsStore';

/**
 * The oldest phone build still allowed in.
 *
 * The app bundles its own copy of the dashboard, so an install that is never
 * updated keeps its old screens and old bugs indefinitely — and there is no
 * other way to retire one. Set a minimum here and anything older shows a
 * full-screen page whose only way on is the store. See src/components/
 * UpdateGate.tsx.
 *
 * This is the Android versionCode (a whole number), not the name like 1.0.12.
 * 0 means no minimum, which is the default and the safe state.
 *
 * Separate from app_releases / appReleases.ts, which serves TV player APKs we
 * host ourselves; this is about the phone app on the Play Store.
 */

const isAdminUser = (user: any) => user?.role === 'admin' || user?.role === 'super_admin';

/** A build number, or null if it isn't one. */
function buildNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < 1e9 ? n : null;
}

export interface AppVersionSettings {
  android: { minBuild: number };
  ios: { minBuild: number };
}

async function read(): Promise<AppVersionSettings> {
  const rec = await getIntegration('app_version').catch(() => null);
  const cfg = rec?.config || {};
  return {
    android: { minBuild: Number(cfg.minBuildAndroid) || 0 },
    ios: { minBuild: Number(cfg.minBuildIos) || 0 },
  };
}

/**
 * GET /public/app-version
 *
 * Deliberately public: the check runs before anyone signs in, and a build
 * number says nothing the Play Store listing doesn't. Cached briefly so a
 * cold start for every app on every resume doesn't reach PocketBase.
 */
export async function getAppVersion(_req: any, res: any) {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json(await read());
  } catch (err: any) {
    console.error('[appVersion] read failed:', err?.message);
    // Fail open — the app treats an error as "no minimum" rather than
    // locking everyone out because PocketBase blinked.
    res.status(500).json({ message: 'Could not load the app version settings.' });
  }
}

/** GET /app-version — same values, for the dashboard's own form. */
export async function getAppVersionAdmin(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ message: 'Access denied.' });
  try {
    res.json(await read());
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Could not load the app version settings.' });
  }
}

/** PUT /app-version — admin only. */
export async function putAppVersion(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ message: 'Access denied.' });

  const android = buildNumber(req.body?.android?.minBuild);
  const ios = buildNumber(req.body?.ios?.minBuild);
  if (android === null || ios === null) {
    return res.status(400).json({ message: 'A minimum version is a whole number, or 0 for none.' });
  }

  try {
    await saveIntegration('app_version', { minBuildAndroid: android, minBuildIos: ios }, true);
    res.json({ android: { minBuild: android }, ios: { minBuild: ios } });
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Could not save the app versions.' });
  }
}
