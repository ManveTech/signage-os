import { pb, ensurePBAuth } from '../db';
import { syncScreenSchedule } from '../scheduler';
import { redis, isRedisReady, acquireLock, releaseLock } from '../redis';
import { notifyScreenConfigChanged } from '../services/screenPush';

async function logServerError(screenId: string, screenName: string, email: string, event: string, detail: string) {
  try {
    await pb.collection('screen_logs').create({
      screenId: screenId || 'system',
      screenName: screenName || 'System',
      assignedToUserEmail: email || '',
      event: event,
      type: 'error',
      detail: detail
    });
  } catch (err: any) {
    console.error('Failed to log server error to database:', err.message);
  }
}

// Cache group names in-process for 5 minutes to avoid repeated PB lookups
const groupNameCache = new Map<string, { name: string; expires: number }>();

async function resolveGroupInfo(groupId: string | null | undefined): Promise<{ groupId: string; groupName: string }> {
  if (!groupId) return { groupId: '', groupName: '' };
  const now = Date.now();
  const cached = groupNameCache.get(groupId);
  if (cached && cached.expires > now) return { groupId, groupName: cached.name };
  try {
    const group = await pb.collection('screen_groups').getOne(groupId).catch(() => null);
    const name = group?.name || '';
    groupNameCache.set(groupId, { name, expires: now + 5 * 60 * 1000 });
    return { groupId, groupName: name };
  } catch {
    return { groupId, groupName: '' };
  }
}

// Build an enriched screen_log payload with group context + metrics
async function buildScreenLog(screen: any, extra: Record<string, any>): Promise<Record<string, any>> {
  const { groupId, groupName } = await resolveGroupInfo(screen.groupId);
  return {
    screenId: screen.id,
    screenName: screen.name,
    assignedToUserEmail: screen.assignedToUserEmail || '',
    groupId,
    groupName,
    ...extra,
  };
}



export async function getLiveScreenMetrics(screen: any) {
  let totalUptime = screen.cumulativeUptime || 0;
  let loopsPlayed = screen.cumulativeLoops || 0;
  const isOnline = screen.status === 'online' || screen.status === 'active';
  if (isOnline && screen.onlineSince) {
    const sessionSeconds = Math.floor((Date.now() - new Date(screen.onlineSince).getTime()) / 1000);
    if (sessionSeconds > 0) {
      totalUptime += sessionSeconds;
      
      let playlistLength = 10; // default/fallback
      try {
        let playlist = null;
        if (screen.playlistId) {
          playlist = await pb.collection('playlists').getOne(screen.playlistId).catch(() => null);
        }
        if (playlist && playlist.slides && playlist.slides.length > 0) {
          playlistLength = playlist.slides.reduce((acc: number, slide: any) => acc + (slide.duration || 10), 0);
        }
      } catch (_) {}
      if (playlistLength > 0) {
        loopsPlayed += Math.floor(sessionSeconds / playlistLength);
      }
    }
  }
  return { totalUptime, loopsPlayed };
}

async function getScreenPlaylistLength(latestScreen: any): Promise<number> {
  try {
    let playlist = null;
    if (latestScreen.playlistId) {
      playlist = await pb.collection('playlists').getOne(latestScreen.playlistId).catch(() => null);
    }
    if (!playlist && latestScreen.playlist) {
      playlist = await pb.collection('playlists').getFirstListItem(pb.filter('name = {:playlist}', { playlist: latestScreen.playlist })).catch(() => null);
    }
    if (playlist && playlist.slides && playlist.slides.length > 0) {
      const length = playlist.slides.reduce((acc: number, slide: any) => acc + (slide.duration || 10), 0);
      if (length > 0) return length;
    }
  } catch (err: any) {
    console.error(`Error calculating playlist length for screen ${latestScreen.id}:`, err.message);
  }
  return 10; // Fallback to 10 seconds per slide / default loop length if no playlist or slides found
}


export async function getPairingCode(req: any, res: any) {
  try {
    const { hardwareUuid } = req.body;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    // Generate a random 6-character alphanumeric pairing code (uppercase)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars like I, O, 1, 0
    let pairingCode = '';
    for (let i = 0; i < 6; i++) {
      pairingCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Set expiration to 10 minutes in the future
    const pairingCodeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Check if screen record already exists in PocketBase
    const screens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
    });

    let screenRecord;
    if (screens.items.length > 0) {
      const existing = screens.items[0];
      // Gate on whether the screen is CLAIMED (assignedToUserEmail set), not
      // on its live status — a claimed screen that's simply offline (powered
      // off overnight, a network blip) previously still fell through to the
      // "issue a new code" branch below, handing anyone who knew its
      // hardwareUuid a valid pairing code for another tenant's screen with
      // no auth at all. The real app never needs a new code for a screen it
      // already has a screenId for — it recovers from offline purely via
      // heartbeat (which matches hardware_uuid, not a pairing code) — so
      // there's no legitimate case this blocks.
      if (existing.assignedToUserEmail) {
        return res.status(200).json({
          screenId: existing.id,
          pairingCode: existing.pairing_code || '',
          status: existing.status,
          pocketbaseUrl: pb.baseUrl
        });
      }

      const { forceRefresh } = req.body;
      const isExpired = existing.pairing_code_expires ? new Date(existing.pairing_code_expires) <= new Date() : false;
      if (existing.pairing_code && !isExpired && !forceRefresh) {
        return res.status(200).json({
          screenId: existing.id,
          pairingCode: existing.pairing_code,
          status: existing.status || 'pairing',
          pocketbaseUrl: pb.baseUrl
        });
      }
      
      // Update existing record with a new code
      screenRecord = await pb.collection('screens').update(existing.id, {
        pairing_code: pairingCode,
        pairing_code_expires: pairingCodeExpires,
        status: 'pairing'
      });
    } else {
      // Create new screen record
      screenRecord = await pb.collection('screens').create({
        name: 'New TV Player',
        status: 'pairing',
        pairing_code: pairingCode,
        pairing_code_expires: pairingCodeExpires,
        hardware_uuid: hardwareUuid,
        playlist: '',
        playlistId: '',
        license_id: ''
      });
    }

    res.status(200).json({
      screenId: screenRecord.id,
      pairingCode: pairingCode,
      status: 'pairing',
      pocketbaseUrl: pb.baseUrl
    });
  } catch (error: any) {
    console.error('Error generating pairing code:', error);
    await logServerError('system', 'System', '', 'Pairing code generation error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error generating pairing code' });
  }
}

