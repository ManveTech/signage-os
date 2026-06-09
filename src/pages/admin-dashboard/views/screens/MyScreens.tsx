import { useState, useEffect } from 'react';
import {
  Search, Plus, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit,
  Clock, Monitor, X, Check, CheckCircle, MoreVertical, MapPin, Cpu,
  Activity, Grid3X3, List
} from 'lucide-react';
import { mediaStore, Playlist } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import type { Screen } from '../../types';

const groupColorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100',    iconBg: 'bg-blue-600' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-100',    iconBg: 'bg-teal-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', iconBg: 'bg-emerald-600' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-100',  iconBg: 'bg-yellow-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100',    iconBg: 'bg-rose-500' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100',   iconBg: 'bg-slate-500' },
};

const statusConfig = {
  online: { label: 'Online', icon: <Wifi size={11} />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100', dot: 'bg-emerald-500' },
  offline: { label: 'Offline', icon: <WifiOff size={11} />, cls: 'bg-red-50 text-red-700 border-red-100', dot: 'bg-red-500' },
  warning: { label: 'Warning', icon: <AlertTriangle size={11} />, cls: 'bg-yellow-50 text-yellow-700 border-yellow-100', dot: 'bg-yellow-500' },
};

type Toast = { id: number; message: string; type: 'success' | 'info' };
type ViewMode = 'grid' | 'list';

export default function MyScreens({ onNavigate, userEmail = 'admin@demo.com' }: { onNavigate: (v: string) => void; userEmail?: string }) {
  const [screens, setScreens] = useState<Screen[]>(() =>
    mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail)
  );
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [userPlaylists, setUserPlaylists] = useState<Playlist[]>(() =>
    mediaStore.getPlaylists().filter(p => p.createdBy === userEmail)
  );
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      if (serverScreens.length > 0) {
        setScreens(serverScreens.filter(s => s.assignedToUserEmail === userEmail));
        mediaStore.saveScreens(serverScreens);
      }
    });
    syncCollection('screen_groups', 'signageos_groups').then(serverGroups => {
      if (serverGroups.length > 0) {
        setGroups(serverGroups);
      }
    });
    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      if (serverPlaylists.length > 0) {
        setUserPlaylists(serverPlaylists.filter(p => p.createdBy === userEmail));
      }
    });
  }, [userEmail]);

  const filtered = screens.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleDelete = () => {
    if (!deleteScreen) return;
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.filter(s => s.id !== deleteScreen.id);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', deleteScreen.id, null, 'DELETE');
    setDeleteScreen(null);
    addToast(`"${deleteScreen.name}" removed from your screens`);
  };

  const handleRestart = (screen: Screen) => {
    setOpenMenu(null);
    addToast(`Restart signal sent to "${screen.name}"`, 'info');
  };

  const handleEditSave = () => {
    if (!editScreen) return;
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.map(s => s.id === editScreen.id ? editScreen : s);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', editScreen.id, editScreen, 'PUT');
    setEditScreen(null);
    addToast(`"${editScreen.name}" updated successfully`);
  };

  const stats = [
    { label: 'Total', count: screens.length, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
    { label: 'Online', count: screens.filter(s => s.status === 'online').length, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Offline', count: screens.filter(s => s.status === 'offline').length, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Warning', count: screens.filter(s => s.status === 'warning').length, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
          }`}>
            <CheckCircle size={15} />
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {screens.length} screen{screens.length !== 1 ? 's' : ''} assigned to your account
          </p>
        </div>
        <button
          onClick={() => onNavigate('screens-add-my')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Add Screen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl px-4 py-3 flex items-center justify-between`}>
            <span className="text-xs font-medium text-gray-600">{s.label}</span>
            <span className={`text-2xl font-bold ${s.color}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or location..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'online', 'offline', 'warning'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
                statusFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(screen => {
            const st = statusConfig[screen.status];
            return (
              <div key={screen.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative h-36 bg-gray-100 overflow-hidden">
                  <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border backdrop-blur-sm ${st.cls}`}>
                      {st.icon}{st.label}
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenu(openMenu === screen.id ? null : screen.id)}
                        className="w-7 h-7 bg-white/90 hover:bg-white rounded-lg flex items-center justify-center shadow-sm transition-colors"
                      >
                        <MoreVertical size={13} className="text-gray-600" />
                      </button>
                      {openMenu === screen.id && (
                        <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-44 z-20">
                          <button onClick={() => { setEditScreen({ ...screen }); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                            <Edit size={13} className="text-blue-500" /> Edit Screen
                          </button>
                          <button onClick={() => handleRestart(screen)} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                            <RefreshCw size={13} className="text-yellow-500" /> Restart
                          </button>
                          <div className="my-1 border-t border-gray-100" />
                          <button onClick={() => { setDeleteScreen(screen); setOpenMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50">
                            <Trash2 size={13} /> Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2.5 right-2.5">
                    <p className="text-white text-sm font-semibold truncate">{screen.name}</p>
                  </div>
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                    <span className="truncate">{screen.location}</span>
                  </div>
                  {screen.groupId ? (() => {
                    const gp = groups.find(g => g.id === screen.groupId);
                    const c = gp ? (groupColorMap[gp.color] ?? groupColorMap.blue) : groupColorMap.blue;
                    return (
                      <div className={`p-2 rounded-lg border ${c.bg} ${c.border} ${c.text} text-[10px] space-y-0.5`}>
                        <div className="font-semibold">Group: {gp?.name}</div>
                        <div className="opacity-80">Inherited: {gp?.playlist || 'Normal'}</div>
                      </div>
                    );
                  })() : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block">Playlist</label>
                      <select
                        value={screen.playlist}
                        onChange={(e) => {
                          const val = e.target.value;
                          const play = userPlaylists.find(p => p.name === val);
                          const updatedScreen = {
                            ...screen,
                            playlist: val,
                            playlistId: play ? play.id : undefined
                          };
                          const allScreens = mediaStore.getScreens();
                          const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
                          mediaStore.saveScreens(updatedAll);
                          setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
                          pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
                          addToast(`Playlist updated for "${screen.name}"`);
                        }}
                        className="w-full text-xs border border-gray-200 bg-white rounded-lg px-2.5 py-1 outline-none text-gray-700 focus:border-blue-400 cursor-pointer"
                      >
                        <option value="Normal">Normal</option>
                        {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                      </select>
                      {screen.schedulePlaylist && (
                        <div className="mt-1 flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 font-medium">
                          <Clock size={8} className="text-amber-500" />
                          <span className="truncate">Next: {screen.schedulePlaylist} ({screen.scheduleDate})</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={10} />
                      {screen.lastHeartbeat}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Screen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Playlist</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Heartbeat</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(screen => {
                  const st = statusConfig[screen.status];
                  return (
                    <tr key={screen.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                            <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{screen.name}</p>
                            <p className="text-xs text-gray-400">v{screen.playerVersion}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.cls}`}>
                          {st.icon}{st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">{screen.location}</td>
                       <td className="px-4 py-3">
                        {screen.groupId ? (() => {
                          const gp = groups.find(g => g.id === screen.groupId);
                          return (
                            <div className="text-sm font-medium text-gray-800">
                              {gp?.playlist || 'Normal'}
                              <span className="block text-[10px] text-gray-400 italic font-normal">Inherited from {gp?.name}</span>
                            </div>
                          );
                        })() : (
                          <div className="space-y-1">
                            <select
                              value={screen.playlist}
                              onChange={(e) => {
                                const val = e.target.value;
                                const play = userPlaylists.find(p => p.name === val);
                                const updatedScreen = {
                                  ...screen,
                                  playlist: val,
                                  playlistId: play ? play.id : undefined
                                };
                                const allScreens = mediaStore.getScreens();
                                const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
                                mediaStore.saveScreens(updatedAll);
                                setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
                                pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
                                addToast(`Playlist updated for "${screen.name}"`);
                              }}
                              className="text-xs border border-gray-200 bg-white rounded-lg px-2 py-1 outline-none text-gray-700 focus:border-blue-400 cursor-pointer"
                            >
                              <option value="Normal">Normal</option>
                              {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                            </select>
                            {screen.schedulePlaylist && (
                              <div className="text-[9px] text-amber-600 font-medium">
                                Scheduled: {screen.schedulePlaylist} ({screen.scheduleDate} {screen.scheduleTime})
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={11} />{screen.lastHeartbeat}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                          <button onClick={() => setEditScreen({ ...screen })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit size={14} /></button>
                          <button onClick={() => handleRestart(screen)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Restart"><RefreshCw size={14} /></button>
                          <button onClick={() => setDeleteScreen(screen)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Remove"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <Monitor size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No screens found</p>
            </div>
          )}
        </div>
      )}

      {filtered.length === 0 && viewMode === 'grid' && (
        <div className="py-16 text-center bg-white rounded-xl border border-gray-100">
          <Monitor size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">No screens found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters</p>
        </div>
      )}

      {/* Click outside to close menu */}
      {openMenu && <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />}

      {/* Edit Modal */}
      {editScreen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditScreen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Edit Screen</h2>
              <button onClick={() => setEditScreen(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Screen Name</label>
                <input value={editScreen.name} onChange={e => setEditScreen(p => p && ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Location</label>
                <input value={editScreen.location} onChange={e => setEditScreen(p => p && ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              {editScreen.groupId ? (() => {
                const gp = groups.find(g => g.id === editScreen.groupId);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-2">
                    <p className="font-semibold">Inherited from Group</p>
                    <p>This screen belongs to group <strong>{gp?.name}</strong>. Playlist, schedule, and assets are managed at the group level.</p>
                    <p className="mt-2">Inherited Playlist: <strong>{gp?.playlist || 'None'}</strong></p>
                    {gp?.schedulePlaylist && (
                      <p>Group Scheduled Playlist: <strong>{gp.schedulePlaylist}</strong> on {gp.scheduleDate} at {gp.scheduleTime}</p>
                    )}
                  </div>
                );
              })() : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                    <select
                      value={editScreen.playlist}
                      onChange={e => {
                        const val = e.target.value;
                        const play = userPlaylists.find(p => p.name === val);
                        setEditScreen(p => p && ({ ...p, playlist: val, playlistId: play ? play.id : undefined }));
                      }}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                    >
                      <option value="Normal">Normal</option>
                      {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                    </select>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">Schedule Playlist Switch</span>
                      <input
                        type="checkbox"
                        checked={!!editScreen.schedulePlaylist}
                        onChange={e => {
                          const checked = e.target.checked;
                          setEditScreen(p => {
                            if (!p) return null;
                            if (checked) {
                              return {
                                ...p,
                                schedulePlaylist: userPlaylists[0]?.name || 'Normal',
                                scheduleDate: new Date().toISOString().split('T')[0],
                                scheduleTime: '12:00'
                              };
                            } else {
                              return {
                                ...p,
                                schedulePlaylist: undefined,
                                scheduleDate: undefined,
                                scheduleTime: undefined
                              };
                            }
                          });
                        }}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                    </div>
                    {editScreen.schedulePlaylist !== undefined && (
                      <div className="space-y-3 p-3 bg-gray-50 border border-gray-100 rounded-xl animate-fade-in">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Playlist</label>
                          <select
                            value={editScreen.schedulePlaylist}
                            onChange={e => setEditScreen(p => p && ({ ...p, schedulePlaylist: e.target.value }))}
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 bg-white"
                          >
                            {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Date</label>
                            <input
                              type="date"
                              value={editScreen.scheduleDate || ''}
                              onChange={e => setEditScreen(p => p && ({ ...p, scheduleDate: e.target.value }))}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Time</label>
                            <input
                              type="time"
                              value={editScreen.scheduleTime || ''}
                              onChange={e => setEditScreen(p => p && ({ ...p, scheduleTime: e.target.value }))}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-blue-400 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setEditScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleEditSave} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"><Check size={15} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteScreen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteScreen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Remove Screen</h2>
              <p className="text-sm text-gray-500 mb-5">Remove <strong>"{deleteScreen.name}"</strong> from your screens?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
