import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Plus, Monitor, ArrowRight, Pencil, X, CalendarX, AlertCircle } from 'lucide-react';
import ScreenDetailsSheet from '../screens/ScreenDetailsSheet';
import ConfirmDialog from '../screens/ConfirmDialog';
import CustomSelect from '../CustomSelect';
import { toast } from '../Toast';
import { mediaStore, Playlist, Screen } from '../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../lib/syncHelper';

/**
 * Scheduled playlist switches: "at this date and time, switch this screen to
 * that playlist". One switch per screen; the server runs it on time (India
 * time — screens have no time zone of their own) even if nobody has the
 * dashboard open.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Epoch ms for a date + time entered as India time. */
const istToEpoch = (date: string, time: string) => Date.parse(`${date}T${time.slice(0, 5)}:00+05:30`);
/** Date/time fields (India time) for an epoch. */
const epochToIst = (ms: number) => {
  const d = new Date(ms + IST_OFFSET_MS);
  return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
};

function when(date: string, time: string) {
  const at = istToEpoch(date, time);
  if (!Number.isFinite(at)) return { label: `${date} ${time}`, relative: '', past: false };
  const d = new Date(at + IST_OFFSET_MS);
  const today = epochToIst(Date.now()).date;
  const tomorrow = epochToIst(Date.now() + 86400000).date;
  const day = date === today ? 'Today' : date === tomorrow ? 'Tomorrow'
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const clock = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
  const diff = at - Date.now();
  const mins = Math.round(diff / 60000);
  const relative = diff <= 0 ? 'due now'
    : mins < 60 ? `in ${mins} min`
    : mins < 60 * 24 ? `in ${Math.round(mins / 60)} h`
    : `in ${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? '' : 's'}`;
  return { label: `${day}, ${clock}`, relative, past: diff <= 0 };
}

/** Quick picks for common switch times (India time). */
function quickPicks() {
  const now = Date.now();
  const today = epochToIst(now).date;
  const tomorrow = epochToIst(now + 86400000).date;
  const picks: { label: string; date: string; time: string }[] = [];
  if (istToEpoch(today, '18:00') > now + 5 * 60000) picks.push({ label: 'Today 6 PM', date: today, time: '18:00' });
  picks.push({ label: 'Tomorrow 9 AM', date: tomorrow, time: '09:00' });
  // Next Monday 9 AM
  const dow = new Date(now + IST_OFFSET_MS).getUTCDay();
  const toMonday = ((8 - dow) % 7) || 7;
  picks.push({ label: 'Monday 9 AM', date: epochToIst(now + toMonday * 86400000).date, time: '09:00' });
  return picks;
}

const isPlayable = (s: Screen) => s.status !== 'pairing' && s.status !== 'unlinked';

