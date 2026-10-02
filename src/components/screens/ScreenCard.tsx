import { ChevronRight, Monitor } from 'lucide-react';
import { screenStatusStyle } from './screenStatus';

/**
 * Compact, tappable summary of one screen: thumbnail with status dot, name,
 * status · location, and what it's playing (or paused / not linked).
 * Tapping opens the screen's details sheet; in selection mode it toggles
 * selection instead.
 */
export default function ScreenCard({
  screen,
  status,
  playing,
  groupName,
  footnote,
  selectionMode,
  selected,
  onClick
}: {
  screen: { name: string; location?: string; thumbnail?: string; paused?: boolean; pairing_code?: string };
  status: string;
  playing: string;
  groupName?: string;
  /** Extra small line, e.g. the owning organization on admin pages. */
  footnote?: string;
  selectionMode?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const style = screenStatusStyle(status);
  const isLive = status === 'online' || status === 'active';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-white rounded-2xl border p-3 flex items-center gap-3 transition-colors cursor-pointer ${
        selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
      }`}
    >
      {selectionMode && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={() => {}}
          className="w-5 h-5 rounded border-slate-300 text-blue-600 shrink-0 pointer-events-none"
        />
      )}
      <span className="relative w-14 h-14 rounded-xl overflow-hidden bg-ink-950 shrink-0 flex items-center justify-center">
        {screen.thumbnail ? (
          <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${screen.thumbnail})` }} />
        ) : (
          <Monitor size={20} className="text-white/25" />
        )}
        <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-ink-950" style={{ backgroundColor: style.dot }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-900 truncate">{screen.name}</span>
        <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 min-w-0">
          <span className={`font-semibold ${style.text}`}>{style.label}</span>
          {screen.location && screen.location !== 'Not Specified' && <span className="truncate">· {screen.location}</span>}
        </span>
        <span className="flex items-center gap-1.5 text-xs mt-1 min-w-0">
          {status === 'pairing' ? (
            <span className="text-slate-500">
              {screen.pairing_code ? <>Code <span className="font-mono font-semibold text-slate-700">{screen.pairing_code}</span> · </> : null}
              not added yet
            </span>
          ) : status === 'unlinked' ? (
            <span className="text-blue-600 font-medium">Tap to pair a TV</span>
          ) : screen.paused ? (
            <span className="truncate text-amber-700 font-medium">❚❚ Paused{playing ? ` · ${playing}` : ''}</span>
          ) : playing ? (
            <span className={`truncate ${isLive ? 'text-slate-700' : 'text-slate-400'}`}>{isLive ? '▶ ' : ''}{playing}</span>
          ) : (
            <span className="text-slate-400">No playlist</span>
          )}
          {groupName && (
            <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold truncate max-w-[90px]">{groupName}</span>
          )}
        </span>
        {footnote && <span className="block text-[11px] text-slate-400 truncate mt-0.5">{footnote}</span>}
      </span>
      {!selectionMode && <ChevronRight size={18} className="text-slate-300 shrink-0" />}
    </button>
  );
}
