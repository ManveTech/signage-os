import { getIntegration, saveIntegration } from '../integrationsStore';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

const FIELDS = [
  'name', 'address', 'gstNumber', 'logoUrl', 'contactEmail', 'contactPhone',
  'state', 'invoicePrefix', 'sac',
  /*
   * The two below are for the public marketing site rather than invoices.
   *
   * whatsappNumber — every "request a quote" button on bluestardigitech.com
   *   opens a wa.me chat with this number, so it is stored in wa.me's own
   *   format: country code and digits only, no '+', spaces or dashes
   *   (918095851597). normalizeWhatsapp() below strips the rest.
   * enquiryEmail — where a new enquiry from the site is emailed. Separate
   *   from contactEmail on purpose: that one is printed on invoices and is
   *   usually accounts, which is not who should be chasing a lead.
   */
  'whatsappNumber', 'enquiryEmail'
] as const;
// Used when not filled in: the business is registered in Karnataka; SAC 997331
// is licensing services for the right to use software.
const DEFAULTS: Partial<Record<(typeof FIELDS)[number], string>> = { state: 'Karnataka', invoicePrefix: 'BSD', sac: '997331' };
const MAX_LOGO_CHARS = 600_000; // ~450 KB image as a data URL

/**
 * wa.me rejects '+', spaces and dashes, and silently opens a chat with the
 * wrong person if the country code is missing — so a number typed the way it
 * appears on a letterhead ("+91 80958 51597") is normalised here rather than
 * leaving every caller to remember. A bare 10-digit Indian mobile gets 91.
 */
function normalizeWhatsapp(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function clean(input: any): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIELDS) {
    const v = input?.[key];
    out[key] = (typeof v === 'string' ? v.trim() : '') || DEFAULTS[key] || '';
  }
  out.whatsappNumber = normalizeWhatsapp(out.whatsappNumber);
  return out;
}

/** Where a new enquiry is emailed: the dedicated mailbox, else the invoice one. */
export async function getEnquiryRecipient(): Promise<string> {
  const rec = await getIntegration('business');
  const cfg = rec?.config || {};
  return (cfg.enquiryEmail || cfg.contactEmail || '').trim();
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

/**
 * GET /public/contact — the subset of the business details the marketing site
 * is allowed to show a stranger: who we are, where we are, and how to reach us.
 *
 * Deliberately NOT the same payload as getBusinessDetails above, which is
 * behind authenticateToken and returns the GST number, SAC code and invoice
 * prefix. Those are for invoices; publishing them on a public endpoint would
 * hand anyone the company's tax registration. This allowlist is the whole
 * point of the handler — extend it only with fields that belong on a
 * letterhead.
 */
export async function getPublicContact(_req: any, res: any) {
  const rec = await getIntegration('business');
  const cfg: any = rec?.config || {};
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    name: (cfg.name || '').trim(),
    address: (cfg.address || '').trim(),
    contactEmail: (cfg.contactEmail || '').trim(),
    contactPhone: (cfg.contactPhone || '').trim(),
    whatsappNumber: normalizeWhatsapp(cfg.whatsappNumber || '')
  });
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
