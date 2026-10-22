import { pb, ensurePBAuth } from '../db';
import { uploadToR2, deleteFromR2, getKeyFromUrl } from '../r2';
import { logAudit, getClientIp } from '../services/auditLog';

/**
 * TV player builds, offered at bluestardigitech.com/app.
 *
 * Admins upload an APK with a version number from the dashboard; the file goes
 * to R2 and a row goes into app_releases. The public side is two reads:
 *
 *   GET /public/app/latest    302 to the newest APK — what a TV opens
 *   GET /public/app/releases  every release, newest first
 */

export const MAX_APK_BYTES = 200 * 1024 * 1024;

const isAdmin = (user: any) => user?.role === 'admin' || user?.role === 'super_admin';

// Only what a visitor needs. uploadedBy stays private.
const publicShape = (r: any) => ({
  id: r.id,
  version: r.version,
  notes: r.notes || '',
  fileUrl: r.fileUrl,
  fileName: r.fileName || '',
  fileSize: r.fileSize || 0,
  created: r.created,
});

async function listReleases() {
  await ensurePBAuth();
  return pb.collection('app_releases').getFullList({ sort: '-created' });
}

export async function getPublicReleases(_req: any, res: any) {
  try {
    const rows = await listReleases();
    // Short cache: a new upload should show up within a minute.
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(rows.map(publicShape));
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Could not load releases' });
  }
}

/**
 * Redirects straight to the newest APK, so the link itself is the download.
 * A TV browser (or the Downloader app) opening it gets the file with no page
 * in between, and no JavaScript needed.
 */
export async function downloadLatest(_req: any, res: any) {
  try {
    const [latest] = await listReleases();
    res.setHeader('Cache-Control', 'no-store');
    if (!latest) return res.status(404).type('text/plain').send('No app has been released yet.');
    res.redirect(302, latest.fileUrl);
  } catch (error: any) {
    res.status(500).type('text/plain').send('Could not find the latest app. Please try again shortly.');
  }
}

/**
 * POST /app-releases — body is the raw APK; the version and notes come as
 * query parameters. Raw rather than base64 JSON: an APK is tens of MB, and
 * base64 would add a third on top for nothing.
 */
export async function uploadRelease(req: any, res: any) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  try {
    const version = String(req.query.version || '').trim();
    const notes = String(req.query.notes || '').trim().slice(0, 2000);
    const body: Buffer = req.body;

    if (!/^[0-9A-Za-z][0-9A-Za-z.\-_]{0,30}$/.test(version)) {
      return res.status(400).json({ error: 'Enter a version like 1.2 or 1.2.3.' });
    }
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return res.status(400).json({ error: 'Choose an APK file to upload.' });
    }
    // Every APK is a zip, and every zip starts "PK".
    if (body[0] !== 0x50 || body[1] !== 0x4b) {
      return res.status(400).json({ error: 'That file is not an APK.' });
    }

    await ensurePBAuth();
    const existing = await pb.collection('app_releases')
      .getFirstListItem(pb.filter('version = {:v}', { v: version })).catch(() => null);
    if (existing) return res.status(409).json({ error: `Version ${version} is already released. Use a new version number.` });

    const fileName = `BlueStar-Signage-${version}.apk`;
    const fileUrl = await uploadToR2(
      body,
      `app-releases/android/${fileName}`,
      'application/vnd.android.package-archive',
      `attachment; filename="${fileName}"`
    );

    const record = await pb.collection('app_releases').create({
      version,
      platform: 'android',
      notes,
      fileUrl,
      fileName,
      fileSize: body.length,
      uploadedBy: req.user?.email || '',
    });

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'app_release.published',
      targetType: 'app_releases',
      targetId: record.id,
      detail: `version=${version}, bytes=${body.length}`,
      ip: getClientIp(req)
    });

    res.status(201).json(publicShape(record));
  } catch (error: any) {
    console.error('Error uploading app release:', error);
    res.status(500).json({ error: error.message || 'Could not upload the release' });
  }
}

export async function deleteRelease(req: any, res: any) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  try {
    await ensurePBAuth();
    const record = await pb.collection('app_releases').getOne(req.params.id).catch(() => null);
    if (!record) return res.status(404).json({ error: 'Release not found.' });

    const key = await getKeyFromUrl(record.fileUrl);
    if (key) await deleteFromR2(key).catch(err => console.warn('Could not delete release file from R2:', err.message));
    await pb.collection('app_releases').delete(record.id);

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'app_release.deleted',
      targetType: 'app_releases',
      targetId: record.id,
      detail: `version=${record.version}`,
      ip: getClientIp(req)
    });
    res.status(204).end();
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Could not delete the release' });
  }
}
