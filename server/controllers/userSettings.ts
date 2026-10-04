import { pb } from '../db';
import { getSmtpConfig } from '../integrationsStore';
import { resolveUserOrgId } from '../services/ownership';
import { GST_STATES, GSTIN_PATTERN, stateFromGstin } from '../services/gst';

/**
 * The signed-in user's own preferences (Settings page). Kept to an explicit
 * list so this can't be used to change anything else on the user record.
 */
const BOOLEAN_SETTINGS = ['alertScreenOffline'] as const;

async function loadSelf(req: any) {
  if (!req.user?.email) return null;
  return pb.collection('users')
    .getFirstListItem(pb.filter('email = {:email}', { email: req.user.email }))
    .catch(() => null);
}

async function emailReady(): Promise<boolean> {
  const cfg = await getSmtpConfig().catch(() => null);
  return !!(cfg?.host && cfg?.username);
}

function view(user: any, ready: boolean) {
  const out: Record<string, unknown> = { email: user.email, emailReady: ready };
  for (const key of BOOLEAN_SETTINGS) out[key] = !!user[key];
  return out;
}

export async function getMySettings(req: any, res: any) {
  const user = await loadSelf(req);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  res.json(view(user, await emailReady()));
}

export async function updateMySettings(req: any, res: any) {
  const user = await loadSelf(req);
  if (!user) return res.status(404).json({ message: 'Account not found.' });
  const update: Record<string, boolean> = {};
  for (const key of BOOLEAN_SETTINGS) {
    if (typeof req.body?.[key] === 'boolean') update[key] = req.body[key];
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ message: 'Nothing to update.' });
  try {
    const saved = await pb.collection('users').update(user.id, update);
    res.json(view(saved, await emailReady()));
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Could not save your settings.' });
  }
}

/**
 * GET/PUT /me/billing — the details printed on the client's invoices
 * (billing name, address, state, GSTIN), kept on their
 * organisation. Admins can edit any organisation's from Organizations.
 */
async function myOrg(req: any) {
  const orgId = await resolveUserOrgId(req.user?.email).catch(() => null);
  return orgId ? pb.collection('organizations').getOne(orgId).catch(() => null) : null;
}

const billingView = (org: any) => ({ billingName: org.billingName || org.name || '', billingAddress: org.billingAddress || '', state: org.state || '', gstin: org.gstin || '' });

export async function getMyBilling(req: any, res: any) {
  const org = await myOrg(req);
  if (!org) return res.json({ billingName: '', billingAddress: '', state: '', gstin: '', noOrganization: true });
  res.json(billingView(org));
}

export async function updateMyBilling(req: any, res: any) {
  const org = await myOrg(req);
  if (!org) return res.status(400).json({ message: 'Your account has no organisation yet — ask us to set it up.' });
  const result = validateBilling(req.body);
  if ('error' in result) return res.status(400).json({ message: result.error });
  try {
    const saved = await pb.collection('organizations').update(org.id, result.values);
    res.json(billingView(saved));
  } catch (err: any) {
    res.status(500).json({ message: err.message || 'Could not save your billing details.' });
  }
}

/** Shared check for billing details (also used when admins edit an organisation). */
export function validateBilling(body: any): { values: Record<string, string> } | { error: string } {
  const gstin = String(body?.gstin || '').trim().toUpperCase();
  let state = String(body?.state || '').trim();
  if (gstin && !GSTIN_PATTERN.test(gstin)) return { error: 'That GSTIN doesn\'t look right — it should be 15 characters, like 29ABCDE1234F1Z5.' };
  if (gstin) {
    const fromGstin = stateFromGstin(gstin);
    if (state && fromGstin && state !== fromGstin) return { error: `That GSTIN is registered in ${fromGstin}, not ${state}.` };
    state = state || fromGstin;
  }
  if (state && !Object.values(GST_STATES).includes(state)) return { error: 'Pick a state from the list.' };
  const values: Record<string, string> = {
    billingAddress: String(body?.billingAddress || '').trim().slice(0, 300),
    state,
    gstin,
  };
  // The organisation's own name links it to its users, so invoices use a
  // separate billing name (the registered company name).
  values.billingName = String(body?.billingName || '').trim().slice(0, 120);
  return { values };
}