export async function pairScreen(req: any, res: any) {
  try {
    const { pairingCode, name, location, groupId, assignedToUserEmail, playlist } = req.body;
    if (!pairingCode || !name) {
      return res.status(400).json({ message: 'Pairing code and name are required.' });
    }

    const clientEmail = req.user?.email || assignedToUserEmail || 'priya@demo.com';
    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';

    let license = null;

    if (!isAdmin) {
      // 1. Verify user's license and slot limits
      const licensesResult = await pb.collection('licenses').getList(1, 100, {
        filter: pb.filter('assignedUserEmail = {:clientEmail} && status = "active"', { clientEmail })
      });

      if (licensesResult.items.length === 0) {
        return res.status(400).json({ message: 'No active license found for this user.' });
      }

      // Count currently active/paired screens for this user (status != 'pairing')
      const activeScreens = await pb.collection('screens').getList(1, 500, {
        filter: pb.filter('assignedToUserEmail = {:clientEmail} && status != "pairing"', { clientEmail })
      });

      const totalAllowed = licensesResult.items.reduce((sum, lic) => sum + (lic.deviceLimit || 0), 0);
      if (activeScreens.items.length >= totalAllowed) {
        return res.status(400).json({
          message: `Device limit reached. Your active license(s) only support up to ${totalAllowed} screen(s).`
        });
      }

      // Dynamically select a license that has available slots
      for (const lic of licensesResult.items) {
        const assignedCount = activeScreens.items.filter(s => s.license_id === lic.id).length;
        if (assignedCount < lic.deviceLimit) {
          license = lic;
          break;
        }
      }

      // Fallback to the first active license if mapping check is bypassed
      if (!license) {
        license = licensesResult.items[0];
      }
    } else {
      // Mock an unlimited system license for admin users
      license = {
        id: 'system_admin_bypass',
        whiteLabel: true
      };
    }

    // 2. Locate screen record by pairing code
    const pairingScreens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('pairing_code = {:pairingCode}', { pairingCode: pairingCode.trim().toUpperCase() })
    });

    if (pairingScreens.items.length === 0) {
      return res.status(400).json({ message: 'Invalid pairing code.' });
    }

    const screenRecord = pairingScreens.items[0];

    // Check expiration
    if (screenRecord.pairing_code_expires) {
      const expires = new Date(screenRecord.pairing_code_expires);
      if (expires.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Pairing code has expired.' });
      }
    }

    // 3. Update screen record to active and link to license/assignments
    const updatedScreen = await pb.collection('screens').update(screenRecord.id, {
      name,
      location: location || 'Not Specified',
      status: 'online',
      pairing_code: '', // clear code
      pairing_code_expires: '', // clear expiration
      license_id: license.id,
      licenseType: license.whiteLabel ? 'Pro' : 'Lite',
      assignedToUserEmail: clientEmail,
      groupId: groupId || null,
      playlist: playlist || '', // playlist ID
      playlistId: playlist || '',
      onlineSince: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString()
    });

    // Sync branding details
    await syncScreenBrandingFromOrg(updatedScreen);

    // The TV is actively polling its pairing loop waiting for this — push
    // instead of leaving it to catch up on its next scheduled poll.
    notifyScreenConfigChanged(updatedScreen.id);

    // Log pairing to screen_logs
    pb.collection('screen_logs').create(
      await buildScreenLog(updatedScreen, {
        event: 'Screen paired',
        type: 'online',
        detail: `Device paired successfully. License: ${updatedScreen.license_id || 'None'}, Playlist: ${updatedScreen.playlist || 'None'}, Group: ${updatedScreen.groupId || 'None'}`,
        totalUptime: updatedScreen.cumulativeUptime || 0,
        loopsPlayed: updatedScreen.cumulativeLoops || 0
      })
    ).catch(err => console.error('Error logging pairing:', err));

    res.status(200).json({
      id: updatedScreen.id,
      name: updatedScreen.name,
      status: updatedScreen.status,
      playlist: updatedScreen.playlist,
      assignedToUserEmail: updatedScreen.assignedToUserEmail,
      hardwareUuid: updatedScreen.hardware_uuid,
      licenseId: updatedScreen.license_id,
      assignedPlaylistId: updatedScreen.playlistId
    });
  } catch (error: any) {
    console.error('Error pairing screen:', error);
    await logServerError('system', req.body?.name || 'System', req.body?.assignedToUserEmail || '', 'Pairing screen error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error pairing screen' });
  }
}

class AsyncMutex {
  private promise: Promise<void> = Promise.resolve();

  async acquire(): Promise<() => void> {
    let resolve: () => void;
    const nextPromise = new Promise<void>((r) => {
      resolve = r;
    });
    const currentPromise = this.promise;
    this.promise = nextPromise;
    await currentPromise;
    return resolve!;
  }
}

const screenLocks = new Map<string, AsyncMutex>();

function getScreenLock(screenId: string): AsyncMutex {
  let lock = screenLocks.get(screenId);
  if (!lock) {
    lock = new AsyncMutex();
    screenLocks.set(screenId, lock);
  }
  return lock;
}

// Serializes read-modify-write access to a single screen's cumulative
// uptime/status fields. checkDeviceStatuses's Redis path previously was the
// only caller using a real distributed lock (acquireLock, backed by Redis
// SET NX) — recordHeartbeat, reportOffline, and disconnectScreen all only
// ever used the local in-process AsyncMutex below, which does nothing to
// stop a *different* server instance in a scaled/multi-process deployment
// from reading the same cumulativeUptime concurrently and writing back
// independently (a lost update — whichever write lands second wins,
// silently discarding the other transition's uptime/loop delta). Now every
// one of these call sites locks the same resource name, so they actually
// exclude each other instead of just their own function. Retries briefly on
// contention rather than failing outright, to match the "wait until free"
// behavior every caller already expected from the local mutex; if Redis
// itself is unreachable, falls back to the local mutex, since there's only
// one process to coordinate with in that case anyway.
async function withScreenLock<T>(screenId: string, fn: () => Promise<T>): Promise<T> {
  if (isRedisReady()) {
    const resource = `screen-update:${screenId}`;
    let token: string | null = null;
    const deadline = Date.now() + 5000;
    while (!token && Date.now() < deadline) {
      token = await acquireLock(resource, 10000);
      if (!token) await new Promise(r => setTimeout(r, 100));
    }
    if (token) {
      try {
        return await fn();
      } finally {
        await releaseLock(resource, token);
      }
    }
    console.warn(`[ScreenLock] Could not acquire distributed lock for screen ${screenId} within 5s — falling back to local mutex.`);
  }
  const release = await getScreenLock(screenId).acquire();
  try {
    return await fn();
  } finally {
    release();
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 100
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return retryWithBackoff(fn, retries - 1, delayMs * 2);
  }
}

