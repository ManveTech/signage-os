import React, { useState, useEffect } from 'react';
import { 
  Plus, Monitor, Film, Calendar, Trash2, Edit3, ArrowLeft, Play, Pause, 
  Tv, CheckSquare, Square, FolderOpen, Save, Clock, ChevronRight, User, Filter, AlertTriangle, Building2
} from 'lucide-react';
import { mediaStore, Playlist, MediaItem, Screen } from '../../../lib/mediaStore';
import { licensingStore, License } from '../../../lib/licensingStore';

const scheduleColors: Record<string, string> = {
  Running: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  Paused: 'bg-yellow-50 text-yellow-700 border-yellow-100',
};

interface Props {
  onNavigate?: (v: string) => void;
}

export default function ClientPlaylists({ onNavigate }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Navigation mode states: 'list' | 'create' | 'edit'
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);

  // Form states
  const [playlistName, setPlaylistName] = useState('');
  const [selectedClientEmail, setSelectedClientEmail] = useState('');
  const [transition, setTransition] = useState('fade');
  const [volume, setVolume] = useState(80);
  const [loop, setLoop] = useState(true);
  const [shuffle, setShuffle] = useState(false);
  const [playlistItems, setPlaylistItems] = useState<{ mediaId: string; customDuration: number }[]>([]);

  // Assign screen modal state
  const [assignModalPlaylist, setAssignModalPlaylist] = useState<Playlist | null>(null);
  const [tempScreenAssignments, setTempScreenAssignments] = useState<string[]>([]);

  // Media Picker Modal inside Playlist Editor
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState<'bucket' | 'upload'>('bucket');
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  // Media Quick Upload Form
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<'image' | 'video'>('image');
  const [uploadDuration, setUploadDuration] = useState(15);
  const [uploadSizeMb, setUploadSizeMb] = useState(2);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allPlaylists = mediaStore.getPlaylists();
    // Only display client playlists (exclude admin's own playlists)
    const clientPlaylists = allPlaylists.filter(p => p.createdBy !== 'admin@demo.com' && p.createdBy !== 'admin');
    setPlaylists(clientPlaylists);

    setMediaList(mediaStore.getMedia());
    setScreens(mediaStore.getScreens());

    const allLicenses = licensingStore.getLicenses();
    setLicenses(allLicenses.filter(l => l.assignedUserEmail));

    const storedGroups = localStorage.getItem('signageos_groups');
    setGroups(storedGroups ? JSON.parse(storedGroups) : []);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getClientDisplayName = (email: string) => {
    const lic = licenses.find(l => l.assignedUserEmail === email);
    return lic && lic.assignedOrgName ? `${lic.assignedOrgName} (${email})` : email;
  };

  // Get unique list of organizations from licenses
  const organizations = Array.from(new Set(licenses.map(l => l.assignedOrgName).filter(Boolean))) as string[];

  const clientEmails = Array.from(new Set(
    licenses
      .filter(l => selectedOrgFilter === 'all' || (selectedOrgFilter === 'none' ? !l.assignedOrgName : l.assignedOrgName === selectedOrgFilter))
      .map(l => l.assignedUserEmail)
      .filter(Boolean)
  )) as string[];

  // -------------------------------------------------------------
  // PLAYLIST LIST VIEWS ACTIONS
  // -------------------------------------------------------------
  const handleDeletePlaylist = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the playlist "${name}"? It will be unassigned from all client screens.`)) {
      mediaStore.deletePlaylist(id);
      showToast(`Playlist "${name}" deleted.`);
      loadData();
    }
  };

  const handleOpenAssignModal = (playlist: Playlist) => {
    setAssignModalPlaylist(playlist);
    // Find screens currently assigned to this playlist
    const assignedScreenIds = screens
      .filter(s => s.playlistId === playlist.id)
      .map(s => s.id);
    setTempScreenAssignments(assignedScreenIds);
  };

  const handleSaveScreenAssignments = () => {
    if (!assignModalPlaylist) return;
    
    // Find all screens belonging to this client
    const clientEmail = assignModalPlaylist.createdBy;
    const clientScreens = screens.filter(s => s.assignedToUserEmail === clientEmail);
    
    // For each client screen, update based on selections
    clientScreens.forEach(screen => {
      const isCurrentlySelected = tempScreenAssignments.includes(screen.id);
      const isCurrentlyAssignedToThisPlaylist = screen.playlistId === assignModalPlaylist.id;
      
      if (isCurrentlySelected && !isCurrentlyAssignedToThisPlaylist) {
        // Assign playlist
        mediaStore.assignPlaylistToScreen(screen.id, assignModalPlaylist.id);
      } else if (!isCurrentlySelected && isCurrentlyAssignedToThisPlaylist) {
        // Unassign playlist
        mediaStore.assignPlaylistToScreen(screen.id, undefined);
      }
    });

    showToast(`Screens assigned successfully for "${assignModalPlaylist.name}"`);
    setAssignModalPlaylist(null);
    loadData();
  };

  // -------------------------------------------------------------
  // PLAYLIST CREATION & EDITING FORM ACTIONS
  // -------------------------------------------------------------
  const handleOpenCreateMode = () => {
    localStorage.setItem('signageos_create_playlist_for_client', 'new');
    if (onNavigate) {
      onNavigate('my-create-playlist');
    }
  };

  const handleOpenEditMode = (playlist: Playlist) => {
    localStorage.setItem('signageos_editing_playlist_id', playlist.id);
    localStorage.setItem('signageos_create_playlist_for_client', playlist.createdBy);
    if (onNavigate) {
      onNavigate('my-create-playlist');
    }
  };

  const handleOpenMediaPicker = () => {
    if (!selectedClientEmail) {
      alert('Please select a client organization first.');
      return;
    }
    setTempSelectedIds(playlistItems.map(item => item.mediaId));
    setIsPickerOpen(true);
    setPickerTab('bucket');
  };

  const handleAddSelectedFromPicker = () => {
    const clientMedia = mediaList.filter(m => m.uploadedBy === selectedClientEmail);
    const newItems = tempSelectedIds.map(id => {
      const existing = playlistItems.find(item => item.mediaId === id);
      const media = clientMedia.find(m => m.id === id);
      return {
        mediaId: id,
        customDuration: existing ? existing.customDuration : (media ? media.duration : 15)
      };
    });
    setPlaylistItems(newItems);
    setIsPickerOpen(false);
  };

  const handleQuickUploadMedia = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !selectedClientEmail) return;
    if (uploadSizeMb > 5) {
      alert("All uploaded files must be under 5MB.");
      return;
    }

    // Check storage limits for this client
    const newSizeBytes = Math.round(uploadSizeMb * 1024 * 1024);
    const bytesUsed = mediaStore.getClientStorageUsedBytes(selectedClientEmail);
    const clientLic = licenses.find(l => l.assignedUserEmail === selectedClientEmail);
    const limitGb = clientLic ? clientLic.storageLimit : 5;
    const limitBytes = limitGb * 1024 * 1024 * 1024;

    if (bytesUsed + newSizeBytes > limitBytes) {
      alert(`Upload Failed: This upload exceeds the client's storage limit of ${limitGb} GB.`);
      return;
    }

    const defaultThumbnails: Record<string, string> = {
      image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=400&fit=crop&q=60',
      video: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&fit=crop&q=60',
    };

    const newMedia = mediaStore.uploadMedia({
      title: uploadTitle,
      type: uploadType,
      duration: Number(uploadDuration),
      resolution: '1920x1080',
      fileSize: `${uploadSizeMb} MB`,
      fileSizeBytes: newSizeBytes,
      uploadedBy: selectedClientEmail,
      expiryDate: '2027-12-31',
      tags: ['admin-uploaded', 'playlist-direct'],
      thumbnail: defaultThumbnails[uploadType]
    });

    // Add to item sequence list
    setPlaylistItems(prev => [...prev, { mediaId: newMedia.id, customDuration: newMedia.duration }]);
    
    // Refresh media listings
    loadData();
    setIsPickerOpen(false);
    
    // Reset form inputs
    setUploadTitle('');
    setUploadDuration(15);
    setUploadSizeMb(2);
    
    showToast(`Uploaded "${uploadTitle}" directly to client's bucket and added to playlist!`);
  };

  const handleSaveFormSubmit = () => {
    if (!playlistName) {
      alert('Please enter a playlist name.');
      return;
    }
    if (playlistItems.length === 0) {
      alert('Please add at least one media item to the sequence.');
      return;
    }

    if (mode === 'create') {
      mediaStore.createPlaylist({
        name: playlistName,
        active: true,
        scheduleStatus: 'Running',
        createdBy: selectedClientEmail,
        mediaIds: playlistItems.map(item => item.mediaId),
        assignedScreenIds: []
      });
      showToast(`Playlist "${playlistName}" created successfully for client.`);
    } else if (mode === 'edit' && editingPlaylistId) {
      mediaStore.updatePlaylist(editingPlaylistId, {
        name: playlistName,
        mediaIds: playlistItems.map(item => item.mediaId)
      });
      showToast(`Playlist "${playlistName}" updated successfully.`);
    }

    setMode('list');
    loadData();
  };

  // -------------------------------------------------------------
  // HELPER DATA CALCULATIONS
  // -------------------------------------------------------------
  const filteredPlaylists = playlists.filter(p => {
    let matchOrg = true;
    if (selectedOrgFilter !== 'all') {
      const lic = licenses.find(l => l.assignedUserEmail === p.createdBy);
      if (selectedOrgFilter === 'none') {
        matchOrg = !lic || !lic.assignedOrgName;
      } else {
        matchOrg = !!lic && lic.assignedOrgName === selectedOrgFilter;
      }
    }

    const matchClient = selectedClientFilter === 'all' || p.createdBy === selectedClientFilter;
    return matchOrg && matchClient;
  });

  const getClientScreens = (clientEmail: string) => {
    return screens.filter(s => s.assignedToUserEmail === clientEmail);
  };

  // Reorder items
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= playlistItems.length) return;
    
    const items = [...playlistItems];
    const temp = items[index];
    items[index] = items[targetIndex];
    items[targetIndex] = temp;
    setPlaylistItems(items);
  };

  return (
    <div className="p-6 space-y-5 text-left relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl border border-slate-700 z-50 animate-slideIn">
          {toastMessage}
        </div>
      )}

      {/* MODE 1: LISTING VIEW */}
      {mode === 'list' && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Client Playlists</h1>
              <p className="text-sm text-gray-500 mt-0.5">Manage digital playlists created by or assigned to client screens</p>
            </div>
            <button 
              onClick={handleOpenCreateMode}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
            >
              <Plus size={14} /> Create Client Playlist
            </button>
          </div>

          {/* Filter Panel */}
          <div className="bg-white p-4 border border-gray-200 rounded-2xl flex flex-col md:flex-row gap-4 items-center">
            {/* Org filter */}
            <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
              <Building2 size={13} className="text-gray-400" />
              <select 
                value={selectedOrgFilter} 
                onChange={e => {
                  setSelectedOrgFilter(e.target.value);
                  setSelectedClientFilter('all'); // Reset client filter when org changes
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

            {/* Client filter */}
            <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
              <Filter size={13} className="text-gray-400" />
              <select 
                value={selectedClientFilter} 
                onChange={e => setSelectedClientFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-white font-bold text-slate-700 min-w-[200px]"
              >
                <option value="all">All Clients</option>
                {clientEmails.map(email => (
                  <option key={email} value={email}>{getClientDisplayName(email)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Playlist Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlaylists.map(playlist => {
              const clientLic = licenses.find(l => l.assignedUserEmail === playlist.createdBy);
              const clientScreens = getClientScreens(playlist.createdBy);
              const assignedToScreensCount = screens.filter(s => s.playlistId === playlist.id).length;
              const assignedGroups = groups.filter(g => g.playlist === playlist.name);
              const assignedIndividualScreens = screens.filter(s => 
                !s.groupId && (s.playlist === playlist.name || s.playlistId === playlist.id)
              );

              return (
                <div key={playlist.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          const updatedActive = !playlist.active;
                          mediaStore.updatePlaylist(playlist.id, { 
                            active: updatedActive,
                            scheduleStatus: updatedActive ? 'Running' : 'Paused'
                          });
                          showToast(`Playlist "${playlist.name}" is now ${updatedActive ? 'active' : 'paused'}.`);
                          loadData();
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                          playlist.active ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-500'
                        }`}
                        title={playlist.active ? "Pause Playlist" : "Activate Playlist"}
                      >
                        {playlist.active ? <Play size={18} className="ml-0.5" /> : <Pause size={18} />}
                      </button>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-800 truncate max-w-[150px]" title={playlist.name}>{playlist.name}</h3>
                        <p className="text-[10px] text-gray-450 mt-0.5">Created: {playlist.createdDate}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button 
                        onClick={() => handleOpenEditMode(playlist)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Edit Playlist"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button 
                        onClick={() => handleDeletePlaylist(playlist.id, playlist.name)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete Playlist"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Owner Label */}
                  <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-[10px] text-slate-600 font-bold rounded-lg border border-slate-100">
                    <User size={10} className="text-slate-400" />
                    <span className="truncate">{clientLic?.assignedOrgName || playlist.createdBy}</span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-50/40 p-2 rounded-xl border border-slate-100">
                    <div className="text-center py-1">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Media Items</p>
                      <p className="text-sm font-black text-slate-700 flex items-center justify-center gap-1 mt-0.5"><Film size={12} className="text-slate-400" />{playlist.mediaCount}</p>
                    </div>
                    <div className="text-center py-1">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Assigned TVs</p>
                      <p className="text-sm font-black text-slate-700 flex items-center justify-center gap-1 mt-0.5"><Monitor size={12} className="text-slate-400" />{assignedToScreensCount}</p>
                    </div>
                  </div>

                  {/* Assignments Section */}
                  <div className="space-y-1.5 pt-2 border-t border-dashed border-gray-100 text-left">
                    <div className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Assignments</div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 font-semibold">Groups:</span>
                        {assignedGroups.length > 0 ? (
                          assignedGroups.map(g => (
                            <span key={g.id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold border border-blue-100">
                              {g.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">None</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-gray-500 font-semibold">Individual TVs:</span>
                        {assignedIndividualScreens.length > 0 ? (
                          assignedIndividualScreens.map(s => (
                            <span key={s.id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[9px] font-bold border border-slate-200">
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[9px] text-gray-400 italic">None</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Footer Assignment Options */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${scheduleColors[playlist.scheduleStatus]}`}>
                      <Calendar size={9} /> {playlist.scheduleStatus}
                    </span>
                    <button 
                      onClick={() => handleOpenAssignModal(playlist)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Tv size={11} /> Assign Screens
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredPlaylists.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 space-y-2 border-2 border-dashed border-gray-200 rounded-3xl bg-slate-50/50">
                <FolderOpen size={36} className="mx-auto text-slate-350" />
                <p className="text-xs font-semibold">No playlists found</p>
                <p className="text-[10px] text-slate-450">Select a different client filter or create a new playlist.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODE 2 & 3: CREATE OR EDIT CLIENT PLAYLIST FORM */}
      {(mode === 'create' || mode === 'edit') && (
        <div className="space-y-5 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMode('list')}
              className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all cursor-pointer text-slate-600"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{mode === 'create' ? 'Create Client Playlist' : 'Edit Playlist Profile'}</h1>
              <p className="text-sm text-gray-500 mt-0.5">Customize display layouts, transitions, and media slide sequences</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left settings column */}
            <div className="lg:col-span-4 bg-white rounded-3xl border border-gray-200 p-5 space-y-4 shadow-xs">
              <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">Playlist Specifications</h2>
              
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Playlist Name *</label>
                <input 
                  value={playlistName} 
                  onChange={e => setPlaylistName(e.target.value)} 
                  placeholder="e.g. Lobby Entrance Carousel" 
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-semibold text-slate-800 text-xs" 
                />
              </div>

              {/* Client Selector (Only editable on create) */}
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Client Organization *</label>
                {mode === 'create' ? (
                  <select 
                    value={selectedClientEmail} 
                    onChange={e => {
                      setSelectedClientEmail(e.target.value);
                      // Clear playlist items if switching client so they don't leak media assets
                      setPlaylistItems([]);
                    }}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white font-bold text-slate-700 text-xs"
                  >
                    {clientEmails.map(email => (
                      <option key={email} value={email}>{getClientDisplayName(email)}</option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700">
                    {getClientDisplayName(selectedClientEmail)}
                  </div>
                )}
              </div>

              {/* Layout controls */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Transition</label>
                  <select 
                    value={transition} 
                    onChange={e => setTransition(e.target.value)} 
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl outline-none focus:border-blue-500 bg-white font-semibold text-slate-800 text-xs"
                  >
                    {['fade', 'slide', 'zoom', 'none'].map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Audio Vol</label>
                  <input 
                    type="range" 
                    min={0} 
                    max={100} 
                    value={volume} 
                    onChange={e => setVolume(Number(e.target.value))} 
                    className="w-full mt-2.5 accent-blue-600 cursor-pointer" 
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div 
                    className={`w-9 h-5 rounded-full transition-colors relative ${shuffle ? 'bg-blue-600' : 'bg-slate-200'}`} 
                    onClick={() => setShuffle(!shuffle)}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-transform ${shuffle ? 'translate-x-4.5' : 'translate-x-0.75'}`} />
                  </div>
                  <span className="text-xs text-slate-700 font-bold">Shuffle Slide Ordering</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div 
                    className={`w-9 h-5 rounded-full transition-colors relative ${loop ? 'bg-blue-600' : 'bg-slate-200'}`} 
                    onClick={() => setLoop(!loop)}
                  >
                    <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-transform ${loop ? 'translate-x-4.5' : 'translate-x-0.75'}`} />
                  </div>
                  <span className="text-xs text-slate-700 font-bold">Infinite Loop Mode</span>
                </label>
              </div>

              <button 
                onClick={handleSaveFormSubmit}
                className="w-full mt-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs uppercase tracking-wider font-extrabold rounded-xl transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
              >
                <Save size={14} /> Save Playlist
              </button>
            </div>

            {/* Right sequence ordering column */}
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-white rounded-3xl border border-gray-200 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-black uppercase text-slate-800 tracking-wider">Sequence Timeline ({playlistItems.length} items)</h2>
                  <button 
                    onClick={handleOpenMediaPicker}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-750 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-xs"
                  >
                    <Plus size={12} className="stroke-[3]" /> Add Slide Content
                  </button>
                </div>

                {playlistItems.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-2 border-2 border-dashed border-gray-200 rounded-3xl bg-slate-50/50">
                    <FolderOpen size={32} className="mx-auto text-slate-355" />
                    <p className="text-xs font-semibold">Timeline list is empty</p>
                    <p className="text-[10px] text-slate-450">Click "Add Slide Content" to upload videos, images, or ticker alerts for this client.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                    {playlistItems.map((item, index) => {
                      const media = mediaList.find(m => m.id === item.mediaId);
                      if (!media) return null;

                      return (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50/60 hover:bg-slate-50 border border-slate-200 rounded-xl transition-all group">
                          <span className="text-[10px] font-black text-slate-400 w-5 shrink-0 text-center">#{index + 1}</span>
                          <img src={media.thumbnail} alt={media.title} className="w-12 h-8 rounded-lg object-cover shrink-0 border border-slate-200" />
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{media.title}</p>
                            <p className="text-[9.5px] text-slate-400 capitalize">{media.type}</p>
                          </div>

                          {/* Duration input */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Clock size={11} className="text-gray-400" />
                            <input 
                              type="number"
                              value={item.customDuration}
                              onChange={e => {
                                const copy = [...playlistItems];
                                copy[index].customDuration = Number(e.target.value);
                                setPlaylistItems(copy);
                              }}
                              className="w-12 px-1.5 py-1 text-xs border border-slate-200 rounded text-center font-bold text-slate-800 bg-white"
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">s</span>
                          </div>

                          {/* Reordering indicators */}
                          <div className="flex flex-col gap-0.5">
                            <button 
                              onClick={() => handleMoveItem(index, 'up')}
                              disabled={index === 0}
                              className={`p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-500 disabled:opacity-30 ${index === 0 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              ▲
                            </button>
                            <button 
                              onClick={() => handleMoveItem(index, 'down')}
                              disabled={index === playlistItems.length - 1}
                              className={`p-0.5 hover:bg-gray-200 rounded transition-colors text-gray-500 disabled:opacity-30 ${index === playlistItems.length - 1 ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              ▼
                            </button>
                          </div>

                          <button 
                            onClick={() => setPlaylistItems(prev => prev.filter((_, i) => i !== index))} 
                            className="text-slate-350 hover:text-rose-600 transition-colors p-1 cursor-pointer shrink-0"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN PLAYLIST TO SCREENS */}
      {assignModalPlaylist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleIn text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Tv size={16} className="text-blue-600" /> Screen Broadcasting Matrix
              </h2>
              <button onClick={() => setAssignModalPlaylist(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer">&times;</button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Assign playlist <span className="font-bold text-slate-800">"{assignModalPlaylist.name}"</span> to client TV screens. Only screens registered under client account <span className="font-bold text-slate-850">{assignModalPlaylist.createdBy}</span> are eligible.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {getClientScreens(assignModalPlaylist.createdBy).map(screen => {
                const isSelected = tempScreenAssignments.includes(screen.id);
                return (
                  <div 
                    key={screen.id} 
                    onClick={() => {
                      setTempScreenAssignments(prev => 
                        prev.includes(screen.id) ? prev.filter(sid => sid !== screen.id) : [...prev, screen.id]
                      );
                    }}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${screen.status === 'online' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Monitor size={15} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{screen.name}</p>
                        <p className="text-[10px] text-gray-400">Current Broadcast: {screen.playlist}</p>
                      </div>
                    </div>
                    <div>
                      {isSelected ? (
                        <CheckSquare size={16} className="text-blue-600 stroke-[2.5]" />
                      ) : (
                        <Square size={16} className="text-gray-300 stroke-[2.5]" />
                      )}
                    </div>
                  </div>
                );
              })}

              {getClientScreens(assignModalPlaylist.createdBy).length === 0 && (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1.5">
                  <AlertTriangle size={24} className="text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No screens registered</p>
                  <p className="text-[10px] text-slate-400">This client does not have any active TV displays.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setAssignModalPlaylist(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
              >
                Cancel
              </button>
              <button
                disabled={getClientScreens(assignModalPlaylist.createdBy).length === 0}
                onClick={handleSaveScreenAssignments}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Broadcast Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CHOOSE MEDIA / UPLOAD DIRECTLY FOR PLAYLIST */}
      {isPickerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleIn text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <FolderOpen size={16} className="text-blue-500" /> Assemble Playlist Slides
              </h2>
              <button onClick={() => setIsPickerOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer">&times;</button>
            </div>

            {/* Picker tabs */}
            <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl w-fit">
              <button
                onClick={() => setPickerTab('bucket')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  pickerTab === 'bucket' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Client's Media Bucket
              </button>
              <button
                onClick={() => setPickerTab('upload')}
                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                  pickerTab === 'upload' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Upload File Directly
              </button>
            </div>

            {/* Tab 1: Client media bucket selection */}
            {pickerTab === 'bucket' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                  {mediaList.filter(m => m.uploadedBy === selectedClientEmail).map(m => {
                    const isSelected = tempSelectedIds.includes(m.id);
                    return (
                      <div 
                        key={m.id} 
                        onClick={() => {
                          setTempSelectedIds(prev => 
                            prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                          );
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-2.5 ${
                          isSelected ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 hover:border-slate-200'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'
                        }`}>
                          {isSelected && <Plus size={10} className="stroke-[3]" />}
                        </div>
                        <img src={m.thumbnail} alt={m.title} className="w-12 h-8 rounded-lg object-cover shrink-0 border border-slate-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-slate-800 truncate">{m.title}</p>
                          <p className="text-[9px] text-slate-400 capitalize">{m.type} · {m.duration}s</p>
                        </div>
                      </div>
                    );
                  })}

                  {mediaList.filter(m => m.uploadedBy === selectedClientEmail).length === 0 && (
                    <div className="col-span-full py-8 text-center text-slate-400 italic text-[11px]">
                      This client's media library is empty.
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setIsPickerOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSelectedFromPicker}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer text-xs"
                  >
                    Apply Selection ({tempSelectedIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Upload new directly inside client bucket */}
            {pickerTab === 'upload' && (
              <form onSubmit={handleQuickUploadMedia} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Slide Title</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Coffee Promo Poster"
                    required
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl font-semibold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">File Type</label>
                    <select 
                      value={uploadType}
                      onChange={e => setUploadType(e.target.value as any)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-white"
                    >
                      <option value="image">Image</option>
                      <option value="video">Video</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Duration (Secs)</label>
                    <input 
                      type="number" 
                      required
                      value={uploadDuration}
                      onChange={e => setUploadDuration(Number(e.target.value))}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Estimated File Size (MB)</label>
                  <input 
                    type="number" 
                    required
                    value={uploadSizeMb}
                    onChange={e => setUploadSizeMb(Number(e.target.value))}
                    className="w-full px-3.5 py-2 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsPickerOpen(false)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer text-xs"
                  >
                    Upload & Add to Sequence
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
