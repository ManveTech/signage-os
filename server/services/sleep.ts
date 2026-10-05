import { pb } from '../db';
import { notifyScreenConfigChanged } from './screenPush';
import {
  cleanRules, effectiveRules, activeOverride, sleepStatus, nextScheduleChange, asleepByRules,
  IST_OFFSET_MINUTES, type SleepRule, type SleepStatus,
} from '../../src/lib/sleepSchedule';

/**
 * Sleep mode on the server: which times a screen follows (its own or its
 * group's), "Sleep now / Wake now", what the TV is sent, and whether a
 * screen is asleep right now (shown in the dashboard; no offline alerts).
 */

async function groupSchedule(groupId: string | undefined, cache?: Map<string, any>): Promise<any> {
  if (!groupId) return null;
  if (cache?.has(groupId)) return cache.get(groupId);
  const g: any = await pb.collection('screen_groups').getOne(groupId, { fields: 'id,sleepSchedule' }).catch(() => null);
  const s = g?.sleepSchedule || null;
  cache?.set(groupId, s);
  return s;
}

export async function rulesForScreen(screen: any, cache?: Map<string, any>): Promise<SleepRule[]> {
  const mode = screen?.sleepSchedule?.mode || 'group';
  return effectiveRules(screen?.sleepSchedule, mode === 'group' ? await groupSchedule(screen?.groupId, cache) : null);
}

export async function screenSleepStatus(screen: any, cache?: Map<string, any>): Promise<SleepStatus> {
  return sleepStatus(await rulesForScreen(screen, cache), screen?.sleepOverride);
}

/** Adds `sleepStatus` to screen records for the dashboard. */
export async function annotateSleep(records: any[]): Promise<void> {
  const cache = new Map<string, any>();
  await Promise.all(records.map(async s => { s.sleepStatus = await screenSleepStatus(s, cache).catch(() => null); }));
}

/** What the TV needs to sleep and wake by itself, even if it loses its connection. */
export async function deviceSleepPayload(screen: any) {
  const rules = await rulesForScreen(screen);
  const o = activeOverride(screen?.sleepOverride, Date.now());
  return {
    rules,
    utcOffsetMinutes: IST_OFFSET_MINUTES,
    override: o ? { state: o.state, untilMs: o.until ? new Date(o.until).getTime() : null } : null,
  };
}

/** Tidies a schedule sent by the dashboard. */
export function cleanScreenSchedule(v: any) {
  if (!v || typeof v !== 'object') return null;
  const mode = ['group', 'custom', 'off'].includes(v.mode) ? v.mode : 'group';
  return { mode, rules: cleanRules(v.rules) };
}
export function cleanGroupSchedule(v: any) {
  if (!v || typeof v !== 'object') return null;
  const rules = cleanRules(v.rules);
  return { enabled: !!v.enabled && rules.length > 0, rules };
}

/**
 * POST /screens/:screenId/sleep { action: 'sleep' | 'wake' | 'auto' }.
 * "Sleep now" / "Wake now" hold until the schedule next changes (so a
 * screen put to sleep in the evening stays asleep through its scheduled
 * night and wakes on time); with no schedule they hold until changed back.
 */
export async function applySleepAction(screen: any, action: string): Promise<{ sleepOverride: any; sleepStatus: SleepStatus }> {
  const rules = await rulesForScreen(screen);
  const now = Date.now();
  let override: any = null;
  if (action === 'sleep' || action === 'wake') {
    const want = action === 'sleep';
    // With no schedule, awake is the normal state — only "sleep" needs holding.
    if (rules.length ? asleepByRules(rules, now) !== want : want) {
      const next = nextScheduleChange(rules, now);
      override = { state: action, until: next ? new Date(next).toISOString() : null };
    }
  }
  await pb.collection('screens').update(screen.id, { sleepOverride: override });
  notifyScreenConfigChanged(screen.id);
  return { sleepOverride: override, sleepStatus: sleepStatus(rules, override, now) };
}
