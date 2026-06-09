import React, { useState, useEffect } from 'react';
import { Plus, Monitor, Film, Calendar, Trash2, Play, Pause, Tv, CheckSquare, Square, FolderOpen, AlertTriangle, Edit } from 'lucide-react';
import { mediaStore, Playlist, Screen } from '../../../../lib/mediaStore';

const scheduleColors: Record<string, string> = {
  Running: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  Paused: 'bg-yellow-50 text-yellow-700 border-yellow-100',
};

interface Props {
  onNavigate: (v: string) => void;
  userEmail?: string;
}

export default function AllPlaylists({ onNavigate, userEmail = 'admin@demo.com' }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Assign screen modal state
  const [assignModalPlaylist, setAssignModalPlaylist] = useState<Playlist | null>(null);
  const [tempScreenAssignments, setTempScreenAssignments] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = () => {
    const allPlaylists = mediaStore.getPlaylists();
    // Filter to only show playlists created by the admin
    setPlaylists(allPlaylists.filter(p => p.createdBy === userEmail));
    setScreens(mediaStore.getScreens());
    const storedGroups = localStorage.getItem('signageos_groups');
    setGroups(storedGroups ? JSON.parse(storedGroups) : []);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the playlist "${name}"? It will be unassigned from all screens.`)) {
      mediaStore.deletePlaylist(id);
      showToast(`Playlist "${name}" deleted successfully.`);
      loadData();
    }
  };

  const handleToggleActive = (playlist: Playlist) => {
    const nextActive = !playlist.active;
    const nextStatus = nextActive ? 'Running' : 'Paused';
    mediaStore.updatePlaylist(playlist.id, { 
      active: nextActive,
      scheduleStatus: nextStatus
    });
    showToast(`Playlist "${playlist.name}" is now ${nextActive ? 'active' : 'paused'}.`);
    loadData();
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

    // Find screens owned by admin
    const adminScreens = screens.filter(s => s.assignedToUserEmail === userEmail);

    // Apply or remove assignments
    adminScreens.forEach(screen => {
      const isSelected = tempScreenAssignments.includes(screen.id);
      const isAssigned = screen.playlistId === assignModalPlaylist.id;

      if (isSelected && !isAssigned) {
        mediaStore.assignPlaylistToScreen(screen.id, assignModalPlaylist.id);
      } else if (!isSelected && isAssigned) {
        mediaStore.assignPlaylistToScreen(screen.id, undefined);
      }
    });

    showToast(`Playlist broadcast settings updated for "${assignModalPlaylist.name}"`);
    setAssignModalPlaylist(null);
    loadData();
  };

  const adminScreens = screens.filter(s => s.assignedToUserEmail === userEmail);

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
          <h1 className="text-xl font-bold text-gray-900">My Channel Playlists</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage layout playlists broadcasting to your local screens</p>
        </div>
        <button 
          onClick={() => onNavigate('my-create-playlist')} 
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Plus size={14} /> Create Playlist
        </button>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map(playlist => {
          const assignedScreensCount = screens.filter(s => s.playlistId === playlist.id).length;
          const assignedGroups = groups.filter(g => g.playlist === playlist.name);
          const assignedIndividualScreens = screens.filter(s => 
            !s.groupId && (s.playlist === playlist.name || s.playlistId === playlist.id)
          );
          return (
            <div key={playlist.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleToggleActive(playlist)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                      playlist.active ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                    }`}
                    title={playlist.active ? 'Pause Playlist' : 'Activate Playlist'}
                  >
                    {playlist.active ? <Play size={18} className="ml-0.5" /> : <Pause size={18} />}
                  </button>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-slate-800 truncate max-w-[155px]" title={playlist.name}>{playlist.name}</h3>
                    <p className="text-[10px] text-gray-450 mt-0.5">Created: {playlist.createdDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => {
                      localStorage.setItem('signageos_editing_playlist_id', playlist.id);
                      onNavigate('my-create-playlist');
                    }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    title="Edit Playlist"
                  >
                    <Edit size={13} />
                  </button>
                  <button 
                    onClick={() => handleDelete(playlist.id, playlist.name)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete Playlist"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50/55 p-2.5 rounded-xl border border-slate-100 text-center">
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Media Slides</p>
                  <p className="text-sm font-black text-slate-800 flex items-center justify-center gap-1 mt-0.5"><Film size={11} className="text-gray-455" /> {playlist.mediaCount}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">Active Screens</p>
                  <p className="text-sm font-black text-slate-800 flex items-center justify-center gap-1 mt-0.5"><Monitor size={11} className="text-gray-455" /> {assignedScreensCount}</p>
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

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${scheduleColors[playlist.scheduleStatus]}`}>
                  <Calendar size={9} /> {playlist.scheduleStatus}
                </span>
                <button 
                  onClick={() => handleOpenAssignModal(playlist)}
                  className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-[10px] font-black uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Tv size={11} /> Broadcast Screens
                </button>
              </div>
            </div>
          );
        })}

        {playlists.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-450 space-y-2 border-2 border-dashed border-gray-200 rounded-3xl bg-slate-50/50">
            <FolderOpen size={36} className="mx-auto text-slate-350" />
            <p className="text-xs font-semibold">No playlists created yet</p>
            <p className="text-[10px] text-slate-450">Click "Create Playlist" above to set up your first media channel timeline.</p>
          </div>
        )}
      </div>

      {/* BROADCAST ASSIGN SCREEN MODAL */}
      {assignModalPlaylist && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleIn text-left">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Tv size={16} className="text-blue-600" /> TV Broadcast Manager
              </h2>
              <button onClick={() => setAssignModalPlaylist(null)} className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer">&times;</button>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Broadcast playlist <span className="font-bold text-slate-800">"{assignModalPlaylist.name}"</span> to your active display screens.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {adminScreens.map(screen => {
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

              {adminScreens.length === 0 && (
                <div className="py-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl space-y-1.5">
                  <AlertTriangle size={24} className="text-amber-500 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No TVs registered</p>
                  <p className="text-[10px] text-slate-400">You don't have any TV screens in your screen inventory yet.</p>
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
                disabled={adminScreens.length === 0}
                onClick={handleSaveScreenAssignments}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply Broadcasts
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
