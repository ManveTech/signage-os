import { useState, useEffect } from 'react';
import { Plus, Monitor, RefreshCw, List, Users, Building, Edit, Trash2, X, Check, CheckCircle, BookOpen, ChevronDown, UserPlus, UserMinus, Calendar, Eraser } from 'lucide-react';
import { mediaStore } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import type { Screen, ScreenGroup } from '../../types';

const COLOR_OPTIONS = [
  { id: 'blue', label: 'Blue', cls: 'bg-blue-600' },
  { id: 'teal', label: 'Teal', cls: 'bg-teal-600' },
  { id: 'emerald', label: 'Green', cls: 'bg-emerald-600' },
  { id: 'yellow', label: 'Yellow', cls: 'bg-yellow-500' },
  { id: 'rose', label: 'Rose', cls: 'bg-rose-500' },
  { id: 'slate', label: 'Slate', cls: 'bg-slate-500' },
];

const colorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100',    icon: 'bg-blue-600' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-100',    icon: 'bg-teal-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', icon: 'bg-emerald-600' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-100',  icon: 'bg-yellow-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100',    icon: 'bg-rose-500' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100',   icon: 'bg-slate-500' },
};

const LIBRARIES = ['Retail Assets', 'Airport Media', 'F&B Collection', 'Corporate Branding', 'General Content'];

type Toast = { id: number; message: string };

const emptyGroup = (): Omit<ScreenGroup, 'id'> => ({ name: '', desc: '', color: 'blue', playlist: '', library: '', orgId: '', schedulePlaylist: '', scheduleDate: '', scheduleTime: '', volume: 80, clear_cache: false, force_sync: false });