export default function SchedulerView({ userEmail, isAdmin = false }: { userEmail: string; isAdmin?: boolean }) {
  const [screens, setScreens] = useState<Screen[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [orgs, setOrgs] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ screenId: string; playlistId: string; date: string; time: string; isNew: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Screen | null>(null);

  const load = () => {
    const all = mediaStore.getScreens().filter(isPlayable);
    setScreens(isAdmin ? all : all.filter(s => s.assignedToUserEmail === userEmail));
    setPlaylists(mediaStore.getPlaylists());
  };

  useEffect(() => {
    load();
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('playlists', 'signageos_playlists'),
      ...(isAdmin ? [syncCollection('organizations', 'signageos_organizations').then(o => { if (o.length) setOrgs(o); })] : []),
    ]).finally(() => { load(); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const ownerName = (email?: string) => {
    if (!email || email === userEmail) return isAdmin ? 'Your screen' : '';
    return orgs.find((o: any) => o.email === email)?.name || email;
  };

  /** Schedules store the playlist id; older ones stored its name. */
  const playlistFor = (value?: string) => value ? playlists.find(p => p.id === value) || playlists.find(p => p.name === value) : undefined;
  const playlistLabel = (value?: string) => playlistFor(value)?.name || value || '';

  /** Playlists that may run on a screen: its owner's, plus the admin's own. */
  const playlistsFor = (screen?: Screen) => {
    if (!screen) return [];
    const owner = screen.assignedToUserEmail || userEmail;
    return playlists.filter(p => p.createdBy === owner || (isAdmin && (p.createdBy === userEmail || p.createdBy === 'admin')));
  };

  const scheduled = useMemo(() => screens
    .filter(s => s.schedulePlaylist && s.scheduleDate && s.scheduleTime)
    .sort((a, b) => istToEpoch(a.scheduleDate!, a.scheduleTime!) - istToEpoch(b.scheduleDate!, b.scheduleTime!)),
  [screens]);

  const startNew = () => {
    const tomorrow = epochToIst(Date.now() + 86400000).date;
    setEditing({ screenId: '', playlistId: '', date: tomorrow, time: '09:00', isNew: true });
  };

  const startEdit = (s: Screen) => setEditing({
    screenId: s.id,
    playlistId: playlistFor(s.schedulePlaylist)?.id || '',
    date: s.scheduleDate || '',
    time: (s.scheduleTime || '').slice(0, 5),
    isNew: false
  });

  const writeSchedule = async (screen: Screen, fields: { schedulePlaylist: string; scheduleDate: string; scheduleTime: string }) => {
    const res = await pushToDatabase('screens', screen.id, fields, 'PUT');
    if (!res.ok) return false;
    mediaStore.saveScreens(mediaStore.getScreens().map(s => (s.id === screen.id ? { ...s, ...fields } : s)));
    load();
    return true;
  };

  const editingScreen = editing ? screens.find(s => s.id === editing.screenId) : undefined;
  const editingWhen = editing && editing.date && editing.time ? istToEpoch(editing.date, editing.time) : NaN;
  const formError = !editing ? ''
    : !editing.screenId ? 'Choose a screen'
    : !editing.playlistId ? 'Choose a playlist'
    : !editing.date || !editing.time ? 'Pick a date and time'
    : !Number.isFinite(editingWhen) ? 'That date isn\'t valid'
    : editingWhen <= Date.now() ? 'That time has already passed'
    : '';
  const replacing = editing?.isNew && editingScreen?.schedulePlaylist ? editingScreen : null;

  const save = async () => {
    if (!editing || formError || !editingScreen) return;
    setSaving(true);
    const ok = await writeSchedule(editingScreen, {
      schedulePlaylist: editing.playlistId,
      scheduleDate: editing.date,
      scheduleTime: editing.time
    });
    setSaving(false);
    if (ok) {
      toast.success(`"${editingScreen.name}" will switch ${when(editing.date, editing.time).label.toLowerCase()}`);
      setEditing(null);
    } else {
      toast.error('Couldn\'t save the schedule — check your connection and try again');
    }
  };

  const cancelSchedule = async (screen: Screen) => {
    const ok = await writeSchedule(screen, { schedulePlaylist: '', scheduleDate: '', scheduleTime: '' });
    setCancelTarget(null);
    if (ok) toast.success(`Switch on "${screen.name}" cancelled`);
    else toast.error('Couldn\'t cancel — check your connection and try again');
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Scheduler</h1>
          <p className="text-sm text-gray-500 mt-0.5">Switch a screen to another playlist at a set time</p>
        </div>
        {screens.length > 0 && (
          <button
            onClick={startNew}
            className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"
          >
            <Plus size={15} /> Schedule a switch
          </button>
        )}
      </div>

      {scheduled.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500">
            {scheduled.length} upcoming · times are India time (IST)
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {scheduled.map(s => {
              const w = when(s.scheduleDate!, s.scheduleTime!);
              const owner = ownerName(s.assignedToUserEmail);
              return (
                <div key={s.id} className="bg-white rounded-2xl border border-slate-100 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <CalendarClock size={19} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{w.label}</span>
                      <span className={`text-xs ${w.past ? 'text-amber-600' : 'text-slate-500'}`}>{w.relative}</span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 flex items-center gap-1.5 min-w-0">
                      <Monitor size={13} className="text-slate-400 shrink-0" />
                      <span className="truncate">{s.name}{owner && isAdmin ? <span className="text-slate-400"> · {owner}</span> : null}</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{s.playlist || 'Nothing playing'}</span>
                      <ArrowRight size={12} className="shrink-0 text-slate-400" />
                      <span className="truncate font-medium text-blue-700">{playlistLabel(s.schedulePlaylist)}</span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(s)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label={`Edit the switch on ${s.name}`}>
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => setCancelTarget(s)} className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600" aria-label={`Cancel the switch on ${s.name}`}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && scheduled.length === 0 && (
        <div className="py-14 px-6 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <CalendarClock size={32} className="mx-auto text-blue-500 mb-2" />
          {screens.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-gray-800">Nothing scheduled</p>
              <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                Plan ahead — e.g. switch the lobby screen to your evening playlist at 6 PM. The switch happens on time even if the dashboard is closed.
              </p>
              <button
                onClick={startNew}
                className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"
              >
                <Plus size={15} /> Schedule a switch
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-gray-800">No screens yet</p>
              <p className="text-xs text-gray-500 mt-1">Connect a screen first, then you can schedule what it plays.</p>
            </>
          )}
        </div>
      )}

      {editing && (
        <ScreenDetailsSheet
          open
          onClose={() => setEditing(null)}
          title={editing.isNew ? 'Schedule a switch' : 'Edit switch'}
          subtitle="Times are India time (IST)"
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Screen</span>
                <CustomSelect
                  value={editing.screenId}
                  onChange={v => setEditing(e => e && ({ ...e, screenId: v, playlistId: '' }))}
                  placeholder="Choose a screen"
                  disabled={!editing.isNew}
                  options={screens
                    .map(s => ({ value: s.id, label: isAdmin && ownerName(s.assignedToUserEmail) ? `${s.name} · ${ownerName(s.assignedToUserEmail)}` : s.name }))
                    .sort((a, b) => a.label.localeCompare(b.label))}
                  buttonClassName="h-11 text-sm px-3"
                />
                {replacing && (
                  <span className="flex items-start gap-1.5 text-xs text-amber-700 mt-1.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    This replaces its switch to “{playlistLabel(replacing.schedulePlaylist)}” — a screen has one switch at a time.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">Switch to</span>
                <CustomSelect
                  value={editing.playlistId}
                  onChange={v => setEditing(e => e && ({ ...e, playlistId: v }))}
                  placeholder={editing.screenId ? 'Choose a playlist' : 'Choose a screen first'}
                  disabled={!editing.screenId}
                  options={playlistsFor(editingScreen).map(p => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label))}
                  buttonClassName="h-11 text-sm px-3"
                />
                {editingScreen && playlistsFor(editingScreen).length === 0 && (
                  <span className="block text-xs text-slate-500 mt-1.5">No playlists for this screen yet — create one first.</span>
                )}
                {editingScreen?.playlist && (
                  <span className="block text-xs text-slate-500 mt-1.5">Now playing: {editingScreen.playlist}</span>
                )}
              </label>

              <div>
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">When</span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar mb-2">
                  {quickPicks().map(p => {
                    const active = editing.date === p.date && editing.time === p.time;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setEditing(e => e && ({ ...e, date: p.date, time: p.time }))}
                        className={`shrink-0 h-8 px-3 rounded-full border text-xs font-semibold ${
                          active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={editing.date}
                    min={epochToIst(Date.now()).date}
                    onChange={e => setEditing(x => x && ({ ...x, date: e.target.value }))}
                    className="h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white"
                    aria-label="Date"
                  />
                  <input
                    type="time"
                    value={editing.time}
                    onChange={e => setEditing(x => x && ({ ...x, time: e.target.value }))}
                    className="h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white"
                    aria-label="Time"
                  />
                </div>
                {Number.isFinite(editingWhen) && editingWhen > Date.now() && (
                  <span className="block text-xs text-slate-500 mt-1.5">
                    {when(editing.date, editing.time).label} · {when(editing.date, editing.time).relative}
                  </span>
                )}
              </div>
            </div>
          }
          footer={
            <div className="space-y-2">
              {formError && editing.screenId && editing.playlistId && (
                <p className="text-xs text-rose-600 flex items-center gap-1.5"><AlertCircle size={13} /> {formError}</p>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={!!formError || saving}
                  className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  {saving ? 'Saving…' : editing.isNew ? 'Schedule switch' : 'Save changes'}
                </button>
              </div>
            </div>
          }
        />
      )}

      {cancelTarget && (
        <ConfirmDialog
          title="Cancel this switch?"
          body={
            <p className="flex items-start gap-1.5">
              <CalendarX size={15} className="mt-0.5 shrink-0 text-slate-400" />
              “{cancelTarget.name}” will keep playing {cancelTarget.playlist ? `“${cancelTarget.playlist}”` : 'what it plays now'}.
            </p>
          }
          confirmLabel="Cancel switch"
          tone="danger"
          onCancel={() => setCancelTarget(null)}
          onConfirm={() => cancelSchedule(cancelTarget)}
        />
      )}
    </div>
  );
}
