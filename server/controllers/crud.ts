import express from 'express';
import { pb, ensurePBAuth } from '../db';
import { checkDeviceStatuses } from './screens';
import { syncScreenSchedule, removeScreenSchedule, syncPlaylistDeletion } from '../scheduler';

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
        await checkDeviceStatuses();
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
        } else if (SAFE_KEY.test(key)) {
          filters.push(`${key} = {:${key}}`);
          filterParams[key] = String(raw);
        }
        // silently drop keys with special characters
      });
      const filterStr = filters.length > 0 ? pb.filter(filters.join(' && '), filterParams) : '';

      // Use getList instead of getFullList to avoid sending skipTotal=1.
      // Sort by '-id' instead of '-created' — on this PocketBase instance,
      // sorting by created/updated returns 400. PocketBase IDs are time-ordered
      // so '-id' gives newest-first ordering.
      const fetchRecords = async () => {
        const result = await pb.collection(collectionName).getList(page, perPage, {
          filter: filterStr || undefined,
          sort: '-id'
        });
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
      const record = await pb.collection(collectionName).getOne(req.params.id);
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
      const record = await pb.collection(collectionName).create(body);

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
      const body = { ...req.body };
      delete body.id;
      delete body.collectionId;
      delete body.collectionName;
      delete body.expand;
      delete body.createdAt;
      delete body.created;
      delete body.updated;
      const record = await pb.collection(collectionName).update(req.params.id, body);

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
      let playlistName = '';
      if (collectionName === 'playlists') {
        try {
          const pl = await pb.collection('playlists').getOne(req.params.id);
          playlistName = pl.name;
        } catch (_) { /* ignore */ }
      }

      await pb.collection(collectionName).delete(req.params.id);

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
