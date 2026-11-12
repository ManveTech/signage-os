import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  Monitor, Building2, PlaySquare, Film, RefreshCw, Table2, LineChart as LineIcon
} from 'lucide-react';
import { syncCollection } from '../../lib/syncHelper';
import { mediaStore } from '../../lib/mediaStore';
import { makeOursTest } from '../../lib/adminOwnership';
import {
  computeOverview, compactNumber, formatBytes, formatHours, formatMonthYear,
  deltaOver, Overview
} from '../../lib/overviewMetrics';

/**
 * A single page showing what the network actually is: how many screens are
 * deployed, how reliably they run, how much content goes through them, who
 * they belong to and where they are.
 *
 * Built to be shown to someone — projected in a meeting or screen-shared with
 * a prospective client — so it carries no revenue, no margins and no billing
 * state, and it leans on shapes rather than figures: a reader across the table
 * takes in a rising line and a wall of green far faster than a column of
 * numbers. It is still an admin page behind login, because it names real
 * clients.
 *
 * Everything here is computed in the browser from collections the dashboard
 * already syncs, so it needs no new API endpoint.
 */

// Chart palette, validated as a set against this page's white card surface
// (lightness band, chroma floor, CVD separation across all pairs, normal-vision
// floor). Three slots is the cap that clears every gate — the library mix folds
// its tail into "Other" rather than reaching for a fourth hue.
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';
const SERIES_3 = '#1baf7a';
const MIX_COLORS = [SERIES_1, SERIES_2, SERIES_3];

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

function Sparkline({ values, width = 104, height = 30 }: {
  values: number[]; width?: number; height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    2 + (i / (values.length - 1)) * (width - 8),
    height - 4 - ((v - min) / span) * (height - 10)
  ] as const);
  const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    // The run is de-emphasised and only the current point wears the accent, so
    // the tile's eye-catch is where the series has got to, not its whole path.
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={SPARK_INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r={4} fill={SERIES_1} stroke="#ffffff" strokeWidth={2} />
    </svg>
  );
}

