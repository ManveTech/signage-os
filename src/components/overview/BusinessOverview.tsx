import { useEffect, useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import {
  Monitor, Wifi, Building2, PlaySquare, MapPin, Film, RefreshCw, Table2, LineChart as LineIcon
} from 'lucide-react';
import { syncCollection } from '../../lib/syncHelper';
import { mediaStore } from '../../lib/mediaStore';
import { makeOursTest } from '../../lib/adminOwnership';
import {
  computeOverview, compactNumber, formatBytes, formatHours, formatMonthYear, Overview
} from '../../lib/overviewMetrics';

/**
 * A single page showing what the network actually is: how many screens are
 * deployed, how reliably they run, how much content goes through them, who
 * they belong to and where they are.
 *
 * Built to be shown to someone — projected in a meeting or screen-shared with
 * a prospective client — so it carries no revenue, no margins and no billing
 * state. It is still an admin page behind login: it names real clients, which
 * is only appropriate in a room you control.
 *
 * Everything here is computed in the browser from collections the dashboard
 * already syncs, so it needs no new API endpoint.
 */

// Chart palette. Validated as a set against this page's white card surface
// (lightness band, chroma floor, CVD separation across all pairs, normal-vision
// floor). Three slots is the cap that clears every gate — the media mix folds
// its tail into "Other" rather than reaching for a fourth hue.
const SERIES_1 = '#2a78d6';
const SERIES_2 = '#eb6834';
const SERIES_3 = '#1baf7a';
const MIX_COLORS = [SERIES_1, SERIES_2, SERIES_3];
const GRID = '#e1e0d9';
const AXIS_INK = '#898781';
// Status is a reserved role, never a series hue: "3 of 5 online" means a
// state, so it takes the status token and is always shown with the ratio
// beside it rather than relying on the colour to say it.
const STATUS_GOOD = '#0ca30c';

function Tile({ icon, value, label, sub }: {
  icon: React.ReactNode; value: string; label: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <span className="text-slate-400">{icon}</span>
      {/* Proportional figures: tabular-nums makes a large standalone number
          look loosely spaced. */}
      <p className="text-3xl font-semibold text-slate-900 mt-2 tracking-tight">{value}</p>
      <p className="text-xs font-medium text-slate-600 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ title, hint, action, children }: {
  title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
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

export default function BusinessOverview({ userEmail = '' }: { userEmail?: string }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [growthAsTable, setGrowthAsTable] = useState(false);

  const load = (force = false) => {
    return Promise.all([
      syncCollection('screens', 'signageos_screens', { force }),
      syncCollection('media_items', 'signageos_media', { force }),
      syncCollection('playlists', 'signageos_playlists', { force }),
      syncCollection('users', 'signageos_users', { force }),
      syncCollection('organizations', 'signageos_organizations', { force }),
    ]).finally(() => setTick(t => t + 1));
  };

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

  const mixTotal = data.mediaMix.reduce((n, s) => n + s.count, 0);
  const maxLocation = data.topLocations[0]?.count || 1;
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
              sub={`${data.locations} location${data.locations === 1 ? '' : 's'}`}
            />
            <Tile
              icon={<Wifi size={16} />}
              value={`${data.onlinePct}%`}
              label="Online right now"
              sub={`${data.screensOnline} of ${data.screensDeployed} reporting in`}
            />
            <Tile
              icon={<Building2 size={16} />}
              value={compactNumber(data.clients)}
              label="Businesses served"
              sub={data.clients > 0 ? 'Active client networks' : undefined}
            />
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
                action={
                  <button
                    onClick={() => setGrowthAsTable(v => !v)}
                    aria-pressed={growthAsTable}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer shrink-0"
                  >
                    {growthAsTable ? <LineIcon size={12} /> : <Table2 size={12} />}
                    {growthAsTable ? 'Chart' : 'Table'}
                  </button>
                }
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
                  <div style={{ height: 248 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.growth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SERIES_1} stopOpacity={0.22} />
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

            <Card title="Content delivered" hint="Across every screen, since day one">
              <dl className="space-y-3">
                {[
                  { label: 'Playlist loops played', value: compactNumber(data.loopsPlayed) },
                  { label: 'Media files', value: compactNumber(data.mediaFiles) },
                  { label: 'Library size', value: formatBytes(data.libraryBytes) },
                  { label: 'Content runtime', value: formatHours(data.contentSeconds) },
                  { label: 'Playlists built', value: compactNumber(data.playlists) },
                ].map(row => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-slate-50 pb-2.5 last:border-0 last:pb-0">
                    <dt className="text-xs text-slate-500">{row.label}</dt>
                    <dd className="text-sm font-semibold text-slate-900">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Where the screens are" hint={`Top locations of ${data.locations}`}>
              {data.topLocations.length === 0 ? (
                <p className="text-sm text-slate-400">No locations recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
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
                      <span className="w-8 shrink-0 text-right text-xs font-semibold text-slate-700 tabular-nums">
                        {loc.count}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="What's in the library" hint={`${data.mediaFiles} files · ${formatBytes(data.libraryBytes)}`}>
              {mixTotal === 0 ? (
                <p className="text-sm text-slate-400">Nothing uploaded yet.</p>
              ) : (
                <>
                  {/* Part-to-whole at a glance, three segments at most. The 2px
                      gaps are the surface showing through, not borders. */}
                  <div className="flex gap-0.5 h-9 rounded-lg overflow-hidden">
                    {data.mediaMix.map((s, i) => (
                      <div
                        key={s.key}
                        className="h-full flex items-center justify-center first:rounded-l-lg last:rounded-r-lg"
                        style={{
                          width: `${(s.count / mixTotal) * 100}%`,
                          backgroundColor: MIX_COLORS[i % MIX_COLORS.length]
                        }}
                        title={`${s.label}: ${s.count}`}
                      >
                        {/* Only label inside the segment when it actually fits,
                            otherwise the legend below carries the value. */}
                        {(s.count / mixTotal) > 0.12 && (
                          <span className="text-[11px] font-semibold text-white px-1 truncate">
                            {Math.round((s.count / mixTotal) * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Legend is always present for two or more segments, and
                      carries the counts — so identity is never colour alone,
                      and every value is readable without hovering. */}
                  <ul className="mt-3.5 space-y-2">
                    {data.mediaMix.map((s, i) => (
                      <li key={s.key} className="flex items-center gap-2.5 text-xs">
                        <span
                          aria-hidden
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: MIX_COLORS[i % MIX_COLORS.length] }}
                        />
                        <span className="text-slate-600 flex-1 min-w-0 truncate">{s.label}</span>
                        <span className="font-semibold text-slate-800 tabular-nums">{s.count}</span>
                        <span className="text-slate-400 w-16 text-right tabular-nums">{formatBytes(s.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>

          <Card
            title="Who we run screens for"
            hint={`${data.clients} business${data.clients === 1 ? '' : 'es'} · ${data.roster.reduce((n, c) => n + c.screens, 0)} client screens`}
          >
            {data.roster.length === 0 ? (
              <p className="text-sm text-slate-400">No client screens deployed yet.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {data.roster.map(c => (
                  <li key={c.email} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                    {c.logo ? (
                      <img src={c.logo} alt="" className="w-9 h-9 rounded-lg object-contain bg-slate-50 shrink-0" />
                    ) : (
                      <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold flex items-center justify-center shrink-0">
                        {c.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate" title={c.name}>{c.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {c.screens} screen{c.screens === 1 ? '' : 's'}
                        {c.locations > 1 ? ` · ${c.locations} locations` : ''}
                        {c.since ? ` · since ${formatMonthYear(c.since)}` : ''}
                      </p>
                    </div>
                    <span
                      className="text-[11px] font-semibold tabular-nums shrink-0"
                      style={{ color: c.online > 0 ? STATUS_GOOD : AXIS_INK }}
                      title={`${c.online} of ${c.screens} online`}
                    >
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
