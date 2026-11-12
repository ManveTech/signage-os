import { useEffect, useMemo, useState } from 'react';
import { mapNameFor } from '../../lib/indiaStates';
import type { StateCount } from '../../lib/overviewMetrics';

/**
 * Screens per state, drawn on India.
 *
 * A choropleth, so the colour job is magnitude: one hue, light to dark, from
 * the blue sequential ramp. A state with no screens takes a neutral grey
 * rather than the palest blue — "none" and "a few" have to be tellable apart,
 * and on this map most states are "none".
 *
 * The shapes are loaded on demand. They are 170KB of path data for one panel
 * of one admin page, which has no business sitting in the bundle every client
 * downloads to watch a playlist.
 *
 * Map shapes: @svg-maps/india, CC BY 4.0.
 */

// Blue sequential ramp, steps 200-600. The scale starts at 200 rather than
// 100 so the lightest band still reads against white.
const RAMP = ['#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
const NO_DATA = '#f1f5f9';
const BORDER = '#ffffff';

type Loaded = { viewBox: string; locations: { id: string; name: string; path: string }[] };

/**
 * Cut points for the five bands. Deliberately not quantiles: with a handful of
 * states carrying screens, quantiles would paint a state with one screen the
 * same dark step as one with forty purely because it ranked highly.
 */
function bandFor(count: number, max: number): number {
  if (count <= 0) return -1;
  if (max <= 1) return 0;
  const share = count / max;
  if (share <= 0.2) return 0;
  if (share <= 0.4) return 1;
  if (share <= 0.6) return 2;
  if (share <= 0.8) return 3;
  return 4;
}

export default function IndiaMap({ states, animate }: {
  states: StateCount[];
  animate: boolean;
}) {
  const [map, setMap] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<{ name: string; count: number; clients: number } | null>(null);

  useEffect(() => {
    let live = true;
    import('@svg-maps/india')
      .then(mod => { if (live) setMap((mod.default || mod) as Loaded); })
      .catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  // Counts keyed by the name the map actually draws, so Ladakh's screens land
  // on the shape that still contains it.
  const byMapName = useMemo(() => {
    const m = new Map<string, { count: number; clients: number }>();
    for (const s of states) {
      const key = mapNameFor(s.state);
      const prev = m.get(key);
      m.set(key, {
        count: (prev?.count || 0) + s.count,
        clients: Math.max(prev?.clients || 0, s.clients)
      });
    }
    return m;
  }, [states]);

  const max = useMemo(
    () => Math.max(1, ...[...byMapName.values()].map(v => v.count)),
    [byMapName]
  );

  if (failed) {
    return (
      <p className="text-sm text-slate-400 py-8 text-center">
        The map could not be loaded. The table view has the same figures.
      </p>
    );
  }

  if (!map) {
    return <div className="h-[260px] flex items-center justify-center text-xs text-slate-400">Loading the map…</div>;
  }

  return (
    <div className="relative">
      <svg
        viewBox={map.viewBox}
        className="w-full"
        style={{ height: 320 }}
        role="img"
        aria-label={`Screens by state across ${states.length} Indian state${states.length === 1 ? '' : 's'}`}
      >
        {map.locations.map((loc, i) => {
          const hit = byMapName.get(loc.name);
          const band = bandFor(hit?.count || 0, max);
          return (
            <path
              key={loc.id}
              d={loc.path}
              fill={band < 0 ? NO_DATA : RAMP[band]}
              stroke={BORDER}
              strokeWidth={0.7}
              onMouseEnter={() => setHover({ name: loc.name, count: hit?.count || 0, clients: hit?.clients || 0 })}
              onMouseLeave={() => setHover(null)}
              style={{
                cursor: hit ? 'default' : undefined,
                // Reuses the global fadeIn keyframe; `forwards` holds the
                // state opaque once its turn has passed.
                ...(animate ? {
                  opacity: 0,
                  animation: `fadeIn 420ms ease-out ${Math.min(i * 9, 420)}ms forwards`
                } : {})
              }}
            />
          );
        })}
      </svg>

      {/* Hover detail. Pinned rather than following the pointer: the shapes are
          awkward and a tooltip chasing the cursor over them is hard to read. */}
      <div className="h-5 mt-1 text-center" aria-live="polite">
        {hover && (
          <p className="text-xs text-slate-600">
            <span className="font-semibold text-slate-800">{hover.name}</span>
            {hover.count > 0
              ? ` — ${hover.count} screen${hover.count === 1 ? '' : 's'}, ${hover.clients} client${hover.clients === 1 ? '' : 's'}`
              : ' — no screens yet'}
          </p>
        )}
      </div>

      {/* A sequential scale needs its legend: the shading means nothing without
          the ends named. */}
      <div className="flex items-center justify-center gap-2 mt-1">
        <span className="text-[10px] text-slate-400">Fewer</span>
        <div className="flex gap-0.5">
          {RAMP.map(c => (
            <span key={c} aria-hidden className="w-5 h-2 rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
        </div>
        <span className="text-[10px] text-slate-400">More</span>
        <span aria-hidden className="w-5 h-2 rounded-[2px] ml-2" style={{ backgroundColor: NO_DATA }} />
        <span className="text-[10px] text-slate-400">None</span>
      </div>
    </div>
  );
}
