import { useState, useEffect } from 'react';
import { Search, Plus, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit, Clock, Monitor, X, Check, CheckCircle, Users, ChevronDown, Activity, Pause, Eraser, FolderMinus, Lock } from 'lucide-react';
import { mediaStore } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import type { Screen } from '../../types';

const renderStatusBadge = (status: string) => {
  let label = status;
  let bg = 'bg-slate-500/10 text-slate-700 border-slate-500/20';
  let dot = <span className="h-2 w-2 rounded-full bg-slate-500"></span>;

  switch (status) {
    case 'online':
    case 'active':
      label = status === 'online' ? 'Online' : 'Active';
      bg = 'bg-emerald-500/10 text-emerald-700 border-emerald-550/20';
      dot = (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      );
      break;
    case 'offline':
      label = 'Offline';
      bg = 'bg-rose-500/10 text-rose-700 border-rose-550/20';
      dot = <span className="h-2 w-2 rounded-full bg-rose-500"></span>;
      break;
    case 'warning':
      label = 'Warning';
      bg = 'bg-yellow-500/10 text-yellow-700 border-yellow-550/20';
      dot = <span className="h-2 w-2 rounded-full bg-yellow-500"></span>;
      break;
    case 'pairing':
      label = 'Pairing';
      bg = 'bg-blue-500/10 text-blue-700 border-blue-550/20';
      dot = <span className="h-2.5 w-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>;
      break;
    case 'suspended':
      label = 'Suspended';
      bg = 'bg-slate-500/10 text-slate-700 border-slate-550/20';
      dot = <Lock size={9} className="text-slate-500" />;
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md shadow-2xs ${bg}`}>
      {dot}
      <span>{label}</span>
    </span>
  );
};

const groupColorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100' },
};

type Toast = { id: number; message: string; type: 'success' | 'info' };

export default function AllScreens({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [screens, setScreens] = useState<Screen[]>(() => mediaStore.getScreens());
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });

  useEffect(() => {
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      if (serverScreens.length > 0) {
        setScreens(serverScreens);
        mediaStore.saveScreens(serverScreens);
      }
    });
    syncCollection('screen_groups', 'signageos_groups').then(serverGroups => {
      if (serverGroups.length > 0) {
        setGroups(serverGroups);
      }
    });
  }, []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(s => s.id));
    }
  };

  const filtered = screens.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.location.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchGroup = groupFilter === 'all' ? true : (groupFilter === 'none' ? !s.groupId : s.groupId === groupFilter);
    return matchSearch && matchStatus && matchGroup;
  });

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleDelete = () => {
    if (!deleteScreen) return;
    const updated = screens.filter(s => s.id !== deleteScreen.id);
    setScreens(updated);
    mediaStore.saveScreens(updated);
    pushToDatabase('screens', deleteScreen.id, null, 'DELETE');
    setDeleteScreen(null);
    addToast(`"${deleteScreen.name}" has been removed`);
  };

  const handleDeleteSelected = () => {
    const updated = screens.filter(s => !selectedIds.includes(s.id));
    setScreens(updated);
    mediaStore.saveScreens(updated);
    selectedIds.forEach(id => pushToDatabase('screens', id, null, 'DELETE'));
    const count = selectedIds.length;
    setSelectedIds([]);
    setIsSelectionMode(false);
    setDeleteConfirm(false);
    addToast(`Successfully removed ${count} screen(s)`);
  };

  const handleRestart = (screen: Screen) => {
    addToast(`Restart signal sent to "${screen.name}"`, 'info');
  };

  const handleStopPlayback = (screen: Screen) => {
    const updatedScreen = {
      ...screen,
      playlist: 'None',
      playlistId: ''
    };
    const allScreens = mediaStore.getScreens();
    const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
    mediaStore.saveScreens(updatedAll);
    setScreens(updatedAll);
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
    addToast(`Playback stopped for "${screen.name}"`);
  };

  const handleClearCache = (screen: Screen) => {
    const updatedScreen = {
      ...screen,
      clear_cache: true
    };
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Cache purge command sent to "${screen.name}"`, 'success');
      } else {
        addToast(`Failed to send cache purge command`, 'info');
      }
    });
  };

  const handleEditSave = () => {
    if (!editScreen) return;
    const gp = groups.find(g => g.id === editScreen.groupId);
    const finalScreen = gp ? { ...editScreen, playlist: gp.playlist } : editScreen;
    const updated = screens.map(s => s.id === editScreen.id ? finalScreen : s);
    setScreens(updated);
    mediaStore.saveScreens(updated);
    pushToDatabase('screens', editScreen.id, finalScreen, 'PUT');
    setEditScreen(null);
    addToast(`"${editScreen.name}" updated successfully`);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
          }`}>
            <CheckCircle size={16} />
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5">{screens.length} total screens registered</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filtered.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm ${
                  isSelectionMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <CheckCircle size={16} />
                {isSelectionMode ? 'Cancel Selection' : 'Select'}
              </button>
              {isSelectionMode && selectedIds.length > 0 && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer shadow-sm animate-fadeIn"
                >
                  <Trash2 size={16} />
                  Delete Selected ({selectedIds.length})
                </button>
              )}
            </div>
          )}
          <button onClick={() => onNavigate('screens-add')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer">
            <Plus size={16} />
            Add Screen
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search screens, locations..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="text-xs border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none text-gray-700 focus:border-blue-400 cursor-pointer"
          >
            <option value="all">All Groups</option>
            <option value="none">No Group</option>
            {groups.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          {(['all', 'online', 'offline', 'warning'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors capitalize ${
              statusFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}>{f}</button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Online', count: screens.filter(s => s.status === 'online').length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Offline', count: screens.filter(s => s.status === 'offline').length, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Warning', count: screens.filter(s => s.status === 'warning').length, color: 'text-yellow-600', bg: 'bg-yellow-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-lg px-4 py-2.5 flex items-center justify-between`}>
            <span className="text-xs font-medium text-gray-700">{s.label}</span>
            <span className={`text-lg font-bold ${s.color}`}>{s.count}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {isSelectionMode && (
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={selectAll}
                      className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Screen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Playlist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">License</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Heartbeat</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(screen => {
                const isSelected = selectedIds.includes(screen.id);
                return (
                  <tr key={screen.id} className={`hover:bg-gray-50 transition-colors group ${isSelected ? 'bg-blue-50/70 hover:bg-blue-55/70' : ''}`} onClick={() => isSelectionMode && toggleSelect(screen.id)}>
                    {isSelectionMode && (
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(screen.id)}
                          className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                          <img src={screen.thumbnail || null} alt={screen.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{screen.name}</p>
                          <p className="text-xs text-gray-400">v{screen.playerVersion}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(screen.status)}
                    </td>
                    <td className="px-4 py-3">
                      {screen.groupId ? (() => {
                        const gp = groups.find(g => g.id === screen.groupId);
                        const c = gp ? (groupColorMap[gp.color] ?? groupColorMap.blue) : groupColorMap.blue;
                        return gp ? (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${c.bg} ${c.text} ${c.border}`}>
                            {gp.name}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        );
                      })() : (
                        <span className="text-xs text-gray-400 italic">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${screen.playlist === 'Normal' ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                        {screen.groupId ? (() => {
                          const gp = groups.find(g => g.id === screen.groupId);
                          return gp ? `${gp.playlist} (Inherited)` : screen.playlist;
                        })() : screen.playlist}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">{screen.location}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        screen.licenseType === 'Pro' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{screen.licenseType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Clock size={11} />
                        {screen.lastHeartbeat}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        <button onClick={() => setEditScreen({ ...screen })} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit size={14} /></button>
                        <button onClick={() => handleRestart(screen)} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="Restart"><RefreshCw size={14} /></button>
                        <button onClick={() => handleStopPlayback(screen)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Stop Playback"><Pause size={14} /></button>
                        <button onClick={() => handleClearCache(screen)} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Clear Device Cache"><Eraser size={14} /></button>
                        {screen.groupId && (
                          <button
                            onClick={() => {
                              const updatedScreen = { ...screen, groupId: '' };
                              const allScreens = mediaStore.getScreens();
                              const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
                              mediaStore.saveScreens(updatedAll);
                              setScreens(updatedAll);
                              pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
                              addToast(`"${screen.name}" removed from group`);
                            }}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Remove from group"
                          >
                            <FolderMinus size={14} />
                          </button>
                        )}
                        <button onClick={() => setDeleteScreen(screen)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
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
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex justify-between">
                  <span>Screen Volume</span>
                  <span className="font-semibold text-blue-600">{(editScreen.volume !== undefined ? editScreen.volume : 80)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editScreen.volume !== undefined ? editScreen.volume : 80} 
                    onChange={e => setEditScreen(p => p && ({ ...p, volume: parseInt(e.target.value) }))} 
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Status</label>
                <select value={editScreen.status} onChange={e => setEditScreen(p => p && ({ ...p, status: e.target.value as Screen['status'] }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="online">Online</option>
                  <option value="offline">Offline</option>
                  <option value="warning">Warning</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Group</label>
                <select
                  value={editScreen.groupId ?? ''}
                  onChange={e => setEditScreen(p => p && ({ ...p, groupId: e.target.value || undefined }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">None (Ungrouped)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {!editScreen.groupId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                  <select
                    value={editScreen.playlist}
                    onChange={e => {
                      const val = e.target.value;
                      const playlists = mediaStore.getPlaylists();
                      const play = playlists.find(p => p.name === val);
                      setEditScreen(p => p && ({ ...p, playlist: val, playlistId: play ? play.id : '' }));
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="None">None (Stop Playback)</option>
                    <option value="Summer Campaign">Summer Campaign</option>
                    <option value="Brand Showcase">Brand Showcase</option>
                    <option value="Menu Loop">Menu Loop</option>
                    <option value="Flight Info">Flight Info</option>
                    <option value="Welcome Loop">Welcome Loop</option>
                  </select>
                </div>
              )}
              {editScreen.groupId && (() => {
                const gp = groups.find(g => g.id === editScreen.groupId);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                    Playlist is managed by group <strong>{gp?.name}</strong> (Inherited: <strong>{gp?.playlist || 'None'}</strong>).
                  </div>
                );
              })()}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">License Type</label>
                <select value={editScreen.licenseType} onChange={e => setEditScreen(p => p && ({ ...p, licenseType: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="Lite">Lite</option>
                  <option value="Pro">Pro</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setEditScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleEditSave} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"><Check size={15} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteScreen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteScreen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Remove Screen</h2>
              <p className="text-sm text-gray-500 mb-5">Are you sure you want to remove <strong>"{deleteScreen.name}"</strong>? This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Selected Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={26} className="text-red-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Delete Selected Screens</h2>
              <p className="text-sm text-gray-500 mb-1">
                This will permanently delete the <strong>{selectedIds.length} selected screen{selectedIds.length !== 1 ? 's' : ''}</strong>.
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