export default function ScreenGroups({ mode = 'all' }: { mode?: 'my' | 'all' }) {
  const [groups, setGroups] = useState<ScreenGroup[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [screens, setScreens] = useState<Screen[]>(() => mediaStore.getScreens());
  const [organizations, setOrganizations] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    return data ? JSON.parse(data) : [];
  });
  const [userPlaylists, setUserPlaylists] = useState<any[]>(() => mediaStore.getPlaylists());
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    syncCollection('screen_groups', 'signageos_groups').then(serverGroups => {
      if (serverGroups.length > 0) {
        setGroups(serverGroups);
      }
    });
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      if (serverScreens.length > 0) {
        setScreens(serverScreens);
        mediaStore.saveScreens(serverScreens);
      }
    });
    syncCollection('organizations', 'signageos_organizations').then(serverOrgs => {
      if (serverOrgs.length > 0) {
        setOrganizations(serverOrgs);
      }
    });
    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      if (serverPlaylists.length > 0) {
        setUserPlaylists(serverPlaylists);
      }
    });
  }, []);

  const filteredPlaylists = userPlaylists.filter(p => {
    if (mode === 'my') {
      return p.createdBy === 'admin@demo.com';
    } else {
      if (selectedOrgFilter) {
        const org = organizations.find(o => o.id === selectedOrgFilter);
        const orgEmail = org?.email;
        return !orgEmail || p.createdBy === orgEmail || p.createdBy === 'admin@demo.com';
      }
      return true;
    }
  });

  const filteredGroups = mode === 'my'
    ? groups.filter(g => !g.orgId)
    : (selectedOrgFilter
        ? groups.filter(g => g.orgId === selectedOrgFilter)
        : groups
      );

  const myScreens = mode === 'my'
    ? screens.filter(s => s.assignedToUserEmail === 'admin@demo.com')
    : screens;

  const screensInGroup = (groupId: string) => myScreens.filter(s => s.groupId === groupId);
  const ungroupedScreens = myScreens.filter(s => !s.groupId);

  const [editGroup, setEditGroup] = useState<ScreenGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<ScreenGroup | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroup, setNewGroup] = useState(emptyGroup());
  const [addScreensTo, setAddScreensTo] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [isScheduledNew, setIsScheduledNew] = useState(false);
  const [isScheduledEdit, setIsScheduledEdit] = useState(false);

  const handleStartEdit = (group: ScreenGroup) => {
    setEditGroup({ ...group });
    setIsScheduledEdit(!!group.schedulePlaylist);
  };

  const [assignLibraryDirectTo, setAssignLibraryDirectTo] = useState<ScreenGroup | null>(null);
  const [scheduleLibraryTo, setScheduleLibraryTo] = useState<ScreenGroup | null>(null);
  const [libraryToAssign, setLibraryToAssign] = useState('');
  const [libraryAssignDate, setLibraryAssignDate] = useState('');
  const [libraryAssignTime, setLibraryAssignTime] = useState('');

  const handleStartLibraryAssignDirect = (group: ScreenGroup) => {
    setAssignLibraryDirectTo(group);
    setLibraryToAssign(group.library || '');
  };

  const handleStartLibrarySchedule = (group: ScreenGroup) => {
    setScheduleLibraryTo(group);
    setLibraryToAssign(group.scheduleLibrary || '');
    setLibraryAssignDate(group.libraryAssignedDate || new Date().toISOString().split('T')[0]);
    setLibraryAssignTime(group.libraryAssignedTime || new Date().toTimeString().split(' ')[0].substring(0, 5));
  };

  const handleSaveLibraryDirect = () => {
    if (!assignLibraryDirectTo) return;
    const updated = groups.map(g => g.id === assignLibraryDirectTo.id ? {
      ...g,
      library: libraryToAssign || undefined
    } : g);
    setGroups(updated);
    localStorage.setItem('signageos_groups', JSON.stringify(updated));
    const grp = updated.find(g => g.id === assignLibraryDirectTo.id);
    if (grp) pushToDatabase('screen_groups', assignLibraryDirectTo.id, grp, 'PUT');
    setAssignLibraryDirectTo(null);
    addToast(`Library assigned immediately for "${assignLibraryDirectTo.name}"`);
  };

  const handleSaveLibrarySchedule = () => {
    if (!scheduleLibraryTo) return;
    const updated = groups.map(g => g.id === scheduleLibraryTo.id ? {
      ...g,
      scheduleLibrary: libraryToAssign || undefined,
      libraryAssignedDate: libraryToAssign ? libraryAssignDate : undefined,
      libraryAssignedTime: libraryToAssign ? libraryAssignTime : undefined
    } : g);
    setGroups(updated);
    localStorage.setItem('signageos_groups', JSON.stringify(updated));
    const grp = updated.find(g => g.id === scheduleLibraryTo.id);
    if (grp) pushToDatabase('screen_groups', scheduleLibraryTo.id, grp, 'PUT');
    setScheduleLibraryTo(null);
    addToast(`Library schedule updated for "${scheduleLibraryTo.name}"`);
  };

  const addToast = (message: string) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  };

  const handleCreateGroup = () => {
    if (!newGroup.name.trim()) return;
    const created: ScreenGroup = { 
      ...newGroup, 
      id: `g${Date.now()}`,
      orgId: mode === 'my' ? undefined : newGroup.orgId,
      playlist: isScheduledNew ? (newGroup.playlist || '') : newGroup.playlist,
      schedulePlaylist: isScheduledNew ? newGroup.schedulePlaylist : undefined,
      scheduleDate: isScheduledNew ? newGroup.scheduleDate : undefined,
      scheduleTime: isScheduledNew ? newGroup.scheduleTime : undefined,
    };
    const updated = [...groups, created];
    setGroups(updated);
    localStorage.setItem('signageos_groups', JSON.stringify(updated));
    pushToDatabase('screen_groups', created.id, created, 'POST');
    setShowNewGroup(false);
    setNewGroup(emptyGroup());
    setIsScheduledNew(false);
    addToast(`Group "${created.name}" created`);
  };

  const handleEditSave = () => {
    if (!editGroup) return;
    const updatedGroup: ScreenGroup = {
      ...editGroup,
      playlist: isScheduledEdit ? (editGroup.playlist || '') : editGroup.playlist,
      schedulePlaylist: isScheduledEdit ? editGroup.schedulePlaylist : undefined,
      scheduleDate: isScheduledEdit ? editGroup.scheduleDate : undefined,
      scheduleTime: isScheduledEdit ? editGroup.scheduleTime : undefined,
    };
    const updated = groups.map(g => g.id === editGroup.id ? updatedGroup : g);
    setGroups(updated);
    localStorage.setItem('signageos_groups', JSON.stringify(updated));
    pushToDatabase('screen_groups', editGroup.id, updatedGroup, 'PUT');

    // ALSO bulk update screens in this group!
    const groupScreens = screensInGroup(editGroup.id);
    const updatedScreens = screens.map(s => {
      if (s.groupId === editGroup.id) {
        const updatedScreen: Screen = {
          ...s,
          playlist: updatedGroup.playlist || s.playlist,
          playlistId: userPlaylists.find(p => p.name === updatedGroup.playlist)?.id || s.playlistId,
          volume: updatedGroup.volume !== undefined ? updatedGroup.volume : s.volume,
          clear_cache: updatedGroup.clear_cache ? true : s.clear_cache,
          force_sync: updatedGroup.force_sync ? true : s.force_sync,
        };
        // push each screen's update to the database
        pushToDatabase('screens', s.id, updatedScreen, 'PUT');
        return updatedScreen;
      }
      return s;
    });
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);

    // Reset one-time triggers in the group object
    const finalGroup = { ...updatedGroup, clear_cache: false, force_sync: false };
    const resetGroups = updated.map(g => g.id === editGroup.id ? finalGroup : g);
    setGroups(resetGroups);
    localStorage.setItem('signageos_groups', JSON.stringify(resetGroups));
    pushToDatabase('screen_groups', editGroup.id, finalGroup, 'PUT');

    setEditGroup(null);
    addToast(`Group "${editGroup.name}" updated`);
  };

  const handleDeleteGroup = () => {
    if (!deleteGroup) return;
    const updatedScreens = screens.map(s => s.groupId === deleteGroup.id ? { ...s, groupId: '' } : s);
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);
    
    // Sync screens to DB
    screens.forEach(s => {
      if (s.groupId === deleteGroup.id) {
        pushToDatabase('screens', s.id, { ...s, groupId: '' }, 'PUT');
      }
    });

    const updatedGroups = groups.filter(g => g.id !== deleteGroup.id);
    setGroups(updatedGroups);
    localStorage.setItem('signageos_groups', JSON.stringify(updatedGroups));
    pushToDatabase('screen_groups', deleteGroup.id, null, 'DELETE');
    setDeleteGroup(null);
    addToast(`Group "${deleteGroup.name}" deleted`);
  };

  const handleAddScreen = (screenId: string, groupId: string) => {
    const targetScreen = screens.find(s => s.id === screenId);
    if (!targetScreen) return;
    const gp = groups.find(g => g.id === groupId);
    const updatedScreen = { 
      ...targetScreen, 
      groupId,
      playlist: gp?.playlist || targetScreen.playlist,
      playlistId: userPlaylists.find(p => p.name === (gp?.playlist || ''))?.id || targetScreen.playlistId,
      volume: gp?.volume !== undefined ? gp.volume : targetScreen.volume,
    };
    const updatedScreens = screens.map(s => s.id === screenId ? updatedScreen : s);
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);
    pushToDatabase('screens', screenId, updatedScreen, 'PUT');
  };

  const handleRemoveScreen = (screenId: string, groupName: string) => {
    const screen = screens.find(s => s.id === screenId);
    if (!screen) return;
    const updatedScreen = { ...screen, groupId: '' };
    const updatedScreens = screens.map(s => s.id === screenId ? updatedScreen : s);
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);
    pushToDatabase('screens', screenId, updatedScreen, 'PUT');
    addToast(`"${screen.name}" removed from "${groupName}"`);
  };

  const handleBulkRestart = (group: ScreenGroup) => {
    const groupScreens = screensInGroup(group.id);
    if (groupScreens.length === 0) {
      addToast(`No screens in group "${group.name}"`);
      return;
    }
    addToast(`Restart signal sent to all screens in "${group.name}"`);
  };

  const handleBulkClearCache = (group: ScreenGroup) => {
    const groupScreens = screensInGroup(group.id);
    if (groupScreens.length === 0) {
      addToast(`No screens in group "${group.name}"`);
      return;
    }
    const updatedScreens = screens.map(s => {
      if (s.groupId === group.id) {
        const updatedScreen = { ...s, clear_cache: true };
        pushToDatabase('screens', s.id, updatedScreen, 'PUT');
        return updatedScreen;
      }
      return s;
    });
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);
    addToast(`Cache purge command sent to all screens in "${group.name}"`);
  };

  const handleBulkForceSync = (group: ScreenGroup) => {
    const groupScreens = screensInGroup(group.id);
    if (groupScreens.length === 0) {
      addToast(`No screens in group "${group.name}"`);
      return;
    }
    const updatedScreens = screens.map(s => {
      if (s.groupId === group.id) {
        const updatedScreen = { ...s, force_sync: true };
        pushToDatabase('screens', s.id, updatedScreen, 'PUT');
        return updatedScreen;
      }
      return s;
    });
    setScreens(updatedScreens);
    mediaStore.saveScreens(updatedScreens);
    addToast(`Force sync command sent to all screens in "${group.name}"`);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white bg-emerald-500">
            <CheckCircle size={16} />{t.message}
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === 'my' ? 'My Screen Groups' : 'Client Screen Groups'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {mode === 'my' ? 'Manage bulk actions and assignments for your screens' : 'Manage bulk screen assignments and actions for client organizations'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {mode !== 'my' && (
            <select
              value={selectedOrgFilter}
              onChange={(e) => setSelectedOrgFilter(e.target.value)}
              className="flex-1 sm:flex-none text-sm border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none text-gray-700 focus:border-blue-400 cursor-pointer min-w-[180px]"
            >
              <option value="">All Organizations</option>
              {organizations.map(org => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <button onClick={() => setShowNewGroup(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0">
            <Plus size={16} /> New Group
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-4">
        {filteredGroups.map(group => {
          const c = colorMap[group.color] ?? colorMap.blue;
          const groupScreens = screensInGroup(group.id);
          const isExpanded = expandedGroup === group.id;

          return (
            <div key={group.id} className={`bg-white rounded-xl border transition-all ${isExpanded ? 'border-blue-200 shadow-sm' : 'border-gray-100'}`}>
              {/* Group header */}
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl ${c.icon} flex items-center justify-center flex-shrink-0`}>
                      <Building size={18} className="text-white" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{group.name}</h3>
                        {group.orgId && (() => {
                          const org = organizations.find(o => o.id === group.orgId);
                          return org ? (
                            <span className="text-[10px] bg-slate-100 text-slate-600 font-medium px-1.5 py-0.5 rounded border border-slate-200">
                              {org.name}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{group.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                    <button onClick={() => handleStartEdit(group)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit group"><Edit size={14} /></button>
                    <button onClick={() => setDeleteGroup(group)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete group"><Trash2 size={14} /></button>
                    <button onClick={() => setExpandedGroup(isExpanded ? null : group.id)} className={`p-1.5 rounded-lg transition-all ${isExpanded ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                      <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <span className={`flex items-center gap-1.5 text-xs ${c.text} ${c.bg} px-2.5 py-1 rounded-full border ${c.border} font-medium`}>
                    <Monitor size={11} /> {groupScreens.length} screens
                  </span>
                  {group.playlist && (
                    <span className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                      <List size={11} /> {group.playlist}
                    </span>
                  )}
                  {group.schedulePlaylist && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 font-medium">
                      <Calendar size={11} className="text-amber-500" />
                      Scheduled: {group.schedulePlaylist} on {group.scheduleDate} at {group.scheduleTime}
                    </span>
                  )}
                  {group.library && (
                    <span className="flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100 font-medium">
                      <BookOpen size={11} className="text-blue-500" />
                      Active Library: {group.library}
                      <span className="text-[10px] text-emerald-600 font-medium ml-1">
                        (Assigned Now)
                      </span>
                    </span>
                  )}
                  {group.scheduleLibrary && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60 font-medium">
                      <Calendar size={11} className="text-amber-500" />
                      Scheduled Library: {group.scheduleLibrary}
                      {group.libraryAssignedDate && (
                        <span className="text-[10px] text-amber-600 font-medium ml-1">
                          (on {group.libraryAssignedDate} at {group.libraryAssignedTime || '00:00'})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button onClick={() => setAddScreensTo(group.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium">
                    <UserPlus size={12} /> Add Screens
                  </button>
                  <button onClick={() => handleBulkRestart(group)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-650 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <RefreshCw size={12} /> Bulk Restart
                  </button>
                  <button onClick={() => handleBulkClearCache(group)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-purple-650 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors font-medium">
                    <Eraser size={12} /> Bulk Clear Cache
                  </button>
                  <button onClick={() => handleBulkForceSync(group)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-650 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors font-medium">
                    <RefreshCw size={12} /> Bulk Force Sync
                  </button>
                  <button onClick={() => handleStartLibraryAssignDirect(group)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <BookOpen size={12} /> Assign Library
                  </button>
                  <button onClick={() => handleStartLibrarySchedule(group)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
                    <Calendar size={12} className="text-amber-500" /> Schedule Library
                  </button>
                </div>
              </div>

              {/* Expanded screen list */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Screens in this group</p>
                  {groupScreens.length === 0 ? (
                    <div className="py-6 text-center">
                      <Monitor size={24} className="mx-auto text-gray-300 mb-1.5" />
                      <p className="text-xs text-gray-400">No screens assigned yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {groupScreens.map(screen => (
                        <div key={screen.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group/row">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            screen.status === 'online' ? 'bg-emerald-500' :
                            screen.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-800 truncate">{screen.name}</p>
                            <p className="text-xs text-gray-400 truncate">{screen.location}</p>
                          </div>
                          <button onClick={() => handleRemoveScreen(screen.id, group.name)} className="p-1 text-gray-300 hover:text-red-500 rounded opacity-0 group-hover/row:opacity-100 transition-all flex-shrink-0" title="Remove from group">
                            <UserMinus size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Screens Modal */}
      {addScreensTo && (() => {
        const group = groups.find(g => g.id === addScreensTo)!;
        const available = ungroupedScreens;
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAddScreensTo(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">Add Screens</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Assign ungrouped screens to <strong>{group.name}</strong></p>
                </div>
                <button onClick={() => setAddScreensTo(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
              </div>
              <div className="p-5 max-h-80 overflow-y-auto space-y-2">
                {available.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">All screens are already in a group</div>
                ) : available.map(screen => (
                  <div key={screen.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        screen.status === 'online' ? 'bg-emerald-500' :
                        screen.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{screen.name}</p>
                        <p className="text-xs text-gray-400">{screen.location}</p>
                      </div>
                    </div>
                    <button onClick={() => { handleAddScreen(screen.id, addScreensTo); addToast(`"${screen.name}" added to "${group.name}"`); }}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors">
                      <UserPlus size={12} /> Add
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-5 pb-5">
                <button onClick={() => setAddScreensTo(null)} className="w-full py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Done</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Group Modal */}
      {editGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditGroup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">Edit Group</h2>
              <button onClick={() => setEditGroup(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Group Name</label>
                <input value={editGroup.name} onChange={e => setEditGroup(p => p && ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                <input value={editGroup.desc} onChange={e => setEditGroup(p => p && ({ ...p, desc: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(co => (
                    <button key={co.id} onClick={() => setEditGroup(p => p && ({ ...p, color: co.id }))} className={`w-7 h-7 rounded-full ${co.cls} transition-all ${editGroup.color === co.id ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'}`} title={co.label} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex justify-between">
                  <span>Screen Volume (Bulk)</span>
                  <span className="font-semibold text-blue-600">{(editGroup.volume !== undefined ? editGroup.volume : 80)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={editGroup.volume !== undefined ? editGroup.volume : 80} 
                    onChange={e => setEditGroup(p => p && ({ ...p, volume: parseInt(e.target.value) }))} 
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-800">Clear Cache (Bulk)</label>
                  <span className="text-[10px] text-gray-400">Purge cached media files on all group screens on save</span>
                </div>
                <input 
                  type="checkbox"
                  checked={!!editGroup.clear_cache}
                  onChange={e => setEditGroup(p => p && ({ ...p, clear_cache: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-650 focus:ring-blue-550 accent-blue-650 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-800">Force Sync (Bulk)</label>
                  <span className="text-[10px] text-gray-400">Force immediate content check on all group screens on save</span>
                </div>
                <input 
                  type="checkbox"
                  checked={!!editGroup.force_sync}
                  onChange={e => setEditGroup(p => p && ({ ...p, force_sync: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-650 focus:ring-blue-550 accent-blue-650 cursor-pointer"
                />
              </div>
              {mode !== 'my' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Organization</label>
                  <select value={editGroup.orgId ?? ''} onChange={e => setEditGroup(p => p && ({ ...p, orgId: e.target.value || undefined }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="">None</option>
                    {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-700">Playlist Settings</label>
                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsScheduledEdit(false)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      !isScheduledEdit ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Assign Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduledEdit(true)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      isScheduledEdit ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Schedule Switch
                  </button>
                </div>
              </div>

              {!isScheduledEdit ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                  <select value={editGroup.playlist} onChange={e => setEditGroup(p => p && ({ ...p, playlist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="">None</option>
                    {filteredPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-200/60">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Scheduled Playlist</label>
                    <select value={editGroup.schedulePlaylist || ''} onChange={e => setEditGroup(p => p && ({ ...p, schedulePlaylist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                      <option value="">Select Playlist...</option>
                      {filteredPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Switch Date</label>
                      <input type="date" value={editGroup.scheduleDate || ''} onChange={e => setEditGroup(p => p && ({ ...p, scheduleDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Switch Time</label>
                      <input type="time" value={editGroup.scheduleTime || ''} onChange={e => setEditGroup(p => p && ({ ...p, scheduleTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </div>
              )}
             </div>
            <div className="flex gap-3 px-5 pb-5">
              <button 
                onClick={() => {
                  setDeleteGroup(editGroup);
                  setEditGroup(null);
                }} 
                className="px-3 py-2.5 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={13} />
                Delete Group
              </button>
              <div className="flex-1" />
              <button onClick={() => setEditGroup(null)} className="px-4 py-2.5 text-xs font-semibold text-gray-650 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
              <button onClick={handleEditSave} className="px-5 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"><Check size={14} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {showNewGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewGroup(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">New Group</h2>
              <button onClick={() => setShowNewGroup(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Group Name</label>
                <input value={newGroup.name} onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))} placeholder="e.g. North Zone Stores" className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Description</label>
                <input value={newGroup.desc} onChange={e => setNewGroup(p => ({ ...p, desc: e.target.value }))} placeholder="Short description..." className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(co => (
                    <button key={co.id} onClick={() => setNewGroup(p => ({ ...p, color: co.id }))} className={`w-7 h-7 rounded-full ${co.cls} transition-all ${newGroup.color === co.id ? 'ring-2 ring-offset-2 ring-blue-500' : 'hover:scale-110'}`} title={co.label} />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 flex justify-between">
                  <span>Screen Volume (Bulk)</span>
                  <span className="font-semibold text-blue-600">{(newGroup.volume !== undefined ? newGroup.volume : 80)}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={newGroup.volume !== undefined ? newGroup.volume : 80} 
                    onChange={e => setNewGroup(p => ({ ...p, volume: parseInt(e.target.value) }))} 
                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-800">Clear Cache (Bulk)</label>
                  <span className="text-[10px] text-gray-400">Purge cached media files on all group screens on save</span>
                </div>
                <input 
                  type="checkbox"
                  checked={!!newGroup.clear_cache}
                  onChange={e => setNewGroup(p => ({ ...p, clear_cache: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-650 focus:ring-blue-550 accent-blue-650 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-800">Force Sync (Bulk)</label>
                  <span className="text-[10px] text-gray-400">Force immediate content check on all group screens on save</span>
                </div>
                <input 
                  type="checkbox"
                  checked={!!newGroup.force_sync}
                  onChange={e => setNewGroup(p => ({ ...p, force_sync: e.target.checked }))}
                  className="w-4 h-4 rounded text-blue-650 focus:ring-blue-550 accent-blue-650 cursor-pointer"
                />
              </div>
              {mode !== 'my' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Organization</label>
                  <select value={newGroup.orgId ?? ''} onChange={e => setNewGroup(p => ({ ...p, orgId: e.target.value || undefined }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="">None</option>
                    {organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-3">
                <label className="block text-xs font-medium text-gray-700">Playlist Settings</label>
                <div className="flex bg-gray-100 p-0.5 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setIsScheduledNew(false)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      !isScheduledNew ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Assign Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsScheduledNew(true)}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      isScheduledNew ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                    }`}
                  >
                    Schedule Switch
                  </button>
                </div>
              </div>

              {!isScheduledNew ? (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Playlist</label>
                  <select value={newGroup.playlist} onChange={e => setNewGroup(p => ({ ...p, playlist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                    <option value="">None</option>
                    {filteredPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                  </select>
                </div>
              ) : (
                <div className="space-y-3 p-3 bg-gray-50 rounded-xl border border-gray-200/60">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Scheduled Playlist</label>
                    <select value={newGroup.schedulePlaylist || ''} onChange={e => setNewGroup(p => ({ ...p, schedulePlaylist: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                      <option value="">Select Playlist...</option>
                      {filteredPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Switch Date</label>
                      <input type="date" value={newGroup.scheduleDate || ''} onChange={e => setNewGroup(p => ({ ...p, scheduleDate: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Switch Time</label>
                      <input type="time" value={newGroup.scheduleTime || ''} onChange={e => setNewGroup(p => ({ ...p, scheduleTime: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setShowNewGroup(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleCreateGroup} disabled={!newGroup.name.trim()} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"><Plus size={15} /> Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirm */}
      {deleteGroup && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteGroup(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={22} className="text-red-500" />
              </div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Delete Group</h2>
              <p className="text-sm text-gray-500 mb-1">Delete <strong>"{deleteGroup.name}"</strong>?</p>
              <p className="text-xs text-gray-400 mb-5">{screensInGroup(deleteGroup.id).length} screens will become ungrouped.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteGroup(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDeleteGroup} className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ungrouped screens */}
      {ungroupedScreens.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Ungrouped Screens</p>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{ungroupedScreens.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {ungroupedScreens.map(screen => (
              <div key={screen.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    screen.status === 'online' ? 'bg-emerald-500' :
                    screen.status === 'offline' ? 'bg-red-500' : 'bg-yellow-400'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{screen.name}</p>
                    <p className="text-xs text-gray-400 truncate">{screen.location}</p>
                  </div>
                </div>
                
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddScreen(screen.id, e.target.value);
                      const targetGroup = groups.find(g => g.id === e.target.value);
                      addToast(`"${screen.name}" assigned to "${targetGroup?.name}"`);
                    }
                  }}
                  value=""
                  className="text-xs border border-gray-200 bg-white rounded px-2 py-1 outline-none text-gray-600 focus:border-blue-400 max-w-[120px] sm:max-w-none cursor-pointer"
                >
                  <option value="" disabled>Assign to group...</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Assign Library Modal (Direct) */}
      {assignLibraryDirectTo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setAssignLibraryDirectTo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Assign Library</h2>
                <p className="text-xs text-gray-500 mt-0.5">Assign media library to <strong>{assignLibraryDirectTo.name}</strong> immediately</p>
              </div>
              <button onClick={() => setAssignLibraryDirectTo(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Select Library</label>
                <select value={libraryToAssign} onChange={e => setLibraryToAssign(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">None</option>
                  {LIBRARIES.map(lib => <option key={lib} value={lib}>{lib}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setAssignLibraryDirectTo(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSaveLibraryDirect} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"><Check size={15} /> Save Assignment</button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Library Modal */}
      {scheduleLibraryTo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setScheduleLibraryTo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Schedule Library</h2>
                <p className="text-xs text-gray-500 mt-0.5">Schedule media library for <strong>{scheduleLibraryTo.name}</strong></p>
              </div>
              <button onClick={() => setScheduleLibraryTo(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Select Library</label>
                <select value={libraryToAssign} onChange={e => setLibraryToAssign(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 bg-white">
                  <option value="">None</option>
                  {LIBRARIES.map(lib => <option key={lib} value={lib}>{lib}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assignment Date</label>
                  <input type="date" value={libraryAssignDate} onChange={e => setLibraryAssignDate(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assignment Time</label>
                  <input type="time" value={libraryAssignTime} onChange={e => setLibraryAssignTime(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setScheduleLibraryTo(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSaveLibrarySchedule} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"><Check size={15} /> Save Schedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
