import express from 'express';
import { pb, ensurePBAuth } from '../db';
import { checkDeviceStatuses, getLiveScreenMetrics } from './screens';
import { syncScreenSchedule, removeScreenSchedule, syncPlaylistDeletion } from '../scheduler';

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
          filters.push(`${key} = {:${key}}`);
          filterParams[key] = String(raw);
        }
      });

      // Security: Extract and enforce user tenancy
      const userRole = req.user?.role;
      const userEmail = req.user?.email;
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';
      let targetEmail = req.headers['x-assigned-to-user-email'] || req.query.assignedToUserEmail;

      if (!isAdmin) {
        targetEmail = userEmail; // Enforce logged-in user's tenancy
      }

      if (targetEmail && targetEmail !== 'all') {
        if (collectionName === 'screens' || collectionName === 'screen_logs') {
          filters.push(`assignedToUserEmail = {:assignedToUserEmail}`);
          filterParams['assignedToUserEmail'] = String(targetEmail);
        } else if (collectionName === 'playlists') {
          filters.push(`createdBy = {:createdBy}`);
          filterParams['createdBy'] = String(targetEmail);
        }
      } else if (!isAdmin) {
        if (collectionName === 'screens' || collectionName === 'screen_logs') {
          filters.push(`assignedToUserEmail = {:assignedToUserEmail}`);
          filterParams['assignedToUserEmail'] = String(userEmail);
        } else if (collectionName === 'playlists') {
          filters.push(`createdBy = {:createdBy}`);
          filterParams['createdBy'] = String(userEmail);
        }
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
      res.json(records);
    } catch (error: any) {
      console.error(`Error fetching list from ${collectionName}:`, error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // GET ONE
  router.get('/:id', async (req: any, res: any) => {
    try {
      const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));
      
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      // Enforce security tenancy
      if (!isAdmin) {
        const ownerEmail = record.assignedToUserEmail || record.createdBy;
        if (ownerEmail && ownerEmail !== req.user?.email) {
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

      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      // Enforce security tenancy on creation
      if (!isAdmin) {
        if (collectionName === 'screens') {
          body.assignedToUserEmail = req.user?.email;
        } else if (collectionName === 'playlists' || collectionName === 'screen_groups') {
          body.createdBy = req.user?.email;
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
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      // Enforce security tenancy
      if (!isAdmin) {
        const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));
        const ownerEmail = record.assignedToUserEmail || record.createdBy;
        if (ownerEmail && ownerEmail !== req.user?.email) {
          return res.status(403).json({ error: 'Access denied' });
        }
        // Client cannot update tenancy properties
        delete req.body.assignedToUserEmail;
        delete req.body.createdBy;
      }

      const body = { ...req.body };
      delete body.id;
      delete body.collectionId;
      delete body.collectionName;
      delete body.expand;
      delete body.createdAt;
      delete body.created;
      delete body.updated;
      const record = await retryWithBackoff(() => pb.collection(collectionName).update(req.params.id, body));

      if (collectionName === 'screens') {
        syncScreenSchedule(record);
      } else if (collectionName === 'playlists') {
        syncPlaylistBrandingFromUser(record).catch(err => {
          console.error('[CrudController] Error syncing playlist branding:', err.message);
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
      const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
      // Enforce security tenancy
      if (!isAdmin) {
        const record = await retryWithBackoff(() => pb.collection(collectionName).getOne(req.params.id));
        const ownerEmail = record.assignedToUserEmail || record.createdBy;
        if (ownerEmail && ownerEmail !== req.user?.email) {
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

      await retryWithBackoff(() => pb.collection(collectionName).delete(req.params.id));

      // Cancel cron job if screen is deleted
      if (collectionName === 'screens') {
        removeScreenSchedule(req.params.id);
      } else if (collectionName === 'playlists' && playlistName) {
        // Clear schedules on screens if playlist is deleted
        await syncPlaylistDeletion(playlistName);
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

    if (!org) return;

    const logo = isWhiteLabel ? (org.websiteLogo || '') : '';
    const name = isWhiteLabel ? (org.websiteName || '') : '';

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
