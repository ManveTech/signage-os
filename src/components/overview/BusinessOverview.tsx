import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  Monitor, Building2, PlaySquare, Film, RefreshCw, Table2, LineChart as LineIcon
} from 'lucide-react';
import { syncCollection, getHeaders } from '../../lib/syncHelper';
import { API_BASE } from '../../config';
import { mediaStore } from '../../lib/mediaStore';
import { makeOursTest } from '../../lib/adminOwnership';
import { useCountUp, useInView, useReducedMotion } from '../../lib/useMotion';
import IndiaMap from './IndiaMap';
import {
  computeOverview, compactNumber, formatBytes, formatHours, formatMonthYear,
  deltaOver, buildDailyActivity, Overview
} from '../../lib/overviewMetrics';

/**
 * A single page showing what the network actually is: how many screens are
 * deployed, how reliably they run, how much content goes through them, who
 * they belong to and where they are.
 *
 * Built to be shown to someone — projected in a meeting or screen-shared with
 * a prospective client — so it carries no revenue, no margins and no billing
 * state, and it leans on shapes rather than figures. Each panel is a different
 * form on purpose: lines for who grew when, a mosaic for where, a ring for
 * what, columns for when, a grid for right now. A page of one shape is a page
 * nobody's eye moves around.
 *
 * Everything draws itself in as you reach it (see lib/useMotion), once, and
 * all of it is skipped under prefers-reduced-motion.
 *
 * It is still an admin page behind login, because it names real clients, and
 * everything is computed in the browser from collections the dashboard already
 * syncs, so it needs no new API endpoint.
 */

// Chart palette, validated as a set against this page's white card surface
// (lightness band, chroma floor, CVD separation, normal-vision floor). Six
// slots clear every adjacent gate, which is what the line chart and the ring
// need; three of them fall below 3:1 against white, so both ship a legend with
// the figures on it and a table view, which is the relief that WARN requires.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const SERIES_1 = SERIES[0];

// Blue sequential ramp: step 100 for a meter's unfilled track, step 450 for its
// fill, so the whole bar reads as one hue, light to dark.
const RAMP_TRACK = '#cde2fb';

const GRID = '#e1e0d9';
const AXIS_INK = '#898781';
const SPARK_INK = '#c3c2b7';
const SUCCESS_INK = '#006300';

// Status is a reserved role and never a series hue. Offline takes a neutral
// rather than the critical red: a screen that is asleep or between heartbeats
// is not an emergency, and a wall of red would misstate a healthy network.
// Both are labelled in the legend, so the colour never carries it alone.
const STATUS_GOOD = '#0ca30c';
const STATUS_IDLE = '#c3c2b7';

/** Past this many screens the grid stops being readable and the meter carries it. */
const MAX_CELLS = 160;

/** Decelerating curve — things arrive at their value rather than stopping dead. */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function grow(pct: number, shown: boolean, reduced: boolean, delayMs = 0) {
  return {
    width: `${shown || reduced ? pct : 0}%`,
    transition: reduced ? undefined : `width 900ms ${EASE} ${delayMs}ms`
  };
}

function Swatch({ color }: { color: string }) {
  return <span aria-hidden className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />;
}

function ChartTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p: any) => p.value !== undefined && p.value !== null);
  if (rows.length === 0) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 text-xs max-w-[220px]">
      <p className="font-semibold text-slate-800">{label}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((p: any, i: number) => (
          <li key={i} className="flex items-center gap-2">
            <Swatch color={p.color || p.fill} />
            <span className="text-slate-600 flex-1 min-w-0 truncate">{p.name}</span>
            <span className="font-semibold text-slate-800 tabular-nums">{p.value}{unit || ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Sparkline({ values, run, width = 104, height = 30 }: {
  values: number[]; run: boolean; width?: number; height?: number;
}) {
  const reduced = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const [length, setLength] = useState(0);
  // Each sparkline needs its own gradient: a shared id would have every tile
  // painting from whichever one mounted last.
  const gradientId = useId().replace(/:/g, '');

  // Every hook runs before the "nothing to draw" exit: bailing out earlier
  // would change the hook order the moment a second data point arrived.
  const enough = values.length >= 2;
  const min = enough ? Math.min(...values) : 0;
  const max = enough ? Math.max(...values) : 0;
  const span = max - min || 1;
  const pts = enough
    ? values.map((v, i) => [
        2 + (i / (values.length - 1)) * (width - 8),
        height - 4 - ((v - min) / span) * (height - 10)
      ] as const)
    : [];
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  // Measured rather than estimated: the dash length has to be the path's real
  // length or the line would either start part-drawn or never finish.
  useEffect(() => {
    if (pathRef.current && d) setLength(pathRef.current.getTotalLength());
  }, [d]);

  if (!enough) return null;

  const [lx, ly] = pts[pts.length - 1];
  const drawn = run || reduced;
  // The same path closed down to the baseline, for the wash underneath it.
  const area = `${d} L${lx.toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.26} />
          <stop offset="100%" stopColor={SERIES_1} stopOpacity={0} />
        </linearGradient>
      </defs>
      {/* A wash, not a block: it sits under the line to give the tile some
          weight without competing with the figure beside it. */}
      <path
        d={area}
        fill={`url(#${gradientId})`}
        style={{
          opacity: drawn ? 1 : 0,
          transition: reduced ? undefined : 'opacity 700ms ease-out 250ms'
        }}
      />
      <path
        ref={pathRef} d={d} fill="none" stroke={SPARK_INK} strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round"
        style={length ? {
          strokeDasharray: length,
          strokeDashoffset: drawn ? 0 : length,
          transition: reduced ? undefined : `stroke-dashoffset 1000ms ${EASE}`
        } : undefined}
      />
      <circle
        cx={lx} cy={ly} r={4} fill={SERIES_1} stroke="#ffffff" strokeWidth={2}
        style={{ opacity: drawn ? 1 : 0, transition: reduced ? undefined : 'opacity 300ms ease-out 850ms' }}
      />
    </svg>
  );
}

function Tile({ icon, value, format, label, sub, series, delta, run }: {
  icon: React.ReactNode; value: number; format: (n: number) => string;
  label: string; sub?: string; series?: number[]; delta?: number | null; run: boolean;
}) {
  const shown = useCountUp(value, run);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-slate-400">{icon}</span>
        {series && series.length > 1 && <Sparkline values={series} run={run} />}
      </div>
      {/* Proportional figures: tabular-nums makes a large standalone number
          look loosely spaced — and makes a counting one jitter. */}
      <p className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{format(shown)}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {typeof delta === 'number' && delta > 0 && (
          <span
            className="text-[11px] font-semibold"
            style={{ color: SUCCESS_INK, opacity: run ? 1 : 0, transition: 'opacity 400ms ease-out 700ms' }}
          >
            +{compactNumber(delta)} this year
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, hint, action, shown, children }: {
  title: string; hint?: string; action?: React.ReactNode;
  shown: boolean; children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <div
      className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 h-full"
      style={reduced ? undefined : {
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(10px)',
        transition: `opacity 500ms ease-out, transform 500ms ${EASE}`
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function TableToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
    >
      {on ? <LineIcon size={12} /> : <Table2 size={12} />}
      {on ? 'Chart' : 'Table'}
    </button>
  );
}

/**
 * The newest slice of the device log, for the daily activity chart.
 *
 * Asks for far more than the endpoint's default page because the chart covers
 * thirty days and a busy network writes a lot of rows in one. The page is
 * still bounded, which is why buildDailyActivity reports how far back the rows
 * actually reach instead of drawing the gap as zeroes. Failure is empty rather
 * than fatal: one card goes quiet, the rest of the page is unaffected.
 */
async function fetchRecentLogs(): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/screen_logs?perPage=3000`, { headers: getHeaders() });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body) ? body : [];
  } catch {
    return [];
  }
}

export default function BusinessOverview({ userEmail = '' }: { userEmail?: string }) {
  const reduced = useReducedMotion();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [trendAsTable, setTrendAsTable] = useState(false);
  const [mixAsTable, setMixAsTable] = useState(false);
  const [placesAsTable, setPlacesAsTable] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // One per band of the page, so each draws itself in as it is reached.
  const [tilesRef, tilesIn] = useInView<HTMLDivElement>();
  const [chartRef, chartIn] = useInView<HTMLDivElement>();
  const [nowRef, nowIn] = useInView<HTMLDivElement>();
  const [placesRef, placesIn] = useInView<HTMLDivElement>();
  const [libraryRef, libraryIn] = useInView<HTMLDivElement>();
  const [uploadsRef, uploadsIn] = useInView<HTMLDivElement>();
  const [rosterRef, rosterIn] = useInView<HTMLDivElement>();

  const load = (force = false) => Promise.all([
    syncCollection('screens', 'signageos_screens', { force }),
    syncCollection('media_items', 'signageos_media', { force }),
    syncCollection('playlists', 'signageos_playlists', { force }),
    syncCollection('users', 'signageos_users', { force }),
    syncCollection('organizations', 'signageos_organizations', { force }),
    fetchRecentLogs().then(setLogs),
  ]).finally(() => setTick(t => t + 1));

  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  const data: Overview = useMemo(() => {
    const orgs = (() => {
      try { return JSON.parse(localStorage.getItem('signageos_organizations') || '[]'); }
      catch { return []; }
    })();
    return computeOverview({
      screens: mediaStore.getScreens(),
      media: mediaStore.getMedia(),
      playlists: mediaStore.getPlaylists(),
      orgs: Array.isArray(orgs) ? orgs : [],
      isOurs: makeOursTest(userEmail)
    });
    // tick is the dependency that matters: the stores are mutable singletons,
    // so a sync finishing is the only signal that their contents changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, userEmail]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true).finally(() => setRefreshing(false));
  };

  const screenSeries = data.growth.map(p => p.screens);
  const clientSeries = data.growth.map(p => p.clients);
  const mediaSeries = data.growth.map(p => p.media);
  const mixTotal = data.mediaMix.reduce((n, s) => n + s.count, 0);
  const maxClientScreens = data.roster[0]?.screens || 1;
  const empty = data.screensDeployed === 0;

  const activity = useMemo(() => buildDailyActivity(logs), [logs]);

  const offline = data.statusCells.filter(c => !c.online);
  const tilesRun = tilesIn && !loading;
  const onlinePct = useCountUp(data.onlinePct, nowIn && !loading);

  return (
    // Held at reduced opacity while refreshing rather than replaced by a
    // skeleton, so the page never jumps while someone is looking at it.
    <div className={`space-y-4 transition-opacity ${refreshing ? 'opacity-60' : 'opacity-100'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Business overview</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            The whole network on one page — built to be shown to a client.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="h-9 px-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center text-sm text-slate-400">
          Loading the network…
        </div>
      ) : empty ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
          <Monitor size={22} className="text-slate-300 mx-auto" />
          <p className="text-sm font-medium text-slate-700 mt-3">No screens deployed yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Once screens are paired and assigned, this page fills in on its own.
          </p>
        </div>
      ) : (
        <>
          <div ref={tilesRef} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Tile
              run={tilesRun} icon={<Monitor size={16} />}
              value={data.screensDeployed} format={n => compactNumber(Math.round(n))}
              label="Screens deployed"
              sub={`Across ${data.locations} location${data.locations === 1 ? '' : 's'}`}
              series={screenSeries} delta={deltaOver(screenSeries)}
            />
            <Tile
              run={tilesRun} icon={<Building2 size={16} />}
              value={data.clients} format={n => compactNumber(Math.round(n))}
              label="Businesses served" sub="Active client networks"
              series={clientSeries} delta={deltaOver(clientSeries)}
            />
            <Tile
              run={tilesRun} icon={<Film size={16} />}
              value={data.mediaFiles} format={n => compactNumber(Math.round(n))}
              label="Media in the library"
              sub={`${formatBytes(data.libraryBytes)} · ${compactNumber(data.playlists)} playlists`}
              series={mediaSeries} delta={deltaOver(mediaSeries)}
            />
            {/* No sparkline here on purpose: playback hours are a running total
                with no history behind them, and drawing a trend we cannot
                source would be an invented line. */}
            <Tile
              run={tilesRun} icon={<PlaySquare size={16} />}
              value={data.uptimeSeconds} format={formatHours}
              label="Hours of playback"
              sub={`${compactNumber(data.loopsPlayed)} playlist loops`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div ref={chartRef} className="lg:col-span-2">
              <Card
                shown={chartIn}
                title="Screens active each day"
                hint="Distinct screens reporting in · last 30 days"
                action={<TableToggle on={trendAsTable} onClick={() => setTrendAsTable(v => !v)} />}
              >
                {trendAsTable ? (
                  <div className="max-h-[248px] overflow-y-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="font-medium py-1.5">Day</th>
                          <th className="font-medium py-1.5 text-right">Screens active</th>
                          <th className="font-medium py-1.5 text-right">Events</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.points.map(p => (
                          <tr key={p.date} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-600">{p.date}</td>
                            <td className="py-1.5 text-right font-medium text-slate-800">{p.screens}</td>
                            <td className="py-1.5 text-right text-slate-500">{p.events}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : activity.points.length === 0 ? (
                  <p className="text-sm text-slate-400 py-10 text-center">
                    No device activity recorded yet.
                  </p>
                ) : (
                  <>
                    <div style={{ height: 248 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activity.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            {/* Defined here rather than borrowed from another
                                chart: SVG gradient ids are document-wide, so a
                                shared one breaks the moment the chart that owns
                                it stops rendering. Full strength at the cap,
                                easing toward the baseline — the column still
                                reads as one solid mark, which a fade to
                                transparent would not. */}
                            <linearGradient id="columnFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={SERIES_1} stopOpacity={1} />
                              <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.55} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                          <XAxis
                            dataKey="label" tick={{ fontSize: 11, fill: AXIS_INK }}
                            tickLine={false} axisLine={{ stroke: GRID }} dy={4}
                            interval="preserveStartEnd" minTickGap={14}
                          />
                          <YAxis
                            width={30} tick={{ fontSize: 11, fill: AXIS_INK }}
                            tickLine={false} axisLine={false} allowDecimals={false}
                          />
                          <Tooltip content={<ChartTooltip unit=" screens" />} cursor={{ fill: 'rgba(11,11,11,0.04)' }} />
                          <Bar
                            dataKey="screens" name="Active"
                            fill="url(#columnFill)" radius={[4, 4, 0, 0]} maxBarSize={18}
                            isAnimationActive={!reduced && chartIn}
                            animationDuration={900}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {/* Where the log stops is stated, not drawn as zero: an
                        empty column before the first row would read as a day
                        the network was dead rather than a day we cannot see. */}
                    {activity.coveredFrom && (
                      <p className="text-[11px] text-slate-400 mt-3">
                        From {activity.coveredFrom} — as far back as the device log reaches.
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>

            <div ref={nowRef}>
              <Card shown={nowIn} title="Right now" hint="Every deployed screen, one square each">
                {/* A ratio against a whole is a meter, not a dial: one hue, the
                    unfilled track a lighter step of the same ramp. */}
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-3xl font-semibold text-slate-900 tracking-tight">
                    {Math.round(onlinePct)}%
                  </span>
                  <span className="text-xs text-slate-500">
                    {data.screensOnline} of {data.screensDeployed} online
                  </span>
                </div>
                <div
                  className="mt-2.5 h-2.5 rounded-full overflow-hidden"
                  style={{ backgroundColor: RAMP_TRACK }}
                  role="meter" aria-valuenow={data.onlinePct} aria-valuemin={0} aria-valuemax={100}
                  aria-label="Screens online"
                >
                  <div className="h-full rounded-full" style={{ ...grow(data.onlinePct, nowIn, reduced), backgroundColor: SERIES_1 }} />
                </div>

                {data.statusCells.length <= MAX_CELLS ? (
                  <>
                    <div className="flex flex-wrap gap-1 mt-4">
                      {data.statusCells.map((c, i) => (
                        <span
                          key={c.id}
                          title={`${c.name} — ${c.online ? 'online' : 'offline'}`}
                          className="w-3.5 h-3.5 rounded-[3px]"
                          style={{
                            backgroundColor: c.online ? STATUS_GOOD : STATUS_IDLE,
                            ...(reduced ? {} : {
                              opacity: nowIn ? 1 : 0,
                              transform: nowIn ? 'scale(1)' : 'scale(0.4)',
                              // Capped so a large estate still finishes
                              // arriving in well under a second.
                              transition: `opacity 260ms ease-out ${Math.min(i * 14, 700)}ms, transform 260ms ${EASE} ${Math.min(i * 14, 700)}ms`
                            })
                          }}
                        />
                      ))}
                    </div>
                    {/* Labelled, so the state never rests on colour alone. */}
                    <ul className="flex items-center gap-4 mt-3.5 text-[11px] text-slate-500">
                      <li className="flex items-center gap-1.5"><Swatch color={STATUS_GOOD} />Online</li>
                      <li className="flex items-center gap-1.5"><Swatch color={STATUS_IDLE} />Offline</li>
                    </ul>

                    {/* The grid says how many are down; the first question
                        anyone asks next is which. This card sits beside a tall
                        chart and had the room standing empty. */}
                    {offline.length > 0 && (
                      <div className="mt-4 pt-3.5 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-500">
                          Offline now
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {offline.slice(0, 6).map(c => (
                            <li key={c.id} className="flex items-center gap-2 text-xs text-slate-600">
                              <Swatch color={STATUS_IDLE} />
                              <span className="truncate" title={c.name}>{c.name}</span>
                            </li>
                          ))}
                        </ul>
                        {offline.length > 6 && (
                          <p className="text-[11px] text-slate-400 mt-2">
                            and {offline.length - 6} more
                          </p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-4">
                    {compactNumber(data.statusCells.length)} screens — too many to show one square each.
                  </p>
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div ref={placesRef}>
              <Card
                shown={placesIn}
                title="Where the screens are"
                hint={`${data.stateCounts.length} state${data.stateCounts.length === 1 ? '' : 's'} · ${data.locations} location${data.locations === 1 ? '' : 's'}`}
                action={<TableToggle on={placesAsTable} onClick={() => setPlacesAsTable(v => !v)} />}
              >
                {data.locationTree.length === 0 ? (
                  <p className="text-sm text-slate-400">No locations recorded yet.</p>
                ) : placesAsTable ? (
                  <div className="max-h-[300px] overflow-y-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="font-medium py-1.5">Location</th>
                          <th className="font-medium py-1.5 text-right">Screens</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.locationTree.map(l => (
                          <tr key={l.name} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-600">{l.name}</td>
                            <td className="py-1.5 text-right font-medium text-slate-800">{l.size}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <>
                    <IndiaMap states={data.stateCounts} animate={!reduced && placesIn} />
                    {/* Said plainly rather than hidden: a map that silently
                        drops screens it could not place would understate the
                        network without the reader having any way to tell. */}
                    {data.unplacedScreens > 0 && (
                      <p className="text-[11px] text-slate-400 mt-2 text-center">
                        {data.unplacedScreens} screen{data.unplacedScreens === 1 ? '' : 's'} not on the map —
                        {' '}no state recorded in the location. The table view lists every location.
                      </p>
                    )}
                  </>
                )}
              </Card>
            </div>

            <div ref={rosterRef}>
              <Card shown={rosterIn} title="Who we run screens for" hint="Each client's network, and how much of it is live">
                {data.roster.length === 0 ? (
                  <p className="text-sm text-slate-400">No client screens deployed yet.</p>
                ) : (
                  // A meter list: a name, a bar and a figure per row, bars
                  // aligned so the networks compare down the column.
                  <ul className="space-y-3.5">
                    {data.roster.map((c, i) => (
                      <li key={c.email} className="flex items-center gap-3">
                        {c.logo ? (
                          <img src={c.logo} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-50 shrink-0" />
                        ) : (
                          <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold flex items-center justify-center shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          {/* Stacked on a phone: side by side, the metadata
                              squeezes the name down to "Apollo P…". */}
                          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <p className="text-xs font-medium text-slate-800 truncate" title={c.name}>{c.name}</p>
                            <p className="text-[11px] text-slate-400 sm:shrink-0 truncate">
                              {c.locations > 1 ? `${c.locations} locations` : '1 location'}
                              {c.since ? ` · since ${formatMonthYear(c.since)}` : ''}
                            </p>
                          </div>
                          {/* One bar per client, all on the same scale: the full
                              length is their screen count against the largest
                              client's, and the green part is the share of it
                              that is live. The two multiply out to
                              online/largest, so green lengths compare straight
                              across rows as online counts. */}
                          <div className="mt-1.5 h-2 bg-slate-50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full overflow-hidden"
                              style={{
                                ...grow(Math.max(6, (c.screens / maxClientScreens) * 100), rosterIn, reduced, i * 80),
                                backgroundColor: STATUS_IDLE
                              }}
                              title={`${c.screens} screen${c.screens === 1 ? '' : 's'}, ${c.online} online`}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  ...grow(c.screens > 0 ? (c.online / c.screens) * 100 : 0, rosterIn, reduced, 250 + i * 80),
                                  backgroundColor: STATUS_GOOD
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0 w-12 text-right">
                          {c.online}/{c.screens}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div ref={uploadsRef}>
              <Card shown={uploadsIn} title="Content added each month" hint="New media uploaded · last 12 months">
                {/* An area rather than more columns: the daily chart above is
                    already a column chart, and twelve months of one measure
                    reads fine as a continuous shape. */}
                <div style={{ height: 212 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.mediaAdded} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="uploadsFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                      <XAxis
                        dataKey="label" tick={{ fontSize: 11, fill: AXIS_INK }}
                        tickLine={false} axisLine={{ stroke: GRID }} dy={4}
                      />
                      <YAxis
                        width={30} tick={{ fontSize: 11, fill: AXIS_INK }}
                        tickLine={false} axisLine={false} allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip unit=" files" />} cursor={{ stroke: AXIS_INK, strokeWidth: 1 }} />
                      {/* One series, so no legend — the card title names it. */}
                      <Area
                        type="monotone" dataKey="count" name="Added"
                        stroke={SERIES_1} strokeWidth={2} fill="url(#uploadsFill)"
                        dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                        isAnimationActive={!reduced && uploadsIn}
                        animationDuration={1000}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>

            <div ref={libraryRef}>
              <Card
                shown={libraryIn}
                title="What's in the library"
                hint={`${compactNumber(data.mediaFiles)} files · ${formatBytes(data.libraryBytes)}`}
                action={mixTotal > 0 ? <TableToggle on={mixAsTable} onClick={() => setMixAsTable(v => !v)} /> : undefined}
              >
                {mixTotal === 0 ? (
                  <p className="text-sm text-slate-400">Nothing uploaded yet.</p>
                ) : mixAsTable ? (
                  <table className="w-full text-xs tabular-nums">
                    <thead>
                      <tr className="text-left text-slate-400">
                        <th className="font-medium py-1.5">Kind</th>
                        <th className="font-medium py-1.5 text-right">Files</th>
                        <th className="font-medium py-1.5 text-right">Share</th>
                        <th className="font-medium py-1.5 text-right">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.mediaMix.map(s => (
                        <tr key={s.key} className="border-t border-slate-100">
                          <td className="py-1.5 text-slate-600">{s.label}</td>
                          <td className="py-1.5 text-right font-medium text-slate-800">{s.count}</td>
                          <td className="py-1.5 text-right text-slate-600">{Math.round((s.count / mixTotal) * 100)}%</td>
                          <td className="py-1.5 text-right text-slate-500">{formatBytes(s.bytes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
                    <div className="relative shrink-0" style={{ width: 176, height: 176 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={data.mediaMix}
                            dataKey="count"
                            nameKey="label"
                            innerRadius="62%"
                            outerRadius="92%"
                            // The gap between segments is the surface showing
                            // through, not a border drawn round each one.
                            paddingAngle={2}
                            stroke="#ffffff"
                            strokeWidth={2}
                            isAnimationActive={!reduced && libraryIn}
                            animationDuration={900}
                          >
                            {data.mediaMix.map((s, i) => (
                              <Cell key={s.key} fill={SERIES[i % SERIES.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip unit=" files" />} />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* The hole is the right place for the total — it is the
                          one number the ring cannot show. */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-semibold text-slate-900 tracking-tight">
                          {compactNumber(data.mediaFiles)}
                        </span>
                        <span className="text-[11px] text-slate-400">files</span>
                      </div>
                    </div>
                    {/* The legend carries each share, which is the relief the
                        lighter slots need against a white surface. */}
                    <ul className="flex-1 min-w-0 space-y-2.5">
                      {data.mediaMix.map((s, i) => (
                        <li key={s.key} className="flex items-center gap-2.5 text-xs">
                          <Swatch color={SERIES[i % SERIES.length]} />
                          <span className="text-slate-600 flex-1 min-w-0 truncate">{s.label}</span>
                          <span className="font-semibold text-slate-800 tabular-nums">
                            {Math.round((s.count / mixTotal) * 100)}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