async function runWithConcurrencyLimit<T>(
  limit: number,
  items: T[],
  fn: (item: T) => Promise<void>
): Promise<void> {
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = fn(item).then(() => {
      executing.splice(executing.indexOf(p), 1);
    });
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

// At small fleet sizes 15s made little practical difference since the app's
// old 20s heartbeat interval already exceeded it on every call. At fleet
// scale this is the actual lever that caps PocketBase write load independent
// of whatever interval the TV app heartbeats at — presence/diagnostics still
// update in Redis every heartbeat regardless, only the DB write is throttled.
const DB_WRITE_THROTTLE_MS = 90000; // 90 seconds
const STATUS_CHECK_CONCURRENCY = 10;

export async function checkDeviceStatuses(options?: { silentIfNoChanges?: boolean }) {
  const startTime = Date.now();
  let devicesCheckedCount = 0;
  let markedOfflineCount = 0;

  try {
    if (isRedisReady()) {
      // --- REDIS PATH ---
      const now = Date.now();
      const threshold = now - 90 * 1000; // 90 seconds timeout threshold
      const zsetKey = 'presence:active_screens';
      
      const staleScreenIds = await redis.zrangebyscore(zsetKey, 0, threshold);
      devicesCheckedCount = staleScreenIds.length;

      if (devicesCheckedCount > 0) {
        console.log(`[Status Checker] Redis found ${devicesCheckedCount} stale screens. Transitioning to offline...`);

        await runWithConcurrencyLimit(STATUS_CHECK_CONCURRENCY, staleScreenIds, async (screenId) => {
          // Shared resource name with withScreenLock() below — this bulk
          // sweep and a concurrent recordHeartbeat/reportOffline call on
          // this same screen (possibly on a different instance) must
          // exclude each other, not just other sweep workers.
          const lockToken = await acquireLock(`screen-update:${screenId}`, 10000);
          if (!lockToken) return; // Skip if another instance is already processing this screen

          try {
            // Double check presence hasn't updated while we got the lock
            const isOnline = await redis.exists(`presence:screen:${screenId}`);
            if (isOnline) {
              await redis.zadd(zsetKey, Date.now(), screenId); // Reset/push forward score
              return;
            }

            const latestScreen = await pb.collection('screens').getOne(screenId).catch(() => null);
            if (!latestScreen) return;

            const details = await redis.hgetall(`heartbeat:screen:${screenId}`);
            const lastHeartbeatTime = details.lastHeartbeat ? parseInt(details.lastHeartbeat) : (latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : 0);

            // Calculate additional session metrics
            let additionalUptime = 0;
            let additionalLoops = 0;
            if (latestScreen.onlineSince && lastHeartbeatTime > 0) {
              const onlineTime = new Date(latestScreen.onlineSince).getTime();
              const sessionEnd = lastHeartbeatTime;
              if (onlineTime > 0 && sessionEnd > onlineTime) {
                additionalUptime = Math.floor((sessionEnd - onlineTime) / 1000);
                const playlistLength = await getScreenPlaylistLength(latestScreen);
                additionalLoops = Math.floor(additionalUptime / playlistLength);
              }
            }

            const updatedCumulativeUptime = (latestScreen.cumulativeUptime || 0) + additionalUptime;
            const updatedCumulativeLoops = (latestScreen.cumulativeLoops || 0) + additionalLoops;

            // Remove from Redis presence structures
            await redis.pipeline()
              .zrem(zsetKey, screenId)
              .del(`heartbeat:screen:${screenId}`)
              .del(`presence:screen:${screenId}`)
              .exec();

            // Sync offline state to PocketBase
            await retryWithBackoff(() => pb.collection('screens').update(latestScreen.id, {
              status: 'offline',
              cumulativeUptime: updatedCumulativeUptime,
              cumulativeLoops: updatedCumulativeLoops,
              onlineSince: ""
            }));

            // Clear cache keys
            await redis.pipeline()
              .del(`cache:screen:${screenId}`)
              .del(`cache:screen_uuid:${latestScreen.hardware_uuid || ''}`)
              .exec();

            markedOfflineCount++;
            console.log(`[Status Checker] 🔴 OFFLINE: Screen "${latestScreen.name}" (ID: ${latestScreen.id}) missed heartbeat. Marked offline in database (Redis detection).`);

            retryWithBackoff(async () => pb.collection('screen_logs').create(
              await buildScreenLog(latestScreen, {
                event: 'Screen went offline',
                type: 'offline',
                detail: `No heartbeat received. (Redis detection).`,
                totalUptime: updatedCumulativeUptime,
                loopsPlayed: updatedCumulativeLoops
              })
            )).catch(err => console.error('Error logging screen offline:', err));

          } catch (err: any) {
            console.error(`[Status Checker] Error processing screen ${screenId}:`, err.message);
          } finally {
            await releaseLock(`screen-update:${screenId}`, lockToken);
          }
        });
      }
    } else {
      // --- FALLBACK (DIRECT POCKETBASE PATH IF REDIS OFFLINE) ---
      const now = Date.now();
      const thresholdMs = now - 90 * 1000; // 90 seconds timeout

      const screensResult = await pb.collection('screens').getList(1, 500, {
        filter: 'status = "online" || status = "active"'
      });
      
      const staleScreens = screensResult.items.filter(s => {
        if (!s.lastHeartbeat) {
          const recentGrace = s.onlineSince || s.updated || s.created;
          if (recentGrace && (now - new Date(recentGrace).getTime()) < 180 * 1000) {
            return false;
          }
          return true;
        }
        const hbTime = new Date(s.lastHeartbeat).getTime();
        return isNaN(hbTime) || hbTime < thresholdMs;
      });

      devicesCheckedCount = staleScreens.length;

      if (devicesCheckedCount > 0) {
        console.log(`[Status Checker] Found ${devicesCheckedCount} stale online screens. Transitioning to offline...`);
        
        await runWithConcurrencyLimit(STATUS_CHECK_CONCURRENCY, staleScreens, async (screen) => {
          const release = await getScreenLock(screen.id).acquire();
          try {
            const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screen.id)).catch(() => null);
            if (!latestScreen) return;

            const lastHeartbeatTime = latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : 0;
            if (now - lastHeartbeatTime <= 90 * 1000 && lastHeartbeatTime > 0) {
              console.log(`[Status Checker] Screen "${latestScreen.name}" (${latestScreen.id}) received a heartbeat recently. Skipping offline status update.`);
              return;
            }

            if (latestScreen.status === 'offline') {
              return;
            }

            console.log(`[Status Checker] 🔴 OFFLINE: Screen "${latestScreen.name}" (ID: ${latestScreen.id}) missed heartbeat. Marked offline in database.`);
            
            let additionalUptime = 0;
            let additionalLoops = 0;
            if (latestScreen.onlineSince && latestScreen.lastHeartbeat) {
              const onlineTime = new Date(latestScreen.onlineSince).getTime();
              const sessionEnd = new Date(latestScreen.lastHeartbeat).getTime();
              if (onlineTime > 0 && sessionEnd > onlineTime) {
                additionalUptime = Math.floor((sessionEnd - onlineTime) / 1000);
                const playlistLength = await getScreenPlaylistLength(latestScreen);
                additionalLoops = Math.floor(additionalUptime / playlistLength);
              }
            }
            const updatedCumulativeUptime = (latestScreen.cumulativeUptime || 0) + additionalUptime;
            const updatedCumulativeLoops = (latestScreen.cumulativeLoops || 0) + additionalLoops;

            await retryWithBackoff(() => pb.collection('screens').update(latestScreen.id, {
              status: 'offline',
              cumulativeUptime: updatedCumulativeUptime,
              cumulativeLoops: updatedCumulativeLoops,
              onlineSince: ""
            }));

            markedOfflineCount++;

            retryWithBackoff(async () => pb.collection('screen_logs').create(
              await buildScreenLog(latestScreen, {
                event: 'Screen went offline',
                type: 'offline',
                detail: `No heartbeat received since ${latestScreen.lastHeartbeat || 'pairing'}.`,
                totalUptime: updatedCumulativeUptime,
                loopsPlayed: updatedCumulativeLoops
              })
            )).catch(err => console.error('Error logging screen offline:', err));

          } catch (err: any) {
            console.error(`[Status Checker] Error processing screen ${screen.id}:`, err.message);
          } finally {
            release();
          }
        });
      }
    }
  } catch (err) {
    console.error('Error in checkDeviceStatuses:', err);
  } finally {
    const duration = Date.now() - startTime;
    if (!options?.silentIfNoChanges || devicesCheckedCount > 0 || markedOfflineCount > 0) {
      console.log(`[Status Checker] Checked ${devicesCheckedCount} stale screens. Marked ${markedOfflineCount} offline. Duration: ${duration}ms`);
    }
  }
}

export async function touchScreenPresence(screenId: string) {
  try {
    const now = Date.now();
    if (isRedisReady()) {
      const presenceKey = `presence:screen:${screenId}`;
      const pipeline = redis.pipeline();
      pipeline.set(presenceKey, 'online', 'EX', 180);
      pipeline.zadd('presence:active_screens', now, screenId);
      await pipeline.exec();
    }

    // Sync PocketBase status if currently offline or missing onlineSince
    const lastTouchKey = `touch:${screenId}`;
    const lastTouch = lastBrandingSync.get(lastTouchKey) || 0;
    if (now - lastTouch > 10000) { // Throttled to once every 10 seconds per screen
      lastBrandingSync.set(lastTouchKey, now);
      pb.collection('screens').getOne(screenId).then(screen => {
        if (screen && (screen.status === 'offline' || screen.status === 'pairing' || !screen.onlineSince)) {
          const updateObj: any = {
            status: 'online',
            lastHeartbeat: new Date().toISOString()
          };
          if (!screen.onlineSince) updateObj.onlineSince = new Date().toISOString();
          pb.collection('screens').update(screenId, updateObj).catch(() => {});
        }
      }).catch(() => {});
    }
  } catch (e) {
    // Ignore presence touch errors
  }
}

