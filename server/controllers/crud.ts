import express from 'express';
import { pb, ensurePBAuth } from '../db';
import { checkDeviceStatuses, getLiveScreenMetrics, touchScreenPresence } from './screens';
import { syncScreenSchedule, removeScreenSchedule, syncPlaylistDeletion } from '../scheduler';
import { isRedisReady, redis } from '../redis';
import { logAudit, getClientIp } from '../services/auditLog';
import { notifyScreenConfigChanged, notifyScreensConfigChanged } from '../services/screenPush';

// --- Tenancy rules for the generic CRUD router -----------------------------
// Every collection mounted through createCrudRouter() is covered by exactly
// one of the buckets below. There is deliberately no "unrecognized collection
// falls through with no check" path anymore — that silent default is what
// previously let any authenticated non-admin user list, read, edit, and
// delete every tenant's licenses, organizations, tickets, and invoices, since
// the old ownership check (`record.assignedToUserEmail || record.createdBy`)
// only ever matched screens/screen_logs/playlists and quietly evaluated to
// "allowed" for every other collection.

// Field on the record that identifies its owning user, keyed by collection.
const OWNER_FIELD_BY_COLLECTION: Record<string, string> = {
  screens: 'assignedToUserEmail',
  screen_logs: 'assignedToUserEmail',
  playlists: 'createdBy',
  media_items: 'uploadedBy',
  licenses: 'assignedUserEmail',
  organizations: 'email',
  tickets: 'clientEmail',
  invoices: 'clientEmail'
};

// Shared reference content with no owner — every authenticated user can read
// these, only admins can create/update/delete them.
const PUBLIC_READ_COLLECTIONS = new Set(['faqs', 'support_docs']);

// Internal/admin-only data with no client-facing purpose at all.
const ADMIN_ONLY_COLLECTIONS = new Set(['leads']);

// Collections where even the record's own "owner" isn't allowed to create or
// modify it directly — these are admin/billing/system-managed. A client can
// read their own license, but never edit their device limit or activate
// themselves, for example.
const WRITE_ADMIN_ONLY_COLLECTIONS = new Set(['licenses', 'organizations', 'invoices', 'faqs', 'support_docs', 'tickets']);
const CREATE_ADMIN_ONLY_COLLECTIONS = new Set(['licenses', 'organizations', 'invoices', 'faqs', 'support_docs']);

function isAdminUser(user: any): boolean {
  return user?.role === 'admin' || user?.role === 'super_admin';
}

// screen_groups is scoped by organization, not a direct user-email field —
// resolve the caller's org via their license the same way the dashboard's own
// client-side filtering already does (licensingStore lookups by assignedUserEmail).
async function resolveUserOrgId(userEmail: string | undefined): Promise<string | null> {
  if (!userEmail) return null;
  try {
    const license = await pb.collection('licenses').getFirstListItem(
      pb.filter('assignedUserEmail = {:email}', { email: userEmail })
    );
    return license?.assignedOrgId || null;
  } catch {
    return null;
  }
}

// The `company` field on a user's own record, used to match them against an
// organizations.name — needed because roles like content_manager/viewer are
// meant to share one org with its org_admin, so scoping organizations by the
// org's own `email` field alone (the primary contact, stamped at creation)
// would incorrectly lock out every other member of that same org.
async function resolveUserCompany(userEmail: string | undefined): Promise<string | null> {
  if (!userEmail) return null;
  try {
    const user = await pb.collection('users').getFirstListItem(
      pb.filter('email = {:email}', { email: userEmail })
    );
    return user?.company || null;
  } catch {
    return null;
  }
}

