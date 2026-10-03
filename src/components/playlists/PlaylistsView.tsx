import { useEffect, useState } from 'react';
import { Plus, Search, ListVideo, Play, Pause, Edit, Trash2, ChevronRight, CheckCircle, Trash, Monitor, Layers, Building2, Check } from 'lucide-react';
import { mediaStore, Playlist, Screen } from '../../lib/mediaStore';
import { syncCollection } from '../../lib/syncHelper';
import ScreenDetailsSheet from '../screens/ScreenDetailsSheet';
import ConfirmDialog from '../screens/ConfirmDialog';
import MediaThumb from '../media/MediaThumb';
import { toast } from '../Toast';
import CustomSelect from '../CustomSelect';
import { licensingStore } from '../../lib/licensingStore';

function formatDuration(totalSeconds: number): string {
  if (!totalSeconds) return '0s';
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return s ? `${m}m ${s}s` : `${m} min`;
}

const TRANSITION_LABELS: Record<string, string> = {
  fade: 'Fade', slide: 'Slide', zoom: 'Zoom', 'slide-up': 'Slide up', 'slide-down': 'Slide down',
  flip: 'Flip', spin: 'Spin', blur: 'Blur', bounce: 'Bounce', wipe: 'Wipe'
};

/**
 * Playlist list shared by the admin "My Channel", admin "Client Playlists"
 * and client playlist pages: compact cards (cover thumbnail, slide count,
 * length, where it plays) that open a details sheet with the playlist's
 * slides and actions.
 *
 * scope="clients" is the admin's view of playlists owned by client
 * accounts: it adds a client filter and shows whose playlist each one is.
 */
