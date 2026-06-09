import React, { useState, useEffect } from 'react';
import { Search, Upload, Film, Image, Layout, Youtube, AlignLeft, Plus, Trash2, HardDrive, Clock, Tag } from 'lucide-react';
import { mediaStore, MediaItem } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';

const typeIcons: Record<string, React.ReactNode> = {
  video: <Film size={13} />,
  image: <Image size={13} />,
  layout: <Layout size={13} />,
  youtube: <Youtube size={13} />,
  ticker: <AlignLeft size={13} />,
};

const typeColors: Record<string, string> = {
  video: 'bg-blue-100 text-blue-700',
  image: 'bg-teal-100 text-teal-700',
  layout: 'bg-purple-100 text-purple-700',
  youtube: 'bg-red-100 text-red-700',
  ticker: 'bg-orange-100 text-orange-700',
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
  
  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const filesArray = selectedFiles ? (Array.from(selectedFiles) as File[]) : [];
  const [customTitle, setCustomTitle] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = () => {
    const all = mediaStore.getMedia();
    // Filter to only show media belonging to this user
    setMediaList(all.filter(m => m.uploadedBy === userEmail));
    
    // Calculate storage used
    const used = mediaStore.getClientStorageUsedBytes(userEmail);
    setStorageUsedBytes(used);

    // Get storage limit from license
    const licenses = licensingStore.getLicenses();
    const lic = licenses.find(l => l.assignedUserEmail === userEmail);
    if (lic) {
      setStorageLimitGb(lic.storageLimit);
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filesArray.length === 0) {
      alert("Please select at least one file.");
      return;
    }

    // Validate file sizes (under 5MB)
    for (const file of filesArray) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Upload cancelled: The file "${file.name}" is larger than 5MB (${(file.size / (1024 * 1024)).toFixed(1)} MB). All uploaded files must be under 5MB.`);
        return;
      }
    }

    // Check storage quota
    const totalSize = filesArray.reduce((acc, f) => acc + f.size, 0);
    const limitBytes = storageLimitGb * 1024 * 1024 * 1024;
    if (storageUsedBytes + totalSize > limitBytes) {
      alert(`Upload Failed: This upload of ${(totalSize / (1024 * 1024)).toFixed(1)} MB exceeds your remaining license storage limit. Allowed storage: ${storageLimitGb} GB.`);
      return;
    }

    // Process files
    const uploadPromises = filesArray.map((file) => {
      return new Promise<void>((resolve, reject) => {
        const isVideo = file.type.startsWith('video/');
        const fileType = isVideo ? 'video' : 'image';
        const reader = new FileReader();

        reader.onload = (event) => {
          const resultDataUrl = event.target?.result as string;

          const saveWithThumb = (thumbUrl: string) => {
            let title = file.name;
            if (filesArray.length === 1 && customTitle.trim()) {
              title = customTitle.trim();
            } else {
              title = file.name.replace(/\.[^/.]+$/, "");
            }

            mediaStore.uploadMedia({
              title: title,
              type: fileType,
              duration: isVideo ? 15 : 10,
              resolution: '1920x1080',
              fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
              fileSizeBytes: file.size,
              uploadedBy: userEmail,
              expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              tags: ['uploaded', fileType],
              thumbnail: thumbUrl
            });
            resolve();
          };

          if (fileType === 'image') {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 160;
              canvas.height = 90;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, 160, 90);
                const lowResDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                saveWithThumb(lowResDataUrl);
              } else {
                saveWithThumb(resultDataUrl);
              }
            };
            img.src = resultDataUrl;
          } else {
            const videoPlaceholderThumbnail = 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60';
            saveWithThumb(videoPlaceholderThumbnail);
          }
        };

        reader.onerror = () => reject();
        reader.readAsDataURL(file);
      });
    });

    try {
      await Promise.all(uploadPromises);
      showToast(`Successfully uploaded ${filesArray.length} file(s)!`);
      setIsUploadOpen(false);
      setSelectedFiles(null);
      setCustomTitle('');
      loadData();
    } catch (err) {
      alert("An error occurred during file upload.");
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"?`)) {
      mediaStore.deleteMedia(id);
      showToast(`Deleted "${title}"`);
      loadData();
    }
  };

  const filtered = mediaList.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    return matchSearch && matchType;
  });

  const storageUsedMb = (storageUsedBytes / (1024 * 1024)).toFixed(1);
  const storageLimitMb = (storageLimitGb * 1024).toFixed(0);
  const storageUsedPercent = Math.min(100, (storageUsedBytes / (storageLimitGb * 1024 * 1024 * 1024)) * 100);

  return (
    <div className="p-6 space-y-5 text-left relative">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 z-50 animate-slideIn">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Media Bucket</h1>
          <p className="text-sm text-gray-500 mt-0.5">Add and store media files for your display screens</p>
        </div>
        <button 
          onClick={() => setIsUploadOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Upload size={14} /> Upload Media
        </button>
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
          {['all', 'video', 'image', 'youtube', 'ticker'].map(f => (
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
          <div key={media.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-all group flex flex-col justify-between">
            <div className="relative aspect-video overflow-hidden bg-gray-100 border-b border-gray-100">
              <img src={media.thumbnail} alt={media.title} className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300" />
              <button 
                onClick={() => handleDelete(media.id, media.title)}
                className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-rose-600/90 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="p-3.5 space-y-1 flex-1 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{media.title}</h3>
              <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold pt-1">
                <div className="flex items-center gap-1"><Clock size={11} /> {media.duration}s</div>
                <div className="flex items-center gap-1"><HardDrive size={11} /> {media.fileSize}</div>
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
                <Upload size={16} className="text-blue-600" /> Upload Media File
              </h2>
              <button 
                onClick={() => setIsUploadOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
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
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl bg-slate-50 font-medium outline-none focus:border-blue-500"
                  required
                />
                <p className="text-[9px] text-gray-400 mt-1">Select one or more images or videos. Images must be below 5MB.</p>
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
                  onClick={() => {
                    setIsUploadOpen(false);
                    setSelectedFiles(null);
                    setCustomTitle('');
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={filesArray.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {filesArray.length > 1 ? `Upload ${filesArray.length} Files` : 'Upload File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
