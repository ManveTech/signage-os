/**
 * The numbers behind the Business Overview page.
 *
 * Kept apart from the view because this is arithmetic over the whole network
 * and is worth testing on its own — and because the view should not be where
 * decisions like "a screen showing a pairing code isn't deployed yet" live.
 *
 * Deliberately no money. The page exists to be shown to a client sitting
 * across the table, so it answers "is this platform real and reliable?" and
 * never "what do we earn?".
 */

import { stateFromLocation } from './indiaStates';

export type MonthPoint = { month: string; label: string; screens: number; clients: number; media: number };
export type StateCount = { state: string; count: number; clients: number };
export type Slice = { key: string; label: string; count: number; bytes: number };
export type ClientRow = {
  email: string;
  name: string;
  logo: string;
  screens: number;
  online: number;
  locations: number;
  since: string;
};

export type Overview = {
  screensDeployed: number;
  screensOnline: number;
  onlinePct: number;
  uptimeSeconds: number;
  loopsPlayed: number;
  clients: number;
  locations: number;
  mediaFiles: number;
  libraryBytes: number;
  contentSeconds: number;
  playlists: number;
  growth: MonthPoint[];
  clientTrends: ClientTrend[];
  mediaAdded: { month: string; label: string; count: number }[];
  topLocations: { name: string; count: number }[];
  /** Every location worth a tile in the treemap, with a folded tail. */
  locationTree: { name: string; size: number }[];
  /** Screens per Indian state, and how many had no state to read. */
  stateCounts: StateCount[];
  unplacedScreens: number;
  mediaMix: Slice[];
  roster: ClientRow[];
  /** Every deployed screen as a status cell, for the grid. */
  statusCells: { id: string; name: string; client: string; online: boolean }[];
};

const ONLINE = new Set(['online', 'active']);

/** A screen somebody owns and has paired — not a TV sitting on a pairing code. */
export function isDeployed(s: any): boolean {
  return s.status !== 'pairing' && s.status !== 'unlinked' && !!s.assignedToUserEmail;
}

export function isOnline(s: any): boolean {
  return ONLINE.has(String(s.status));
}

/**
 * Seconds this screen has ever been playing, including the session it is in
 * right now — cumulativeUptime is only banked when a screen goes offline, so
 * leaving it out would make a network that is currently up look idle.
 */
export function uptimeSeconds(s: any): number {
  let total = Number(s.cumulativeUptime) || 0;
  if (isOnline(s) && s.onlineSince) {
    const session = Math.floor((Date.now() - new Date(s.onlineSince).getTime()) / 1000);
    if (session > 0) total += session;
  }
  return total;
}

const createdAt = (r: any): string => String(r?.created || r?.createdDate || '').replace(' ', 'T');

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Cumulative totals at the end of each of the last `months` months — the
 * count of everything deployed up to that point, not what was added during
 * it. A showcase wants the line that rises, and a month where nothing was
 * installed should read as flat rather than as a drop to zero.
 *
 * A record with no creation date is counted in the running total but never
 * attributed to a month, so the final figure still matches the headline.
 */
export function buildGrowth(
  screens: any[], roster: ClientRow[], media: any[], months = 12
): MonthPoint[] {
  const now = new Date();
  const screenTimes = screens.map(s => new Date(createdAt(s)).getTime());
  const clientTimes = roster.map(c => new Date(c.since).getTime());
  const mediaTimes = media.map(m => new Date(createdAt(m)).getTime());
  const upTo = (times: number[], end: number) =>
    times.filter(t => Number.isFinite(t) && t < end).length;

  const points: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    points.push({
      month: monthKey(d),
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      screens: upTo(screenTimes, end),
      clients: upTo(clientTimes, end),
      media: upTo(mediaTimes, end)
    });
  }
  return points;
}

/**
 * How much a series grew over the window — the figure a stat tile's delta
 * shows. Returns null when there is no earlier point to compare against, so
 * the tile can leave the delta off rather than claim a rise from zero.
 */
export function deltaOver(series: number[]): number | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === last) return 0;
  return last - first;
}

