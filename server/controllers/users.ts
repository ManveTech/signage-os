import PocketBase from 'pocketbase';
import { pb, ensurePBAuth } from '../db';
import { PB_URL } from '../config';
import { sendCredentialsEmail } from '../email';
import { appBaseUrl } from '../utils/appUrl';
import { logAudit, getClientIp } from '../services/auditLog';
import { removeScreenSchedule } from '../scheduler';
import { clearScreenCache } from './screens';
import { notifyScreenConfigChanged } from '../services/screenPush';

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// This whole file previously had zero role checks — any authenticated user,
// any role, could list every user, view/edit/delete any account, and (via
// updateUser's unrestricted body spread) set their own `role` to
// `super_admin` in a single request. Every handler below now requires admin
// for anything beyond a user managing their own record, and updateUser
// restricts which fields a non-admin may touch on themselves.

export async function listUsers(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const result = await pb.collection('users').getList(1, 500, { sort: '-created' });
    const records = result.items;
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error fetching users' });
  }
}

export async function getUser(req: any, res: any) {
  const isAdmin = isAdminUser(req.user);
  if (!isAdmin && req.user?.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  try {
    const record = await pb.collection('users').getOne(req.params.id);
    const avatarUrl = record.avatar ? `${pb.baseUrl}/api/files/users/${record.id}/${record.avatar}` : '';
    res.json({ ...record, avatarUrl });
  } catch (error: any) {
    res.status(error.status || 404).json({ error: error.message || 'User not found' });
  }
}

export async function createUser(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    const body = req.body;
    const email = body.email;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userPassword = body.password || 'Welcome@123';
    if (userPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'Database authentication unavailable. Try again shortly.' });
    }

    // Check if user already exists in pb
    try {
      const existing = await pb.collection('users').getFirstListItem(
        pb.filter('email = {:email}', { email: email.toLowerCase().trim() })
      );
      if (existing) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
    } catch (e) {
      // Not found, which is correct
    }

    const roleMap: Record<string, string> = {
      client: 'org_admin',
      admin: 'super_admin',
      super_admin: 'super_admin',
      org_admin: 'org_admin',
      content_manager: 'content_manager',
      viewer: 'viewer',
    };
    const pbRole = roleMap[body.role] || 'org_admin';

    // Retrieve license if licenseId is provided
    let license = null;
    if (body.licenseId) {
      try {
        license = await pb.collection('licenses').getOne(body.licenseId);
        if (license.assignedUserEmail) {
          return res.status(400).json({ error: `License ${body.licenseId} is already assigned to ${license.assignedUserEmail}` });
        }
      } catch (err: any) {
        return res.status(400).json({ error: `Selected license not found: ${err.message}` });
      }
    }

    // Organization Setup / Lookup
    const orgName = body.company || '';
    let orgId = '';
    if (orgName) {
      try {
        const existingOrg = await pb.collection('organizations').getFirstListItem(
          pb.filter('name = {:orgName}', { orgName })
        );
        orgId = existingOrg.id;
      } catch (e) {
        // Create new organization if it doesn't exist
        const newOrgId = body.organizationId || (Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)).substring(0, 15);
        const newOrg = {
          id: newOrgId,
          name: orgName,
          adminName: body.name || email.split('@')[0],
          email: email.toLowerCase().trim(),
          planType: license ? (license.name.toLowerCase().includes('pro') ? 'Business' : 'Starter') : 'Starter',
          screensAllowed: license ? license.deviceLimit : 5,
          storageLimit: license ? license.storageLimit : 5,
          subscriptionStatus: 'active',
          renewalDate: license ? license.expiryDate : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        const createdOrg = await pb.collection('organizations').create(newOrg);
        orgId = createdOrg.id;
      }
    }

    const createData: Record<string, any> = {
      name: body.name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      mobile: body.mobile || '',
      role: pbRole,
      company: orgName,
      address: body.address || '',
      password: userPassword,
      passwordConfirm: body.passwordConfirm || userPassword,
      emailVisibility: body.emailVisibility ?? true,
      firstTimeLogin: true,
      licenseCount: license ? 1 : 0,
      screensAssigned: license ? (license.deviceLimit || 0) : 0,
      status: body.status || 'active',
      enableVideoConferencing: license ? !!license.enableVideoConferencing : (body.enableVideoConferencing ?? false),
      enableBroadcasting: body.enableBroadcasting ?? true,
      enableLiveChat: body.enableLiveChat ?? true,
      enableCameraMonitoring: body.enableCameraMonitoring ?? false
    };

    if (body.id && /^[a-z0-9]{15}$/.test(body.id)) {
      createData.id = body.id;
    }

    const record = await pb.collection('users').create(createData);

    // Update license assignment if license was selected
    if (license) {
      await pb.collection('licenses').update(license.id, {
        assignedUserEmail: email.toLowerCase().trim(),
        assignedOrgName: orgName,
        assignedOrgId: orgId
      });
    }

    // Send credentials email
    if (body.sendEmail !== false) {
      await sendCredentialsEmail({
        toEmail: record.email,
        userName: record.name,
        role: record.role,
        tempPassword: userPassword,
        loginUrl: appBaseUrl(req)
      });
    }

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'user.created',
      targetType: 'users',
      targetId: record.id,
      detail: `email=${record.email}, role=${record.role}`,
      ip: getClientIp(req)
    });

    res.status(201).json(record);
  } catch (error: any) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message || 'Error creating user', details: error.response?.data || error.data });
  }
}

