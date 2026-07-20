import { pb } from '../db';
import { syncScreenSchedule } from '../scheduler';
import { redis, isRedisReady, acquireLock, releaseLock } from '../redis';

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
      if (existing.status === 'active' || existing.status === 'online') {
        // If already active, just return the existing paired record details
        return res.status(200).json({
          screenId: existing.id,
          pairingCode: existing.pairing_code || '',
          status: existing.status,
          pocketbaseUrl: pb.baseUrl
        });
      }
      
      // Update existing record
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

const DB_WRITE_THROTTLE_MS = 30000; // 30 seconds
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
          const lockToken = await acquireLock(`offline:${screenId}`, 10000);
          if (!lockToken) return; // Skip if another instance is already processing

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
            await releaseLock(`offline:${screenId}`, lockToken);
          }
        });
      }
    } else {
      // --- FALLBACK (DIRECT POCKETBASE PATH IF REDIS OFFLINE) ---
      const thresholdTime = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const filter = `(status = "online" || status = "active") && (lastHeartbeat < "${thresholdTime}" || lastHeartbeat = null || lastHeartbeat = "")`;
      
      const screensResult = await pb.collection('screens').getList(1, 500, {
        filter: filter
      });
      
      const staleScreens = screensResult.items;
      devicesCheckedCount = staleScreens.length;

      if (devicesCheckedCount > 0) {
        console.log(`[Status Checker] Fallback found ${devicesCheckedCount} stale screens. Processing status updates...`);
        
        await runWithConcurrencyLimit(STATUS_CHECK_CONCURRENCY, staleScreens, async (screen) => {
          const release = await getScreenLock(screen.id).acquire();
          try {
            const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screen.id)).catch(() => null);
            if (!latestScreen) return;

            const lastHeartbeatTime = latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : 0;
            const now = Date.now();
            if (now - lastHeartbeatTime <= 2 * 60 * 1000 && lastHeartbeatTime > 0) {
              console.log(`[Status Checker] Screen "${latestScreen.name}" (${latestScreen.id}) received a heartbeat recently. Skipping offline status update.`);
              return;
            }

            if (latestScreen.status === 'offline') {
              return;
            }

            console.log(`[Status Checker] 🔴 OFFLINE: Screen "${latestScreen.name}" (ID: ${latestScreen.id}) missed heartbeat. Marked offline in database (Fallback detection).`);
            
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

export async function recordHeartbeat(req: any, res: any) {
  const startTime = Date.now();
  let hardwareUuid = '';
  let isThrottled = false;
  let screenId = '';
  let screenRecord: any = null;
  let transitionStatus = 'ALREADY_ONLINE';
  
  try {
    const { cpuTemp, currentPlayingAsset, storageUsedBytes, storageAvailableBytes } = req.body;
    hardwareUuid = req.body.hardwareUuid;
    if (!hardwareUuid) {
      return res.status(400).json({ message: 'hardwareUuid is required.' });
    }

    // 1. Resolve screen details via Redis Cache or PocketBase read-through
    const cacheKey = `cache:screen_uuid:${hardwareUuid}`;
    
    if (isRedisReady()) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        screenRecord = JSON.parse(cached);
      }
    }

    if (!screenRecord) {
      const screens = await pb.collection('screens').getList(1, 1, {
        filter: pb.filter('hardware_uuid = {:hardwareUuid}', { hardwareUuid })
      });
      if (screens.items.length > 0) {
        screenRecord = screens.items[0];
        if (isRedisReady()) {
          await redis.set(cacheKey, JSON.stringify(screenRecord), 'EX', 3600);
          await redis.set(`cache:screen:${screenRecord.id}`, JSON.stringify(screenRecord), 'EX', 3600);
        }
      }
    }

    if (screenRecord) {
      screenId = screenRecord.id;
      const storageUsed = storageAvailableBytes 
        ? Math.round((storageUsedBytes / (storageUsedBytes + storageAvailableBytes)) * 100) 
        : 15;
      
      const now = Date.now();

      if (isRedisReady()) {
        // --- REDIS PATH ---
        const presenceKey = `presence:screen:${screenId}`;
        const wasOffline = screenRecord.status === 'offline' || screenRecord.status === 'pairing' || !screenRecord.onlineSince;

        // Pipeline standard diagnostics update
        const pipeline = redis.pipeline();
        pipeline.set(presenceKey, 'online', 'EX', 90);
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
          // Transition online in PB
          const release = await getScreenLock(screenId).acquire();
          try {
            const latest = await pb.collection('screens').getOne(screenId);
            const updateData = {
              status: 'online',
              onlineSince: new Date().toISOString(),
              lastHeartbeat: new Date().toISOString(),
              storageUsed: storageUsed
            };

            await retryWithBackoff(() => pb.collection('screens').update(screenId, updateData));
            
            // Re-cache updated screen
            const updated = { ...latest, ...updateData };
            await redis.set(cacheKey, JSON.stringify(updated), 'EX', 3600);
            await redis.set(`cache:screen:${screenId}`, JSON.stringify(updated), 'EX', 3600);

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
          } finally {
            release();
          }
        }
      } else {
        // --- FALLBACK (DIRECT POCKETBASE PATH IF REDIS OFFLINE) ---
        const release = await getScreenLock(screenRecord.id).acquire();
        try {
          const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screenRecord.id));
          const wasOffline = latestScreen.status === 'offline' || latestScreen.status === 'pairing';
          const lastHeartbeatTime = latestScreen.lastHeartbeat ? new Date(latestScreen.lastHeartbeat).getTime() : 0;

          if (!wasOffline && latestScreen.onlineSince && (now - lastHeartbeatTime) < DB_WRITE_THROTTLE_MS && storageUsed === latestScreen.storageUsed) {
            isThrottled = true;
            transitionStatus = 'THROTTLED';
            return res.status(204).end();
          }

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
    const isSuperAdmin = req.user?.role === 'super_admin';
    if (existingScreen.assignedToUserEmail !== clientEmail && !isSuperAdmin) {
      return res.status(403).json({ message: 'Unauthorized: You do not own this screen.' });
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

    const updatedScreen = await pb.collection('screens').update(screenId, {
      playlistId: playlistId || '',
      playlist: playlistName || 'Normal',
    });

    // Sync scheduling on direct playlist assignment
    syncScreenSchedule(updatedScreen);

    const metrics = await getLiveScreenMetrics(updatedScreen);
    pb.collection('screen_logs').create(
      await buildScreenLog(updatedScreen, {
        event: 'Playlist assigned',
        type: 'sync',
        detail: `Playlist "${playlistName || 'Normal'}" (${playlistId || 'none'}) assigned to screen.`,
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

    if (!org) return;

    const updatedLogo = isWhiteLabel ? (org.websiteLogo || '') : '';
    const updatedName = isWhiteLabel ? (org.websiteName || '') : '';

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

      const release = await getScreenLock(screenId).acquire();
      try {
        const latestScreen = await retryWithBackoff(() => pb.collection('screens').getOne(screenId));
        
        if (latestScreen.status === 'online' || latestScreen.status === 'active') {
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

          retryWithBackoff(async () => pb.collection('screen_logs').create(
            await buildScreenLog(latestScreen, {
              event: 'Screen went offline',
              type: 'offline',
              detail: reason || 'App was closed by the user.',
              totalUptime: updatedCumulativeUptime,
              loopsPlayed: updatedCumulativeLoops
            })
          )).catch(err => console.error('Error logging screen offline:', err));
          
          console.log(`Screen "${latestScreen.name}" (${latestScreen.id}) marked offline immediately. Reason: ${reason || 'App closed'}`);
        }
      } finally {
        release();
      }
    }

    res.status(204).end();
  } catch (error: any) {
    console.error('Error recording screen offline:', error);
    await logServerError(screenRecord?.id || 'system', 'System', '', 'Report offline error', error.message || 'Unknown error');
    res.status(500).json({ message: error.message || 'Error recording screen offline' });
  }
}

export async function clearAllScreenLogs(req: any, res: any) {
  try {
    const userRole = req.user?.role;
    const authUserEmail = req.user?.email;
    
    // Read from header first to avoid sending email on URL query, fallback to query for compatibility
    let targetEmail = req.headers['x-assigned-to-user-email'] || req.query.assignedToUserEmail;
    
    // Enforce security
    if (userRole !== 'admin') {
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
      screenRecord = await pb.collection('screens').getOne(screenId).catch(() => null);
      if (!screenRecord) {
        return res.status(404).json({ message: 'Screen not found.' });
      }

      const user = req.user;
      if (user) {
        const isSuperAdmin = user.role === 'super_admin' || user.role === 'admin';
        if (screenRecord.assignedToUserEmail !== user.email && !isSuperAdmin) {
          return res.status(403).json({ message: 'Unauthorized: You do not own this screen.' });
        }
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

    const updatedScreen = await pb.collection('screens').update(screenRecord.id, {
      status: 'pairing',
      pairing_code: pairingCode,
      pairing_code_expires: pairingCodeExpires,
      assignedToUserEmail: '',
      license_id: '',
      groupId: null,
      playlist: '',
      playlistId: '',
      onlineSince: ''
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

    res.status(200).json({
      message: 'Screen disconnected successfully.',
      id: updatedScreen.id,
      status: updatedScreen.status,
      pairingCode: updatedScreen.pairing_code
    });
  } catch (error: any) {
    console.error('Error disconnecting screen:', error);
    res.status(500).json({ message: error.message || 'Error disconnecting screen' });
  }
}

export async function clearScreenCommand(req: any, res: any) {
  try {
    const { screenId, command } = req.body;
    if (!screenId || !command) {
      return res.status(400).json({ error: 'screenId and command are required' });
    }

    const validCommands = ['clear_cache', 'force_sync', 'restart_playlist'];
    if (!validCommands.includes(command)) {
      return res.status(400).json({ error: `Invalid command: ${command}` });
    }

    const authenticated = await ensurePBAuth();
    if (!authenticated) {
      return res.status(503).json({ error: 'PocketBase connection authentication failed' });
    }

    const updateData: any = {};
    updateData[command] = false;

    const updatedRecord = await pb.collection('screens').update(screenId, updateData);

    if (isRedisReady()) {
      await redis.pipeline()
        .del(`cache:screen:${screenId}`)
        .del(`cache:screen_uuid:${updatedRecord.hardware_uuid || ''}`)
        .exec();
    }

    return res.status(200).json({ success: true, message: `Command ${command} cleared successfully.` });
  } catch (err: any) {
    console.error(`Error clearing screen command ${req.body?.command}:`, err);
    return res.status(500).json({ error: err.message || 'Internal server error clearing command' });
  }
}
