import { getIntegration, saveIntegration } from '../integrationsStore';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

const FIELDS = ['name', 'address', 'gstNumber', 'logoUrl', 'contactEmail', 'contactPhone', 'state', 'invoicePrefix', 'sac'] as const;
// Used when not filled in: the business is registered in Karnataka; SAC 997331
// is licensing services for the right to use software.
const DEFAULTS: Partial<Record<(typeof FIELDS)[number], string>> = { state: 'Karnataka', invoicePrefix: 'BSD', sac: '997331' };
const MAX_LOGO_CHARS = 600_000; // ~450 KB image as a data URL

function clean(input: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIELDS) {
    const v = input?.[key];
    out[key] = (typeof v === 'string' ? v.trim() : '') || DEFAULTS[key] || '';
  }
  return out;
}

/**
 * GET /business-details — the admin's business details printed on invoices.
 * Any signed-in user can read them (clients see them on their invoices).
 * They used to live only in the admin's own browser storage, so every client
 * saw demo placeholder details instead.
 */
export async function getBusinessDetails(_req: any, res: any) {
  const rec = await getIntegration('business');
  res.json(clean(rec?.config || {}));
}

/** PUT /business-details — admin only. */
export async function putBusinessDetails(req: any, res: any) {
  if (!isAdminUser(req.user)) return res.status(403).json({ message: 'Access denied.' });
  const details = clean(req.body);
  if (details.logoUrl && (details.logoUrl.length > MAX_LOGO_CHARS || !/^(data:image\/(png|jpe?g|webp|gif);base64,|https:\/\/)/i.test(details.logoUrl))) {
    return res.status(400).json({ message: 'Logo must be a PNG, JPG, WebP or GIF under about 450 KB.' });
  }
  try {
    await saveIntegration('business', details, true);
    res.json(details);
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Could not save billing details.' });
  }
}
