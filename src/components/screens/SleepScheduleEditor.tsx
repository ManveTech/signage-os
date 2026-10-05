import { Moon, Plus, Trash2 } from 'lucide-react';
import {
  DAY_NAMES, DEFAULT_RULE, describeRules, cleanRules,
  type SleepRule, type ScreenSleepSchedule, type GroupSleepSchedule,
} from '../../lib/sleepSchedule';

/**
 * Sleep times for a screen or a group. A screen can follow its group's
 * times, have its own, or never sleep; a group's times apply to every screen
 * in it that follows the group. Times are India time.
 */

type Props =
  | { kind: 'screen'; value: ScreenSleepSchedule | null | undefined; onChange: (v: ScreenSleepSchedule) => void; groupName?: string; groupSchedule?: GroupSleepSchedule | null }
  | { kind: 'group'; value: GroupSleepSchedule | null | undefined; onChange: (v: GroupSleepSchedule) => void };

function RulesEditor({ rules, onChange }: { rules: SleepRule[]; onChange: (r: SleepRule[]) => void }) {
  const set = (i: number, patch: Partial<SleepRule>) => onChange(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2.5">
      {rules.map((r, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Sleep at</span>
              <input
                type="time"
                value={r.from}
                onChange={e => set(i, { from: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="flex-1 min-w-0">
              <span className="block text-[11px] font-medium text-slate-500 mb-1">Wake at</span>
              <input
                type="time"
                value={r.to}
                onChange={e => set(i, { to: e.target.value })}
                className="w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-400"
              />
            </label>
            {rules.length > 1 && (
              <button
                type="button"
                onClick={() => onChange(rules.filter((_, j) => j !== i))}
                className="self-end p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                aria-label="Remove these times"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
            {DAY_NAMES.map((d, day) => {
              const on = r.days.includes(day);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set(i, { days: on ? r.days.filter(x => x !== day) : [...r.days, day].sort() })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {r.days.length === 0 && <p className="text-[11px] text-rose-600">Pick at least one day.</p>}
          {r.to <= r.from && r.days.length > 0 && (
            <p className="text-[11px] text-slate-500">Overnight: wakes the next morning.</p>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rules, { ...DEFAULT_RULE, days: [0, 6], from: '20:00', to: '10:00' }])}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
      >
        <Plus size={14} /> Add different times for other days
      </button>
    </div>
  );
}

export default function SleepScheduleEditor(props: Props) {
  const header = (
    <div className="flex items-start gap-2">
      <Moon size={15} className="text-indigo-500 mt-0.5 shrink-0" />
      <div>
        <span className="text-xs font-semibold text-gray-700 block">Sleep schedule</span>
        <span className="text-[11px] text-gray-400">The screen goes dark and silent, then wakes by itself. India time.</span>
      </div>
    </div>
  );

  if (props.kind === 'group') {
    const v = props.value || { enabled: false, rules: [] };
    const rules = v.rules?.length ? v.rules : [DEFAULT_RULE];
    return (
      <div className="border-t border-gray-100 pt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          {header}
          <input
            type="checkbox"
            checked={!!v.enabled}
            onChange={e => props.onChange({ enabled: e.target.checked, rules })}
            className="w-4 h-4 rounded accent-blue-600 cursor-pointer shrink-0"
            aria-label="Sleep on a schedule"
          />
        </div>
        {v.enabled && (
          <>
            <RulesEditor rules={rules} onChange={r => props.onChange({ enabled: true, rules: r })} />
            <p className="text-[11px] text-gray-400">Applies to every screen in this group, unless a screen has its own sleep times.</p>
          </>
        )}
      </div>
    );
  }

  const v = props.value || { mode: 'group' as const, rules: [] };
  const mode = v.mode || 'group';
  const groupActive = !!props.groupName && !!props.groupSchedule?.enabled && cleanRules(props.groupSchedule.rules).length > 0;
  const rules = v.rules?.length ? v.rules : [DEFAULT_RULE];
  const options: { value: ScreenSleepSchedule['mode']; label: string }[] = [
    { value: 'group', label: props.groupName ? 'Same as group' : 'Never' },
    { value: 'custom', label: 'Own times' },
    ...(props.groupName ? [{ value: 'off' as const, label: 'Never' }] : []),
  ];
  // Without a group, "group" and "off" both mean never sleeping.
  const selected = !props.groupName && mode === 'off' ? 'group' : mode;
  return (
    <div className="border-t border-gray-100 pt-4 space-y-3">
      {header}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected === o.value}
            onClick={() => props.onChange({ mode: o.value, rules: o.value === 'custom' ? rules : (v.rules || []) })}
            className={`py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${selected === o.value ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {mode === 'group' && props.groupName && (
        <p className="text-[11px] text-gray-500">
          {groupActive
            ? <>Group <strong>{props.groupName}</strong>: {describeRules(cleanRules(props.groupSchedule!.rules))}.</>
            : <>Group <strong>{props.groupName}</strong> has no sleep times, so this screen stays on.</>}
        </p>
      )}
      {mode === 'custom' && (
        <RulesEditor rules={rules} onChange={r => props.onChange({ mode: 'custom', rules: r })} />
      )}
    </div>
  );
}
