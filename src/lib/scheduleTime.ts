/**
 * Date/time helpers for "switch the playlist at…" scheduling.
 *
 * Everything is India time, because that is what the server's scheduler reads
 * the stored `scheduleDate` / `scheduleTime` pair as. Doing the comparison in
 * the browser's own zone would let a user abroad book a time the server then
 * treats as already past.
 *
 * These used to live inside SchedulerView, which is why that one page refused
 * past times and the group and screen schedulers happily accepted them.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch ms for a date + time entered as India time. */
export const istToEpoch = (date: string, time: string) =>
  Date.parse(`${date}T${(time || '').slice(0, 5)}:00+05:30`);

/** Date/time fields (India time) for an epoch. */
export const epochToIst = (ms: number) => {
  const d = new Date(ms + IST_OFFSET_MS);
  return {
    date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
  };
};

/** Today in India — the earliest date a `<input type="date">` should accept. */
export const todayIst = () => epochToIst(Date.now()).date;

/**
 * Why this date/time can't be scheduled, or '' if it's fine.
 *
 * A date alone is not enough to judge: "today" is valid until the clock passes
 * the time entered, so both fields are needed before this can say anything.
 */
export function scheduleError(date?: string, time?: string): string {
  if (!date || !time) return 'Pick a date and time';
  const at = istToEpoch(date, time);
  if (!Number.isFinite(at)) return "That date isn't valid";
  if (at <= Date.now()) return 'That time has already passed';
  return '';
}
