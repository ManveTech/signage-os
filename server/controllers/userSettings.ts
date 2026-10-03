import { pb } from '../db';
import { getSmtpConfig } from '../integrationsStore';

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