// Fields a non-admin is allowed to touch on their OWN account. Deliberately
// excludes role, license/screen counts, feature flags, email, company, and
// status — the previous version let a client PUT {"role":"super_admin"} on
// their own id and be granted full admin instantly.
const SELF_EDITABLE_FIELDS = new Set(['name', 'mobile', 'address', 'password', 'passwordConfirm', 'firstTimeLogin']);

export async function updateUser(req: any, res: any) {
  const isAdmin = isAdminUser(req.user);
  const isSelf = req.user?.id === req.params.id;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const body: Record<string, any> = { ...req.body };

    let previousRole: string | undefined;
    if (!isAdmin) {
      for (const key of Object.keys(body)) {
        if (!SELF_EDITABLE_FIELDS.has(key)) delete body[key];
      }
    } else if (typeof body.role === 'string') {
      // Role changes are privilege-escalation-sensitive — capture the prior
      // value before it's overwritten so the audit entry shows the change.
      try {
        const existing = await pb.collection('users').getOne(req.params.id);
        previousRole = existing.role;
      } catch (_) { /* best-effort — don't block the update if this lookup fails */ }
    }

    if (!body.password) {
      delete body.password;
      delete body.passwordConfirm;
    } else {
      // Changing your OWN password previously only verified the current
      // password with a separate client-side /auth/login call before this
      // request was ever sent — the actual update never re-checked it
      // server-side, so anyone already holding a valid session for this
      // account could set a new password without proving they knew the old
      // one. Re-verify here, the same way login itself authenticates.
      // Exception: the mandatory first-time-login password change already
      // proved the temp password moments ago (it's how the JWT was issued),
      // and the frontend for that flow has no way to ask for it again — a
      // fresh account has no "current password" to protect yet.
      if (isSelf) {
        let isFirstTimeLoginChange = false;
        try {
          const existing = await pb.collection('users').getOne(req.params.id);
          isFirstTimeLoginChange = !!existing.firstTimeLogin;
        } catch (_) { /* best-effort — falls through to requiring verification */ }

        if (!isFirstTimeLoginChange) {
          const currentPassword = req.body.currentPassword;
          if (!currentPassword) {
            return res.status(400).json({ error: 'Current password is required to change your password.' });
          }
          try {
            const verifyPb = new PocketBase(PB_URL);
            await verifyPb.collection('users').authWithPassword(req.user.email, currentPassword);
          } catch {
            return res.status(403).json({ error: 'Current password is incorrect.' });
          }
        }
      }
      delete body.currentPassword;
      body.passwordConfirm = body.password;
      // If changing password, set firstTimeLogin to false unless explicitly overridden
      if (body.firstTimeLogin === undefined) {
        body.firstTimeLogin = false;
      }
    }
    const record = await pb.collection('users').update(req.params.id, body);

    if (isAdmin && typeof body.role === 'string' && body.role !== previousRole) {
      logAudit({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: 'user.role_changed',
        targetType: 'users',
        targetId: req.params.id,
        detail: `${previousRole ?? 'unknown'} -> ${body.role}`,
        ip: getClientIp(req)
      });
    }
    if (isAdmin && !isSelf) {
      logAudit({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: 'user.updated_by_admin',
        targetType: 'users',
        targetId: req.params.id,
        detail: Object.keys(body).join(','),
        ip: getClientIp(req)
      });
    }

    res.json(record);
  } catch (error: any) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message || 'Error updating user' });
  }
}


