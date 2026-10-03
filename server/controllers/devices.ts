import { pb, ensurePBAuth } from '../db';
import { redis, isRedisReady } from '../redis';

const COMMAND_FLAGS = new Set(['clear_cache', 'force_sync', 'restart_playlist']);

/**
 * Loads the screen a device is talking about and proves the caller is that
 * device (its hardware id matches). These endpoints are unauthenticated —
 * devices have no login — so this check is the whole access control.
 */
async function loadDeviceScreen(req: any, res: any): Promise<any | null> {
  const screenId = typeof req.body?.screenId === 'string' ? req.body.screenId : '';
  const hardwareUuid = typeof req.body?.hardwareUuid === 'string' ? req.body.hardwareUuid : '';
  if (!screenId || !hardwareUuid) {
    res.status(400).json({ message: 'screenId and hardwareUuid are required.' });
    return null;
  }
  await ensurePBAuth();
  const screen = await pb.collection('screens').getOne(screenId).catch(() => null);
  if (!screen) {
    res.status(404).json({ message: 'Screen not found.', unpaired: true });
    return null;
  }
  if (!screen.hardware_uuid || screen.hardware_uuid !== hardwareUuid || screen.status === 'unlinked') {
    res.status(403).json({ message: 'This device does not own this screen.', unpaired: true });
    return null;
  }
  return screen;
}

/**
 * POST /devices/ack — the TV reports what it has handled:
 *   clear:   one-shot command flags it has acted on (clear_cache, force_sync, restart_playlist)
 *   volume:  a volume change made on the TV itself
 *   schedule: it switched to its scheduled playlist (clears the schedule)
 *
 * The TV used to PATCH these straight into PocketBase, which needed the
 * screens collection to accept anonymous writes.
 */
export async function acknowledgeDevice(req: any, res: any) {
  try {
    const screen = await loadDeviceScreen(req, res);
    if (!screen) return;

    const update: Record<string, any> = {};
    const clear: unknown = req.body.clear;
    if (Array.isArray(clear)) {
      for (const flag of clear) {
        if (typeof flag === 'string' && COMMAND_FLAGS.has(flag)) update[flag] = false;
      }
    }
    const volume = Number(req.body.volume);
    if (req.body.volume !== undefined && Number.isFinite(volume)) {
      update.volume = Math.max(0, Math.min(100, Math.round(volume)));
    }
    const schedule = req.body.schedule;
    if (schedule && typeof schedule === 'object' && screen.schedulePlaylist) {
      const playlistId = typeof schedule.playlistId === 'string' ? schedule.playlistId : '';
      if (playlistId) {
        const playlist = await pb.collection('playlists').getOne(playlistId).catch(() => null);
        if (!playlist) return res.status(400).json({ message: 'Unknown playlist.' });
      }
      update.playlist = playlistId;
      update.playlistId = playlistId;
      update.schedulePlaylist = '';
      update.scheduleDate = '';
      update.scheduleTime = '';
    }

    if (Object.keys(update).length === 0) return res.status(204).end();

    await pb.collection('screens').update(screen.id, update);
    if (isRedisReady()) {
      await redis.pipeline()
        .del(`cache:screen:${screen.id}`)
        .del(`cache:screen_uuid:${screen.id}`)
        .del(`cache:screen_uuid:${screen.hardware_uuid}`)
        .exec();
    }
    return res.status(204).end();
  } catch (err: any) {
    console.error('[Devices] ack failed:', err);
    return res.status(500).json({ message: err.message || 'Could not record the acknowledgement.' });
  }
}

/**
 * POST /devices/log — the TV's error reports (download failures, playback
 * errors). They used to post to /screen_logs, which requires a dashboard
 * login, so every report from a TV was rejected and never reached the
 * owner's logs.
 */
export async function logFromDevice(req: any, res: any) {
  try {
    const screen = await loadDeviceScreen(req, res);
    if (!screen) return;
    const event = String(req.body.event || 'Device error').slice(0, 200);
    const detail = String(req.body.detail || '').slice(0, 2000);
    const type = ['error', 'sync', 'other'].includes(req.body.type) ? req.body.type : 'error';
    await pb.collection('screen_logs').create({
      screenId: screen.id,
      screenName: screen.name,
      assignedToUserEmail: screen.assignedToUserEmail || '',
      groupId: screen.groupId || '',
      event,
      type,
      detail,
    });
    return res.status(204).end();
  } catch (err: any) {
    console.error('[Devices] log failed:', err);
    return res.status(500).json({ message: err.message || 'Could not record the log.' });
  }
}
