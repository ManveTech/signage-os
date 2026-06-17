import React, { useState, useEffect } from 'react';
import { Search, Film, Image, Layout, Youtube, AlignLeft, Trash2, Trash, CheckCircle, Filter, HardDrive, User, Mail, ShieldAlert, Building2, Play, X } from 'lucide-react';
import { mediaStore, MediaItem } from '../../../lib/mediaStore';
import { licensingStore, License } from '../../../lib/licensingStore';

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

export default function ClientMedia() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    // Get all media in the store
    const allMedia = mediaStore.getMedia();
    // Filter out admin's own media, so we only display clients' media
    const clientOnlyMedia = allMedia.filter(m => m.uploadedBy !== 'admin@demo.com' && m.uploadedBy !== 'admin');
    setMediaList(clientOnlyMedia);

    // Get all active/assigned licenses to fetch client emails and org details
    const allLicenses = licensingStore.getLicenses();
    setLicenses(allLicenses.filter(l => l.assignedUserEmail));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete "${title}"? This media will be removed from all client playlists.`)) {
      mediaStore.deleteMedia(id);
      showToast(`Successfully deleted client media: "${title}"`);
      loadData();
    }
  };

  const handleDeleteSelected = () => {
    selectedIds.forEach(id => mediaStore.deleteMedia(id));
    const count = selectedIds.length;
    setSelectedIds([]);
    setIsSelectionMode(false);
    setDeleteConfirm(false);
    showToast(`Successfully deleted ${count} client media item(s).`);
    loadData();
  };

  // Get unique list of organizations from licenses
  const organizations = Array.from(new Set(licenses.map(l => l.assignedOrgName).filter(Boolean))) as string[];

  // Get list of clients who have uploaded items or have active licenses, filtered by organization
  const clientEmails = Array.from(new Set([
    ...licenses
      .filter(l => selectedOrg === 'all' || (selectedOrg === 'none' ? !l.assignedOrgName : l.assignedOrgName === selectedOrg))
      .map(l => l.assignedUserEmail)
      .filter(Boolean),
    ...mediaList
      .filter(m => {
        if (selectedOrg === 'all') return true;
        const lic = licenses.find(l => l.assignedUserEmail === m.uploadedBy);
        return selectedOrg === 'none' ? (!lic || !lic.assignedOrgName) : (!!lic && lic.assignedOrgName === selectedOrg);
      })
      .map(m => m.uploadedBy)
  ])) as string[];

  const getClientDisplayName = (email: string) => {
    const lic = licenses.find(l => l.assignedUserEmail === email);
    if (lic && lic.assignedOrgName) {
      return `${lic.assignedOrgName} (${email})`;
    }
    return email;
  };

  const filteredMedia = mediaList.filter(media => {
    const matchSearch = media.title.toLowerCase().includes(search.toLowerCase());
    
    let matchOrg = true;
    if (selectedOrg !== 'all') {
      const lic = licenses.find(l => l.assignedUserEmail === media.uploadedBy);
      if (selectedOrg === 'none') {
        matchOrg = !lic || !lic.assignedOrgName;
      } else {
        matchOrg = !!lic && lic.assignedOrgName === selectedOrg;
      }
    }

    const matchUser = selectedUser === 'all' || media.uploadedBy === selectedUser;
    const matchType = typeFilter === 'all' || media.type === typeFilter;
    return matchSearch && matchOrg && matchUser && matchType;
  });

  // Calculate storage usage details for the selected user (if any)
  const getSelectedUserStorageInfo = () => {
    if (selectedUser === 'all') return null;
    const email = selectedUser;
    const bytesUsed = mediaStore.getClientStorageUsedBytes(email);
    const mbUsed = (bytesUsed / (1024 * 1024)).toFixed(1);
    
    const lic = licenses.find(l => l.assignedUserEmail === email);
    const limitGb = lic ? lic.storageLimit : 5;
    const percent = Math.min(100, (bytesUsed / (limitGb * 1024 * 1024 * 1024)) * 100);
    
    return {
      mbUsed,
      limitGb,
      percent,
      orgName: lic?.assignedOrgName || 'Independent client'
    };
  };

  const storageInfo = getSelectedUserStorageInfo();

  return (
    <div className="p-6 space-y-5 text-left relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 z-50 animate-slideIn">
          {toastMessage}
        </div>
      )}

      {/* Title */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Client Media Repository</h1>
          <p className="text-sm text-gray-500 mt-0.5">Oversee and manage media uploads for all client organizations</p>
        </div>
        {filteredMedia.length > 0 && (
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
                className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-650 rounded-xl text-xs font-semibold hover:bg-red-100 hover:border-red-300 transition-all shadow-sm cursor-pointer animate-fadeIn"
              >
                <Trash size={14} />
                Delete Selected ({selectedIds.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* User Storage Widget */}
      {storageInfo && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs max-w-xl flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <HardDrive size={22} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">{storageInfo.orgName}</span>
              <span className="text-xs text-gray-500 font-semibold">{storageInfo.mbUsed} MB / {storageInfo.limitGb} GB</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  storageInfo.percent > 90 ? 'bg-rose-500' : storageInfo.percent > 70 ? 'bg-amber-400' : 'bg-blue-600'
                }`}
                style={{ width: `${storageInfo.percent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Filters Panel */}
      <div className="bg-white p-4 border border-gray-200 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={14} className="absolute left-3 top-3 text-gray-400" />
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search client media..." 
            className="w-full pl-9 pr-4 py-2 text-xs border border-gray-200 rounded-xl outline-none focus:border-blue-400" 
          />
        </div>

        {/* Organization Filter */}
        <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
          <Building2 size={13} className="text-gray-400" />
          <select 
            value={selectedOrg} 
            onChange={e => {
              setSelectedOrg(e.target.value);
              setSelectedUser('all'); // Reset user filter when org changes
            }}
            className="px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-white font-bold text-slate-700 min-w-[200px]"
          >
            <option value="all">All Organizations</option>
            {organizations.map(org => (
              <option key={org} value={org}>{org}</option>
            ))}
            <option value="none">Independent / No Org</option>
          </select>
        </div>

        {/* User filter */}
        <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
          <Filter size={13} className="text-gray-400" />
          <select 
            value={selectedUser} 
            onChange={e => setSelectedUser(e.target.value)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-white font-bold text-slate-700 min-w-[200px]"
          >
            <option value="all">All Clients</option>
            {clientEmails.map(email => (
              <option key={email} value={email}>{getClientDisplayName(email)}</option>
            ))}
          </select>
        </div>

        {/* Type Filter */}
        <div className="flex gap-1">
          {['all', 'video', 'image', 'youtube', 'ticker'].map(type => (
            <button 
              key={type} 
              onClick={() => setTypeFilter(type)} 
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border capitalize transition-all cursor-pointer ${
                typeFilter === type 
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-slate-800'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredMedia.map(media => {
          const lic = licenses.find(l => l.assignedUserEmail === media.uploadedBy);
          return (
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
              
              <div className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 line-clamp-1">{media.title}</h3>
                  {/* Client Info badge */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-[9.5px] text-blue-600 font-bold bg-blue-50/50 px-2 py-1 rounded-md w-fit">
                    <User size={10} />
                    <span className="truncate max-w-[150px]">{lic?.assignedOrgName || media.uploadedBy}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-[9.5px] text-gray-400 border-t border-gray-50 pt-2 font-semibold">
                  <div>Duration: <span className="text-slate-700">{media.duration}s</span></div>
                  <div>Size: <span className="text-slate-700">{media.fileSize}</span></div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMedia.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 space-y-2 border-2 border-dashed border-gray-200 rounded-3xl bg-slate-50/50">
            <ShieldAlert size={36} className="mx-auto text-slate-350" />
            <p className="text-xs font-semibold">No client media matches selection</p>
            <p className="text-[10px] text-slate-450">Ensure clients have uploaded files or select a different filter.</p>
          </div>
        )}
      </div>
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
                This will permanently delete the <strong>{selectedIds.length} selected media item{selectedIds.length !== 1 ? 's' : ''}</strong> matching the active filter selections from client storage.
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
