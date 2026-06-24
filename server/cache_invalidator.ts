import { pb } from './db';
import { redis, isRedisReady } from './redis';

export function listenToCollectionChanges() {
  console.log('[Cache Invalidator] Initializing PocketBase SSE subscription...');

  // Subscribe to screens updates
  pb.collection('screens').subscribe('*', async (e) => {
    if (!isRedisReady()) return;
    try {
      if (e.action === 'update' || e.action === 'delete') {
        const screenId = e.record.id;
        const uuid = e.record.hardware_uuid || '';

        console.log(`[Cache Invalidator] Screen changed: ${screenId}. Evicting cache.`);

        const pipeline = redis.pipeline();
        pipeline.del(`cache:screen:${screenId}`);
        if (uuid) {
          pipeline.del(`cache:screen_uuid:${uuid}`);
        }
        await pipeline.exec();
      }
    } catch (err: any) {
      console.error('[Cache Invalidator] Error evicting screen cache:', err.message);
    }
  }).catch((err) => {
    console.error('[Cache Invalidator] Failed to subscribe to screens collection:', err.message);
  });

  // Subscribe to playlists updates
  pb.collection('playlists').subscribe('*', async (e) => {
    if (!isRedisReady()) return;
    try {
      if (e.action === 'update' || e.action === 'delete') {
        const playlistId = e.record.id;
        const playlistName = e.record.name;

        console.log(`[Cache Invalidator] Playlist changed: ${playlistId} (${playlistName}). Evicting cache.`);

        const pipeline = redis.pipeline();
        pipeline.del(`cache:playlist:${playlistId}`);
        if (playlistName) {
          pipeline.del(`cache:playlist_name:${playlistName}`);
        }
        await pipeline.exec();
      }
    } catch (err: any) {
      console.error('[Cache Invalidator] Error evicting playlist cache:', err.message);
    }
  }).catch((err) => {
    console.error('[Cache Invalidator] Failed to subscribe to playlists collection:', err.message);
  });
}
