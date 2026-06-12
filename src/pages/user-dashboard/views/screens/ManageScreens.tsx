import { useState, useEffect } from 'react';
import {
  Search, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit,
  Monitor, X, Check, CheckCircle, Power, Download, Settings,
  Building2, User, MoreVertical, Filter, Activity, Pause, Eraser
} from 'lucide-react';
import { mediaStore } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import type { Screen } from '../../types';

const statusConfig = {
  online: { label: 'Online', icon: <Wifi size={11} />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  offline: { label: 'Offline', icon: <WifiOff size={11} />, cls: 'bg-red-50 text-red-700 border-red-100' },
  warning: { label: 'Warning', icon: <AlertTriangle size={11} />, cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
  pairing: { label: 'Pairing', icon: <Activity size={11} />, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
  active: { label: 'Active', icon: <CheckCircle size={11} />, cls: 'bg-teal-50 text-teal-700 border-teal-100' },
  suspended: { label: 'Suspended', icon: <AlertTriangle size={11} />, cls: 'bg-amber-50 text-amber-700 border-amber-100' },
};

const groupColorMap: Record<string, { bg: string; text: string; border: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100' },
};

type Toast = { id: number; message: string; type: 'success' | 'info' | 'error' };
type BulkAction = 'restart' | 'disable' | 'delete' | '';

export default function ManageScreens({ userEmail = 'priya@demo.com' }: { userEmail?: string }) {
  const [screens, setScreens] = useState<Screen[]>(() => mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail));
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [selectedScreens, setSelectedScreens] = useState<Set<string>>(new Set());
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [bulkAction, setBulkAction] = useState<BulkAction>('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userPlaylists, setUserPlaylists] = useState<any[]>(() => mediaStore.getPlaylists().filter(p => p.createdBy === userEmail));

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

  const toggleScreen = (id: string) => {
    setSelectedScreens(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedScreens.size === filtered.length) setSelectedScreens(new Set());
    else setSelectedScreens(new Set(filtered.map(s => s.id)));
  };

  const handleBulkAction = () => {
    if (!bulkAction || selectedScreens.size === 0) return;
    const count = selectedScreens.size;
    if (bulkAction === 'delete') {
      const allScreens = mediaStore.getScreens();
      const updated = allScreens.filter(s => !selectedScreens.has(s.id));
      mediaStore.saveScreens(updated);
      setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
      selectedScreens.forEach(id => {
        pushToDatabase('screens', id, null, 'DELETE');
      });
      addToast(`${count} screen${count > 1 ? 's' : ''} deleted`);
    } else if (bulkAction === 'restart') {
      addToast(`Restart signal sent to ${count} screen${count > 1 ? 's' : ''}`, 'info');
    } else if (bulkAction === 'disable') {
      const allScreens = mediaStore.getScreens();
      const updated = allScreens.map(s => {
        if (selectedScreens.has(s.id)) {
          const disabledScreen = { ...s, status: 'offline' as const };
          pushToDatabase('screens', s.id, disabledScreen, 'PUT');
          return disabledScreen;
        }
        return s;
      });
      mediaStore.saveScreens(updated);
      setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
      addToast(`${count} screen${count > 1 ? 's' : ''} disabled`);
    }
    setSelectedScreens(new Set());
    setBulkAction('');
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
    setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
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
        addToast(`Failed to send cache purge command`, 'error');
      }
    });
  };

  const handleSingleDelete = () => {
    if (!deleteScreen) return;
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.filter(s => s.id !== deleteScreen.id);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', deleteScreen.id, null, 'DELETE');
    setDeleteScreen(null);
    addToast(`"${deleteScreen.name}" deleted`);
  };

  const handleEditSave = () => {
    if (!editScreen) return;
    const gp = groups.find(g => g.id === editScreen.groupId);
    const finalScreen = gp ? { ...editScreen, playlist: gp.playlist } : editScreen;
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.map(s => s.id === editScreen.id ? finalScreen : s);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', editScreen.id, finalScreen, 'PUT');
    setEditScreen(null);
    addToast(`"${editScreen.name}" updated`);
  };

  const summaryStats = [
    { label: 'Total Screens', value: screens.length, color: 'text-gray-800', sub: 'registered' },
    { label: 'Online', value: screens.filter(s => s.status === 'online').length, color: 'text-emerald-700', sub: 'active now' },
    { label: 'Offline', value: screens.filter(s => s.status === 'offline').length, color: 'text-red-600', sub: 'unreachable' },
    { label: 'Warning', value: screens.filter(s => s.status === 'warning').length, color: 'text-yellow-600', sub: 'needs attention' },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'info' ? 'bg-blue-500' : 'bg-red-500'
          }`}>
            <CheckCircle size={15} />
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Manage Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor, configure and control all registered screens</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <Download size={15} />
          Export
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {summaryStats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search screens or locations..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedScreens.size > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
          <span className="text-sm font-semibold text-blue-700">{selectedScreens.size} selected</span>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={bulkAction}
              onChange={e => setBulkAction(e.target.value as BulkAction)}
              className="px-3 py-1.5 text-xs border border-blue-200 rounded-lg bg-white outline-none focus:border-blue-400 text-gray-700"
            >
              <option value="">Choose bulk action...</option>
              <option value="restart">Restart selected</option>
              <option value="disable">Disable selected</option>
              <option value="delete">Delete selected</option>
            </select>
            <button
              onClick={handleBulkAction}
              disabled={!bulkAction}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
          <button onClick={() => setSelectedScreens(new Set())} className="text-xs text-blue-600 hover:underline">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedScreens.size === filtered.length && filtered.length > 0}
                    onChange={selectAll}
                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Screen</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Group</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Playlist</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">License</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(screen => {
                const st = statusConfig[screen.status as keyof typeof statusConfig] || statusConfig.offline;
                return (
                  <tr
                    key={screen.id}
                    className={`transition-colors group ${selectedScreens.has(screen.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedScreens.has(screen.id)}
                        onChange={() => toggleScreen(screen.id)}
                        className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-8 rounded overflow-hidden flex-shrink-0 bg-gray-100">
                          <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{screen.name}</p>
                          <p className="text-xs text-gray-400 truncate max-w-[120px]">{screen.location}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${st.cls}`}>
                        {st.icon}{st.label}
                      </span>
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
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        screen.licenseType === 'Pro' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>{screen.licenseType}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setEditScreen({ ...screen })}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Edit"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => addToast(`Restart sent to "${screen.name}"`, 'info')}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Restart"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => handleStopPlayback(screen)}
                          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Stop Playback"
                        >
                          <Pause size={13} />
                        </button>
                        <button
                          onClick={() => handleClearCache(screen)}
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Clear Device Cache"
                        >
                          <Eraser size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteScreen(screen)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
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
                      const play = userPlaylists.find(p => p.name === val);
                      setEditScreen(p => p && ({ ...p, playlist: val, playlistId: play ? play.id : '' }));
                    }}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white"
                  >
                    <option value="Normal">Normal</option>
                    <option value="None">None (Stop Playback)</option>
                    {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
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

      {/* Delete Confirm */}
      {deleteScreen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteScreen(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Delete Screen</h2>
              <p className="text-sm text-gray-500 mb-5">Delete <strong>"{deleteScreen.name}"</strong>? This cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleSingleDelete} className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
