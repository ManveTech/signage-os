import { AlertTriangle } from 'lucide-react';
import type { Playlist } from '../../lib/mediaStore';

/** Playlists that play any of these files. */
export function playlistsUsing(playlists: Playlist[], mediaIds: Iterable<string>): Playlist[] {
  const ids = new Set(mediaIds);
  return playlists.filter(p =>
    (p.slides || []).some(s => ids.has(s.mediaId) || (!!s.secondMediaId && ids.has(s.secondMediaId))) ||
    (p.mediaIds || []).some(id => ids.has(id)));
}

/**
 * The warning on "Delete file": which playlists lose a slide. Deleting a file
 * takes it out of every playlist that plays it, and the screens showing those
 * playlists stop showing it — easy to miss in a one-line note.
 */
export default function PlaylistUsage({ playlists, files = 1 }: { playlists: Playlist[]; files?: number }) {
  if (playlists.length === 0) return null;
  const shown = playlists.slice(0, 6);
  const more = playlists.length - shown.length;
  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-amber-900">
      <p className="flex items-start gap-1.5 text-sm font-semibold">
        <AlertTriangle size={15} className="mt-0.5 shrink-0" />
        {files === 1 ? 'This file is' : 'These files are'} used in {playlists.length} playlist{playlists.length === 1 ? '' : 's'}
      </p>
      <p className="text-xs mt-1 text-amber-800">Deleting removes {files === 1 ? 'it' : 'them'} from {playlists.length === 1 ? 'that playlist' : 'these playlists'}, and screens playing {playlists.length === 1 ? 'it' : 'them'} stop showing {files === 1 ? 'it' : 'them'}:</p>
      <ul className="mt-1.5 space-y-0.5">
        {shown.map(p => <li key={p.id} className="text-xs font-medium truncate">• {p.name}</li>)}
        {more > 0 && <li className="text-xs text-amber-800">and {more} more</li>}
      </ul>
    </div>
  );
}