/** Every client with at least one deployed screen, biggest first. */
export function buildRoster(deployed: any[], orgs: any[]): ClientRow[] {
  const byEmail = new Map<string, any[]>();
  for (const s of deployed) {
    const email = String(s.assignedToUserEmail || '').toLowerCase();
    if (!email) continue;
    const list = byEmail.get(email);
    if (list) list.push(s); else byEmail.set(email, [s]);
  }

  const orgByEmail = new Map<string, any>();
  for (const o of orgs) {
    const email = String(o?.email || '').toLowerCase();
    if (email) orgByEmail.set(email, o);
  }

  const rows: ClientRow[] = [];
  for (const [email, list] of byEmail) {
    const org = orgByEmail.get(email);
    // The org record is the better source for a name and a logo, but a client
    // can have screens before anyone fills one in — so fall back to the name
    // on the screen record, then to the email, rather than dropping the row.
    const name = org?.name || org?.adminName || list.find(s => s.websiteName)?.websiteName || email;
    const logo = org?.websiteLogo || list.find(s => s.websiteLogo)?.websiteLogo || '';
    const dates = [createdAt(org), ...list.map(createdAt)]
      .filter(d => Number.isFinite(new Date(d).getTime()) && d);
    rows.push({
      email,
      name: String(name),
      logo: String(logo),
      screens: list.length,
      online: list.filter(isOnline).length,
      locations: new Set(list.map(s => String(s.location || '').trim()).filter(Boolean)).size,
      since: dates.sort()[0] || ''
    });
  }

  return rows.sort((a, b) => b.screens - a.screens || a.name.localeCompare(b.name));
}

const TYPE_LABELS: Record<string, string> = {
  image: 'Images',
  video: 'Videos',
  layout: 'Layouts',
  ticker: 'Tickers'
};

/** Media broken down by kind, biggest first, with everything unusual folded in. */
export function buildMediaMix(media: any[]): Slice[] {
  const byType = new Map<string, Slice>();
  for (const m of media) {
    const key = String(m?.type || 'other');
    const slice = byType.get(key) || { key, label: TYPE_LABELS[key] || 'Other', count: 0, bytes: 0 };
    slice.count++;
    slice.bytes += Number(m?.fileSizeBytes) || 0;
    byType.set(key, slice);
  }
  const all = [...byType.values()].sort((a, b) => b.count - a.count);

  // Never more hues than the palette validates for. Past three, the tail
  // becomes one "Other" segment rather than a generated colour.
  if (all.length <= 3) return all;
  const head = all.slice(0, 2);
  const tail = all.slice(2);
  return [
    ...head,
    {
      key: 'other',
      label: 'Other',
      count: tail.reduce((n, s) => n + s.count, 0),
      bytes: tail.reduce((n, s) => n + s.bytes, 0)
    }
  ];
}

/**
 * Each client's screen count at the end of each month — the lines of the
 * growth chart.
 *
 * Every line is in the same unit on the same axis, which is the whole reason
 * this is one chart: plotting screens against, say, playback hours would need
 * a second y-scale, and the alignment of two scales is arbitrary, so the chart
 * would invent a relationship that isn't in the data.
 *
 * Only the biggest `top` clients get a line of their own. The rest are summed
 * into "Other" rather than given generated colours, which stop being
 * distinguishable past the palette's slots.
 */
export type ClientTrend = { name: string; values: number[] };

export function buildClientTrends(
  clientScreens: any[], roster: ClientRow[], months = 12, top = 5
): ClientTrend[] {
  if (roster.length === 0) return [];
  const now = new Date();
  const ends: number[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    ends.push(new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime());
  }

  const timesByEmail = new Map<string, number[]>();
  for (const s of clientScreens) {
    const email = String(s.assignedToUserEmail || '').toLowerCase();
    if (!email) continue;
    const t = new Date(createdAt(s)).getTime();
    if (!Number.isFinite(t)) continue;
    const list = timesByEmail.get(email);
    if (list) list.push(t); else timesByEmail.set(email, [t]);
  }

  const countsFor = (emails: string[]) => ends.map(end =>
    emails.reduce((n, e) => n + (timesByEmail.get(e) || []).filter(t => t < end).length, 0));

  const head = roster.slice(0, top);
  const tail = roster.slice(top);
  const trends: ClientTrend[] = head.map(c => ({ name: c.name, values: countsFor([c.email]) }));
  if (tail.length === 1) {
    // Exactly one left over: naming it costs the same line and reads better
    // than "1 others" — there is nothing to summarise.
    trends.push({ name: tail[0].name, values: countsFor([tail[0].email]) });
  } else if (tail.length > 1) {
    trends.push({ name: `${tail.length} others`, values: countsFor(tail.map(c => c.email)) });
  }
  return trends;
}

/**
 * How much media was added in each month — a count per month, not a running
 * total, so a quiet month reads as a short column rather than a flat line.
 */
export function buildMediaAdded(media: any[], months = 12): { month: string; label: string; count: number }[] {
  const now = new Date();
  const out: { month: string; label: string; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    out.push({
      month: monthKey(d),
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      count: media.filter(m => {
        const t = new Date(createdAt(m)).getTime();
        return Number.isFinite(t) && t >= start && t < end;
      }).length
    });
  }
  return out;
}

