import { pb } from '../db';

/**
 * The organisation a user belongs to: the one on their licence, or else the
 * one named by their account's company. (Licence only, before — a client
 * whose licence had no organisation counted as having none.)
 */
export async function resolveUserOrgId(userEmail: string | undefined): Promise<string | null> {
  if (!userEmail) return null;
  const license = await pb.collection('licenses').getFirstListItem(
    pb.filter('assignedUserEmail = {:email} && assignedOrgId != ""', { email: userEmail })
  ).catch(() => null);
  if (license?.assignedOrgId) return license.assignedOrgId;
  const user = await pb.collection('users').getFirstListItem(
    pb.filter('email = {:email}', { email: userEmail })
  ).catch(() => null);
  if (!user?.company) return null;
  const org = await pb.collection('organizations').getFirstListItem(
    pb.filter('name = {:name}', { name: user.company })
  ).catch(() => null);
  return org?.id || null;
}

/** A screen group belongs to a user if it's their organisation's, or they made it. */
export async function groupBelongsTo(group: any, userEmail: string | undefined): Promise<boolean> {
  if (!group || !userEmail) return false;
  if (group.createdBy && group.createdBy === userEmail) return true;
  if (!group.orgId) return false;
  const orgId = await resolveUserOrgId(userEmail);
  return !!orgId && group.orgId === orgId;
}