/**
 * Device-facing alternative to the TV app hitting PocketBase's own REST API
 * directly for its status-sync poll. Deliberately NOT cached: an earlier
 * cached version of this endpoint raced with pairing — a request reading the
 * pre-pairing "pairing" record could still be in flight when pairing
 * completed, and would write that stale snapshot into the cache *after*
 * pairing's own cache invalidation, re-poisoning it. Combined with the
 * config-changed push triggering an immediate re-sync, this made a screen
 * see stale "still pairing" data right after actually pairing and unpair
 * itself. Always reading through to PocketBase avoids that whole class of
 * bug. Revisit caching here only with proper invalidation ordering
 * (e.g. a version/updated-at check) if this ever becomes a real bottleneck.
 */
export async function getScreenStatusForDevice(req: any, res: any) {
  try {
    const screenId = req.body?.screenId || req.query?.screenId;
    const hardwareUuid = req.body?.hardwareUuid || req.query?.hardwareUuid;
    if (!screenId) {
      return res.status(400).json({ message: 'screenId is required.' });
    }

    // Only a genuine PocketBase 404 means the screen was deleted. Anything
    // else (PocketBase restarting, admin token expired, network blip) used
    // to be reported as 404 too — and the TV treats 404 as "I was removed",
    // unpairing itself and wiping its cache, so one backend hiccup could
    // blank the whole fleet. `unpaired: true` is the explicit signal the TV
    // now requires before it unpairs; a bare 404/503 from a proxy never has it.
    let screenRecord: any;
    try {
      screenRecord = await pb.collection('screens').getOne(screenId);
    } catch (err: any) {
      if (err?.status === 404) {
        return res.status(404).json({ message: 'Screen not found.', unpaired: true });
      }
      console.error(`[DeviceSync] Could not load screen ${screenId}:`, err?.message);
      return res.status(503).json({ message: 'Screen status temporarily unavailable.' });
    }

    // This endpoint is unauthenticated — without this check, any caller who
    // knows/guesses a screenId could read another tenant's full screen record
    // (assignedToUserEmail, pairing_code, license_id). Devices on an updated
    // app build send their own hardwareUuid alongside screenId, so mismatches
    // are rejected. Older builds that don't send it yet are let through
    // unverified during rollout — drop that fallback once the fleet updates.
    if (hardwareUuid && screenRecord.hardware_uuid && screenRecord.hardware_uuid !== hardwareUuid) {
      // This screen slot now belongs to a different physical device.
      return res.status(403).json({ message: 'hardwareUuid does not match this screen.', unpaired: true });
    }

    // The owner unlinked this TV (Unlink TV) — the slot is kept for re-pairing,
    // but no device owns it until then.
    if (screenRecord.status === 'unlinked') {
      return res.status(403).json({ message: 'This TV was unlinked from the screen.', unpaired: true });
    }

    return res.status(200).json(screenRecord);
  } catch (error: any) {
    console.error('Error fetching screen status for device:', error);
    res.status(500).json({ message: error.message || 'Error fetching screen status' });
  }
}

