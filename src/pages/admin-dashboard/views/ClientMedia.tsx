import React, { useState, useEffect } from 'react';
import { Search, Film, Image, Layout, Youtube, AlignLeft, Trash2, Filter, HardDrive, User, Mail, ShieldAlert, Building2 } from 'lucide-react';
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
      <div>
        <h1 className="text-xl font-bold text-gray-900">Client Media Repository</h1>
        <p className="text-sm text-gray-500 mt-0.5">Oversee and manage media uploads for all client organizations</p>
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
    </div>
  );
}
