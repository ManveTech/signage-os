import { useEffect, useRef, useState } from 'react';
import {
  Search, Film, Image, Upload, Trash2, Trash, CheckCircle, Play, HardDrive,
  ListVideo, Pencil, X, AlertCircle, Loader2, Check, CloudUpload, Plus
} from 'lucide-react';
import MediaThumb, { PreviewMedia } from './MediaThumb';
import ScreenDetailsSheet from '../screens/ScreenDetailsSheet';
import ConfirmDialog from '../screens/ConfirmDialog';
import { toast } from '../Toast';
import { mediaStore, MediaItem, Playlist } from '../../lib/mediaStore';
import { licensingStore } from '../../lib/licensingStore';
import { syncCollection } from '../../lib/syncHelper';
import { checkFiles, formatBytes, uploadMediaFile, FileCheck } from '../../lib/mediaUpload';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '../../lib/uploadLimits';

const TYPES: { key: string; label: string; icon: typeof Film }[] = [
  { key: 'image', label: 'Images', icon: Image },
  { key: 'video', label: 'Videos', icon: Film },
];

type UploadRow = FileCheck & { state: 'waiting' | 'uploading' | 'done' | 'failed'; message?: string };

const formatDate = (d?: string) => {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date.getTime()) ? d : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * The media library — your own uploads (admin or client). Compact tiles with
 * search and type filters; tap a tile for a preview, where it's used,
 * rename and delete. Upload by button or by dropping files on the page;
 * each file shows its own progress and, if it fails, why.
 */