export async function recordHeartbeat(req: any, res: any) {
  const startTime = Date.now();
  let hardwareUuid = '';
  let isThrottled = false;
  let screenId = '';
  let screenRecord: any = null;
  let transitionStatus = 'ALREADY_ONLINE';
  
  try {
    const { screenId: reqScreenId, cpuTemp, currentPlayingAsset, storageUsedBytes, storageAvailableBytes } = req.body;
    hardwareUuid = req.body.hardwareUuid || '';
    const targetId = reqScreenId || hardwareUuid;
    if (!targetId) {
      return res.status(400).json({ message: 'hardwareUuid or screenId is required.' });
    }

    // 1. Resolve screen details via Redis Cache or PocketBase read-through
    const cacheKey = `cache:screen_uuid:${targetId}`;
    
    if (isRedisReady()) {
      const cached = await redis.get(cacheKey) || await redis.get(`cache:screen:${targetId}`);
      if (cached) {
        screenRecord = JSON.parse(cached);
      }
    }

    if (!screenRecord) {
      if (reqScreenId) {
        screenRecord = await pb.collection('screens').getOne(reqScreenId).catch(() => null);
      }
      if (!screenRecord && hardwareUuid) {
        const screens = await pb.collection('screens').getList(1, 1, {
          filter: pb.filter('hardware_uuid = {:hardwareUuid} || id = {:hardwareUuid}', { hardwareUuid })
        });
        if (screens.items.length > 0) {
          screenRecord = screens.items[0];
        }
      }
      if (screenRecord && isRedisReady()) {
        await redis.set(cacheKey, JSON.stringify(screenRecord), 'EX', 3600);
        await redis.set(`cache:screen:${screenRecord.id}`, JSON.stringify(screenRecord), 'EX', 3600);
      }
    }

    if (screenRecord) {
      // The device always sends its own hardwareUuid on this endpoint (it's
      // a required field on the app's HeartbeatRequest, never optional), and
      // this endpoint is unauthenticated — so unlike the sync endpoint below,
      // there's no legacy-client compatibility reason to let a request
      // through when hardwareUuid is missing. An attacker doesn't have to
      // behave like the real app, so requiring it unconditionally (rather
      // than only checking it when present) closes the gap where simply
      // omitting the field let a caller who knows/guesses another tenant's
      // screenId spoof that screen online and overwrite its live
      // status/storage/asset fields. hardware_uuid is only absent on a
      // screen that hasn't finished pairing yet, so this can't lock out a
      // legitimately paired device.
      if (screenRecord.hardware_uuid && screenRecord.hardware_uuid !== hardwareUuid) {
        screenId = screenRecord.id;
        transitionStatus = 'UNKNOWN_DEVICE';
        console.warn(`[Heartbeat] Rejected: hardwareUuid mismatch for screen ${screenRecord.id} (request hardwareUuid=${hardwareUuid}, record hardware_uuid=${screenRecord.hardware_uuid}).`);
        return res.status(403).json({ message: 'hardwareUuid does not match this screen.' });
      }

      if (screenRecord.status === 'unlinked') {
        screenId = screenRecord.id;
        transitionStatus = 'UNKNOWN_DEVICE';
        return res.status(403).json({ message: 'This TV was unlinked from the screen.', unpaired: true });
      }

      screenId = screenRecord.id;
      const storageUsed = storageAvailableBytes
        ? Math.round((storageUsedBytes / (storageUsedBytes + storageAvailableBytes)) * 100) 
        : 15;
      
      const now = Date.now();

      if (isRedisReady()) {
        // --- REDIS PATH ---
        const presenceKey = `presence:screen:${screenId}`;
        const wasOffline = screenRecord.status === 'offline' || screenRecord.status === 'pairing';

        // Pipeline standard diagnostics update
        const pipeline = redis.pipeline();
        pipeline.set(presenceKey, 'online', 'EX', 180);
        pipeline.zadd('presence:active_screens', now, screenId);
        pipeline.hmset(`heartbeat:screen:${screenId}`, {
          lastHeartbeat: now.toString(),
          cpuTemp: String(cpuTemp || 0),
          currentPlayingAsset: currentPlayingAsset || 'None',
          storageUsed: String(storageUsed || 15)
        });
        pipeline.expire(`heartbeat:screen:${screenId}`, 86400);
        await pipeline.exec();

        // Check if white label branding needs sync
        const lastSyncTime = lastBrandingSync.get(screenId) || 0;
        if (now - lastSyncTime > 5 * 60 * 1000) {
          lastBrandingSync.set(screenId, now);
          syncScreenBrandingFromOrg(screenRecord).catch(err => {
            console.error('[Heartbeat Branding] Error syncing screen branding:', err);
          });
        }

        if (wasOffline) {
          transitionStatus = 'CAME_ONLINE';
        }

        const lastHbTime = screenRecord.lastHeartbeat ? new Date(screenRecord.lastHeartbeat).getTime() : 0;
        if (wasOffline || (now - lastHbTime) > DB_WRITE_THROTTLE_MS) {
          // Update DB with throttled write. Uses the distributed lock (when
          // Redis is available) rather than the local mutex, since this path
          // only runs when Redis IS ready — a different server instance's
          // checkDeviceStatuses sweep or reportOffline call for this exact
          // screen must be excluded too, not just concurrent requests on
          // this one process.
          await withScreenLock(screenId, async () => {
            const latest = await pb.collection('screens').getOne(screenId).catch(() => screenRecord);
            const updateData: any = {
              status: 'online',
              lastHeartbeat: new Date().toISOString(),
              storageUsed: storageUsed
            };
            if (wasOffline || !latest.onlineSince) {
              updateData.onlineSince = new Date().toISOString();
            }

            await retryWithBackoff(() => pb.collection('screens').update(screenId, updateData));

            // Re-cache updated screen
            const updated = { ...latest, ...updateData };
            await redis.set(cacheKey, JSON.stringify(updated), 'EX', 3600);
            await redis.set(`cache:screen:${screenId}`, JSON.stringify(updated), 'EX', 3600);

            if (wasOffline) {
              const metrics = await getLiveScreenMetrics(latest);
              retryWithBackoff(async () => pb.collection('screen_logs').create(
                await buildScreenLog(screenRecord, {
                  event: 'Screen came online',
                  type: 'online',
                  detail: `Heartbeat received (reconnected). CPU Temp: ${cpuTemp || 'N/A'}°C`,
                  totalUptime: metrics.totalUptime,
                  loopsPlayed: metrics.loopsPlayed
                })
              )).catch(err => console.error('Error logging screen online:', err));
            }
          });
        }
      } else {
        // --- FALLBACK (DIRECT POCKETBASE PATH IF REDIS OFFLINE) ---
        const release = await getScreenLock(screenRecord.id).acquire();
        try {
          const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screenRecord.id));
          const wasOffline = latestScreen.status === 'offline' || latestScreen.status === 'pairing';
          const lastHeartbeatTime = latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : 0;

          const updateData: any = {
            lastHeartbeat: new Date().toISOString(),
            status: 'online',
            storageUsed: storageUsed
          };

          const lastSyncTime = lastBrandingSync.get(latestScreen.id) || 0;
          if (now - lastSyncTime > 5 * 60 * 1000) {
            lastBrandingSync.set(latestScreen.id, now);
            syncScreenBrandingFromOrg(latestScreen).catch(err => {
              console.error('[Heartbeat Branding] Error syncing screen branding:', err);
            });
          }

          if (wasOffline || !latestScreen.onlineSince) {
            transitionStatus = 'CAME_ONLINE';
            updateData.onlineSince = new Date().toISOString();

            const metrics = await getLiveScreenMetrics(latestScreen);
            retryWithBackoff(async () => pb.collection('screen_logs').create(
              await buildScreenLog(latestScreen, {
                event: 'Screen came online',
                type: 'online',
                detail: `Heartbeat received. CPU Temp: ${cpuTemp || 'N/A'}°C, Current Asset: ${currentPlayingAsset || 'None'}`,
                totalUptime: metrics.totalUptime,
                loopsPlayed: metrics.loopsPlayed
              })
            )).catch(err => console.error('Error logging screen online:', err));
          }

          await retryWithBackoff(() => pb.collection('screens').update(latestScreen.id, updateData));
        } finally {
          release();
        }
      }
    } else {
      transitionStatus = 'UNKNOWN_DEVICE';
      console.log(`Heartbeat received for unknown hardwareUuid: ${hardwareUuid}`);
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording heartbeat:', error);
    await logServerError(screenId || 'system', 'System', '', 'Heartbeat recording error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error recording heartbeat' });
  } finally {
    const duration = Date.now() - startTime;
    let logMsg = '';
    if (transitionStatus === 'CAME_ONLINE') {
      logMsg = `[Heartbeat] 🟢 ONLINE (TRANSITION): Screen "${screenRecord?.name || 'unknown'}" (ID: ${screenId || 'unknown'}, hardwareUuid: ${hardwareUuid}) reconnected.`;
    } else if (transitionStatus === 'ALREADY_ONLINE') {
      logMsg = `[Heartbeat] 🟢 ONLINE (ACTIVE): Screen "${screenRecord?.name || 'unknown'}" (ID: ${screenId || 'unknown'}, hardwareUuid: ${hardwareUuid}) sent heartbeat.`;
    } else if (transitionStatus === 'THROTTLED') {
      logMsg = `[Heartbeat] 🟢 ONLINE (THROTTLED): Screen "${screenRecord?.name || 'unknown'}" (ID: ${screenId || 'unknown'}, hardwareUuid: ${hardwareUuid}) sent heartbeat (DB write throttled).`;
    } else if (transitionStatus === 'UNKNOWN_DEVICE') {
      logMsg = `[Heartbeat] ⚠️ UNKNOWN: Heartbeat received for unregistered hardwareUuid: ${hardwareUuid}.`;
    } else {
      logMsg = `[Heartbeat] Processed heartbeat for screen "${screenRecord?.name || 'unknown'}" (ID: ${screenId || 'unknown'}, hardwareUuid: ${hardwareUuid}). Status: ${transitionStatus}.`;
    }
    console.log(`${logMsg} Duration: ${duration}ms`);
  }
}

