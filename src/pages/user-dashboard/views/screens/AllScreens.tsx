import { useState } from 'react';
import { Search, Plus, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit, Clock, Monitor, X, Check, CheckCircle, Users, ChevronDown } from 'lucide-react';
import { mockScreens, mockGroups } from '../../data/mockData';
import type { Screen } from '../../types';

const statusConfig = {
  online: { label: 'Online', icon: <Wifi size={12} />, cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  offline: { label: 'Offline', icon: <WifiOff size={12} />, cls: 'bg-red-50 text-red-700 border-red-100' },
  warning: { label: 'Warning', icon: <AlertTriangle size={12} />, cls: 'bg-yellow-50 text-yellow-700 border-yellow-100' },
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
  const [screens, setScreens] = useState<Screen[]>(mockScreens);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

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
    setScreens(p => p.filter(s => s.id !== deleteScreen.id));
    setDeleteScreen(null);
    addToast(`"${deleteScreen.name}" has been removed`);
  };

  const handleRestart = (screen: Screen) => {
    addToast(`Restart signal sent to "${screen.name}"`, 'info');
  };

  const handleEditSave = () => {
    if (!editScreen) return;
    const gp = mockGroups.find(g => g.id === editScreen.groupId);
    const finalScreen = gp ? { ...editScreen, playlist: gp.playlist } : editScreen;
    setScreens(p => p.map(s => s.id === editScreen.id ? finalScreen : s));
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

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5">{screens.length} total screens registered</p>
        </div>
        <button onClick={() => onNavigate('screens-add')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          <Plus size={16} />
          Add Screen
        </button>
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
            {mockGroups.map(g => (
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
                    <td className="px-4 py-3">
                      {screen.groupId ? (() => {
                        const gp = mockGroups.find(g => g.id === screen.groupId);
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
                          const gp = mockGroups.find(g => g.id === screen.groupId);
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
                        {screen.groupId && (
                          <button
                            onClick={() => {
                              setScreens(p => p.map(s => s.id === screen.id ? { ...s, groupId: undefined } : s));
                              addToast(`"${screen.name}" removed from group`);
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove from group"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {!screen.groupId && (
                          <button onClick={() => setDeleteScreen(screen)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                        )}
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
                  {mockGroups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {!editScreen.groupId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                  <select value={editScreen.playlist} onChange={e => setEditScreen(p => p && ({ ...p, playlist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="Normal">Normal</option>
                    <option value="Summer Campaign">Summer Campaign</option>
                    <option value="Brand Showcase">Brand Showcase</option>
                    <option value="Menu Loop">Menu Loop</option>
                    <option value="Flight Info">Flight Info</option>
                    <option value="Welcome Loop">Welcome Loop</option>
                  </select>
                </div>
              )}
              {editScreen.groupId && (() => {
                const gp = mockGroups.find(g => g.id === editScreen.groupId);
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
    </div>
  );
}
