/**
 * Sleep mode: times when a screen goes dark (black, silent, nothing playing)
 * and wakes again on its own. Shared by the dashboard and the server; the TV
 * apps carry the same rules (SleepSchedule.kt, tizen/js/sleep.js).
 *
 * Times are India time (IST, UTC+5:30, no daylight saving). A rule whose end
 * is at or before its start runs overnight: "22:00 → 08:00 on Mon" sleeps
 * from Monday 10 pm to Tuesday 8 am.
 */

export type SleepRule = {
  /** 0 = Sunday … 6 = Saturday — the day the sleep starts. */
  days: number[];
  /** "HH:MM", 24-hour. */
  from: string;
  to: string;
};

/** On a screen: follow its group, its own times, or never sleep. */
export type ScreenSleepSchedule = { mode: 'group' | 'custom' | 'off'; rules: SleepRule[] };
/** On a group: applies to every screen in it that follows the group. */
export type GroupSleepSchedule = { enabled: boolean; rules: SleepRule[] };

/** "Sleep now" / "Wake now" from the dashboard, until the schedule next changes (or for good if there's none). */
export type SleepOverride = { state: 'sleep' | 'wake'; until: string | null } | null;

export const IST_OFFSET_MINUTES = 330;
export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
export const DEFAULT_RULE: SleepRule = { days: EVERY_DAY, from: '22:00', to: '08:00' };

const minutesOf = (hhmm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return -1;
  const h = Number(m[1]), mm = Number(m[2]);
  return h < 24 && mm < 60 ? h * 60 + mm : -1;
};

export function isValidRule(r: any): r is SleepRule {
  return !!r && Array.isArray(r.days) && r.days.length > 0 && r.days.every((d: any) => Number.isInteger(d) && d >= 0 && d <= 6)
    && minutesOf(r.from) >= 0 && minutesOf(r.to) >= 0;
}

export function cleanRules(rules: any): SleepRule[] {
  return (Array.isArray(rules) ? rules : []).filter(isValidRule).map(r => ({
    days: Array.from(new Set(r.days as number[])).sort(),
    from: r.from.padStart(5, '0'),
    to: r.to.padStart(5, '0'),
  }));
}