export async function reconnectScreen(req: any, res: any) {
  try {
    const { screenId, pairingCode } = req.body;
    if (!screenId || !pairingCode) {
      return res.status(400).json({ message: 'Screen ID and pairing code are required.' });
    }

    // 1. Find the new screen record by pairing code
    const pairingScreens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('pairing_code = {:pairingCode}', { pairingCode: pairingCode.trim().toUpperCase() })
    });

    if (pairingScreens.items.length === 0) {
      return res.status(400).json({ message: 'Invalid pairing code.' });
    }

    const pairingScreen = pairingScreens.items[0];

    // Check expiration of the pairing code
    if (pairingScreen.pairing_code_expires) {
      const expires = new Date(pairingScreen.pairing_code_expires);
      if (expires.getTime() < Date.now()) {
        return res.status(400).json({ message: 'Pairing code has expired.' });
      }
    }

    // 2. Find the existing screen record by screenId
    const existingScreen = await pb.collection('screens').getOne(screenId);

    // Verify ownership or super admin permissions
    const clientEmail = req.user?.email;
    const isAdmin = req.user?.role === 'super_admin' || req.user?.role === 'admin';
    if (existingScreen.assignedToUserEmail !== clientEmail && !isAdmin) {
      return res.status(403).json({ message: 'Unauthorized: You do not own this screen.' });
    }

    // The code must belong to a TV that's waiting to be added, not to a
    // screen someone already owns.
    if (pairingScreen.id !== existingScreen.id && pairingScreen.assignedToUserEmail) {
      return res.status(400).json({ message: 'That code belongs to a screen that is already in use.' });
    }

    // Enforce exclusivity: check if another device is already connected to this screen slot
    if (existingScreen.hardware_uuid && existingScreen.hardware_uuid !== pairingScreen.hardware_uuid) {
      return res.status(400).json({ message: 'This screen is already connected to another device.' });
    }

    // 3. Update the existing screen with the hardware_uuid and new device details
    const updatedScreen = await pb.collection('screens').update(existingScreen.id, {
      hardware_uuid: pairingScreen.hardware_uuid,
      status: 'online',
      pairing_code: '',
      pairing_code_expires: '',
      onlineSince: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString()
    });

    // 4. Delete the temporary pairingScreen record to keep database clean (only if it is a different record)
    if (pairingScreen.id !== existingScreen.id) {
      await pb.collection('screens').delete(pairingScreen.id);
    }

    if (isRedisReady()) {
      await redis.pipeline()
        .del(`cache:screen:${existingScreen.id}`)
        .del(`cache:screen_uuid:${existingScreen.id}`)
        .del(`cache:screen_uuid:${pairingScreen.hardware_uuid || ''}`)
        .del(`cache:screen:${pairingScreen.id}`)
        .exec();
    }
    // The TV is still connected under its temporary pairing record's room —
    // nudge it to re-sync now: it learns that record is gone, asks for its
    // pairing info by hardware id, and is handed this screen.
    notifyScreenConfigChanged(pairingScreen.id);
    notifyScreenConfigChanged(existingScreen.id);
    syncScreenBrandingFromOrg(updatedScreen).catch(() => {});

    // 5. Log the reconnect event to screen_logs
    pb.collection('screen_logs').create(
      await buildScreenLog(updatedScreen, {
        event: 'Screen reconnected',
        type: 'online',
        detail: `Device reconnected. Hardware UUID updated to ${updatedScreen.hardware_uuid}.`,
        totalUptime: updatedScreen.cumulativeUptime || 0,
        loopsPlayed: updatedScreen.cumulativeLoops || 0
      })
    ).catch(err => console.error('Error logging reconnect:', err));

    res.status(200).json(updatedScreen);
  } catch (error: any) {
    console.error('Error reconnecting screen:', error);
    await logServerError(req.body?.screenId || 'system', 'System', '', 'Reconnecting screen error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error reconnecting screen' });
  }
}

export async function assignPlaylistToScreen(req: any, res: any) {
  try {
    const { screenId } = req.params;
    const { playlistId, playlistName } = req.body;
    if (!screenId) {
      return res.status(400).json({ message: 'screenId is required.' });
    }

    const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
    if (!isAdmin) {
      const screen = await pb.collection('screens').getOne(screenId).catch(() => null);
      if (!screen || screen.assignedToUserEmail !== req.user?.email) {
        return res.status(403).json({ message: 'Access denied.' });
      }
    }

    const isNone = !playlistId || playlistId === 'None' || !playlistName || playlistName === 'None';

    const updatedScreen = await pb.collection('screens').update(screenId, {
      playlistId: isNone ? '' : playlistId,
      playlist: isNone ? '' : playlistName,
      restart_playlist: true
    });

    // Sync scheduling on direct playlist assignment
    syncScreenSchedule(updatedScreen);
    notifyScreenConfigChanged(screenId);

    const metrics = await getLiveScreenMetrics(updatedScreen);
    pb.collection('screen_logs').create(
      await buildScreenLog(updatedScreen, {
        event: 'Playlist assigned',
        type: 'sync',
        detail: isNone ? 'Playlist unassigned from screen.' : `Playlist "${playlistName}" (${playlistId}) assigned to screen.`,
        totalUptime: metrics.totalUptime,
        loopsPlayed: metrics.loopsPlayed
      })
    ).catch((err: any) => console.error('Error logging playlist assignment:', err));

    res.status(200).json(updatedScreen);
  } catch (error: any) {
    console.error('Error assigning playlist to screen:', error);
    await logServerError(req.params?.screenId || 'system', 'System', '', 'Assign playlist error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error assigning playlist' });
  }
}

const lastBrandingSync = new Map<string, number>();

export async function syncScreenBrandingFromOrg(screenRecord: any) {
  try {
    const clientEmail = screenRecord.assignedToUserEmail;
    if (!clientEmail) return;

    // 1. Get user
    const user = await pb.collection('users').getFirstListItem(
      pb.filter('email = {:email}', { email: clientEmail.toLowerCase().trim() })
    ).catch(() => null);
    if (!user) return;

    // 2. Determine if white label is enabled for this license/screen
    let isWhiteLabel = false;
    let orgId = '';
    if (screenRecord.license_id) {
      try {
        const license = await pb.collection('licenses').getOne(screenRecord.license_id);
        isWhiteLabel = !!license.whiteLabel;
        orgId = license.assignedOrgId || '';
      } catch (_) {}
    } else {
      try {
        const licenses = await pb.collection('licenses').getList(1, 1, {
          filter: pb.filter(
            'assignedUserEmail = {:email} && status = "active" && whiteLabel = true',
            { email: clientEmail }
          )
        });
        if (licenses.items.length > 0) {
          isWhiteLabel = true;
          orgId = licenses.items[0].assignedOrgId || '';
        }
      } catch (_) {}
    }

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

    // Previously returned here, leaving the screen stuck with whatever
    // branding it last had forever once its org became unresolvable
    // (deleted, or the user's `company` no longer matches any org's name) —
    // there was no path back to non-white-label even though the org backing
    // that branding no longer exists. Treat an unresolvable org the same as
    // "not white-label" instead.
    isWhiteLabel = org ? isWhiteLabel : false;
    const updatedLogo = isWhiteLabel ? (org?.websiteLogo || '') : '';
    const updatedName = isWhiteLabel ? (org?.websiteName || '') : '';

    if (
      screenRecord.whiteLabel !== isWhiteLabel ||
      screenRecord.websiteLogo !== updatedLogo ||
      screenRecord.websiteName !== updatedName
    ) {
      console.log(`Updating branding for screen ${screenRecord.id}: whiteLabel=${isWhiteLabel}, logoLength=${updatedLogo.length}, name=${updatedName}`);
      await pb.collection('screens').update(screenRecord.id, {
        whiteLabel: isWhiteLabel,
        websiteLogo: updatedLogo,
        websiteName: updatedName
      });
    }
  } catch (err: any) {
    console.error(`Error syncing screen branding for screen ${screenRecord.id}:`, err.message);
  }
}

export async function reportOffline(req: any, res: any) {
  let screenRecord: any = null;
  try {
    const { hardwareUuid, reason } = req.body;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    const screens = await pb.collection('screens').getList(1, 1, {
      filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
    });

    if (screens.items.length > 0) {
      screenRecord = screens.items[0];
      const screenId = screenRecord.id;
      
      // Clean presence and caches in Redis immediately
      if (isRedisReady()) {
        await redis.pipeline()
          .del(`presence:screen:${screenId}`)
          .zrem('presence:active_screens', screenId)
          .del(`heartbeat:screen:${screenId}`)
          .del(`cache:screen:${screenId}`)
          .del(`cache:screen_uuid:${hardwareUuid}`)
          .exec();
      }

      await markScreenOffline(screenId, reason || 'App was closed by the user.');
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording screen offline:', error);
    await logServerError(screenRecord?.id || 'system', 'System', '', 'Report offline error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error recording screen offline' });
  }
}

/**
 * Moves a screen to offline right now: folds the current online session into
 * cumulativeUptime/cumulativeLoops, clears Redis presence, writes the
 * "went offline" log. Shared by the device's own offline report and the
 * dashboard's live status check. No-op if it isn't currently online.
 */