export default function MediaLibraryView({ userEmail, isAdmin = false }: {
  userEmail: string;
  isAdmin?: boolean;
}) {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [limitGb, setLimitGb] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaItem | null>(null);
  const [renameTarget, setRenameTarget] = useState<MediaItem | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const load = () => {
    setMedia(mediaStore.getMedia().filter(m => m.uploadedBy === userEmail));
    setPlaylists(mediaStore.getPlaylists());
    // Same rule as the server: a client's storage is the sum of their active
    // plans. Admins aren't plan-limited.
    setLimitGb(isAdmin ? 0 : licensingStore.getLicenses()
      .filter(l => l.assignedUserEmail === userEmail && l.status === 'active')
      .reduce((sum, l) => sum + (l.storageLimit || 0), 0));
  };

  useEffect(() => {
    load();
    Promise.all([
      syncCollection('media_items', 'signageos_media'),
      syncCollection('playlists', 'signageos_playlists'),
      ...(isAdmin ? [] : [syncCollection('licenses', 'signageos_licenses')]),
    ]).finally(() => { load(); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const usedBytes = media.reduce((sum, m) => sum + (m.fileSizeBytes || 0), 0);
  const limitBytes = limitGb > 0 ? limitGb * 1024 ** 3 : null;
  const percent = limitBytes ? Math.min(100, (usedBytes / limitBytes) * 100) : 0;

  const usedIn = (m: MediaItem) => playlists.filter(p =>
    (p.slides || []).some(s => s.mediaId === m.id || s.secondMediaId === m.id) || (p.mediaIds || []).includes(m.id));

  const q = search.trim().toLowerCase();
  const filtered = media.filter(m =>
    (typeFilter === 'all' || m.type === typeFilter) && (!q || m.title.toLowerCase().includes(q)));
  const typeCounts = TYPES
    .map(t => ({ ...t, count: media.filter(m => m.type === t.key).length }))
    .filter(t => t.count > 0);

  // ── Upload ────────────────────────────────────────────────────────────────
  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    setUploadOpen(true);
    setRows(prev => {
      // Keep finished/failed rows from earlier batches visible until closed,
      // and check new files against what's already queued.
      const queuedBytes = prev.filter(r => r.state === 'waiting' && !r.error).reduce((s, r) => s + r.file.size, 0);
      return [...prev, ...checkFiles(files, usedBytes + queuedBytes, limitBytes).map(c => ({ ...c, state: 'waiting' as const }))];
    });
  };

  const startUpload = async () => {
    const queue = rows.filter(r => r.state === 'waiting' && !r.error);
    if (queue.length === 0) return;
    setUploading(true);
    let ok = 0;
    for (const row of queue) {
      setRows(prev => prev.map(r => (r.file === row.file ? { ...r, state: 'uploading' } : r)));
      try {
        await uploadMediaFile(row.file, userEmail);
        ok++;
        setRows(prev => prev.map(r => (r.file === row.file ? { ...r, state: 'done' } : r)));
        load();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setRows(prev => prev.map(r => (r.file === row.file ? { ...r, state: 'failed', message } : r)));
      }
    }
    setUploading(false);
    load();
    if (ok === queue.length) {
      toast.success(ok === 1 ? 'File uploaded' : `${ok} files uploaded`);
      setUploadOpen(false);
      setRows([]);
    } else if (ok > 0) {
      toast.warning(`${ok} of ${queue.length} uploaded — see the failed ones below`);
    }
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    setRows([]);
  };

  // Drop files anywhere on the page.
  const onDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    addFiles(Array.from(e.dataTransfer.files || []));
  };

  // ── Delete / rename ───────────────────────────────────────────────────────
  const deleteOne = (m: MediaItem) => {
    mediaStore.removeMediaFromPlaylists(new Set([m.id]));
    mediaStore.deleteMedia(m.id);
    toast.success(`"${m.title}" deleted`);
    setDeleteTarget(null);
    setOpenId(null);
    load();
  };

  const deleteSelected = () => {
    mediaStore.removeMediaFromPlaylists(new Set(selectedIds));
    selectedIds.forEach(id => mediaStore.deleteMedia(id));
    toast.success(`${selectedIds.length} file${selectedIds.length === 1 ? '' : 's'} deleted`);
    setSelectedIds([]);
    setSelectionMode(false);
    setBulkConfirm(false);
    load();
  };

  const saveRename = () => {
    const title = renameValue.trim();
    if (!renameTarget || !title) return;
    mediaStore.renameMedia(renameTarget.id, title);
    toast.success('Renamed');
    setRenameTarget(null);
    load();
  };

  const open = openId ? media.find(m => m.id === openId) : null;
  const pending = rows.filter(r => r.state === 'waiting' && !r.error).length;
  const doneCount = rows.filter(r => r.state === 'done').length;
  const progress = rows.length ? Math.round((doneCount / Math.max(1, rows.filter(r => !r.error).length)) * 100) : 0;

  return (
    <div
      className="p-4 sm:p-6 space-y-4 sm:space-y-5 min-h-full relative"
      onDragEnter={onDragEnter}
      onDragOver={e => { if (dragging) e.preventDefault(); }}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { addFiles(Array.from(e.target.files || [])); e.target.value = ''; }}
      />

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Media</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {media.length > 0
              ? `${media.length} file${media.length === 1 ? '' : 's'} · tap one to preview`
              : 'Images and videos for your screens'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {media.length > 0 && (
            <button
              onClick={() => { setSelectionMode(v => !v); setSelectedIds([]); }}
              className={`flex items-center gap-2 h-10 px-4 border rounded-xl text-sm font-medium ${
                selectionMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
              }`}
            >
              <CheckCircle size={15} /> {selectionMode ? 'Cancel' : 'Select'}
            </button>
          )}
          {selectionMode && selectedIds.length > 0 ? (
            <button
              onClick={() => setBulkConfirm(true)}
              className="flex items-center gap-2 h-10 px-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium"
            >
              <Trash size={15} /> Delete ({selectedIds.length})
            </button>
          ) : (
            <button
              data-tour="media-upload"
              onClick={() => fileInput.current?.click()}
              className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold"
            >
              <Upload size={15} /> Upload
            </button>
          )}
        </div>
      </div>

      {(media.length > 0 || limitBytes) && (
        <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-2xl px-4 py-3">
          <HardDrive size={16} className="text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-slate-700">Storage</span>
              <span className="text-slate-500 shrink-0">
                {formatBytes(usedBytes)}{limitBytes ? ` of ${limitGb} GB` : ' used'}
              </span>
            </div>
            {limitBytes !== null && (
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full rounded-full ${percent > 90 ? 'bg-rose-500' : percent > 70 ? 'bg-amber-400' : 'bg-blue-600'}`}
                  style={{ width: `${Math.max(percent, usedBytes > 0 ? 1 : 0)}%` }}
                />
              </div>
            )}
            {percent > 90 && (
              <p className="text-[11px] text-rose-600 mt-1.5">
                Almost full — delete files you no longer use, or upgrade your plan, to keep uploading.
              </p>
            )}
          </div>
        </div>
      )}

      {media.length > 0 && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files"
              className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
          </div>
          {typeCounts.length > 1 && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {[{ key: 'all', label: 'All', count: media.length }, ...typeCounts].map(t => {
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
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {filtered.map((m, i) => {
          const selected = selectedIds.includes(m.id);
          const inUse = usedIn(m).length;
          return (
            <button
              key={m.id}
              type="button"
              data-tour={i === 0 ? 'media-card' : undefined}
              onClick={() => (selectionMode
                ? setSelectedIds(prev => prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id])
                : setOpenId(m.id))}
              className={`text-left bg-white rounded-2xl border overflow-hidden transition-colors ${
                selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
              }`}
            >
              <span className="relative block aspect-video bg-slate-100">
                <MediaThumb src={m.type === 'video' ? (m.fileUrl || m.thumbnail) : (m.thumbnail || m.fileUrl)} type={m.type} alt={m.title} width={360} />
                <span className="absolute left-1.5 bottom-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                  {m.type === 'video' ? <><Film size={11} /> {m.duration || 0}s</> : <><Image size={11} /> Image</>}
                </span>
                {selectionMode && (
                  <span className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-md border flex items-center justify-center ${
                    selected ? 'bg-blue-600 border-blue-600' : 'bg-white/90 border-slate-300'
                  }`}>
                    {selected && <Check size={13} className="text-white" />}
                  </span>
                )}
              </span>
              <span className="block px-3 py-2.5">
                <span className="block text-sm font-medium text-slate-900 truncate">{m.title}</span>
                <span className="block text-xs text-slate-500 mt-0.5 truncate">
                  {m.fileSizeBytes ? formatBytes(m.fileSizeBytes) : m.fileSize}
                  {' · '}
                  {inUse ? `In ${inUse} playlist${inUse === 1 ? '' : 's'}` : 'Not in a playlist'}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!loading && media.length === 0 && (
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          className="w-full py-14 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
        >
          <CloudUpload size={32} className="mx-auto text-blue-500 mb-2" />
          <p className="text-sm font-semibold text-gray-800">Upload your first images or videos</p>
          <p className="text-xs text-gray-500 mt-1">
            Tap to choose files<span className="hidden sm:inline">, or drop them anywhere on this page</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-3">
            Images up to {formatBytes(MAX_IMAGE_UPLOAD_BYTES)} · videos up to {formatBytes(MAX_VIDEO_UPLOAD_BYTES)}
          </p>
        </button>
      )}
      {media.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">Nothing matches “{search}”.</p>
      )}

      {/* Drop overlay */}
      {dragging && (
        <div className="fixed inset-0 z-40 bg-blue-600/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl border-2 border-dashed border-blue-400 px-8 py-6 text-center">
            <CloudUpload size={30} className="mx-auto text-blue-600 mb-2" />
            <p className="text-sm font-semibold text-slate-900">Drop to upload</p>
          </div>
        </div>
      )}

      {/* Upload sheet */}
      {uploadOpen && (
        <ScreenDetailsSheet
          open
          onClose={closeUpload}
          title={uploading ? 'Uploading…' : 'Upload files'}
          subtitle={limitBytes
            ? `${formatBytes(Math.max(0, limitBytes - usedBytes))} of storage left`
            : `Images up to ${formatBytes(MAX_IMAGE_UPLOAD_BYTES)} · videos up to ${formatBytes(MAX_VIDEO_UPLOAD_BYTES)}`}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-3">
              {uploading && (
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
                </div>
              )}
              <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-[45vh] overflow-y-auto">
                {rows.map((r, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2.5 bg-white">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      r.error || r.state === 'failed' ? 'bg-rose-50 text-rose-500'
                        : r.state === 'done' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {r.error || r.state === 'failed' ? <AlertCircle size={16} />
                        : r.state === 'done' ? <Check size={16} />
                        : r.state === 'uploading' ? <Loader2 size={16} className="animate-spin" />
                        : r.file.type.startsWith('video/') ? <Film size={16} /> : <Image size={16} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-slate-900 truncate">{r.file.name}</span>
                      <span className={`block text-xs ${r.error || r.state === 'failed' ? 'text-rose-600' : 'text-slate-500 truncate'}`}>
                        {r.error || r.message || (r.state === 'uploading' ? 'Uploading…' : r.state === 'done' ? 'Uploaded' : formatBytes(r.file.size))}
                      </span>
                    </span>
                    {r.state === 'waiting' && !uploading && (
                      <button
                        type="button"
                        onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                        className="p-1.5 text-slate-400 hover:text-slate-600"
                        aria-label={`Remove ${r.file.name}`}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!uploading && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-slate-300 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600"
                >
                  <Plus size={15} /> Add more files
                </button>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeUpload}
                disabled={uploading}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                {pending === 0 && doneCount > 0 ? 'Done' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={startUpload}
                disabled={uploading || pending === 0}
                className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {uploading ? `Uploading ${Math.min(doneCount + 1, doneCount + pending)}…` : pending === 0 ? 'Nothing to upload' : `Upload ${pending} file${pending === 1 ? '' : 's'}`}
              </button>
            </div>
          }
        />
      )}

      {/* Details sheet */}
      {open && (() => {
        const playlistsUsing = usedIn(open);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={open.title}
            subtitle={open.type === 'video' ? `Video · ${open.duration || 0}s` : 'Image'}
            hero={
              <div className="aspect-video rounded-xl overflow-hidden bg-slate-900">
                <PreviewMedia src={open.type === 'video' ? (open.fileUrl || open.thumbnail) : (open.fileUrl || open.thumbnail)} type={open.type} alt={open.title} />
              </div>
            }
            details={[
              ...(open.fileSizeBytes || open.fileSize ? [{ label: 'Size', value: open.fileSizeBytes ? formatBytes(open.fileSizeBytes) : open.fileSize }] : []),
              ...(open.resolution ? [{ label: 'Resolution', value: open.resolution.replace('x', ' × ') }] : []),
              ...(open.createdDate ? [{ label: 'Added', value: formatDate(open.createdDate) }] : []),
              {
                label: 'Used in',
                value: playlistsUsing.length
                  ? playlistsUsing.map(p => p.name).join(', ')
                  : <span className="text-slate-400">No playlists yet</span>
              },
            ]}
            groups={[
              {
                title: 'File',
                actions: [
                  {
                    key: 'rename',
                    label: 'Rename',
                    description: 'Only changes the name you see here',
                    icon: <Pencil size={17} />,
                    onClick: () => { setRenameTarget(open); setRenameValue(open.title); }
                  },
                  ...(open.fileUrl || open.thumbnail?.startsWith('http') ? [{
                    key: 'open',
                    label: 'Open original',
                    description: 'Full-size file in a new tab',
                    icon: <Play size={17} />,
                    onClick: () => window.open(open.fileUrl || open.thumbnail, '_blank', 'noopener')
                  }] : []),
                ]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'delete',
                  label: 'Delete file',
                  description: playlistsUsing.length
                    ? `Also removes it from ${playlistsUsing.length} playlist${playlistsUsing.length === 1 ? '' : 's'}`
                    : 'Frees up storage; can\'t be undone',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteTarget(open)
                }]
              }
            ]}
          />
        );
      })()}

      {renameTarget && (
        <ConfirmDialog
          title="Rename file"
          body={
            <input
              autoFocus
              onFocus={e => e.target.select()}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); }}
              maxLength={120}
              className="w-full h-11 px-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400"
            />
          }
          confirmLabel="Save"
          onCancel={() => setRenameTarget(null)}
          onConfirm={saveRename}
        />
      )}

      {deleteTarget && (() => {
        const using = usedIn(deleteTarget);
        return (
          <ConfirmDialog
            title={`Delete “${deleteTarget.title}”?`}
            body={
              <div className="space-y-2">
                <p>The file is deleted permanently.</p>
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

      {bulkConfirm && (() => {
        const ids = new Set(selectedIds);
        const affected = playlists.filter(p =>
          (p.slides || []).some(s => ids.has(s.mediaId) || (s.secondMediaId && ids.has(s.secondMediaId))) ||
          (p.mediaIds || []).some(id => ids.has(id)));
        return (
          <ConfirmDialog
            title={`Delete ${selectedIds.length} file${selectedIds.length === 1 ? '' : 's'}?`}
            body={
              <div className="space-y-2">
                <p>They're deleted permanently.</p>
                {affected.length > 0 && (
                  <p className="flex items-start gap-1.5 text-amber-700">
                    <ListVideo size={14} className="mt-0.5 shrink-0" />
                    {affected.length} playlist{affected.length === 1 ? ' uses' : 's use'} some of them — those slides will be removed.
                  </p>
                )}
              </div>
            }
            confirmLabel="Delete"
            tone="danger"
            onCancel={() => setBulkConfirm(false)}
            onConfirm={deleteSelected}
          />
        );
      })()}

      {loading && media.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="aspect-video bg-slate-100 animate-pulse" />
              <div className="px-3 py-2.5 space-y-1.5">
                <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
