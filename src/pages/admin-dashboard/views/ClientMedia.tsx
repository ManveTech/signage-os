import { useEffect, useState } from 'react';
import { Search, Film, Image, Youtube, AlignLeft, Layout, Trash2, Trash, CheckCircle, Building2, Play, FolderOpen, HardDrive, ListVideo } from 'lucide-react';
import MediaThumb, { PreviewMedia } from '../../../components/media/MediaThumb';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import CustomSelect from '../../../components/CustomSelect';
import { toast } from '../../../components/Toast';
import { mediaStore, MediaItem, Playlist } from '../../../lib/mediaStore';
import { licensingStore, License } from '../../../lib/licensingStore';
import { syncCollection } from '../../../lib/syncHelper';

const TYPES: { key: string; label: string; icon: typeof Film }[] = [
  { key: 'image', label: 'Images', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
  { key: 'youtube', label: 'YouTube', icon: Youtube },
  { key: 'ticker', label: 'Tickers', icon: AlignLeft },
  { key: 'layout', label: 'Layouts', icon: Layout },
];

function youtubeId(url: string) {
  const match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
  return match && match[2].length === 11 ? match[2] : null;
}

/**
 * Admin view of every client's uploads: compact tiles with one search +
 * client filter row; tapping a tile opens a sheet with a preview, where it's
 * used, and delete.
 */
export default function ClientMedia({ userEmail = 'admin@demo.com' }: { userEmail?: string } = {}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [orgs, setOrgs] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);

  const load = () => {
    setMedia(mediaStore.getMedia().filter(m => m.uploadedBy && m.uploadedBy !== userEmail && m.uploadedBy !== 'admin'));
    setPlaylists(mediaStore.getPlaylists());
    setLicenses(licensingStore.getLicenses());
  };

  useEffect(() => {
    load();
    Promise.all([
      syncCollection('media_items', 'signageos_media'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('organizations', 'signageos_organizations').then(o => { if (o.length) setOrgs(o); }),
    ]).finally(() => { load(); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const ownerName = (email?: string) => {
    if (!email) return 'Unknown client';
    const org = orgs.find((o: any) => o.email === email);
    if (org?.name) return org.name;
    return licenses.find(l => l.assignedUserEmail === email && l.assignedOrgName)?.assignedOrgName || email;
  };

  const usedIn = (m: MediaItem) => playlists.filter(p =>
    (p.slides || []).some(s => s.mediaId === m.id || s.secondMediaId === m.id) || (p.mediaIds || []).includes(m.id));

  const owners = Array.from(new Set(media.map(m => m.uploadedBy).filter(Boolean))) as string[];
  const byClient = media.filter(m => clientFilter === 'all' || m.uploadedBy === clientFilter);
  const q = search.trim().toLowerCase();
  const filtered = byClient.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) &&
    (!q || m.title.toLowerCase().includes(q) || ownerName(m.uploadedBy).toLowerCase().includes(q)));
  const typeCounts = TYPES
    .map(t => ({ ...t, count: byClient.filter(m => m.type === t.key).length }))
    .filter(t => t.count > 0);

  // Storage for the chosen client, against their plan.
  const storage = (() => {
    if (clientFilter === 'all') return null;
    const used = mediaStore.getClientStorageUsedBytes(clientFilter);
    const limitGb = licenses
      .filter(l => l.assignedUserEmail === clientFilter && l.status === 'active')
      .reduce((sum, l) => sum + (l.storageLimit || 0), 0);
    return { usedMb: used / (1024 * 1024), limitGb, percent: limitGb ? Math.min(100, (used / (limitGb * 1024 ** 3)) * 100) : 0 };
  })();

  const removeFromPlaylists = (ids: Set<string>) => mediaStore.removeMediaFromPlaylists(ids);

  const deleteOne = (m: MediaItem) => {
    removeFromPlaylists(new Set([m.id]));
    mediaStore.deleteMedia(m.id);
    toast.success(`"${m.title}" deleted`);
    setDeleteTarget(null);
    setOpenId(null);
    load();
  };

  const deleteSelected = () => {
    removeFromPlaylists(new Set(selectedIds));
    selectedIds.forEach(id => mediaStore.deleteMedia(id));
    toast.success(`${selectedIds.length} item${selectedIds.length === 1 ? '' : 's'} deleted`);
    setSelectedIds([]);
    setSelectionMode(false);
    setBulkConfirm(false);
    load();
  };

  const open = openId ? media.find(m => m.id === openId) : null;
  const typeIcon = (type: string) => {
    const Icon = TYPES.find(t => t.key === type)?.icon || Film;
    return <Icon size={11} />;
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Client Media</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {media.length > 0
              ? `${media.length} file${media.length === 1 ? '' : 's'} from ${owners.length} client${owners.length === 1 ? '' : 's'} — tap one to preview`
              : 'Everything your clients have uploaded'}
          </p>
        </div>
        {media.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectionMode(v => !v); setSelectedIds([]); }}
              className={`flex items-center gap-2 h-10 px-4 border rounded-xl text-sm font-medium ${
                selectionMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600'
              }`}
            >
              <CheckCircle size={15} /> {selectionMode ? 'Cancel' : 'Select'}
            </button>
            {selectionMode && selectedIds.length > 0 && (
              <button
                onClick={() => setBulkConfirm(true)}
                className="flex items-center gap-2 h-10 px-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium"
              >
                <Trash size={15} /> Delete ({selectedIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      {media.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search files or clients"
                className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
              />
            </div>
            {owners.length > 1 && (
              <div className="sm:w-64">
                <CustomSelect
                  value={clientFilter}
                  onChange={v => { setClientFilter(v); setTypeFilter('all'); }}
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

          {typeCounts.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {[{ key: 'all', label: 'All', count: byClient.length }, ...typeCounts].map(t => {
                const active = typeFilter === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setTypeFilter(t.key)}
                    aria-pressed={active}
                    className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                      active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {t.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{t.count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {storage && (
            <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3">
              <HardDrive size={16} className="text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 truncate">{ownerName(clientFilter)}</span>
                  <span className="text-slate-500 shrink-0">
                    {storage.usedMb >= 1024 ? `${(storage.usedMb / 1024).toFixed(1)} GB` : `${storage.usedMb.toFixed(0)} MB`}
                    {storage.limitGb ? ` of ${storage.limitGb} GB` : ''}
                  </span>
                </div>
                {storage.limitGb > 0 && (
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${storage.percent > 90 ? 'bg-rose-500' : storage.percent > 70 ? 'bg-amber-400' : 'bg-blue-600'}`}
                      style={{ width: `${storage.percent}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtered.map(m => {
          const selected = selectedIds.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => (selectionMode
                ? setSelectedIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])
                : setOpenId(m.id))}
              className={`text-left bg-white rounded-2xl border overflow-hidden transition-colors ${
                selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              <span className="relative block aspect-video bg-slate-100">
                {(m.type as string) === 'youtube' || m.type === 'ticker' ? (
                  <span className="absolute inset-0 flex items-center justify-center text-slate-400">
                    {(m.type as string) === 'youtube' ? <Youtube size={22} /> : <AlignLeft size={22} />}
                  </span>
                ) : (
                  <MediaThumb src={m.thumbnail || m.fileUrl} type={m.type} alt={m.title} width={360} />
                )}
                <span className="absolute left-1.5 bottom-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                  {typeIcon(m.type)}
                  {m.type === 'video' || (m.type as string) === 'youtube' ? `${m.duration || 0}s` : m.type === 'image' ? 'Image' : m.type}
                </span>
                {selectionMode && (
                  <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md border flex items-center justify-center ${
                    selected ? 'bg-blue-600 border-blue-600' : 'bg-white/90 border-slate-300'
                  }`}>
                    {selected && <CheckCircle size={13} className="text-white" />}
                  </span>
                )}
              </span>
              <span className="block px-3 py-2.5">
                <span className="block text-sm font-medium text-slate-900 truncate">{m.title}</span>
                <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 min-w-0">
                  <Building2 size={11} className="shrink-0" />
                  <span className="truncate">{ownerName(m.uploadedBy)}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!loading && media.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <FolderOpen size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No client uploads yet</p>
          <p className="text-xs text-gray-500 mt-1">Files your clients upload will show up here.</p>
        </div>
      )}
      {media.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">Nothing matches these filters.</p>
      )}

      {open && (() => {
        const playlistsUsing = usedIn(open);
        const yt = (open.type as string) === 'youtube' ? youtubeId(open.fileUrl || open.thumbnail || '') : null;
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={open.title}
            subtitle={ownerName(open.uploadedBy)}
            hero={
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-900">
                {(open.type as string) === 'youtube' ? (
                  yt ? (
                    <iframe
                      src={`https://www.youtube.com/embed/${yt}`}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Invalid YouTube link</div>
                ) : open.type === 'ticker' ? (
                  <div className="w-full h-full flex items-center justify-center p-4 text-sm text-white text-center">{open.title}</div>
                ) : (
                  <PreviewMedia src={open.fileUrl || open.thumbnail} type={open.type} alt={open.title} />
                )}
              </div>
            }
            details={[
              { label: 'Client', value: open.uploadedBy },
              { label: 'Type', value: <span className="capitalize">{open.type}</span> },
              ...(open.type === 'video' || (open.type as string) === 'youtube' ? [{ label: 'Length', value: `${open.duration || 0}s` }] : []),
              ...(open.fileSize ? [{ label: 'Size', value: open.fileSize }] : []),
              ...(open.resolution ? [{ label: 'Resolution', value: open.resolution }] : []),
              {
                label: 'Used in',
                value: playlistsUsing.length
                  ? playlistsUsing.map(p => p.name).join(', ')
                  : <span className="text-slate-400">No playlists</span>
              },
            ]}
            groups={[
              ...(open.fileUrl && (open.type as string) !== 'youtube' && open.type !== 'ticker' ? [{
                title: 'File',
                actions: [{
                  key: 'open',
                  label: 'Open original',
                  description: 'Full-size file in a new tab',
                  icon: <Play size={17} />,
                  onClick: () => window.open(open.fileUrl, '_blank', 'noopener')
                }]
              }] : []),
              {
                title: 'Danger zone',
                actions: [{
                  key: 'delete',
                  label: 'Delete file',
                  description: playlistsUsing.length
                    ? `Also removes it from ${playlistsUsing.length} playlist${playlistsUsing.length === 1 ? '' : 's'}`
                    : 'Frees the client\'s storage; can\'t be undone',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteTarget(open)
                }]
              }
            ]}
          />
        );
      })()}

      {deleteTarget && (() => {
        const using = usedIn(deleteTarget);
        return (
          <ConfirmDialog
            title={`Delete “${deleteTarget.title}”?`}
            body={
              <div className="space-y-2">
                <p>This deletes the client's file permanently.</p>
                {using.length > 0 && (
                  <p className="flex items-start gap-1.5 text-amber-700">
                    <ListVideo size={14} className="mt-0.5 shrink-0" />
                    It's in {using.map(p => `“${p.name}”`).join(', ')} — those slides will be removed.
                  </p>
                )}
              </div>
            }
            confirmLabel="Delete file"
            tone="danger"
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => deleteOne(deleteTarget)}
          />
        );
      })()}

      {bulkConfirm && (
        <ConfirmDialog
          title={`Delete ${selectedIds.length} file${selectedIds.length === 1 ? '' : 's'}?`}
          body={<p>They'll be deleted from the clients' storage and removed from any playlists using them. This can't be undone.</p>}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setBulkConfirm(false)}
          onConfirm={deleteSelected}
        />
      )}
    </div>
  );
}