export async function markScreenOffline(screenId: string, detail: string): Promise<boolean> {
  let changed = false;
  if (isRedisReady()) {
    const current = await pb.collection('screens').getOne(screenId).catch(() => null);
    await redis.pipeline()
      .del(`presence:screen:${screenId}`)
      .zrem('presence:active_screens', screenId)
      .del(`heartbeat:screen:${screenId}`)
      .del(`cache:screen:${screenId}`)
      .del(`cache:screen_uuid:${screenId}`)
      .del(`cache:screen_uuid:${current?.hardware_uuid || ''}`)
      .exec();
  }
  await withScreenLock(screenId, async () => {
    const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screenId));
    if (latestScreen.status !== 'online' && latestScreen.status !== 'active') return;

    let additionalUptime = 0;
    let additionalLoops = 0;
    const sessionEnd = latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : Date.now();
    if (latestScreen.onlineSince) {
      const onlineTime = new Date(latestScreen.onlineSince).getTime();
      if (onlineTime > 0 && sessionEnd > onlineTime) {
        additionalUptime = Math.floor((sessionEnd - onlineTime) / 1000);
        const playlistLength = await getScreenPlaylistLength(latestScreen);
        additionalLoops = Math.floor(additionalUptime / playlistLength);
      }
    }
    const updatedCumulativeUptime = (latestScreen.cumulativeUptime || 0) + additionalUptime;
    const updatedCumulativeLoops = (latestScreen.cumulativeLoops || 0) + additionalLoops;

    await retryWithBackoff(() => pb.collection('screens').update(latestScreen.id, {
      status: 'offline',
      cumulativeUptime: updatedCumulativeUptime,
      cumulativeLoops: updatedCumulativeLoops,
      onlineSince: ""
    }));
    changed = true;

    retryWithBackoff(async () => pb.collection('screen_logs').create(
      await buildScreenLog(latestScreen, {
        event: 'Screen went offline',
        type: 'offline',
        detail,
        totalUptime: updatedCumulativeUptime,
        loopsPlayed: updatedCumulativeLoops
      })
    )).catch(err => console.error('Error logging screen offline:', err));

    console.log(`Screen "${latestScreen.name}" (${latestScreen.id}) marked offline. Reason: ${detail}`);
  });
  return changed;
}

/** Marks a screen online right now (it just proved it's alive), mirroring a heartbeat's transition. */
async function markScreenOnline(screenId: string, detail: string): Promise<void> {
  const now = Date.now();
  if (isRedisReady()) {
    await redis.pipeline()
      .set(`presence:screen:${screenId}`, 'online', 'EX', 180)
      .zadd('presence:active_screens', now, screenId)
      .del(`cache:screen:${screenId}`)
      .del(`cache:screen_uuid:${screenId}`)
      .exec();
  }
  await withScreenLock(screenId, async () => {
    const latest = await retryWithBackoff(() => pb.collection('screens').getOne(screenId));
    const wasOffline = latest.status !== 'online' && latest.status !== 'active';
    const update: Record<string, any> = { lastHeartbeat: new Date(now).toISOString() };
    if (wasOffline) update.status = 'online';
    if (wasOffline || !latest.onlineSince) update.onlineSince = new Date(now).toISOString();
    await retryWithBackoff(() => pb.collection('screens').update(screenId, update));
    if (wasOffline) {
      const metrics = await getLiveScreenMetrics({ ...latest, ...update });
      pb.collection('screen_logs').create(
        await buildScreenLog(latest, {
          event: 'Screen came online',
          type: 'online',
          detail,
          totalUptime: metrics.totalUptime,
          loopsPlayed: metrics.loopsPlayed
        })
      ).catch(err => console.error('Error logging screen online:', err));
    }
  });
}

async function loadOwnedScreen(req: any, res: any): Promise<any | null> {
  const screenId = req.params.screenId;
  const screen = await pb.collection('screens').getOne(screenId).catch(() => null);
  if (!screen) {
    res.status(404).json({ message: 'Screen not found.' });
    return null;
  }
  const isAdmin = req.user?.role === 'admin' || req.user?.role === 'super_admin';
  if (!isAdmin && screen.assignedToUserEmail !== req.user?.email) {
    res.status(403).json({ message: 'Access denied.' });
    return null;
  }
  return screen;
}

/**
 * Dashboard "Check status": asks the TV over its live socket to answer
 * within a few seconds, and updates the stored status to match — useful when
 * the dashboard shows offline but the TV looks fine (or vice versa) and a
 * reload doesn't settle it.
 */