// Small profile photo, not full media — same idea as the image/video limits
// in media_items.ts but tighter, since this is just an avatar.
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/**
 * Sets or clears the real `avatar` file field on a user's PocketBase record.
 * Previously the frontend only ever stored the uploaded image as base64 in
 * localStorage — nothing was ever written to the account itself, so the
 * avatar never followed the user to another browser/device and admins could
 * never see it.
 */
export async function updateUserAvatar(req: any, res: any) {
  const isAdmin = isAdminUser(req.user);
  const isSelf = req.user?.id === req.params.id;
  if (!isAdmin && !isSelf) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const userId = req.params.id;

    if (req.body?.removeAvatar) {
      const record = await pb.collection('users').update(userId, { avatar: null });
      return res.json({ ...record, avatarUrl: '' });
    }

    const { avatarData, mimeType, fileName } = req.body;
    if (!avatarData || !mimeType) {
      return res.status(400).json({ error: 'avatarData and mimeType are required.' });
    }
    if (!mimeType.startsWith('image/')) {
      return res.status(400).json({ error: 'Avatar must be an image file.' });
    }

    const fileBuffer = Buffer.from(avatarData, 'base64');
    if (fileBuffer.length > MAX_AVATAR_BYTES) {
      return res.status(413).json({ error: `Avatar too large. Maximum allowed size is ${MAX_AVATAR_BYTES / (1024 * 1024)}MB.` });
    }

    const ext = mimeType.split('/')[1] || 'png';
    const safeFileName = (fileName || `avatar.${ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileBlob = new File([fileBuffer], safeFileName, { type: mimeType });

    const formData = new FormData();
    formData.append('avatar', fileBlob);

    const record = await pb.collection('users').update(userId, formData);
    const avatarUrl = record.avatar ? `${pb.baseUrl}/api/files/users/${record.id}/${record.avatar}` : '';

    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: isSelf ? 'user.avatar_updated' : 'user.avatar_updated_by_admin',
      targetType: 'users',
      targetId: userId,
      ip: getClientIp(req)
    });

    res.json({ ...record, avatarUrl });
  } catch (error: any) {
    console.error('Error updating user avatar:', error);
    res.status(500).json({ error: error.message || 'Error updating avatar' });
  }
}

export async function deleteUser(req: any, res: any) {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  try {
    // Previously this only ever deleted the users record — every screen,
    // license, playlist, and media item that referenced this account by
    // email kept doing so forever, with no owner able to ever manage them
    // again. Screens and licenses are unassigned back to a reusable state
    // (mirroring what disconnectScreen already does for a single screen);
    // playlists/media_items keep createdBy/uploadedBy as a historical
    // attribution rather than being touched or deleted, since content
    // itself shouldn't disappear just because the account that made it did.
    const deletedUser = await pb.collection('users').getOne(req.params.id).catch(() => null);
    const userEmail = deletedUser?.email;

    if (userEmail) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const orphanedScreens = await pb.collection('screens').getFullList({
        filter: pb.filter('assignedToUserEmail = {:email}', { email: userEmail })
      }).catch(() => [] as any[]);
      await Promise.all(orphanedScreens.map((screen: any) => {
        let pairingCode = '';
        for (let i = 0; i < 6; i++) pairingCode += chars.charAt(Math.floor(Math.random() * chars.length));
        return pb.collection('screens').update(screen.id, {
          status: 'pairing',
          pairing_code: pairingCode,
          pairing_code_expires: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          assignedToUserEmail: '',
          license_id: '',
          groupId: null,
          playlist: '',
          playlistId: '',
          schedulePlaylist: '',
          scheduleDate: '',
          scheduleTime: '',
          onlineSince: ''
        }).then(async () => {
          removeScreenSchedule(screen.id);
          await clearScreenCache(screen.id, screen.hardware_uuid);
          // The TV drops back to its pairing code now, not on its next poll.
          notifyScreenConfigChanged(screen.id);
        }).catch(() => {});
      }));

      const orphanedLicenses = await pb.collection('licenses').getFullList({
        filter: pb.filter('assignedUserEmail = {:email}', { email: userEmail })
      }).catch(() => [] as any[]);
      await Promise.all(orphanedLicenses.map((lic: any) =>
        pb.collection('licenses').update(lic.id, {
          assignedUserEmail: '',
          assignedOrgName: '',
          assignedOrgId: ''
        }).catch(() => {})
      ));
    }

    await pb.collection('users').delete(req.params.id);
    logAudit({
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'user.deleted',
      targetType: 'users',
      targetId: req.params.id,
      detail: userEmail ? `email=${userEmail}` : undefined,
      ip: getClientIp(req)
    });
    res.status(204).end();
  } catch (error: any) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message || 'Error deleting user' });
  }
}