function Tile({ icon, value, label, sub, series, delta }: {
  icon: React.ReactNode; value: string; label: string; sub?: string;
  series?: number[]; delta?: number | null;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-slate-400">{icon}</span>
        {series && series.length > 1 && <Sparkline values={series} />}
      </div>
      {/* Proportional figures: tabular-nums makes a large standalone number
          look loosely spaced. */}
      <p className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{value}</p>
      <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
        <p className="text-xs font-medium text-slate-600">{label}</p>
        {typeof delta === 'number' && delta > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: SUCCESS_INK }}>
            +{compactNumber(delta)} this year
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, hint, action, children }: {
  title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 h-full">
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

function GrowthTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="text-slate-600 mt-0.5">{p.screens} screen{p.screens === 1 ? '' : 's'} live</p>
      <p className="text-slate-600">{p.clients} client{p.clients === 1 ? '' : 's'}</p>
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

export default function BusinessOverview({ userEmail = '' }: { userEmail?: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [growthAsTable, setGrowthAsTable] = useState(false);
  const [mixAsTable, setMixAsTable] = useState(false);

  const load = (force = false) => Promise.all([
    syncCollection('screens', 'signageos_screens', { force }),
    syncCollection('media_items', 'signageos_media', { force }),
    syncCollection('playlists', 'signageos_playlists', { force }),
    syncCollection('users', 'signageos_users', { force }),
    syncCollection('organizations', 'signageos_organizations', { force }),
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
  const maxLocation = data.topLocations[0]?.count || 1;
  const maxClientScreens = data.roster[0]?.screens || 1;
  const empty = data.screensDeployed === 0;

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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Tile
              icon={<Monitor size={16} />}
              value={compactNumber(data.screensDeployed)}
              label="Screens deployed"
              sub={`Across ${data.locations} location${data.locations === 1 ? '' : 's'}`}
              series={screenSeries}
              delta={deltaOver(screenSeries)}
            />
            <Tile
              icon={<Building2 size={16} />}
              value={compactNumber(data.clients)}
              label="Businesses served"
              sub="Active client networks"
              series={clientSeries}
              delta={deltaOver(clientSeries)}
            />
            <Tile
              icon={<Film size={16} />}
              value={compactNumber(data.mediaFiles)}
              label="Media in the library"
              sub={`${formatBytes(data.libraryBytes)} · ${compactNumber(data.playlists)} playlists`}
              series={mediaSeries}
              delta={deltaOver(mediaSeries)}
            />
            {/* No sparkline here on purpose: playback hours are a running total
                with no history behind them, and drawing a trend we cannot
                source would be an invented line. */}
            <Tile
              icon={<PlaySquare size={16} />}
              value={formatHours(data.uptimeSeconds)}
              label="Hours of playback"
              sub={`${compactNumber(data.loopsPlayed)} playlist loops`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card
                title="Screens live over time"
                hint="Cumulative total at each month end · last 12 months"
                action={<TableToggle on={growthAsTable} onClick={() => setGrowthAsTable(v => !v)} />}
              >
                {growthAsTable ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs tabular-nums">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="font-medium py-1.5 pr-4">Month</th>
                          <th className="font-medium py-1.5 pr-4">Screens live</th>
                          <th className="font-medium py-1.5">Clients</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.growth.map(p => (
                          <tr key={p.month} className="border-t border-slate-100">
                            <td className="py-1.5 pr-4 text-slate-600">{p.month}</td>
                            <td className="py-1.5 pr-4 font-medium text-slate-800">{p.screens}</td>
                            <td className="py-1.5 text-slate-600">{p.clients}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  // Height covers the plot plus the x-axis band, so the axis
                  // labels are never cropped into a nested scrollbar.
                  <div style={{ height: 272 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.growth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.16} />
                            <stop offset="100%" stopColor={SERIES_1} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        {/* Solid hairlines, horizontal only — dashes read as a
                            threshold when they are just a grid. */}
                        <CartesianGrid stroke={GRID} strokeWidth={1} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: AXIS_INK }}
                          tickLine={false}
                          axisLine={{ stroke: GRID }}
                          dy={4}
                        />
                        <YAxis
                          width={34}
                          tick={{ fontSize: 11, fill: AXIS_INK }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip content={<GrowthTooltip />} cursor={{ stroke: AXIS_INK, strokeWidth: 1 }} />
                        {/* One series, so no legend — the card title names it. */}
                        <Area
                          type="monotone"
                          dataKey="screens"
                          stroke={SERIES_1}
                          strokeWidth={2}
                          fill="url(#growthFill)"
                          dot={false}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <Card title="Right now" hint="Every deployed screen, one square each">
              {/* A ratio against a whole is a meter, not a dial: one hue, the
                  unfilled track a lighter step of the same ramp. */}
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-3xl font-semibold text-slate-900 tracking-tight">
                  {data.onlinePct}%
                </span>
                <span className="text-xs text-slate-500">
                  {data.screensOnline} of {data.screensDeployed} online
                </span>
              </div>
              <div
                className="mt-2.5 h-2.5 rounded-full overflow-hidden"
                style={{ backgroundColor: RAMP_TRACK }}
                role="meter"
                aria-valuenow={data.onlinePct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Screens online"
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${data.onlinePct}%`, backgroundColor: SERIES_1 }}
                />
              </div>

              {data.statusCells.length <= MAX_CELLS ? (
                <>
                  <div className="flex flex-wrap gap-1 mt-4">
                    {data.statusCells.map(c => (
                      <span
                        key={c.id}
                        title={`${c.name} — ${c.online ? 'online' : 'offline'}`}
                        className="w-3.5 h-3.5 rounded-[3px]"
                        style={{ backgroundColor: c.online ? STATUS_GOOD : STATUS_IDLE }}
                      />
                    ))}
                  </div>
                  {/* Labelled, so the state never rests on colour alone. */}
                  <ul className="flex items-center gap-4 mt-3.5 text-[11px] text-slate-500">
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: STATUS_GOOD }} />
                      Online
                    </li>
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden className="w-2.5 h-2.5 rounded-[3px]" style={{ backgroundColor: STATUS_IDLE }} />
                      Offline
                    </li>
                  </ul>
                </>
              ) : (
                <p className="text-[11px] text-slate-400 mt-4">
                  {compactNumber(data.statusCells.length)} screens — too many to show one square each.
                </p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Where the screens are" hint={`Busiest of ${data.locations} locations`}>
              {data.topLocations.length === 0 ? (
                <p className="text-sm text-slate-400">No locations recorded yet.</p>
              ) : (
                <ul className="space-y-3">
                  {data.topLocations.map(loc => (
                    <li key={loc.name} className="flex items-center gap-3">
                      <span className="w-28 sm:w-36 shrink-0 text-xs text-slate-600 truncate" title={loc.name}>
                        {loc.name}
                      </span>
                      <span className="flex-1 min-w-0 h-2.5 bg-slate-50 rounded-full overflow-hidden">
                        {/* One series, one colour. Length already encodes the
                            value; shading it by size would spend the only free
                            channel on what the bar says twice. */}
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(4, (loc.count / maxLocation) * 100)}%`,
                            backgroundColor: SERIES_1
                          }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-xs font-semibold text-slate-700 tabular-nums">
                        {loc.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
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
                <>
                  {/* Tall segmented bar: one whole split into parts, read at a
                      glance. 28px, shares printed inside where they fit, and the
                      2px gaps are the surface showing through, not borders. */}
                  <div className="flex gap-0.5" style={{ height: 28 }}>
                    {data.mediaMix.map((s, i) => (
                      <div
                        key={s.key}
                        className="h-full flex items-center rounded"
                        style={{
                          width: `${(s.count / mixTotal) * 100}%`,
                          backgroundColor: MIX_COLORS[i % MIX_COLORS.length]
                        }}
                        title={`${s.label}: ${s.count} file${s.count === 1 ? '' : 's'} (${Math.round((s.count / mixTotal) * 100)}%)`}
                      >
                        {/* Only printed where the block is wide enough to hold
                            it with padding — a cropped label is worse than none,
                            and the value stays in the table view either way. */}
                        {(s.count / mixTotal) > 0.14 && (
                          <span className="text-[11px] font-semibold text-white pl-2">
                            {Math.round((s.count / mixTotal) * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* The legend names the parts in block order and repeats no
                      numbers — the bar and the table carry those. */}
                  <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3.5">
                    {data.mediaMix.map((s, i) => (
                      <li key={s.key} className="flex items-center gap-2 text-xs text-slate-600">
                        <span
                          aria-hidden
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: MIX_COLORS[i % MIX_COLORS.length] }}
                        />
                        {s.label}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <Card
            title="Who we run screens for"
            hint="Each client's network, and how much of it is live"
          >
            {data.roster.length === 0 ? (
              <p className="text-sm text-slate-400">No client screens deployed yet.</p>
            ) : (
              // A meter list: a name, a bar and a figure per row, bars aligned
              // so the networks compare against each other down the column.
              <ul className="space-y-3.5">
                {data.roster.map(c => (
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
                          client's, and the green part is the share of it that
                          is live. The two multiply out to online/largest, so
                          green lengths compare straight across rows as online
                          counts — the row is a stacked bar, not a nested one. */}
                      <div className="mt-1.5 h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full overflow-hidden"
                          style={{
                            width: `${Math.max(6, (c.screens / maxClientScreens) * 100)}%`,
                            backgroundColor: STATUS_IDLE
                          }}
                          title={`${c.screens} screen${c.screens === 1 ? '' : 's'}, ${c.online} online`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${c.screens > 0 ? (c.online / c.screens) * 100 : 0}%`,
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
        </>
      )}
    </div>
  );
}