export async function pingScreen(req: any, res: any) {
  try {
    const screen = await loadOwnedScreen(req, res);
    if (!screen) return;

    if (screen.status === 'unlinked' || !screen.hardware_uuid) {
      return res.status(200).json({ online: false, unlinked: true, message: 'No TV is linked to this screen.' });
    }

    const io = (global as any).io;
    const started = Date.now();
    let reply: any = null;
    // Only wait for an answer if the TV actually has a live connection —
    // otherwise there's nobody to answer and the check can finish at once.
    const connected = io ? (await io.in(`screen-${screen.id}`).fetchSockets().catch(() => [])).length > 0 : false;
    if (io && connected) {
      try {
        const replies: any[] = await io.timeout(5000).to(`screen-${screen.id}`).emitWithAck('screen:ping', { at: started });
        reply = replies.find(r => r && r.ok) || null;
      } catch {
        reply = null; // no answer within the timeout
      }
    }

    if (reply) {
      await markScreenOnline(screen.id, 'Responded to a status check from the dashboard.');
      return res.status(200).json({
        online: true,
        latencyMs: Date.now() - started,
        device: reply,
        checkedAt: new Date().toISOString()
      });
    }

    // No live answer. A TV on an older app build never answers pings but may
    // still be heartbeating — don't mark that one offline.
    const lastHb = screen.lastHeartbeat ? new Date(screen.lastHeartbeat).getTime() : 0;
    const presence = isRedisReady() ? await redis.exists(`presence:screen:${screen.id}`) : 0;
    if (presence || (lastHb && Date.now() - lastHb < 90 * 1000)) {
      return res.status(200).json({
        online: true,
        viaHeartbeat: true,
        message: 'The TV is sending heartbeats but its app version does not answer live checks. Update the TV app for live checks.',
        checkedAt: new Date().toISOString()
      });
    }

    await markScreenOffline(screen.id, 'Did not respond to a status check from the dashboard.');
    return res.status(200).json({
      online: false,
      lastSeen: screen.lastHeartbeat || null,
      checkedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error pinging screen:', error);
    res.status(500).json({ message: error.message || 'Error checking screen status' });
  }
}

/**
 * Detaches the physical TV from a screen but keeps the screen (name,
 * location, group, playlist, schedule) in the owner's account as "unlinked",
 * ready for a TV to be paired to it again via /screens/reconnect. The TV
 * itself drops back to its pairing-code screen.
 */
export async function unlinkScreen(req: any, res: any) {
  try {
    const screen = await loadOwnedScreen(req, res);
    if (!screen) return;
    if (screen.status === 'unlinked' && !screen.hardware_uuid) {
      return res.status(200).json(screen);
    }

    // Close out the online session's uptime first, like any offline transition.
    await markScreenOffline(screen.id, 'TV unlinked from the dashboard.');

    const oldUuid = screen.hardware_uuid || '';
    const updated = await withScreenLock(screen.id, async () =>
      pb.collection('screens').update(screen.id, {
        status: 'unlinked',
        hardware_uuid: '',
        pairing_code: '',
        pairing_code_expires: '',
        onlineSince: '',
        paused: false
      })
    );

    if (isRedisReady()) {
      await redis.pipeline()
        .del(`presence:screen:${screen.id}`)
        .zrem('presence:active_screens', screen.id)
        .del(`heartbeat:screen:${screen.id}`)
        .del(`cache:screen:${screen.id}`)
        .del(`cache:screen_uuid:${screen.id}`)
        .del(`cache:screen_uuid:${oldUuid}`)
        .exec();
    }

    // The TV re-syncs immediately, is told it no longer owns this screen, and
    // shows a fresh pairing code.
    notifyScreenConfigChanged(screen.id);

    pb.collection('screen_logs').create(
      await buildScreenLog(screen, {
        event: 'TV unlinked',
        type: 'offline',
        detail: 'The TV was unlinked from the dashboard. The screen is kept and can be paired to a TV again.',
        totalUptime: updated.cumulativeUptime || 0,
        loopsPlayed: updated.cumulativeLoops || 0
      })
    ).catch(err => console.error('Error logging unlink:', err));

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error unlinking screen:', error);
    res.status(500).json({ message: error.message || 'Error unlinking screen' });
  }
}

export async function clearAllScreenLogs(req: any, res: any) {
  try {
    const userRole = req.user?.role;
    const authUserEmail = req.user?.email;
    
    // Read from header first to avoid sending email on URL query, fallback to query for compatibility
    let targetEmail = req.headers['x-assigned-to-user-email'] || req.query.assignedToUserEmail;
    
    // Enforce security
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      targetEmail = authUserEmail;
    }

    let filter = '';
    if (targetEmail && targetEmail !== 'all') {
      filter = pb.filter('assignedToUserEmail = {:email}', { email: targetEmail });
    }

    const logs = await pb.collection('screen_logs').getFullList({
      filter: filter || undefined,
      fields: 'id'
    });

    console.log(`[Logs Clear] Deleting ${logs.length} logs for filter: "${filter || 'all'}"`);

    // Delete in concurrency batches
    const concurrency = 20;
    for (let i = 0; i < logs.length; i += concurrency) {
      const batch = logs.slice(i, i + concurrency);
      await Promise.all(
        batch.map(log =>
          retryWithBackoff(() => pb.collection('screen_logs').delete(log.id))
            .catch(err => console.error(`Failed to delete log ${log.id}:`, err.message))
        )
      );
    }

    res.status(200).json({ success: true, message: `Successfully cleared ${logs.length} logs.` });
  } catch (error: any) {
    console.error('Error clearing screen logs:', error);
    res.status(500).json({ error: error.message || 'Error clearing logs' });
  }
}

export async function disconnectScreen(req: any, res: any) {
  try {
    const { screenId, hardwareUuid } = req.body;
    if (!screenId && !hardwareUuid) {
      return res.status(400).json({ message: 'screenId or hardwareUuid is required.' });
    }

    let screenRecord = null;

    if (screenId) {
      // The TV app only ever calls this endpoint with hardwareUuid (see
      // SignageRepository.disconnectDevice) — the screenId path exists for
      // the authenticated dashboard "unpair" action, so it's the one place
      // here that can and must require a real owner/admin. Without this, a
      // caller with no credentials at all could unpair any tenant's screen
      // by screenId — this path is not on the /devices unauthenticated
      // bypass list, but /screens/disconnect itself is, so `req.user` can
      // still be undefined here and must not be treated as "allowed".
      const user = req.user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required.' });
      }
      screenRecord = await pb.collection('screens').getOne(screenId).catch(() => null);
      if (!screenRecord) {
        return res.status(404).json({ message: 'Screen not found.' });
      }
      const isSuperAdmin = user.role === 'super_admin' || user.role === 'admin';
      if (screenRecord.assignedToUserEmail !== user.email && !isSuperAdmin) {
        return res.status(403).json({ message: 'Unauthorized: You do not own this screen.' });
      }
    } else if (hardwareUuid) {
      const list = await pb.collection('screens').getList(1, 1, {
        filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
      });
      if (list.items.length === 0) {
        return res.status(404).json({ message: 'Screen device not found.' });
      }
      screenRecord = list.items[0];
    }

    if (!screenRecord) {
      return res.status(404).json({ message: 'Screen record not found.' });
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pairingCode = '';
    for (let i = 0; i < 6; i++) {
      pairingCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pairingCodeExpires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Every other offline transition (reportOffline, checkDeviceStatuses)
    // folds the current online session into cumulativeUptime/cumulativeLoops
    // before clearing onlineSince — this one was clearing onlineSince
    // without ever doing that, permanently losing whatever time the screen
    // had been online for at the moment it was disconnected/unpaired. Locked
    // (distributed, when Redis is available) and re-fetched fresh here since
    // a concurrent heartbeat/offline-sweep could otherwise race this exact
    // read-modify-write on another instance.
    const updatedScreen = await withScreenLock(screenRecord.id, async () => {
      const latest = await pb.collection('screens').getOne(screenRecord.id).catch(() => screenRecord);

      const updateData: Record<string, any> = {
        status: 'pairing',
        pairing_code: pairingCode,
        pairing_code_expires: pairingCodeExpires,
        assignedToUserEmail: '',
        license_id: '',
        groupId: null,
        playlist: '',
        playlistId: '',
        onlineSince: ''
      };

      if ((latest.status === 'online' || latest.status === 'active') && latest.onlineSince) {
        const sessionEnd = latest.lastHeartbeat ? new Date(latest.lastHeartbeat).getTime() : Date.now();
        const onlineTime = new Date(latest.onlineSince).getTime();
        if (onlineTime > 0 && sessionEnd > onlineTime) {
          const additionalUptime = Math.floor((sessionEnd - onlineTime) / 1000);
          const playlistLength = await getScreenPlaylistLength(latest);
          const additionalLoops = Math.floor(additionalUptime / playlistLength);
          updateData.cumulativeUptime = (latest.cumulativeUptime || 0) + additionalUptime;
          updateData.cumulativeLoops = (latest.cumulativeLoops || 0) + additionalLoops;
        }
      }

      return pb.collection('screens').update(screenRecord.id, updateData);
    });

    if (isRedisReady()) {
      await redis.pipeline()
        .zrem('presence:active_screens', screenRecord.id)
        .del(`heartbeat:screen:${screenRecord.id}`)
        .del(`presence:screen:${screenRecord.id}`)
        .del(`cache:screen:${screenRecord.id}`)
        .del(`cache:screen_uuid:${screenRecord.hardware_uuid || ''}`)
        .exec();
    }

    // Use screenRecord (pre-disconnect) for group info, since groupId is cleared on disconnect
    pb.collection('screen_logs').create(
      await buildScreenLog(screenRecord, {
        event: 'Screen disconnected',
        type: 'offline',
        detail: `Device disconnected/unpaired. Status reset to pairing.`,
        totalUptime: updatedScreen.cumulativeUptime || 0,
        loopsPlayed: updatedScreen.cumulativeLoops || 0
      })
    ).catch(err => console.error('Error logging unpairing:', err));

    // The pairing code is deliberately not returned here — neither caller
    // (the TV app's disconnectDevice, nor the dashboard's unpair action)
    // reads it from this response, and handing it back is exactly what let
    // an unauthenticated caller who only knew a hardwareUuid immediately
    // re-pair the screen as their own in a second request. A real device
    // fetches its own code separately via getPairingCode when it needs one.
    res.status(200).json({
      message: 'Screen disconnected successfully.',
      id: updatedScreen.id,
      status: updatedScreen.status
    });
  } catch (error: any) {
    console.error('Error disconnecting screen:', error);
    res.status(500).json({ message: error.message || 'Error disconnecting screen' });
  }
}

