import { redis, isRedisReady } from '../redis';

/**
 * Push-based alternative to short-interval polling: whenever a screen's own
 * record, its playlist, or its group changes, tell the TV immediately over
 * the socket connection it already holds instead of making it wait for its
 * next poll. This is what lets the TV app's poll interval be stretched out
 * to a safety-net cadence instead of a tight loop.
 *
 * Also invalidates the screen's cached record (the same `cache:screen:<id>`
 * key the heartbeat handler populates with a long TTL) — otherwise a TV that
 * reacts to this push by immediately re-fetching its status could just get
 * back the stale cached record, making the push pointless.
 */
export function notifyScreenConfigChanged(screenId: string): void {
  if (!screenId) return;

  if (isRedisReady()) {
    redis.del(`cache:screen:${screenId}`).catch(() => {});
  }

  const io = (global as any).io;
  if (!io) return;
  io.to(`screen-${screenId}`).emit('screen:config-changed');
}

export function notifyScreensConfigChanged(screenIds: string[]): void {
  for (const id of screenIds) {
    notifyScreenConfigChanged(id);
  }
}