/** IST day of week and minute of day for a moment. */
function istParts(ms: number): { day: number; minute: number } {
  const d = new Date(ms + IST_OFFSET_MINUTES * 60_000);
  return { day: d.getUTCDay(), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
}

export function asleepByRules(rules: SleepRule[], ms: number): boolean {
  const { day, minute } = istParts(ms);
  const yesterday = (day + 6) % 7;
  return rules.some(r => {
    const from = minutesOf(r.from), to = minutesOf(r.to);
    if (from < 0 || to < 0) return false;
    if (from < to) return r.days.includes(day) && minute >= from && minute < to;
    // Overnight (or all day when from == to).
    return (r.days.includes(day) && minute >= from) || (r.days.includes(yesterday) && minute < to);
  });
}

/** The next moment (ms) the schedule switches between asleep and awake, or null if it never does. */
export function nextScheduleChange(rules: SleepRule[], ms: number): number | null {
  if (!rules.length) return null;
  const now = asleepByRules(rules, ms);
  const startOfMinute = ms - (ms % 60_000);
  const { minute } = istParts(startOfMinute);
  const midnight = startOfMinute - minute * 60_000; // IST midnight today
  const marks = new Set<number>();
  for (let day = 0; day <= 8; day++) {
    for (const r of rules) {
      for (const t of [r.from, r.to]) {
        const at = midnight + (day * 1440 + minutesOf(t)) * 60_000;
        if (at > ms) marks.add(at);
      }
    }
  }
  for (const at of Array.from(marks).sort((a, b) => a - b)) {
    if (asleepByRules(rules, at) !== now) return at;
  }
  return null;
}

/** Which rules a screen actually follows — its own, its group's, or none. */
export function effectiveRules(screenSchedule: any, groupSchedule: any): SleepRule[] {
  const mode = screenSchedule?.mode || 'group';
  if (mode === 'off') return [];
  if (mode === 'custom') return cleanRules(screenSchedule.rules);
  return groupSchedule?.enabled ? cleanRules(groupSchedule.rules) : [];
}

export function activeOverride(override: any, ms: number): SleepOverride {
  if (!override || (override.state !== 'sleep' && override.state !== 'wake')) return null;
  if (override.until && new Date(override.until).getTime() <= ms) return null;
  return { state: override.state, until: override.until || null };
}

export type SleepStatus = {
  asleep: boolean;
  /** When it next wakes (if asleep) or next sleeps (if awake); null if nothing is coming. */
  changesAt: string | null;
  /** Set when "Sleep now" / "Wake now" is holding it. */
  manual: boolean;
  scheduled: boolean;
};

export function sleepStatus(rules: SleepRule[], override: any, ms = Date.now()): SleepStatus {
  const o = activeOverride(override, ms);
  const scheduled = rules.length > 0;
  if (o) {
    // The override holds until the schedule's next change; after that the schedule decides.
    const asleep = o.state === 'sleep';
    let changesAt: number | null = o.until ? new Date(o.until).getTime() : null;
    if (changesAt !== null && asleepByRules(rules, changesAt) === asleep) changesAt = nextScheduleChange(rules, changesAt);
    return { asleep, changesAt: changesAt ? new Date(changesAt).toISOString() : null, manual: true, scheduled };
  }
  const asleep = asleepByRules(rules, ms);
  const next = nextScheduleChange(rules, ms);
  return { asleep, changesAt: next ? new Date(next).toISOString() : null, manual: false, scheduled };
}

/** "10:00 PM" */
export function formatTime12(hhmm: string): string {
  const m = minutesOf(hhmm);
  if (m < 0) return hhmm;
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function describeDays(days: number[]): string {
  const s = [...days].sort().join(',');
  if (s === '0,1,2,3,4,5,6') return 'Every day';
  if (s === '1,2,3,4,5') return 'Mon–Fri';
  if (s === '0,6') return 'Weekends';
  return [...days].sort().map(d => DAY_NAMES[d]).join(', ');
}

/** "Every day, 10:00 PM – 8:00 AM" */
export function describeRules(rules: SleepRule[]): string {
  if (!rules.length) return 'No sleep times';
  return rules.map(r => `${describeDays(r.days)}, ${formatTime12(r.from)} – ${formatTime12(r.to)}`).join('; ');
}

/** "8:00 AM" today, or "Tue 8:00 AM" on another day (IST). */
export function formatChangeTime(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime();
  const a = istParts(ms);
  const istDay = (t: number) => Math.floor((t + IST_OFFSET_MINUTES * 60_000) / 86_400_000);
  const sameDay = istDay(ms) === istDay(nowMs);
  const hh = String(Math.floor(a.minute / 60)).padStart(2, '0'), mm = String(a.minute % 60).padStart(2, '0');
  return `${sameDay ? '' : DAY_NAMES[a.day] + ' '}${formatTime12(`${hh}:${mm}`)}`;
}

/** Short line for screen lists: "Sleeping · wakes 8:00 AM". Empty when awake. */
export function sleepingLine(status: SleepStatus | null | undefined): string {
  if (!status?.asleep) return '';
  return status.changesAt ? `Sleeping · wakes ${formatChangeTime(status.changesAt)}` : 'Sleeping';
}

/** Longer text for a screen's details: what it's doing and what happens next. */
export function sleepDetail(status: SleepStatus | null | undefined): string {
  if (!status || (!status.scheduled && !status.manual)) return 'Never sleeps';
  const when = status.changesAt ? formatChangeTime(status.changesAt) : '';
  const how = status.manual ? (status.asleep ? 'Sleep now' : 'Wake now') : '';
  if (status.asleep) return `Asleep${when ? ` until ${when}` : ''}${how ? ` (${how})` : ''}`;
  return `Awake${when ? `, sleeps at ${when}` : ''}${how ? ` (${how})` : ''}`;
}