export function buildTopLocations(deployed: any[], limit = 6): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const s of deployed) {
    const name = String(s.location || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/**
 * Locations as treemap tiles, biggest first. A long tail of one-screen sites
 * would be a row of slivers too thin to label, so past `limit` they become a
 * single "N more locations" tile that still carries their screens.
 */
export function buildLocationTree(deployed: any[], limit = 12): { name: string; size: number }[] {
  const all = buildTopLocations(deployed, Number.MAX_SAFE_INTEGER);
  if (all.length <= limit) return all.map(l => ({ name: l.name, size: l.count }));
  const head = all.slice(0, limit - 1);
  const tail = all.slice(limit - 1);
  return [
    ...head.map(l => ({ name: l.name, size: l.count })),
    { name: `${tail.length} more locations`, size: tail.reduce((n, l) => n + l.count, 0) }
  ];
}

/**
 * Screens per state, for the map, plus however many could not be placed.
 *
 * The unplaced count is returned rather than swallowed: a map that quietly
 * drops a third of the estate because those screens predate the "City, State"
 * location format would overstate nothing and understate everything, and the
 * reader would have no way to tell.
 */
export function buildStateCounts(deployed: any[]): { states: StateCount[]; unplaced: number } {
  const byState = new Map<string, { count: number; clients: Set<string> }>();
  let unplaced = 0;

  for (const s of deployed) {
    const state = stateFromLocation(s.location);
    if (!state) { unplaced++; continue; }
    const entry = byState.get(state) || { count: 0, clients: new Set<string>() };
    entry.count++;
    const owner = String(s.assignedToUserEmail || '').toLowerCase();
    if (owner) entry.clients.add(owner);
    byState.set(state, entry);
  }

  const states = [...byState.entries()]
    .map(([state, v]) => ({ state, count: v.count, clients: v.clients.size }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));

  return { states, unplaced };
}

export function computeOverview(input: {
  screens: any[];
  media: any[];
  playlists: any[];
  orgs: any[];
  /** From lib/adminOwnership — tells our own display estate from a client's. */
  isOurs: (email?: string) => boolean;
}): Overview {
  const deployed = input.screens.filter(isDeployed);
  const clientScreens = deployed.filter(s => !input.isOurs(s.assignedToUserEmail));
  const roster = buildRoster(clientScreens, input.orgs);

  const online = deployed.filter(isOnline).length;
  const { states, unplaced } = buildStateCounts(deployed);

  return {
    stateCounts: states,
    unplacedScreens: unplaced,
    screensDeployed: deployed.length,
    screensOnline: online,
    onlinePct: deployed.length > 0 ? Math.round((online / deployed.length) * 100) : 0,
    uptimeSeconds: deployed.reduce((n, s) => n + uptimeSeconds(s), 0),
    loopsPlayed: deployed.reduce((n, s) => n + (Number(s.cumulativeLoops) || 0), 0),
    clients: roster.length,
    locations: new Set(deployed.map(s => String(s.location || '').trim()).filter(Boolean)).size,
    mediaFiles: input.media.length,
    libraryBytes: input.media.reduce((n, m) => n + (Number(m?.fileSizeBytes) || 0), 0),
    contentSeconds: input.media.reduce((n, m) => n + (Number(m?.duration) || 0), 0),
    playlists: input.playlists.length,
    growth: buildGrowth(clientScreens, roster, input.media),
    // Eight rather than the default five: these are drawn as small multiples,
    // one panel each in a single hue, so the number of clients shown is no
    // longer limited by how many colours can be told apart.
    clientTrends: buildClientTrends(clientScreens, roster, 12, 8),
    mediaAdded: buildMediaAdded(input.media),
    topLocations: buildTopLocations(deployed),
    locationTree: buildLocationTree(deployed),
    mediaMix: buildMediaMix(input.media),
    roster,
    statusCells: deployed.map(s => ({
      id: String(s.id),
      name: String(s.name || 'Screen'),
      client: String(s.assignedToUserEmail || ''),
      online: isOnline(s)
    }))
  };
}

// --- Formatting --------------------------------------------------------------

/** 12400 -> "12.4K". Big numbers are the point of this page; nine digits are not. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const tb = bytes / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(1)} TB`;
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

/** Playback totals run to years, so this stops at the two units that matter. */
export function formatHours(totalSeconds: number): string {
  const hours = Math.floor((Number(totalSeconds) || 0) / 3600);
  if (hours < 1) return `${Math.max(0, Math.floor((Number(totalSeconds) || 0) / 60))}m`;
  if (hours < 1000) return `${hours}h`;
  // "69Kh" runs the magnitude and the unit together into something unreadable
  // at tile size, so the compact form takes a spaced unit instead.
  return `${compactNumber(hours)} hrs`;
}

export function formatMonthYear(iso: string): string {
  const d = new Date(String(iso).replace(' ', 'T'));
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}
