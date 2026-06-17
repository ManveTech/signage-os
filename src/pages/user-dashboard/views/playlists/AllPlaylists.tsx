import React, { useState, useEffect } from 'react';
import { Plus, Monitor, Film, Calendar, Trash2, Play, Pause, Tv, CheckSquare, Square, FolderOpen, AlertTriangle, Edit } from 'lucide-react';
import { mediaStore, Playlist, Screen } from '../../../../lib/mediaStore';
import { mockGroups } from '../../data/mockData';

const scheduleColors: Record<string, string> = {
  Running: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Scheduled: 'bg-blue-50 text-blue-700 border-blue-100',
  Paused: 'bg-yellow-50 text-yellow-700 border-yellow-100',
};

interface Props {
  onNavigate: (v: string) => void;
  userEmail: string;
}

export default function AllPlaylists({ onNavigate, userEmail }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [screens, setScreens] = useState<Screen[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);



  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = () => {
    const allPlaylists = mediaStore.getPlaylists();
    // Filter to only show playlists created by this client user
    setPlaylists(allPlaylists.filter(p => p.createdBy === userEmail));
    setScreens(mediaStore.getScreens());
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the playlist "${name}"? It will be unassigned from all your screens.`)) {
      mediaStore.deletePlaylist(id);
      showToast(`Playlist "${name}" deleted successfully.`);
      loadData();
    }
  };

  const handleToggleActive = (playlist: Playlist) => {
    const nextActive = !playlist.active;
    const nextStatus = nextActive ? 'Running' : 'Paused';

    if (nextActive) {
      // Reactivate playlist — restore all screen assignments
      mediaStore.updatePlaylist(playlist.id, {
        active: nextActive,
        scheduleStatus: nextStatus
      });
      showToast(`Playlist "${playlist.name}" is now active.`);
    } else {
      // Pause playlist — unassign all screens so TV player stops playing
      const assignedScreenIds = screens
        .filter(s => s.playlistId === playlist.id)
        .map(s => s.id);

      mediaStore.updatePlaylist(playlist.id, {
        active: nextActive,
        scheduleStatus: nextStatus,
        assignedScreenIds: [] // Clear screen assignments to stop playback
      });
      showToast(`Playlist "${playlist.name}" paused — playback stopped on ${assignedScreenIds.length} screen(s).`);
    }
    loadData();
  };



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
          <h1 className="text-xl font-bold text-gray-900">Signage Playlists</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage and organize layout broadcasting for your screens</p>
        </div>
        <button 
          onClick={() => onNavigate('playlists-create')} 
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
        >
          <Plus size={14} /> Create Playlist
        </button>
      </div>

      {/* Grid view */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {playlists.map(playlist => {
          const assignedScreensCount = screens.filter(s => s.playlistId === playlist.id).length;
          const assignedGroups = mockGroups.filter(g => g.playlist === playlist.name);
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
                      onNavigate('playlists-create');
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
              <div className="flex items-center justify-start pt-2 border-t border-gray-50">
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${scheduleColors[playlist.scheduleStatus]}`}>
                  <Calendar size={9} /> {playlist.scheduleStatus}
                </span>
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


    </div>
  );
}