// Single record-level ownership check shared by GET/:id, PUT/PATCH, and
// DELETE, so all three enforce the exact same rule instead of drifting apart.
async function isOwnRecord(collectionName: string, record: any, user: any): Promise<boolean> {
  if (collectionName === 'screen_groups') {
    const orgId = await resolveUserOrgId(user?.email);
    return !!record.orgId && !!orgId && record.orgId === orgId;
  }
  if (collectionName === 'organizations') {
    if (record.email && record.email === user?.email) return true;
    const company = await resolveUserCompany(user?.email);
    return !!company && !!record.name && record.name === company;
  }
  const ownerField = OWNER_FIELD_BY_COLLECTION[collectionName];
  if (!ownerField) return false;
  const ownerValue = record[ownerField];
  return !!ownerValue && ownerValue === user?.email;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 250
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isNetworkError = !error.status || error.status === 0 || error.message?.includes('fetch failed') || error.message?.includes('timeout') || error.message?.includes('ENOTFOUND') || error.code === 'ENOTFOUND';
    if (retries <= 0 || !isNetworkError) throw error;
    console.warn(`[CRUD PocketBase] Connection error: ${error.message || 'timeout'}. Retrying in ${delayMs}ms... (${retries} retries left)`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}

export function createCrudRouter(collectionName: string) {
  const router = express.Router();

  // Middleware to ensure PocketBase auth is valid before any operation
  router.use(async (req: any, res: any, next: any) => {
    try {
      const authenticated = await ensurePBAuth();
      if (!authenticated) {
        return res.status(503).json({ error: 'PocketBase admin authentication failed' });
      }
      next();
    } catch (err: any) {
      res.status(500).json({ error: `PB Auth error: ${err.message}` });
    }
  });

  // GET ALL
  router.get('/', async (req: any, res: any) => {
    try {
      if (collectionName === 'screens' || collectionName === 'screen_logs') {
        await checkDeviceStatuses({ silentIfNoChanges: true });
      }
      
      const filters: string[] = [];
      const filterParams: Record<string, any> = {};
      let page = 1;
      let perPage = 500;
      // Only allow alphanumeric + underscore key names to prevent injection.
      const SAFE_KEY = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

      Object.keys(req.query).forEach(key => {
        const raw = req.query[key];
        if (raw === undefined || raw === null || raw === '') return;
        if (key === 'page') {
          page = parseInt(raw as string) || 1;
        } else if (key === 'perPage') {
          perPage = parseInt(raw as string) || 500;
        } else if (key === 'assignedToUserEmail') {
          // Skip raw query parameter to enforce security
          return;
        } else if (SAFE_KEY.test(key)) {
          // Boolean fields must be compared against unquoted true/false literals in
          // PocketBase filter syntax — the {:param} placeholder always quotes as a string,
          // which never matches a bool column.
          if (raw === 'true' || raw === 'false') {
            filters.push(`${key} = ${raw}`);
          } else {
            filters.push(`${key} = {:${key}}`);
            filterParams[key] = String(raw);
          }
        }
      });

      // Security: Extract and enforce user tenancy
      const userEmail = req.user?.email;
      const isAdmin = isAdminUser(req.user);
      let targetEmail = req.headers['x-assigned-to-user-email'] || req.query.assignedToUserEmail;

      if (!isAdmin) {
        targetEmail = userEmail; // Enforce logged-in user's tenancy

        if (ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
          return res.status(403).json({ error: 'Admin access required.' });
        }
      }

      const ownerField = OWNER_FIELD_BY_COLLECTION[collectionName];

      if (!isAdmin && collectionName === 'screen_groups') {
        const orgId = await resolveUserOrgId(userEmail);
        if (orgId) {
          filters.push(`(orgId = {:orgId} || orgId = "")`);
          filterParams['orgId'] = orgId;
        } else {
          filters.push(`orgId = ""`);
        }
      } else if (!isAdmin && collectionName === 'organizations') {
        // Match either the org's own primary-contact email, or the caller's
        // `company` field against the org name — covers org_admin (whose
        // email was stamped as the org's email at creation) and any
        // content_manager/viewer sharing that same organization.
        const company = await resolveUserCompany(userEmail);
        if (company) {
          filters.push(`(email = {:ownerEmail} || name = {:ownerCompany})`);
          filterParams['ownerEmail'] = String(userEmail);
          filterParams['ownerCompany'] = String(company);
        } else {
          filters.push(`email = {:ownerEmail}`);
          filterParams['ownerEmail'] = String(userEmail);
        }
      } else if (ownerField && !PUBLIC_READ_COLLECTIONS.has(collectionName)) {
        if (targetEmail && targetEmail !== 'all') {
          filters.push(`${ownerField} = {:ownerField}`);
          filterParams['ownerField'] = String(targetEmail);
        } else if (!isAdmin) {
          filters.push(`${ownerField} = {:ownerField}`);
          filterParams['ownerField'] = String(userEmail);
        }
      } else if (!isAdmin && !PUBLIC_READ_COLLECTIONS.has(collectionName) && collectionName !== 'screen_groups') {
        // No recognized tenancy rule for this collection — deny by default
        // instead of silently returning every tenant's records, which is
        // exactly the bug this whole block replaces.
        return res.status(403).json({ error: 'Access denied.' });
      }
      const filterStr = filters.length > 0 ? pb.filter(filters.join(' && '), filterParams) : '';

      // Use getList instead of getFullList to avoid sending skipTotal=1.
      // Sort by '-created' to ensure correct chronological ordering (newest-first).
      const fetchRecords = async () => {
        const result = await retryWithBackoff(() => pb.collection(collectionName).getList(page, perPage, {
          filter: filterStr || undefined,
          sort: '-created'
        }));
        return result.items;
      };

      let records;
      try {
        records = await fetchRecords();
      } catch (firstErr: any) {
        // Auth issues — force re-auth and retry once
        if (firstErr.status === 401 || firstErr.status === 403) {
          const { authenticatePBAdmin } = await import('../db');
          await authenticatePBAdmin();
          records = await fetchRecords();
        } else {
          throw firstErr;
        }
      }
      if (collectionName === 'screens' && Array.isArray(records) && records.length > 0) {
        if (isRedisReady()) {
          try {
            const pipeline = redis.pipeline();
            records.forEach((s: any) => pipeline.exists(`presence:screen:${s.id}`));
            const presenceResults = await pipeline.exec();
            if (presenceResults) {
              records.forEach((s: any, idx: number) => {
                const isOnlineInRedis = presenceResults[idx] && presenceResults[idx][1] === 1;
                if (isOnlineInRedis) {
                  s.status = 'online';
                }
              });
            }
          } catch (_) {}
        }
      }
      res.json(records);
    } catch (error: any) {
      console.error(`Error fetching list from ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // GET ONE
  router.get('/:id', async (req: any, res: any) => {
    try {
      if (collectionName === 'screens') {
        touchScreenPresence(req.params.id);
      }
      const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));

      const isAdmin = isAdminUser(req.user);
      // Enforce security tenancy
      if (!isAdmin) {
        if (ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
          return res.status(403).json({ error: 'Access denied' });
        }
        if (!PUBLIC_READ_COLLECTIONS.has(collectionName) && !(await isOwnRecord(collectionName, record, req.user))) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      res.json(record);
    } catch (error: any) {
      console.error(`Error fetching record from ${collectionName}:`, error);
      res.status(error.status || 404).json({ error: error.message || 'Record not found' });
    }
  });

  // CREATE
  router.post('/', async (req: any, res: any) => {
    try {
      const body = { ...req.body };
      delete body.collectionId;
      delete body.collectionName;
      delete body.expand;
      delete body.createdAt;
      delete body.created;
      delete body.updated;
      if (body.id && !/^[a-z0-9]{15}$/.test(body.id)) {
        delete body.id;
      }

      // Enrich screen logs with owner tenancy, live metrics, and group context at time of creation
      if (collectionName === 'screen_logs' && body.screenId) {
        try {
          const screen = await retryWithBackoff(() => pb.collection('screens').getOne(body.screenId));
          if (screen) {
            if (screen.assignedToUserEmail) {
              body.assignedToUserEmail = screen.assignedToUserEmail;
            }
            const metrics = await getLiveScreenMetrics(screen);
            body.totalUptime = metrics.totalUptime;
            body.loopsPlayed = metrics.loopsPlayed;
            // Enrich with group info
            if (screen.groupId) {
              body.groupId = screen.groupId;
              if (!body.groupName) {
                const grp = await pb.collection('screen_groups').getOne(screen.groupId).catch(() => null);
                body.groupName = grp?.name || '';
              }
            }
          }
        } catch (e: any) {
          console.warn(`[CrudController] Could not enrich screen_log:`, e.message);
        }
      }

      const isAdmin = isAdminUser(req.user);
      if (!isAdmin) {
        if (ADMIN_ONLY_COLLECTIONS.has(collectionName) || CREATE_ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
          return res.status(403).json({ error: 'Admin access required.' });
        }

        // Enforce security tenancy on creation — always stamp identity fields
        // from the authenticated session, never trust them from the request body.
        if (collectionName === 'screens') {
          body.assignedToUserEmail = req.user?.email;

          // The real "Add Screen" UI flow goes through /screens/pair, which
          // already checks this — but this generic create endpoint is also
          // live and reachable directly, and had no equivalent check at all,
          // letting a caller create unlimited screens under their own
          // account regardless of their license's deviceLimit.
          const licensesResult = await pb.collection('licenses').getList(1, 100, {
            filter: pb.filter('assignedUserEmail = {:email} && status = "active"', { email: req.user?.email })
          }).catch(() => ({ items: [] as any[] }));
          const licenseItems: any[] = licensesResult.items;
          if (licenseItems.length > 0) {
            const totalAllowed = licenseItems.reduce((sum: number, lic: any) => sum + (lic.deviceLimit || 0), 0);
            const activeScreensResult = await pb.collection('screens').getList(1, 500, {
              filter: pb.filter('assignedToUserEmail = {:email} && status != "pairing"', { email: req.user?.email })
            }).catch(() => ({ items: [] as any[] }));
            const activeScreenItems: any[] = activeScreensResult.items;
            if (activeScreenItems.length >= totalAllowed) {
              return res.status(400).json({ error: `Device limit reached. Your active license(s) only support up to ${totalAllowed} screen(s).` });
            }
          }
        } else if (collectionName === 'playlists') {
          body.createdBy = req.user?.email;
        } else if (collectionName === 'screen_groups') {
          // Always overwrite from the session, even when unresolved (null) —
          // leaving a client-supplied orgId in place when the caller has no
          // license/org of their own let an unlicensed user set an arbitrary
          // orgId and have the record show up inside another tenant's
          // screen-group listing (isOwnRecord/GET-list both scope purely by
          // orgId equality). Matches the PATCH/PUT handler below, which
          // already deletes any client-supplied orgId outright.
          const orgId = await resolveUserOrgId(req.user?.email);
          body.orgId = orgId || '';
        } else if (collectionName === 'tickets') {
          body.clientEmail = req.user?.email;
        }
      }

      const record = await retryWithBackoff(() => pb.collection(collectionName).create(body));

      // Sync scheduling on creation
      if (collectionName === 'screens') {
        syncScreenSchedule(record);
      } else if (collectionName === 'playlists') {
        syncPlaylistBrandingFromUser(record).catch(err => {
          console.error('[CrudController] Error syncing playlist branding:', err.message);
        });
      } else if (collectionName === 'licenses') {
        syncVideoConferencingFromLicense(record).catch(err => {
          console.error('[CrudController] Error syncing video conferencing:', err.message);
        });
      }

      res.status(201).json(record);
    } catch (error: any) {
      console.error(`Error creating record in ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error creating record' });
    }
  });

  // Shared handler for PUT and PATCH (both perform a full or partial update)
  async function handleUpdate(req: any, res: any) {
    try {
      const isAdmin = isAdminUser(req.user);
      // Enforce security tenancy
      if (!isAdmin) {
        if (ADMIN_ONLY_COLLECTIONS.has(collectionName) || WRITE_ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));
        if (!(await isOwnRecord(collectionName, record, req.user))) {
          return res.status(403).json({ error: 'Access denied' });
        }
        // Client cannot update tenancy properties
        delete req.body.assignedToUserEmail;
        delete req.body.createdBy;
        delete req.body.orgId;
      }

      const body = { ...req.body };
      delete body.id;
      delete body.collectionId;
      delete body.collectionName;
      delete body.expand;
      delete body.createdAt;
      delete body.created;
      delete body.updated;

      // Role changes are a privilege-escalation-sensitive action — capture the
      // prior role before it's overwritten so the audit entry shows the change.
      let previousRole: string | undefined;
      if (collectionName === 'users' && typeof body.role === 'string') {
        try {
          const existing = await retryWithBackoff(() => pb.collection('users').getOne(req.params.id));
          previousRole = existing.role;
        } catch (_) { /* best-effort — don't block the update if this lookup fails */ }
      }

      const record = await retryWithBackoff(() => pb.collection(collectionName).update(req.params.id, body));

      if (collectionName === 'users' && typeof body.role === 'string' && body.role !== previousRole) {
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

      if (collectionName === 'screens') {
        syncScreenSchedule(record);
        notifyScreenConfigChanged(req.params.id);
      } else if (collectionName === 'playlists') {
        syncPlaylistBrandingFromUser(record).catch(err => {
          console.error('[CrudController] Error syncing playlist branding:', err.message);
        });
        notifyScreensAssignedToPlaylist(req.params.id).catch(err => {
          console.error('[CrudController] Error notifying screens of playlist change:', err.message);
        });
      } else if (collectionName === 'screen_groups') {
        notifyScreensInGroup(req.params.id).catch(err => {
          console.error('[CrudController] Error notifying screens of group change:', err.message);
        });
      } else if (collectionName === 'licenses') {
        syncVideoConferencingFromLicense(record).catch(err => {
          console.error('[CrudController] Error syncing video conferencing:', err.message);
        });
      }

      res.json(record);
    } catch (error: any) {
      console.error(`Error updating record in ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error updating record' });
    }
  }

  router.put('/:id', handleUpdate);
  router.patch('/:id', handleUpdate);

  // DELETE
  router.delete('/:id', async (req: any, res: any) => {
    try {
      const isAdmin = isAdminUser(req.user);
      // Enforce security tenancy
      if (!isAdmin) {
        if (ADMIN_ONLY_COLLECTIONS.has(collectionName) || WRITE_ADMIN_ONLY_COLLECTIONS.has(collectionName)) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));
        if (!(await isOwnRecord(collectionName, record, req.user))) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }

      let playlistName = '';
      if (collectionName === 'playlists') {
        try {
          const pl = await retryWithBackoff(() => pb.collection('playlists').getOne(req.params.id));
          playlistName = pl.name;
        } catch (_) { /* ignore */ }
      }

      let deletedLicense: any = null;
      if (collectionName === 'licenses') {
        deletedLicense = await retryWithBackoff(() => pb.collection('licenses').getOne(req.params.id)).catch(() => null);
      }

      await retryWithBackoff(() => pb.collection(collectionName).delete(req.params.id));

      if (deletedLicense) {
        // syncVideoConferencingFromLicense also runs on create/update — the
        // delete path had no equivalent, so cancelling a license that had
        // enableVideoConferencing=true left the user permanently able to
        // start calls even after the license granting that access was gone.
        syncVideoConferencingFromLicense({ ...deletedLicense, enableVideoConferencing: false }).catch(err => {
          console.error('[CrudController] Error syncing video conferencing after license deletion:', err.message);
        });
      }

      logAudit({
        actorId: req.user?.id,
        actorEmail: req.user?.email,
        action: `${collectionName}.deleted`,
        targetType: collectionName,
        targetId: req.params.id,
        detail: playlistName || undefined,
        ip: getClientIp(req)
      });

      // Cancel cron job if screen is deleted
      if (collectionName === 'screens') {
        removeScreenSchedule(req.params.id);
      } else if (collectionName === 'playlists' && playlistName) {
        // Clear both active assignments and scheduled swaps on screens referencing this playlist
        await syncPlaylistDeletion(playlistName, req.params.id);
      } else if (collectionName === 'screen_groups') {
        // Previously screens kept a groupId pointing at a deleted group
        // forever — group-scoped bulk pushes (notifyScreensInGroup) would
        // keep resolving them by that dangling id, and any UI resolving
        // groupId -> group name would show a blank/broken label indefinitely.
        try {
          const groupedScreens = await pb.collection('screens').getFullList({
            filter: pb.filter('groupId = {:groupId}', { groupId: req.params.id }),
            fields: 'id'
          });
          await Promise.all(groupedScreens.map((s: any) =>
            pb.collection('screens').update(s.id, { groupId: null }).catch(() => {})
          ));
        } catch (err: any) {
          console.error('Error clearing groupId on screens after screen_group deletion:', err.message);
        }
      }

      res.status(204).end();
    } catch (error: any) {
      if (error.status === 404) {
        console.log(`Record ${req.params.id} already deleted from ${collectionName} (404). Treating as success.`);
        return res.status(204).end();
      }
      console.error(`Error deleting record from ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Error deleting record' });
    }
  });

  return router;
}

// Notify every screen currently assigned this playlist (by id) that something
// changed, so they re-sync immediately instead of waiting for their next poll.
async function notifyScreensAssignedToPlaylist(playlistId: string): Promise<void> {
  const screens = await pb.collection('screens').getFullList({
    filter: pb.filter('playlistId = {:playlistId}', { playlistId }),
    fields: 'id'
  }).catch(() => []);
  notifyScreensConfigChanged(screens.map((s: any) => s.id));
}

// Same idea for a screen group — group-level changes (bulk volume, assigned
// playlist, etc.) apply to every screen in the group.
async function notifyScreensInGroup(groupId: string): Promise<void> {
  const screens = await pb.collection('screens').getFullList({
    filter: pb.filter('groupId = {:groupId}', { groupId }),
    fields: 'id'
  }).catch(() => []);
  notifyScreensConfigChanged(screens.map((s: any) => s.id));
}

// Propagate a license's enableVideoConferencing flag onto the user it is assigned to,
// so toggling the flag on the license immediately controls that user's access.
async function syncVideoConferencingFromLicense(licenseRecord: any) {
  try {
    const email = licenseRecord.assignedUserEmail;
    if (!email) return;

    const user = await pb.collection('users').getFirstListItem(
      pb.filter('email = {:email}', { email: String(email).toLowerCase().trim() })
    ).catch(() => null);
    if (!user) return;

    const shouldEnable = !!licenseRecord.enableVideoConferencing;
    if (user.enableVideoConferencing !== shouldEnable) {
      await pb.collection('users').update(user.id, { enableVideoConferencing: shouldEnable });
      console.log(`Synced enableVideoConferencing=${shouldEnable} to user ${email} from license ${licenseRecord.id}`);
    }
  } catch (err: any) {
    console.warn('[CrudController] Error syncing video conferencing from license:', err.message);
  }
}

async function syncPlaylistBrandingFromUser(playlistRecord: any) {
  try {
    const creatorEmail = playlistRecord.createdBy;
    if (!creatorEmail) return;

    // 1. Get user
    const user = await pb.collection('users').getFirstListItem(
      pb.filter('email = {:email}', { email: creatorEmail.toLowerCase().trim() })
    ).catch(() => null);
    if (!user) return;

    // 2. Determine if white label is enabled for this license/user
    let isWhiteLabel = false;
    let orgId = '';
    try {
      const licenses = await pb.collection('licenses').getList(1, 1, {
        filter: pb.filter(
          'assignedUserEmail = {:email} && status = "active" && whiteLabel = true',
          { email: creatorEmail }
        )
      });
      if (licenses.items.length > 0) {
        isWhiteLabel = true;
        orgId = licenses.items[0].assignedOrgId || '';
      }
    } catch (_) {}

    // 3. Get organization
    let org = null;
    if (orgId) {
      org = await pb.collection('organizations').getOne(orgId).catch(() => null);
    }
    if (!org && user.company) {
      org = await pb.collection('organizations').getFirstListItem(
        pb.filter('name = {:company}', { company: user.company })
      ).catch(() => null);
    }

    // Same fix as syncScreenBrandingFromOrg — an unresolvable org (deleted,
    // or a renamed/typo'd company field) previously froze whatever branding
    // was last set instead of falling back to non-white-label.
    isWhiteLabel = org ? isWhiteLabel : false;
    const logo = isWhiteLabel ? (org?.websiteLogo || '') : '';
    const name = isWhiteLabel ? (org?.websiteName || '') : '';

    if (
      playlistRecord.whiteLabel !== isWhiteLabel ||
      playlistRecord.websiteLogo !== logo ||
      playlistRecord.websiteName !== name
    ) {
      console.log(`Updating branding for playlist ${playlistRecord.id}: whiteLabel=${isWhiteLabel}, logoLength=${logo.length}, name=${name}`);
      await pb.collection('playlists').update(playlistRecord.id, {
        whiteLabel: isWhiteLabel,
        websiteLogo: logo,
        websiteName: name
      });
    }
  } catch (err: any) {
    console.error(`Error syncing playlist branding for playlist ${playlistRecord.id}:`, err.message);
  }
}
