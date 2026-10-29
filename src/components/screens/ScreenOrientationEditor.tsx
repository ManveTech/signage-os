import { FlipVertical2 } from 'lucide-react';

type OrientationFields = {
  orientation?: string;
  flipped?: boolean;
  displayWidth?: number;
  displayHeight?: number;
  displayRotation?: number;
};

/**
 * True when the TV's own display already turns the picture — e.g. a Philips
 * monitor rotated 90° in its PBS settings, or an Android box set to portrait.
 * The TV then reports a picture taller than wide, and the app must not turn
 * it again. (displayRotation alone says nothing: a display whose natural
 * shape is portrait reports 90° when it is showing landscape.)
 */
export function displayRotatesItself(s: OrientationFields): boolean {
  return !!s.displayWidth && !!s.displayHeight && s.displayHeight > s.displayWidth;
}

/**
 * Landscape / Portrait and "Flip upside down" for one screen. These describe
 * how the display is mounted, so they live on the screen, not the playlist.
 */
export default function ScreenOrientationEditor<T extends OrientationFields>({
  screen,
  onChange
}: {
  screen: T;
  onChange: (patch: Partial<OrientationFields>) => void;
}) {
  const selfRotated = displayRotatesItself(screen);
  const orientation = screen.orientation === 'portrait' ? 'portrait' : 'landscape';

  return (
    <div className="space-y-1.5 border-t border-gray-100 pt-4">
      <label className="block text-xs font-medium text-gray-700">Orientation</label>
      {selfRotated ? (
        <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
          Rotated by the display's own settings — nothing to set here.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: 'landscape', label: 'Landscape', box: 'w-6 h-4' },
            { value: 'portrait', label: 'Portrait', box: 'w-4 h-6' }
          ] as const).map(opt => {
            const selected = orientation === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ orientation: opt.value })}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${selected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <span className={`${opt.box} rounded-[3px] border-2 ${selected ? 'border-blue-600' : 'border-gray-400'}`} />
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between border border-gray-200 rounded-xl px-3 h-[42px] bg-white">
        <div className="flex items-center gap-2">
          <FlipVertical2 size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-700">Flip upside down</span>
        </div>
        <input
          type="checkbox"
          checked={!!screen.flipped}
          title="For a display mounted the other way up"
          onChange={e => onChange({ flipped: e.target.checked })}
          className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
        />
      </div>
    </div>
  );
}
