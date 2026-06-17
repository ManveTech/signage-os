import cron from 'node-cron';
import { pb, ensurePBAuth } from './db';
import { checkDeviceStatuses } from './controllers/screens';

// In-memory map of active screen cron tasks: screenId -> ScheduledTask
const activeJobs = new Map<string, any>();

/**
 * Parses local date/time string inside a target timezone and returns a native Date object in UTC.
 */
function getScreenLocalDateTime(dateStr: string, timeStr: string, timezone: string): Date {
  const targetStr = `${dateStr}T${timeStr.slice(0, 5)}:00`;
  try {
    const date = new Date(targetStr + 'Z'); // Parse as UTC representation
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => Number(parts.find(p => p.type === type)?.value);

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    let hour = getPart('hour');
    if (hour === 24) hour = 0;
    const minute = getPart('minute');
    const second = getPart('second');

    const formattedUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const originalUtc = date.getTime();
    const offset = formattedUtc - originalUtc;

    return new Date(originalUtc - offset);
  } catch (err: any) {
    console.warn(`[Scheduler] Timezone lookup failed for "${timezone}", falling back to system timezone:`, err.message);
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hour, minute] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute, 0, 0);
  }
}

/**
 * Activates a scheduled playlist for a screen immediately, clears schedule fields, and logs it.
 */
async function activateScheduledPlaylist(screen: any) {
  console.log(`[Scheduler] Activating scheduled playlist for screen "${screen.name}" (${screen.id}) → "${screen.schedulePlaylist}"`);

  try {
    await ensurePBAuth();

    // Resolve playlistId from its name if not already set or outdated
    let playlistId = '';
    try {
      const plResult = await pb.collection('playlists').getList(1, 10, {
        filter: `name = "${screen.schedulePlaylist}"`,
      });
      if (plResult.items.length > 0) {
        playlistId = plResult.items[0].id;
      }
    } catch (_) { /* ignore and fallback */ }

    // Update screen: apply the playlist and clear schedule fields
    await pb.collection('screens').update(screen.id, {
      playlist: screen.schedulePlaylist,
      playlistId: playlistId,
      schedulePlaylist: '',
      scheduleDate: '',
      scheduleTime: '',
    });

    // Log the event to screen_logs
    try {
      await pb.collection('screen_logs').create({
        screenId: screen.id,
        screenName: screen.name,
        assignedToUserEmail: screen.assignedToUserEmail || '',
        event: 'Scheduled playlist activated',
        type: 'sync',
        detail: `Playlist "${screen.schedulePlaylist}" was automatically activated on schedule (${screen.scheduleDate} ${screen.scheduleTime}).`,
      });
    } catch (logErr: any) {
      console.warn('[Scheduler] Could not write to screen_logs:', logErr.message);
    }
  } catch (err: any) {
    console.error(`[Scheduler] Error applying schedule for screen ${screen.id}:`, err.message);
  }
}

/**
 * Synchronizes/updates the cron job for a screen based on its schedule fields.
 */
export function syncScreenSchedule(screen: any) {
  // 1. Cancel and remove any existing job for this screen
  removeScreenSchedule(screen.id);

  const { schedulePlaylist, scheduleDate, scheduleTime, timezone } = screen;
  if (!schedulePlaylist || !scheduleDate || !scheduleTime) {
    return; // No schedule configured or cleared
  }

  // 2. Parse the target date-time in the screen's local timezone
  const screenTimezone = timezone || 'Asia/Kolkata';
  const targetDate = getScreenLocalDateTime(scheduleDate, scheduleTime, screenTimezone);
  const now = new Date();

  // 3. If target time has already arrived or is in the past, run immediately
  if (targetDate.getTime() <= now.getTime()) {
    console.log(`[Scheduler] Scheduled target time (${scheduleDate} ${scheduleTime}) is in the past. Executing immediately.`);
    // Execute asynchronously in the background
    activateScheduledPlaylist(screen).catch(err => {
      console.error(`[Scheduler] Immediate execution failed for ${screen.id}:`, err.message);
    });
    return;
  }

  // 4. If target time is in the future, schedule a timezone-aware one-off cron job
  // Extract date components from the scheduled fields
  const [year, monthVal, dayVal] = scheduleDate.split('-').map(Number);
  const [hourVal, minuteVal] = scheduleTime.split(':').map(Number);

  // cron pattern: minute hour day-of-month month day-of-week
  const cronExpression = `${minuteVal} ${hourVal} ${dayVal} ${monthVal} *`;
  
  console.log(`[Scheduler] Scheduling cron job for screen "${screen.name}" (${screen.id}) at local time ${scheduleDate} ${scheduleTime} (${screenTimezone}). Cron: "${cronExpression}"`);

  try {
    const job = cron.schedule(cronExpression, async () => {
      try {
        await activateScheduledPlaylist(screen);
      } finally {
        // Stop and remove the job from the map once triggered (since it is a one-off event)
        removeScreenSchedule(screen.id);
      }
    }, {
      timezone: screenTimezone
    });

    activeJobs.set(screen.id, job);
  } catch (err: any) {
    console.error(`[Scheduler] Failed to schedule cron job for screen ${screen.id}:`, err.message);
  }
}

