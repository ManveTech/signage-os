import { mediaStore } from '../../lib/mediaStore';

/**
 * "Mall — Evening · today at 18:00" for a screen with a pending scheduled
 * switch, or null. Schedules store the playlist id (older ones its name).
 */
export function scheduleLabel(screen: { schedulePlaylist?: string; scheduleDate?: string; scheduleTime?: string }): string | null {
  if (!screen.schedulePlaylist || !screen.scheduleDate || !screen.scheduleTime) return null;
  const pl = mediaStore.getPlaylists().find(p => p.id === screen.schedulePlaylist || p.name === screen.schedulePlaylist);
  const name = pl?.name || 'Another playlist';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + 86_400_000));
  const day = screen.scheduleDate === today ? 'today'
    : screen.scheduleDate === tomorrow ? 'tomorrow'
    : new Date(`${screen.scheduleDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${name} · ${day} at ${screen.scheduleTime.slice(0, 5)}`;
}
