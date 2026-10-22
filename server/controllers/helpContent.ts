import crypto from 'crypto';
import { pb, ensurePBAuth } from '../db';
import { uploadToR2 } from '../r2';
import { logAudit, getClientIp } from '../services/auditLog';
import { defaultGuideRecords, defaultFaqRecords } from '../data/helpDefaults';

const isAdmin = (user: any) => user?.role === 'admin' || user?.role === 'super_admin';

/**
 * POST /help/defaults — adds the standard guides and FAQs to the Help Center.
 *
 * Anything whose title (or question) is already there is skipped, so pressing
 * it again only fills gaps: an edited guide is never overwritten and a
 * deleted one only returns if the admin asks for it.
 */
export async function addDefaultHelp(req: any, res: any) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  try {
    await ensurePBAuth();
    const norm = (s: string) => String(s || '').trim().toLowerCase();
    const haveDocs = new Set((await pb.collection('support_docs').getFullList({ fields: 'title' })).map((d: any) => norm(d.title)));
    const haveFaqs = new Set((await pb.collection('faqs').getFullList({ fields: 'question' })).map((f: any) => norm(f.question)));

    let guides = 0, faqs = 0;
    for (const g of defaultGuideRecords()) {
      if (haveDocs.has(norm(g.title))) continue;
      await pb.collection('support_docs').create({ ...g, createdDate: new Date().toISOString().slice(0, 10) });
      guides++;
    }
    for (const f of defaultFaqRecords()) {
      if (haveFaqs.has(norm(f.question))) continue;
      await pb.collection('faqs').create(f);
      faqs++;
    }

    logAudit({ actorId: req.user?.id, actorEmail: req.user?.email, action: 'help.defaults_added', detail: `guides=${guides}, faqs=${faqs}`, ip: getClientIp(req) });
    res.json({ guides, faqs });
  } catch (error: any) {
    console.error('Error adding standard help content:', error);
    res.status(500).json({ error: error.message || 'Could not add the standard guides' });
  }
}

const MAX_HELP_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };

/**
 * POST /help/images — a screenshot for a guide step. The body is the raw
 * image. Stored in R2 under help/, separate from anyone's media library and
 * not counted against a plan's storage.
 */
export async function uploadHelpImage(req: any, res: any) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin access required.' });
  const type = String(req.headers['content-type'] || '').split(';')[0].trim();
  const ext = IMAGE_TYPES[type];
  if (!ext) return res.status(400).json({ error: 'Use a PNG, JPG, WebP or GIF image.' });
  const body: Buffer = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: 'No image received.' });
  if (body.length > MAX_HELP_IMAGE_BYTES) return res.status(413).json({ error: 'Screenshots can be up to 8 MB.' });
  try {
    const url = await uploadToR2(body, `help/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`, type);
    res.status(201).json({ url });
  } catch (error: any) {
    res.status(503).json({ error: error.message || 'Could not store the image' });
  }
}