/**
 * Stops and removes the active cron job for a screen.
 */
export function removeScreenSchedule(screenId: string) {
  const job = activeJobs.get(screenId);
  if (job) {
    job.stop();
    activeJobs.delete(screenId);
    console.log(`[Scheduler] Cancelled and removed active cron job for screen ${screenId}`);
  }
}

/**
 * Handles playlist deletion: clears scheduled swaps on screens scheduling this playlist.
 */
export async function syncPlaylistDeletion(playlistName: string) {
  if (!playlistName) return;
  console.log(`[Scheduler] Handling deletion of playlist: "${playlistName}". Checking for scheduled switches...`);

  try {
    await ensurePBAuth();

    // Query screens scheduling this playlist
    const screensResult = await pb.collection('screens').getList(1, 500, {
      filter: `schedulePlaylist = "${playlistName}"`,
    });

    for (const screen of screensResult.items) {
      console.log(`[Scheduler] Clearing playlist schedule on screen "${screen.name}" because playlist was deleted.`);
      
      // Update screen in database
      const updatedScreen = await pb.collection('screens').update(screen.id, {
        schedulePlaylist: '',
        scheduleDate: '',
        scheduleTime: '',
      });

      // Synchronize in-memory job
      syncScreenSchedule(updatedScreen);
    }
  } catch (err: any) {
    console.error('[Scheduler] Error checking playlist deletion dependencies:', err.message);
  }
}

/**
 * Initializes/restores all cron jobs from the database on startup.
 * Also starts a background device-status poller that writes offline health
 * logs independently of any HTTP request — this is what fires the
 * "Screen went offline" log entries.
 */
export async function startScheduler() {
  console.log('[Scheduler] Initializing cron scheduler from PocketBase source of truth...');
  try {
    await ensurePBAuth();

    // Fetch all screens that have a playlist schedule set
    const screensResult = await pb.collection('screens').getList(1, 500, {
      filter: `schedulePlaylist != "" && scheduleDate != "" && scheduleTime != ""`,
    });

    const screens = screensResult.items;
    console.log(`[Scheduler] Found ${screens.length} active schedule(s) to restore.`);

    for (const screen of screens) {
      syncScreenSchedule(screen);
    }

    console.log('[Scheduler] Finished restoring cron schedule jobs successfully.');
  } catch (err: any) {
    console.error('[Scheduler] Critical error starting scheduler:', err.message);
  }

  // ── Device status poller ──────────────────────────────────────────────────
  // Run every 2 minutes regardless of HTTP traffic. This ensures "Screen went
  // offline" health logs are written even when no dashboard user is active.
  const DEVICE_CHECK_INTERVAL_MS = 2 * 60 * 1000;
  setInterval(async () => {
    try {
      await checkDeviceStatuses();
    } catch (err: any) {
      console.error('[Scheduler] Device status poll error:', err.message);
    }
  }, DEVICE_CHECK_INTERVAL_MS);
  console.log('[Scheduler] Device status poller started — checks every 2 minutes.');
}
