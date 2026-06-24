import React, { useState, useEffect } from 'react';
import { Search, Upload, Film, Image, Layout, Youtube, AlignLeft, Plus, Trash2, Trash, HardDrive, Clock, Tag, CheckCircle, Play, X } from 'lucide-react';
import { mediaStore, MediaItem } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';
import { toast } from '../../../../components/Toast';

const typeIcons: Record<string, React.ReactNode> = {
  video: <Film size={13} />,
  image: <Image size={13} />,
  layout: <Layout size={13} />,
  ticker: <AlignLeft size={13} />,
  youtube: <Youtube size={13} />,
};

const typeColors: Record<string, string> = {
  video: 'bg-blue-100 text-blue-700',
  image: 'bg-teal-100 text-teal-700',
  layout: 'bg-purple-100 text-purple-700',
  ticker: 'bg-orange-100 text-orange-700',
  youtube: 'bg-red-100 text-red-700',
};

interface Props {
  userEmail: string;
  onNavigate?: (v: string) => void;
}

export default function MediaLibrary({ userEmail }: Props) {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [storageUsedBytes, setStorageUsedBytes] = useState(0);
  const [storageLimitGb, setStorageLimitGb] = useState(5);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const filesArray = selectedFiles ? (Array.from(selectedFiles) as File[]) : [];
  const [customTitle, setCustomTitle] = useState('');
  const [totalFilesToUpload, setTotalFilesToUpload] = useState(0);
  const [uploadingFilesCount, setUploadingFilesCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Selection & Delete state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = () => {
    const all = mediaStore.getMedia();
    setMediaList(all.filter(m => m.uploadedBy === userEmail));
    const used = mediaStore.getClientStorageUsedBytes(userEmail);
    setStorageUsedBytes(used);
    const licenses = licensingStore.getLicenses();
    const lic = licenses.find(l => l.assignedUserEmail === userEmail);
    if (lic) {
      setStorageLimitGb(lic.storageLimit);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filesArray.length === 0) {
      toast.warning("Please select at least one file.");
      return;
    }

    for (const file of filesArray) {
      const isVideo = file.type.startsWith('video/');
      const limitBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
      const limitMb = isVideo ? 50 : 5;
      if (file.size > limitBytes) {
        toast.error(`Upload cancelled: The file "${file.name}" is larger than ${limitMb}MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). All uploaded ${isVideo ? 'video' : 'image'} files must be under ${limitMb}MB.`);
        return;
      }
    }

    const totalSize = filesArray.reduce((acc, f) => acc + f.size, 0);
    const limitBytes = storageLimitGb * 1024 * 1024 * 1024;
    if (storageUsedBytes + totalSize > limitBytes) {
      toast.error(`Upload Failed: This upload of ${(totalSize / (1024 * 1024)).toFixed(1)} MB exceeds your remaining license storage limit. Allowed storage: ${storageLimitGb} GB.`);
      return;
    }

    setTotalFilesToUpload(filesArray.length);
    setUploadingFilesCount(0);
    setUploadProgress(0);

    let count = 0;
    for (const file of filesArray) {
      count++;
      setUploadingFilesCount(count);
      setUploadProgress(((count - 1) / filesArray.length) * 100);

      try {
        await new Promise<void>((resolve, reject) => {
          const isVideo = file.type.startsWith('video/');
          const fileType = isVideo ? 'video' : 'image';
          const reader = new FileReader();

          reader.onload = (event) => {
            const resultDataUrl = event.target?.result as string;
            const base64Data = resultDataUrl.split(',')[1];
            let title = file.name;
            if (filesArray.length === 1 && customTitle.trim()) {
              title = customTitle.trim();
            } else {
              title = file.name.replace(/\.[^/.]+$/, "");
            }

            if (fileType === 'image') {
              const img = new Image();
              img.onload = async () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                try {
                  await mediaStore.uploadMedia({
                    title, type: fileType, duration: 10, resolution: `${width}x${height}`,
                    fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, fileSizeBytes: file.size,
                    uploadedBy: userEmail, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    tags: ['uploaded', fileType], thumbnail: resultDataUrl,
                    width, height, mimeType: file.type, fileData: base64Data, fileName: file.name
                  });
                  resolve();
                } catch (err) { reject(err); }
              };
              img.onerror = () => reject(new Error("Failed to load image metadata"));
              img.src = resultDataUrl;
            } else {
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.onloadedmetadata = async () => {
                const width = video.videoWidth;
                const height = video.videoHeight;
                const duration = Math.round(video.duration) || 15;
                window.URL.revokeObjectURL(video.src);
                try {
                  await mediaStore.uploadMedia({
                    title, type: fileType, duration, resolution: `${width}x${height}`,
                    fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, fileSizeBytes: file.size,
                    uploadedBy: userEmail, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    tags: ['uploaded', fileType], thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60',
                    width, height, mimeType: file.type, fileData: base64Data, fileName: file.name
                  });
                  resolve();
                } catch (err) { reject(err); }
              };
              video.onerror = async () => {
                try {
                  await mediaStore.uploadMedia({
                    title, type: fileType, duration: 15, resolution: '1920x1080',
                    fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`, fileSizeBytes: file.size,
                    uploadedBy: userEmail, expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    tags: ['uploaded', fileType], thumbnail: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60',
                    width: 1920, height: 1080, mimeType: file.type, fileData: base64Data, fileName: file.name
                  });
                  resolve();
                } catch (err) { reject(err); }
              };
              video.src = URL.createObjectURL(file);
            }
          };

          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });
      } catch (err) {
        console.error("Single file upload error", err);
        toast.error(`Error uploading file "${file.name}": ` + (err instanceof Error ? err.message : String(err)));
      }
      setUploadProgress((count / filesArray.length) * 100);
    }

    showToast(`Successfully uploaded ${filesArray.length} file(s)!`);
    setIsUploadOpen(false);
    setSelectedFiles(null);
    setCustomTitle('');
    loadData();
    setTotalFilesToUpload(0);
    setUploadingFilesCount(0);
    setUploadProgress(0);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      mediaStore.deleteMedia(id);
      showToast(`Deleted "${title}"`);
      loadData();
    }
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => mediaStore.deleteMedia(id));
    const count = selectedIds.length;
    setSelectedIds([]);
    setIsSelectionMode(false);
    setDeleteConfirm(false);
    showToast(`${count} media item(s) deleted`, 'success');
    loadData();
  };

  const filtered = mediaList.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const storageUsedMb = (storageUsedBytes / (1024 * 1024)).toFixed(1);
  const storageUsedPercent = Math.min(100, (storageUsedBytes / (storageLimitGb * 1024 * 1024 * 1024)) * 100);

  return (
    <div className="p-6 space-y-5 text-left relative">
      {/* Toast */}
      {toastMessage && (
        <div className={`fixed top-20 right-6 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border z-50 animate-slideIn ${
          toastType === 'error' ? 'bg-red-600 border-red-700' : 'bg-slate-900 border-slate-700'
        }`}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Media Bucket</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add and store media files for your display screens</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mediaList.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-semibold transition-all shadow-sm cursor-pointer ${
                  isSelectionMode ? 'bg-slate-100 border-slate-350 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <CheckCircle size={14} />
                {isSelectionMode ? 'Cancel Selection' : 'Select'}
              </button>
              {isSelectionMode && selectedIds.length > 0 && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-650 rounded-xl text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition-all shadow-sm cursor-pointer"
                >
                  <Trash size={14} />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
          >
            <Upload size={14} /> Upload Media
          </button>
        </div>
      </div>

      {/* Storage Limit Progress Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs max-w-xl">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
          <span className="font-bold flex items-center gap-1"><HardDrive size={13} /> Storage Usage</span>
          <span className="font-semibold text-slate-900">{storageUsedMb} MB / {storageLimitGb} GB ({storageUsedPercent.toFixed(1)}%)</span>
        </div>
        <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              storageUsedPercent > 90 ? 'bg-rose-500' : storageUsedPercent > 70 ? 'bg-amber-400' : 'bg-blue-600'
            }`}
            style={{ width: `${storageUsedPercent}%` }}
          />
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-2.5 text-xs border border-gray-200 rounded-xl outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'video', 'image', 'ticker'].map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3.5 py-2 text-xs font-bold rounded-xl border capitalize transition-all cursor-pointer ${
                typeFilter === f
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid List */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(media => (
          <div key={media.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all group flex flex-col justify-between relative">
            {isSelectionMode && (
              <div 
                className="absolute inset-0 bg-slate-900/[0.02] hover:bg-slate-900/[0.05] z-45 rounded-2xl cursor-pointer flex items-start p-3"
                onClick={() => toggleSelect(media.id)}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(media.id)}
                  onChange={() => {}}
                  className="w-5 h-5 rounded border-slate-350 text-blue-600 focus:ring-blue-550 cursor-pointer shadow-sm"
                />
              </div>
            )}
            <div className="relative aspect-video overflow-hidden bg-gray-100 border-b border-gray-100">
              {playingVideoId === media.id ? (
                <div className="absolute inset-0 z-30 bg-black">
                  {media.type === 'youtube' ? (
                    (() => {
                      const ytId = getYoutubeId(media.fileUrl || media.thumbnail);
                      return ytId ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-white">Invalid YouTube Link</div>
                      );
                    })()
                  ) : (
                    <video
                      src={media.fileUrl || media.thumbnail}
                      controls
                      autoPlay
                      className="w-full h-full object-cover"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlayingVideoId(null);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/85 hover:bg-slate-900 text-white rounded-lg transition-colors duration-150 cursor-pointer shadow-sm z-40"
                    title="Stop Preview"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <>
                  {media.type === 'video' && (media.fileUrl?.toLowerCase().includes('.mp4') || media.thumbnail?.toLowerCase().includes('.mp4') || media.fileUrl?.toLowerCase().includes('.mov') || media.thumbnail?.toLowerCase().includes('.mov') || media.fileUrl?.toLowerCase().includes('.webm') || media.thumbnail?.toLowerCase().includes('.webm') || media.fileUrl?.toLowerCase().includes('video/') || media.thumbnail?.toLowerCase().includes('video/')) ? (
                    <video
                      src={media.fileUrl || media.thumbnail}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img src={media.thumbnail} alt={media.title} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300 animate-fadeIn" />
                  )}
                  
                  {/* Play button overlay for video or youtube */}
                  {(media.type === 'video' || media.type === 'youtube') && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer group/play"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayingVideoId(media.id);
                      }}
                    >
                      <div className="w-10 h-10 rounded-full bg-white/85 backdrop-blur-xs flex items-center justify-center shadow-lg text-slate-800 group-hover/play:scale-110 transition-transform">
                        <Play size={16} fill="currentColor" className="ml-0.5 text-slate-800" />
                      </div>
                    </div>
                  )}

                  <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-900/70 text-white capitalize flex items-center gap-1">
                    {typeIcons[media.type] || <Film size={10} />}
                    {media.type}
                  </div>
                  
                  {/* Always visible delete button on thumbnail */}
                  {!isSelectionMode && (
                    <button
                      onClick={() => handleDelete(media.id, media.title)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg transition-colors duration-150 cursor-pointer shadow-sm z-35"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
            <div className="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{media.title}</h3>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold pt-1">
                <div className="flex items-center gap-1"><Clock size={11} /> {media.duration}s</div>
                <div className="flex items-center gap-1"><HardDrive size={11} /> {media.type === 'youtube' ? 'YouTube' : media.fileSize}</div>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 space-y-2 border-2 border-dashed border-gray-200 rounded-3xl bg-slate-50/50">
            <HardDrive size={36} className="mx-auto text-slate-300" />
            <p className="text-xs font-semibold">No media items found</p>
            <p className="text-[10px] text-slate-400">Upload images or videos to populate your content pool.</p>
          </div>
        )}
      </div>

      {/* UPLOAD MODAL */}
      {isUploadOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Upload size={16} className="text-blue-600" /> Add Media Content
              </h2>
              <button
                onClick={() => { setIsUploadOpen(false); setSelectedFiles(null); setCustomTitle(''); setTotalFilesToUpload(0); setUploadingFilesCount(0); setUploadProgress(0); }}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {totalFilesToUpload > 0 && (
                <div className="bg-blue-50/50 border border-blue-150 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-800">
                    <span>Uploading files sequentially...</span>
                    <span>{uploadingFilesCount} of {totalFilesToUpload} ({Math.round(uploadProgress)}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1.5">Select File(s) *</label>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={e => {
                    const files = e.target.files;
                    setSelectedFiles(files);
                    if (files && files.length === 1) {
                      setCustomTitle(files[0].name.replace(/\.[^/.]+$/, ""));
                    } else {
                      setCustomTitle('');
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-slate-50 font-medium outline-none focus:border-blue-550"
                  required
                  disabled={totalFilesToUpload > 0}
                />
                <p className="text-[9px] text-gray-400 mt-1">Select one or more images or videos. Images must be under 5MB, videos must be under 50MB.</p>
              </div>

              {filesArray.length <= 1 && (
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Media Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Counter Promotion Slide"
                    value={customTitle}
                    onChange={e => setCustomTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold outline-none focus:border-blue-500 bg-slate-50"
                    disabled={totalFilesToUpload > 0}
                  />
                </div>
              )}

              {filesArray.length > 1 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 text-left">
                  <p className="text-[10px] font-bold text-slate-700">Files to upload ({filesArray.length}):</p>
                  {filesArray.map((file, idx) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] text-slate-600">
                      <span className="truncate max-w-[240px] font-semibold">{file.name}</span>
                      <span className="font-mono">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => { setIsUploadOpen(false); setSelectedFiles(null); setCustomTitle(''); setTotalFilesToUpload(0); setUploadingFilesCount(0); setUploadProgress(0); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  disabled={totalFilesToUpload > 0}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={filesArray.length === 0 || totalFilesToUpload > 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {filesArray.length > 1 ? `Upload ${filesArray.length} Files` : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Selected Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash size={26} className="text-red-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Delete Selected Media</h2>
              <p className="text-sm text-gray-500 mb-1">
                This will permanently delete the <strong>{selectedIds.length} selected media item{selectedIds.length !== 1 ? 's' : ''}</strong> from your bucket.
              </p>
              <p className="text-xs text-red-500 font-semibold mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDeleteSelected} className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">Delete Selected</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
