import { redis, isRedisReady } from './redis';

// Tracks which conference is currently active for each screen, independent of
// any single socket's lifecycle or of whether the call was ended through the
// Socket.IO path or the REST API. Shared between the Socket.IO handlers in
// index.ts (which populate/consult it for reconnect replay) and the REST
// video-conference controller (whose /end endpoint must also clear it —
// otherwise a call ended from the dashboard never reaches a display that
// only listens for the replayed conference:initiated on reconnect).
//
// Backed by Redis (not a plain in-memory Map) because this state has to be
// visible to whichever server process a given screen's socket happens to be
// connected to — a prerequisite for running more than one instance at all.
// Falls back to an in-memory Map if Redis is unreachable, so a single
// instance keeps working exactly as before either way.
const SCREEN_KEY_PREFIX = 'activeconf:screen:';
const CONFERENCE_INDEX_PREFIX = 'activeconf:byconference:';

const memoryFallback = new Map<string, any>();
// screenId -> conferenceId, so the in-memory fallback can also answer
// "which screens are in conference X" without a linear scan of every entry.
const memoryConferenceIndex = new Map<string, Set<string>>();

function addToMemoryIndex(conferenceId: string, screenId: string) {
  let set = memoryConferenceIndex.get(conferenceId);
  if (!set) {
    set = new Set();
    memoryConferenceIndex.set(conferenceId, set);
  }
  set.add(screenId);
}

function removeFromMemoryIndex(conferenceId: string | undefined, screenId: string) {
  if (!conferenceId) return;
  const set = memoryConferenceIndex.get(conferenceId);
  if (!set) return;
  set.delete(screenId);
  if (set.size === 0) memoryConferenceIndex.delete(conferenceId);
}

export async function setActiveConference(screenId: string, data: any): Promise<void> {
  const previous = memoryFallback.get(screenId);
  removeFromMemoryIndex(previous?.conferenceId, screenId);
  memoryFallback.set(screenId, data);
  if (data?.conferenceId) addToMemoryIndex(data.conferenceId, screenId);

  if (isRedisReady()) {
    try {
      const multi = redis.multi();
      multi.set(`${SCREEN_KEY_PREFIX}${screenId}`, JSON.stringify(data));
      if (data?.conferenceId) {
        multi.sadd(`${CONFERENCE_INDEX_PREFIX}${data.conferenceId}`, screenId);
      }
      await multi.exec();
    } catch (err: any) {
      console.error('[VideoConferenceState] Redis write failed, relying on in-memory fallback:', err.message);
    }
  }
}

export async function getActiveConference(screenId: string): Promise<any | null> {
  if (isRedisReady()) {
    try {
      const raw = await redis.get(`${SCREEN_KEY_PREFIX}${screenId}`);
      return raw ? JSON.parse(raw) : null;
    } catch (err: any) {
      console.error('[VideoConferenceState] Redis read failed, falling back to in-memory:', err.message);
    }
  }
  return memoryFallback.get(screenId) ?? null;
}

export async function clearActiveConference(screenId: string): Promise<void> {
  const previous = memoryFallback.get(screenId);
  removeFromMemoryIndex(previous?.conferenceId, screenId);
  memoryFallback.delete(screenId);

  if (isRedisReady()) {
    try {
      const raw = await redis.get(`${SCREEN_KEY_PREFIX}${screenId}`);
      const data = raw ? JSON.parse(raw) : previous;
      const multi = redis.multi();
      multi.del(`${SCREEN_KEY_PREFIX}${screenId}`);
      if (data?.conferenceId) {
        multi.srem(`${CONFERENCE_INDEX_PREFIX}${data.conferenceId}`, screenId);
      }
      await multi.exec();
    } catch (err: any) {
      console.error('[VideoConferenceState] Redis clear failed:', err.message);
    }
  }
}

/** Clears every screen currently tracked as being in the given conference, returning their ids. */
export async function clearActiveConferencesForConference(conferenceId: string): Promise<string[]> {
  const clearedScreenIds = new Set<string>();

  const memberSet = memoryConferenceIndex.get(conferenceId);
  if (memberSet) {
    for (const screenId of memberSet) {
      memoryFallback.delete(screenId);
      clearedScreenIds.add(screenId);
    }
    memoryConferenceIndex.delete(conferenceId);
  }

  if (isRedisReady()) {
    try {
      const indexKey = `${CONFERENCE_INDEX_PREFIX}${conferenceId}`;
      const screenIds = await redis.smembers(indexKey);
      if (screenIds.length > 0) {
        const multi = redis.multi();
        screenIds.forEach((id) => {
          multi.del(`${SCREEN_KEY_PREFIX}${id}`);
          clearedScreenIds.add(id);
        });
        multi.del(indexKey);
        await multi.exec();
      }
    } catch (err: any) {
      console.error('[VideoConferenceState] Redis conference clear failed:', err.message);
    }
  }

  return Array.from(clearedScreenIds);
}