export default function PlaylistsView({
  userEmail,
  title,
  subtitle,
  createView,
  onNavigate,
  allowBulkDelete = false,
  scope = 'mine',
  screensView = 'my-screens-list',
  groupsView
}: {
  userEmail: string;
  title: string;
  subtitle: string;
  /** View id of the create/edit playlist page. */
  createView: string;
  onNavigate: (view: string) => void;
  allowBulkDelete?: boolean;
  scope?: 'mine' | 'clients';
  /** View id of the screens list ("Assign to screens" fallback link). */
  screensView?: string;
  /** View id of the screen groups page. */
  groupsView?: string;
}) {
  const isOwn = (p: Playlist) => (scope === 'mine'
    ? p.createdBy === userEmail
    : !!p.createdBy && p.createdBy !== userEmail && p.createdBy !== 'admin');
  const [playlists, setPlaylists] = useState<Playlist[]>(() => mediaStore.getPlaylists().filter(isOwn));
  const [screens, setScreens] = useState<Screen[]>(() => mediaStore.getScreens());
  const [groups, setGroups] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_groups') || '[]'));
  const [media, setMedia] = useState<any[]>(() => mediaStore.getMedia());
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [clientFilter, setClientFilter] = useState('all');
  const [pickerFor, setPickerFor] = useState<Playlist | null>(null);
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);
  const [orgs, setOrgs] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));

  const reload = () => {
    setPlaylists(mediaStore.getPlaylists().filter(isOwn));
    setScreens(mediaStore.getScreens());
    setMedia(mediaStore.getMedia());
  };

  useEffect(() => {
    reload();
    Promise.all([
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('screen_groups', 'signageos_groups').then(g => { if (g.length) setGroups(g); }),
      ...(scope === 'clients' ? [
        syncCollection('organizations', 'signageos_organizations').then(o => { if (o.length) setOrgs(o); }),
        syncCollection('licenses', 'signageos_licenses'),
      ] : []),
    ]).then(reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, scope]);

  // "Organisation name" for a client account, falling back to the email.
  const licenses = scope === 'clients' ? licensingStore.getLicenses() : [];
  const ownerName = (email?: string) => {
    if (!email) return 'Unknown client';
    const org = orgs.find((o: any) => o.email === email);
    if (org?.name) return org.name;
    const lic = licenses.find(l => l.assignedUserEmail === email && l.assignedOrgName);
    return lic?.assignedOrgName || email;
  };
  const owners = Array.from(new Set(playlists.map(p => p.createdBy).filter(Boolean))) as string[];

  const mediaById = new Map(media.map((m: any) => [m.id, m]));
  const slidesOf = (p: Playlist) => (p.slides && p.slides.length ? p.slides : (p.mediaIds || []).map((id, i) => ({ id: `${id}-${i}`, mediaId: id, duration: 10, layoutType: 'single' as const })));
  const lengthOf = (p: Playlist) => slidesOf(p).reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const playsOn = (p: Playlist) => {
    const viaGroups = groups.filter(g => g.playlist === p.name || (g.playlistId && g.playlistId === p.id));
    const groupIds = new Set(viaGroups.map(g => g.id));
    const direct = screens.filter(s => !s.groupId && (s.playlistId === p.id || (!s.playlistId && s.playlist === p.name)));
    const inGroups = screens.filter(s => s.groupId && groupIds.has(s.groupId));
    return { groups: viaGroups, direct, total: direct.length + inGroups.length };
  };

  const filtered = playlists.filter(p =>
    (clientFilter === 'all' || p.createdBy === clientFilter) &&
    (!search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      (scope === 'clients' && ownerName(p.createdBy).toLowerCase().includes(search.trim().toLowerCase()))));

  // The admin's create page builds a client's playlist when told whose it
  // is; without that it saves under the admin's own account.
  const startCreate = () => {
    localStorage.removeItem('signageos_editing_playlist_id');
    if (scope === 'clients') {
      localStorage.setItem('signageos_create_playlist_for_client', clientFilter !== 'all' ? clientFilter : 'new');
    } else {
      localStorage.removeItem('signageos_create_playlist_for_client');
    }
    onNavigate(createView);
  };

  const editPlaylist = (p: Playlist) => {
    localStorage.setItem('signageos_editing_playlist_id', p.id);
    if (scope === 'clients' && p.createdBy) localStorage.setItem('signageos_create_playlist_for_client', p.createdBy);
    else localStorage.removeItem('signageos_create_playlist_for_client');
    onNavigate(createView);
  };

  // Screens a playlist can be put on: its owner's paired screens.
  const ownerScreens = (p: Playlist) => screens.filter(s =>
    s.assignedToUserEmail === p.createdBy && s.status !== 'pairing' && s.status !== 'unlinked');

  const openPicker = (p: Playlist) => {
    setPickerSelection(ownerScreens(p).filter(s => !s.groupId && s.playlistId === p.id).map(s => s.id));
    setPickerFor(p);
  };

  const savePicker = () => {
    if (!pickerFor) return;
    const candidates = ownerScreens(pickerFor).filter(s => !s.groupId).map(s => s.id);
    const { added, removed } = mediaStore.setPlaylistScreens(pickerFor.id, pickerSelection, candidates);
    if (added || removed) {
      const now = pickerSelection.length;
      toast.success(now ? `"${pickerFor.name}" now plays on ${now} screen${now === 1 ? '' : 's'}` : `"${pickerFor.name}" removed from its screens`);
    }
    setPickerFor(null);
    reload();
  };

  // Pausing keeps every screen/group assignment — an inactive playlist simply
  // stops playing on the TVs, and resuming brings it straight back. (The
  // client page used to also wipe the assignments when pausing, so resuming
  // left the playlist playing nowhere.)
  const toggleActive = (p: Playlist) => {
    const active = !p.active;
    mediaStore.updatePlaylist(p.id, { active, scheduleStatus: active ? 'Running' : 'Paused' });
    toast.success(active ? `"${p.name}" is playing again` : `"${p.name}" paused on all its screens`);
    reload();
  };

  const deletePlaylist = (p: Playlist) => {
    mediaStore.deletePlaylist(p.id);
    toast.success(`"${p.name}" deleted`);
    setDeleteTarget(null);
    setOpenId(null);
    reload();
  };

  const deleteSelected = () => {
    selectedIds.forEach(id => mediaStore.deletePlaylist(id));
    toast.success(`${selectedIds.length} playlist${selectedIds.length === 1 ? '' : 's'} deleted`);
    setSelectedIds([]);
    setSelectionMode(false);
    setBulkConfirm(false);
    reload();
  };

  const open = openId ? playlists.find(p => p.id === openId) : null;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          {allowBulkDelete && playlists.length > 0 && (
            <button
              onClick={() => { setSelectionMode(v => !v); setSelectedIds([]); }}
              className={`flex items-center gap-2 h-10 px-4 border rounded-xl text-sm font-medium ${
                selectionMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}
            >
              <CheckCircle size={15} /> {selectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {selectionMode && selectedIds.length > 0 && (
            <button
              onClick={() => setBulkConfirm(true)}
              className="flex items-center gap-2 h-10 px-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium"
            >
              <Trash size={15} /> Delete ({selectedIds.length})
            </button>
          )}
          {!selectionMode && (
            <button
              data-tour="playlists-new"
              onClick={startCreate}
              className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium"
            >
              <Plus size={16} /> New playlist
            </button>
          )}
        </div>
      </div>

      {(playlists.length > 3 || (scope === 'clients' && owners.length > 1)) && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={scope === 'clients' ? 'Search playlists or clients' : 'Search playlists'}
              className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
          </div>
          {scope === 'clients' && owners.length > 1 && (
            <div className="sm:w-64">
              <CustomSelect
                value={clientFilter}
                onChange={setClientFilter}
                options={[
                  { value: 'all', label: `All clients (${owners.length})` },
                  ...owners
                    .map(email => ({ value: email, label: ownerName(email) === email ? email : `${ownerName(email)} · ${email}` }))
                    .sort((a, b) => a.label.localeCompare(b.label))
                ]}
                buttonClassName="h-11 text-sm px-3"
              />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(p => {
          const slides = slidesOf(p);
          const cover = slides.map(s => mediaById.get(s.mediaId)).find(Boolean);
          const plays = playsOn(p);
          const selected = selectedIds.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              data-tour="playlist-card"
              onClick={() => (selectionMode
                ? setSelectedIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])
                : setOpenId(p.id))}
              className={`w-full text-left bg-white rounded-2xl border p-3 flex items-center gap-3 transition-colors ${
                selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              {selectionMode && (
                <input type="checkbox" checked={selected} onChange={() => {}} className="w-5 h-5 rounded border-slate-300 shrink-0 pointer-events-none" />
              )}
              <span className={`relative w-20 h-14 rounded-xl overflow-hidden bg-slate-100 shrink-0 flex items-center justify-center ${p.active ? '' : 'opacity-60'}`}>
                {cover ? (
                  <MediaThumb src={cover.thumbnail || cover.fileUrl} type={cover.type} alt="" width={160} />
                ) : (
                  <ListVideo size={20} className="text-slate-400" />
                )}
                {p.orientation === 'vertical' && (
                  <span className="absolute top-1 right-1 px-1 rounded bg-black/60 text-white text-[9px] font-semibold">Portrait</span>
                )}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900 truncate">{p.name}</span>
                  {!p.active && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 text-[10px] font-semibold">Paused</span>}
                </span>
                {scope === 'clients' && (
                  <span className="flex items-center gap-1 text-xs text-blue-700 mt-0.5 min-w-0">
                    <Building2 size={11} className="shrink-0" />
                    <span className="truncate">{ownerName(p.createdBy)}</span>
                  </span>
                )}
                <span className="block text-xs text-slate-500 mt-0.5">
                  {slides.length} slide{slides.length === 1 ? '' : 's'} · {formatDuration(lengthOf(p))}
                </span>
                <span className={`block text-xs mt-0.5 truncate ${plays.total > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                  {plays.total > 0
                    ? `Playing on ${plays.total} screen${plays.total === 1 ? '' : 's'}${plays.groups.length ? ` · ${plays.groups.length} group${plays.groups.length === 1 ? '' : 's'}` : ''}`
                    : 'Not on any screen'}
                </span>
              </span>
              {!selectionMode && <ChevronRight size={18} className="text-slate-300 shrink-0" />}
            </button>
          );
        })}
      </div>

      {playlists.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <ListVideo size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">{scope === 'clients' ? 'No client playlists yet' : 'No playlists yet'}</p>
          <p className="text-xs text-gray-500 mt-1">{scope === 'clients' ? 'Create one for a client, or wait for clients to make their own.' : 'Create one to choose what your screens play.'}</p>
          <button
            onClick={startCreate}
            className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium"
          >
            <Plus size={16} /> New playlist
          </button>
        </div>
      )}
      {playlists.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No playlists match “{search}”.</p>
      )}

      {open && (() => {
        const slides = slidesOf(open);
        const plays = playsOn(open);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={open.name}
            subtitle={`${slides.length} slide${slides.length === 1 ? '' : 's'} · ${formatDuration(lengthOf(open))} per loop`}
            badge={open.active
              ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-100">Active</span>
              : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-100">Paused</span>}
            hero={slides.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {slides.map((s, i) => {
                  const m: any = mediaById.get(s.mediaId);
                  return (
                    <div key={s.id || i} className="shrink-0 w-28">
                      <div className="w-28 h-16 rounded-lg overflow-hidden bg-slate-100">
                        {m ? <MediaThumb src={m.thumbnail || m.fileUrl} type={m.type} alt={m.title} width={224} /> : null}
                      </div>
                      <p className="text-[11px] text-slate-600 truncate mt-1">{m?.title || 'Missing media'}</p>
                      <p className="text-[10px] text-slate-400">{s.duration}s</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500 bg-slate-50 rounded-xl px-4 py-3">This playlist has no slides yet.</p>
            )}
            details={[
              ...(scope === 'clients' ? [{ label: 'Client', value: ownerName(open.createdBy) }] : []),
              {
                label: 'Plays on',
                value: plays.total > 0
                  ? `${plays.total} screen${plays.total === 1 ? '' : 's'}`
                  : <span className="text-slate-400">No screens yet</span>
              },
              ...(plays.groups.length ? [{ label: 'Groups', value: plays.groups.map(g => g.name).join(', ') }] : []),
              ...(plays.direct.length ? [{ label: 'Screens', value: plays.direct.map(s => s.name).join(', ') }] : []),
              { label: 'Orientation', value: open.orientation === 'vertical' ? 'Portrait' : 'Landscape' },
              { label: 'Transition', value: TRANSITION_LABELS[open.transition || 'fade'] || open.transition || 'Fade' },
              { label: 'Playback', value: [open.shuffle ? 'Shuffle' : 'In order', open.loop === false ? 'once' : 'loops'].join(', ') },
              ...(open.createdDate ? [{ label: 'Created', value: open.createdDate }] : []),
            ]}
            groups={[
              {
                title: 'Playlist',
                actions: [
                  {
                    key: 'edit',
                    label: 'Edit playlist',
                    description: 'Slides, timing, orientation and widgets',
                    icon: <Edit size={17} />,
                    onClick: () => editPlaylist(open)
                  },
                  {
                    key: 'toggle',
                    label: open.active ? 'Pause everywhere' : 'Resume everywhere',
                    description: open.active
                      ? `Stops it on ${plays.total} screen${plays.total === 1 ? '' : 's'}; assignments are kept`
                      : 'Starts playing again on all its screens',
                    icon: open.active ? <Pause size={17} /> : <Play size={17} />,
                    onClick: () => toggleActive(open)
                  }
                ]
              },
              {
                title: 'Where it plays',
                actions: [
                  ownerScreens(open).length > 0 ? {
                    key: 'screens',
                    label: 'Choose screens',
                    description: plays.direct.length
                      ? `On ${plays.direct.length} screen${plays.direct.length === 1 ? '' : 's'} directly — add or remove`
                      : `Pick from ${scope === 'clients' ? 'this client\'s' : 'your'} ${ownerScreens(open).length} screen${ownerScreens(open).length === 1 ? '' : 's'}`,
                    icon: <Monitor size={17} />,
                    onClick: () => openPicker(open)
                  } : {
                    key: 'screens',
                    label: 'Assign to screens',
                    description: scope === 'clients' ? 'This client has no paired screens yet' : 'You have no paired screens yet — add one first',
                    icon: <Monitor size={17} />,
                    onClick: () => onNavigate(screensView)
                  },
                  {
                    key: 'groups',
                    label: 'Assign to a group',
                    description: 'Every screen in the group plays it',
                    icon: <Layers size={17} />,
                    onClick: () => onNavigate(groupsView || (createView === 'my-create-playlist' ? 'screens-groups-my' : 'screens-groups'))
                  }
                ]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'delete',
                  label: 'Delete playlist',
                  description: plays.total > 0 ? `Also removes it from ${plays.total} screen${plays.total === 1 ? '' : 's'}` : 'This can\'t be undone',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteTarget(open)
                }]
              }
            ]}
          />
        );
      })()}

      {pickerFor && (() => {
        const list = ownerScreens(pickerFor);
        const free = list.filter(s => !s.groupId);
        const grouped = list.filter(s => s.groupId);
        const elsewhere = free.filter(s => pickerSelection.includes(s.id) && s.playlistId && s.playlistId !== pickerFor.id).length;
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setPickerFor(null)}
            title="Choose screens"
            subtitle={`Where “${pickerFor.name}” plays${scope === 'clients' ? ` · ${ownerName(pickerFor.createdBy)}` : ''}`}
            details={[]}
            groups={[]}
            hero={
              <div className="space-y-4">
                {free.length > 0 && (
                  <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    {free.map(s => {
                      const on = pickerSelection.includes(s.id);
                      const current = s.playlistId && s.playlistId !== pickerFor.id ? (s.playlist || 'another playlist') : '';
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setPickerSelection(prev => on ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${on ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
                        >
                          <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                            {on && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-slate-900 truncate">{s.name}</span>
                            <span className="block text-xs text-slate-500 truncate">
                              {current ? `Now playing ${current}` : s.playlistId === pickerFor.id ? 'Playing this playlist' : 'Nothing assigned'}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {grouped.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">In a group</p>
                    <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                      {grouped.map(s => (
                        <div key={s.id} className="flex items-center gap-3 px-4 py-3 opacity-60">
                          <Layers size={16} className="text-slate-400 shrink-0" />
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-medium text-slate-900 truncate">{s.name}</span>
                            <span className="block text-xs text-slate-500 truncate">Plays its group's playlist — change it on the group</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            }
            footer={
              <div className="space-y-2">
                {elsewhere > 0 && (
                  <p className="text-xs text-amber-700">
                    {elsewhere} screen{elsewhere === 1 ? ' will switch' : 's will switch'} from {elsewhere === 1 ? 'its' : 'their'} current playlist.
                  </p>
                )}
                <button
                  type="button"
                  onClick={savePicker}
                  disabled={free.length === 0}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  Save · {pickerSelection.length} screen{pickerSelection.length === 1 ? '' : 's'}
                </button>
              </div>
            }
          />
        );
      })()}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete “${deleteTarget.name}”?`}
          body={<p>It will be removed from every screen and group that plays it. This can't be undone.</p>}
          confirmLabel="Delete playlist"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => deletePlaylist(deleteTarget)}
        />
      )}

      {bulkConfirm && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} playlist${selectedIds.length === 1 ? '' : 's'}?`}
          body={<p>They will be removed from every screen and group that plays them. This can't be undone.</p>}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setBulkConfirm(false)}
          onConfirm={deleteSelected}
        />
      )}
    </div>
  );
}
