import { useState, useEffect } from 'react';
import { Search, Plus, Wifi, WifiOff, AlertTriangle, AlertCircle, Info, RefreshCw, Trash2, Edit, Clock, Monitor, X, Check, CheckCircle, Users, ChevronDown, Activity, Pause, Eraser, FolderMinus, Lock, Play, Unlink, Tv, RotateCcw } from 'lucide-react';
import ScreenDetailsSheet from '../../../../components/screens/ScreenDetailsSheet';
import ScreenCard from '../../../../components/screens/ScreenCard';
import PairTvDialog from '../../../../components/screens/PairTvDialog';
import ConfirmDialog from '../../../../components/screens/ConfirmDialog';
import { lastSeenText } from '../../../../components/screens/screenStatus';
import { pingScreen, unlinkScreen, pairTvToScreen } from '../../../../lib/screenActions';
import { mediaStore } from '../../../../lib/mediaStore';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import CustomSelect from '../../../../components/CustomSelect';
import ScreenSubNav from '../../../../components/ScreenSubNav';
import type { Screen } from '../../types';
import { getEffectiveStatus } from './MyScreens';

const renderStatusBadge = (screenOrStatus: any) => {
  const status = typeof screenOrStatus === 'string' ? screenOrStatus : getEffectiveStatus(screenOrStatus);
  let label = status;
  let bg = 'bg-slate-500/10 text-slate-700 border-slate-500/20';
  let dot = <span className="h-2 w-2 rounded-full bg-slate-500"></span>;

  switch (status) {
    case 'online':
    case 'active':
      label = status === 'online' ? 'Online' : 'Active';
      bg = 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
      dot = (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      );
      break;
    case 'offline':
      label = 'Offline';
      bg = 'bg-rose-500/10 text-rose-700 border-rose-500/20';
      dot = <span className="h-2 w-2 rounded-full bg-rose-500"></span>;
      break;
    case 'warning':
      label = 'Warning';
      bg = 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20';
      dot = <span className="h-2 w-2 rounded-full bg-yellow-500"></span>;
      break;
    case 'pairing':
      label = 'Pairing';
      bg = 'bg-blue-500/10 text-blue-700 border-blue-500/20';
      dot = <span className="h-2.5 w-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>;
      break;
    case 'unlinked':
      label = 'Not linked';
      bg = 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      dot = <span className="h-2 w-2 rounded-full bg-slate-400"></span>;
      break;
    case 'suspended':
      label = 'Suspended';
      bg = 'bg-slate-500/10 text-slate-700 border-slate-500/20';
      dot = <Lock size={9} className="text-slate-500" />;
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-2xs ${bg}`}>
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

type Toast = { id: number; message: string; type: 'success' | 'info' | 'error' };

export default function AllScreens({ onNavigate, userEmail = 'priya@demo.com' }: { onNavigate: (v: string) => void; userEmail?: string }) {
  const [screens, setScreens] = useState<Screen[]>(() => mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail));
  const [groups, setGroups] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_groups');
    return data ? JSON.parse(data) : [];
  });
  const [userPlaylists, setUserPlaylists] = useState<any[]>(() => mediaStore.getPlaylists().filter(p => p.createdBy === userEmail));
  const [organizations, setOrganizations] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    return data ? JSON.parse(data) : [];
  });
  const [licenses, setLicenses] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_licenses');
    return data ? JSON.parse(data) : [];
  });
  const videoConferencingEnabled = !!licenses.find((l: any) => l.assignedUserEmail === userEmail)?.enableVideoConferencing;
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    const refreshData = () => {
      syncCollection('screens', 'signageos_screens').then(serverScreens => {
        if (serverScreens && serverScreens.length > 0) {
          setScreens(serverScreens.filter(s => s.assignedToUserEmail === userEmail));
          mediaStore.saveScreens(serverScreens);
        }
      });
    };

    refreshData();
    const interval = setInterval(refreshData, 5000);

    const handleScreensUpdate = () => {
      const local = mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail);
      setScreens(local);
    };

    window.addEventListener('storage', handleScreensUpdate);
    window.addEventListener('signageos_screens_updated', handleScreensUpdate);

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
    syncCollection('organizations', 'signageos_organizations').then(serverOrgs => {
      if (serverOrgs.length > 0) setOrganizations(serverOrgs);
    });
    syncCollection('licenses', 'signageos_licenses').then(serverLicenses => {
      if (serverLicenses.length > 0) setLicenses(serverLicenses);
    });

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleScreensUpdate);
      window.removeEventListener('signageos_screens_updated', handleScreensUpdate);
    };
  }, [userEmail]);

  const getScreenOrgName = (screen: Screen) => {
    const org = organizations.find(o => o.email === screen.assignedToUserEmail);
    if (org) return org.name;
    const lic = licenses.find(l => l.assignedUserEmail === screen.assignedToUserEmail);
    if (lic?.assignedOrgName) return lic.assignedOrgName;
    if (screen.assignedToUserEmail === 'admin@demo.com') return 'Admin Org';
    return screen.assignedToUserEmail || 'None';
  };

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [detailsScreenId, setDetailsScreenId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<Screen | null>(null);
  const [pairTarget, setPairTarget] = useState<Screen | null>(null);
  // TVs that asked for a pairing code but were never added to anyone's
  // account. They aren't screens yet, so they live in their own view instead
  // of padding out the list and its counts.
  const isWaitingToPair = (s: Screen) => s.status === 'pairing' && !s.assignedToUserEmail;
  const [showPairing, setShowPairing] = useState(false);
  const waitingCount = screens.filter(isWaitingToPair).length;
  const realScreenCount = screens.length - waitingCount;
  const statusCount = (key: 'online' | 'offline' | 'warning') => screens.filter(s => {
    if (isWaitingToPair(s)) return false;
    const eff = getEffectiveStatus(s);
    return key === 'online' ? (eff === 'online' || eff === 'active') : eff === key;
  }).length;

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
    if (showPairing !== isWaitingToPair(s)) return false;
    if (showPairing) {
      const q = search.toLowerCase();
      return !q || (s.name || '').toLowerCase().includes(q) || ((s as any).pairing_code || '').toLowerCase().includes(q);
    }
    const matchSearch = (s.name || '').toLowerCase().includes(search.toLowerCase()) || (s.location || '').toLowerCase().includes(search.toLowerCase());
    // Same (heartbeat-aware) status the chips count by — the filter used the
    // raw stored status, so its results didn't match the numbers shown.
    const eff = getEffectiveStatus(s);
    const matchStatus = statusFilter === 'all' || (statusFilter === 'online' ? (eff === 'online' || eff === 'active') : eff === statusFilter);
    const matchGroup = groupFilter === 'all' ? true : (groupFilter === 'none' ? !s.groupId : s.groupId === groupFilter);
    const matchOrg = orgFilter === 'all' || getScreenOrgName(s) === orgFilter;
    return matchSearch && matchStatus && matchGroup && matchOrg;
  });

  const recordsPerPage = 25;
  const totalPages = Math.ceil(filtered.length / recordsPerPage);
  const activePage = Math.min(currentPage, totalPages || 1);
  const paginatedRecords = filtered.slice((activePage - 1) * recordsPerPage, activePage * recordsPerPage);

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
    addToast(`"${deleteScreen.name}" has been removed`);
  };

  const handleDeleteSelected = () => {
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.filter(s => !selectedIds.includes(s.id));
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    selectedIds.forEach(id => pushToDatabase('screens', id, null, 'DELETE'));
    const count = selectedIds.length;
    setSelectedIds([]);
    setIsSelectionMode(false);
    setDeleteConfirm(false);
    addToast(`Successfully removed ${count} screen(s)`);
  };

  const updateLocalScreen = (id: string, patch: Partial<Screen>) => {
    const allScreens = mediaStore.getScreens();
    const updatedAll = allScreens.map(s => s.id === id ? { ...s, ...patch } as Screen : s);
    mediaStore.saveScreens(updatedAll);
    setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
  };

  // Restart from the first slide. (This used to only show a toast — it never
  // actually told the TV anything.)
  const handleRestart = (screen: Screen) => {
    pushToDatabase('screens', screen.id, { restart_playlist: true }, 'PUT').then(res => {
      if (res.ok) addToast(`"${screen.name}" is restarting its playlist`, 'success');
      else addToast(`Couldn't restart "${screen.name}"`, 'error');
    });
  };

  const handleSync = (screen: Screen) => {
    pushToDatabase('screens', screen.id, { force_sync: true }, 'PUT').then(res => {
      if (res.ok) addToast(`Sync signal sent to "${screen.name}"`, 'success');
      else addToast(`Failed to send sync signal`, 'error');
    });
  };

  // Pause keeps the playlist assigned; the TV shows a paused screen until resumed.
  const handleTogglePause = (screen: Screen) => {
    const paused = !screen.paused;
    updateLocalScreen(screen.id, { paused });
    pushToDatabase('screens', screen.id, { paused }, 'PUT').then(res => {
      if (res.ok) {
        addToast(paused ? `Playback paused on "${screen.name}"` : `Playback resumed on "${screen.name}"`, 'success');
      } else {
        updateLocalScreen(screen.id, { paused: !paused });
        addToast(`Couldn't ${paused ? 'pause' : 'resume'} "${screen.name}"`, 'error');
      }
    });
  };

  const handleCheckStatus = async (screen: Screen) => {
    addToast(`Checking "${screen.name}"…`, 'info');
    try {
      const result = await pingScreen(screen.id);
      if (result.unlinked) {
        addToast(`"${screen.name}" has no TV linked`, 'info');
      } else if (result.online) {
        updateLocalScreen(screen.id, { status: 'online', lastHeartbeat: new Date().toISOString() });
        addToast(
          result.viaHeartbeat
            ? `"${screen.name}" is online (update the TV app for live checks)`
            : `"${screen.name}" is online — replied in ${result.latencyMs} ms`,
          'success'
        );
      } else {
        updateLocalScreen(screen.id, { status: 'offline' });
        addToast(`"${screen.name}" didn't respond — marked offline`, 'error');
      }
    } catch (e: any) {
      addToast(e?.message || `Couldn't check "${screen.name}"`, 'error');
    }
  };

  const handleUnlink = async (screen: Screen) => {
    try {
      await unlinkScreen(screen.id);
      updateLocalScreen(screen.id, { status: 'unlinked', paused: false });
      addToast(`TV unlinked from "${screen.name}". Pair a TV to use this screen again.`, 'success');
    } catch (e: any) {
      addToast(e?.message || `Couldn't unlink "${screen.name}"`, 'error');
    } finally {
      setUnlinkTarget(null);
    }
  };

  const handlePairTv = async (screen: Screen, code: string) => {
    const updated = await pairTvToScreen(screen.id, code);
    updateLocalScreen(screen.id, { status: (updated?.status || 'online') as Screen['status'], lastHeartbeat: new Date().toISOString() });
    setPairTarget(null);
    addToast(`TV paired to "${screen.name}"`, 'success');
  };

  const handleRemoveFromGroup = (screen: Screen) => {
    updateLocalScreen(screen.id, { groupId: '' } as Partial<Screen>);
    pushToDatabase('screens', screen.id, { groupId: '' }, 'PUT');
    addToast(`"${screen.name}" removed from group`);
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

  const handleEditSave = () => {
    if (!editScreen) return;
    const gp = groups.find(g => g.id === editScreen.groupId);
    const finalScreen = gp ? { 
      ...editScreen, 
      playlist: gp.playlist || editScreen.playlist,
      playlistId: userPlaylists.find(p => p.name === (gp?.playlist || ''))?.id || editScreen.playlistId,
      volume: gp.volume !== undefined ? gp.volume : editScreen.volume,
    } : editScreen;
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.map(s => s.id === editScreen.id ? finalScreen : s);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', editScreen.id, finalScreen, 'PUT');
    setEditScreen(null);
    addToast(`"${editScreen.name}" updated successfully`);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <ScreenSubNav activeTab="screens" onNavigate={onNavigate} role="user" />
      {/* Toasts — z-[60], above the z-50 edit/delete modals below */}
      <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <AlertCircle size={16} /> : <Info size={16} />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">All Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{realScreenCount} screen{realScreenCount === 1 ? '' : 's'}</span>
            {waitingCount > 0 && !showPairing && (
              <button
                onClick={() => { setShowPairing(true); setCurrentPage(1); setSelectedIds([]); }}
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                · {waitingCount} waiting to pair <span aria-hidden>→</span>
              </button>
            )}
          </p>
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

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Search screens"
          className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
        />
      </div>

      {/* Unclaimed TVs showing a pairing code — kept out of the main list. */}
      {showPairing ? (
        <div className="flex items-center justify-between gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3.5 py-2.5">
          <span className="text-xs text-blue-800">
            <span className="font-semibold">{waitingCount} TV{waitingCount === 1 ? '' : 's'} waiting to pair.</span> These show a code on screen but haven't been added to any account.
          </span>
          <button
            onClick={() => { setShowPairing(false); setCurrentPage(1); setSelectedIds([]); }}
            className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-800"
          >
            Back to screens
          </button>
        </div>
      ) : null}

      {!showPairing && (
        <div className="space-y-3 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-3">
        {/* Status chips double as the counts; tap the active one again to clear it. */}
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {([
            { key: 'online', label: 'Online', count: statusCount('online'), dot: 'bg-emerald-500' },
            { key: 'offline', label: 'Offline', count: statusCount('offline'), dot: 'bg-rose-500' },
            { key: 'warning', label: 'Warning', count: statusCount('warning'), dot: 'bg-amber-500' },
          ] as const).map(chip => {
            const active = statusFilter === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => { setStatusFilter(active ? 'all' : chip.key); setCurrentPage(1); }}
                aria-pressed={active}
                className={`flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${
                  active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-white' : chip.dot}`} />
                {chip.label}
                <span className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Group / organization filters */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <div className="sm:w-52">
            <CustomSelect
              value={groupFilter}
              onChange={val => { setGroupFilter(val); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Groups' },
                { value: 'none', label: 'No Group' },
                ...groups.map(g => ({ value: g.id, label: g.name }))
              ]}
              buttonClassName="text-xs py-2 px-3 sm:min-w-[140px]"
            />
          </div>
          <div className="sm:w-52">
            <CustomSelect
              value={orgFilter}
              onChange={val => { setOrgFilter(val); setCurrentPage(1); }}
              options={[
                { value: 'all', label: 'All Organizations' },
                ...Array.from(new Set<string>(organizations.map((o: any) => o.name as string)))
                  .filter((name: string) => Boolean(name && name !== 'x'))
                  .map((orgName: string) => ({ value: orgName, label: orgName }))
              ]}
              buttonClassName="text-xs py-2 px-3 sm:min-w-[160px]"
            />
          </div>
        </div>
        </div>
      )}

      {isSelectionMode && filtered.length > 0 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{selectedIds.length} selected</span>
          <button onClick={selectAll} className="font-semibold text-blue-600">
            {selectedIds.length === filtered.length ? 'Clear selection' : `Select all ${filtered.length}`}
          </button>
        </div>
      )}

      {/* Screens — compact cards; tapping one opens its details sheet. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {paginatedRecords.map(screen => {
          const status = getEffectiveStatus(screen);
          const group = screen.groupId ? groups.find(g => g.id === screen.groupId) : null;
          const playing = group ? (group.playlist || 'Normal') : (screen.playlist && screen.playlist !== 'None' ? screen.playlist : '');
          return (
            <ScreenCard
              key={screen.id}
              screen={screen}
              status={status}
              playing={playing}
              groupName={group?.name}
              footnote={isWaitingToPair(screen) ? undefined : getScreenOrgName(screen)}
              selectionMode={isSelectionMode}
              selected={selectedIds.includes(screen.id)}
              onClick={() => (isSelectionMode ? toggleSelect(screen.id) : setDetailsScreenId(screen.id))}
            />
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center bg-white rounded-2xl border border-gray-100">
          <Monitor size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500">No screens found</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 font-medium">
            {((activePage - 1) * recordsPerPage) + 1}–{Math.min(activePage * recordsPerPage, filtered.length)} of {filtered.length}
          </span>
          <div className="flex gap-2">
            <button
              disabled={activePage === 1}
              onClick={() => setCurrentPage(activePage - 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Previous
            </button>
            <button
              disabled={activePage === totalPages}
              onClick={() => setCurrentPage(activePage + 1)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {(() => {
        const screen = detailsScreenId ? screens.find(s => s.id === detailsScreenId) : null;
        if (!screen) return null;
        const status = getEffectiveStatus(screen);
        const group = screen.groupId ? groups.find(g => g.id === screen.groupId) : null;
        const playlistLabel = group ? (group.playlist || 'Normal') : (screen.playlist && screen.playlist !== 'None' ? screen.playlist : 'None');
        const unlinked = status === 'unlinked';
        const waitingDevice = isWaitingToPair(screen);
        const pairingCode = (screen as any).pairing_code as string | undefined;
        const removeAction = {
          key: 'delete',
          label: 'Remove screen',
          description: unlinked ? 'Delete this screen and its settings' : 'Unpair the TV and delete this screen',
          icon: <Trash2 size={17} />,
          tone: 'danger' as const,
          onClick: () => setDeleteScreen(screen)
        };
        const editAction = {
          key: 'edit',
          label: 'Edit details',
          description: 'Name, location, group and settings',
          icon: <Edit size={17} />,
          onClick: () => setEditScreen({ ...screen })
        };
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setDetailsScreenId(null)}
            title={screen.name}
            subtitle={screen.location && screen.location !== 'Not Specified' ? screen.location : undefined}
            badge={renderStatusBadge(screen)}
            hero={screen.thumbnail ? (
              <div className="aspect-video rounded-2xl bg-cover bg-center bg-ink-950" style={{ backgroundImage: `url(${screen.thumbnail})` }} />
            ) : undefined}
            details={waitingDevice ? [
              { label: 'Pairing code', value: pairingCode ? <span className="font-mono">{pairingCode}</span> : '—' },
              { label: 'Code expires', value: (screen as any).pairing_code_expires ? new Date((screen as any).pairing_code_expires).toLocaleString() : '—' },
              { label: 'First seen', value: (screen as any).created ? new Date((screen as any).created).toLocaleDateString() : '—' },
            ] : [
              { label: group ? 'Playlist (from group)' : 'Playlist', value: playlistLabel },
              ...(screen.paused ? [{ label: 'Playback', value: <span className="text-amber-700">Paused</span> }] : []),
              { label: 'TV', value: unlinked ? <span className="text-slate-500">Not linked</span> : (status === 'online' || status === 'active' ? 'Online now' : `Last seen ${lastSeenText(screen.lastHeartbeat)}`) },
              ...(group ? [{ label: 'Group', value: group.name }] : []),
              { label: 'Organization', value: getScreenOrgName(screen) || '—' },
              ...(screen.playerVersion ? [{ label: 'Player version', value: `v${screen.playerVersion}` }] : []),
            ]}
            groups={waitingDevice ? [
              {
                title: 'TV',
                actions: [{
                  key: 'add',
                  label: 'Add this TV as a screen',
                  description: pairingCode ? `Use code ${pairingCode} on the Add Screen page` : 'Open Add Screen and enter the code shown on the TV',
                  icon: <Plus size={17} />,
                  onClick: () => onNavigate('screens-add')
                }]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'delete',
                  label: 'Remove this device',
                  description: 'Deletes the waiting record — if the TV is still on, it shows a new code',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteScreen(screen)
                }]
              }
            ] : unlinked ? [
              {
                title: 'TV',
                actions: [{
                  key: 'pair',
                  label: 'Pair a TV',
                  description: 'Enter the code shown on the TV — keeps this screen\'s settings',
                  icon: <Tv size={17} />,
                  onClick: () => setPairTarget(screen)
                }]
              },
              { title: 'Settings', actions: [editAction] },
              { title: 'Danger zone', actions: [removeAction] }
            ] : [
              {
                title: 'Content',
                actions: [
                  {
                    key: 'restart',
                    label: 'Restart playlist',
                    description: 'Play again from the first slide',
                    icon: <RotateCcw size={17} />,
                    onClick: () => handleRestart(screen)
                  },
                  {
                    key: 'sync',
                    label: 'Sync now',
                    description: 'Re-download content; keeps playing meanwhile',
                    icon: <RefreshCw size={17} />,
                    onClick: () => handleSync(screen)
                  }
                ]
              },
              {
                title: 'Device',
                actions: [
                  {
                    key: 'ping',
                    label: 'Check status',
                    description: 'Ask the TV if it\'s online right now and update its status',
                    icon: <Activity size={17} />,
                    onClick: () => handleCheckStatus(screen)
                  },
                  {
                    key: 'pause',
                    label: screen.paused ? 'Resume playback' : 'Pause playback',
                    description: screen.paused ? 'Continue playing its playlist' : 'Show a paused screen; the playlist stays assigned',
                    icon: screen.paused ? <Play size={17} /> : <Pause size={17} />,
                    onClick: () => handleTogglePause(screen)
                  },
                  {
                    key: 'cache',
                    label: 'Clear cache',
                    description: 'Delete all downloaded media on the TV and download it again — blank until done',
                    icon: <Eraser size={17} />,
                    onClick: () => handleClearCache(screen)
                  },
                  editAction
                ]
              },
              {
                title: 'Danger zone',
                actions: [
                  {
                    key: 'unlink',
                    label: 'Unlink TV',
                    description: 'Disconnect the TV but keep this screen to pair again later',
                    icon: <Unlink size={17} />,
                    tone: 'danger' as const,
                    onClick: () => setUnlinkTarget(screen)
                  },
                  ...(group ? [{
                    key: 'ungroup',
                    label: 'Remove from group',
                    description: `Stop following "${group.name}"`,
                    icon: <FolderMinus size={17} />,
                    tone: 'danger' as const,
                    onClick: () => handleRemoveFromGroup(screen)
                  }] : []),
                  removeAction
                ]
              }
            ]}
          />
        );
      })()}

      {unlinkTarget && (
        <ConfirmDialog
          title={`Unlink the TV from "${unlinkTarget.name}"?`}
          body={<>
            <p>The TV stops playing and goes back to its pairing screen.</p>
            <p>This screen stays in the account with its name, location, group and playlist. Use “Pair a TV” to connect a TV to it again.</p>
          </>}
          confirmLabel="Unlink TV"
          tone="danger"
          onCancel={() => setUnlinkTarget(null)}
          onConfirm={() => handleUnlink(unlinkTarget)}
        />
      )}

      {pairTarget && (
        <PairTvDialog
          screenName={pairTarget.name}
          onClose={() => setPairTarget(null)}
          onSubmit={code => handlePairTv(pairTarget, code)}
        />
      )}

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
                <CustomSelect 
                  value={editScreen.status} 
                  onChange={val => setEditScreen(p => p && ({ ...p, status: val as Screen['status'] }))} 
                  options={[
                    { value: 'online', label: 'Online' },
                    { value: 'offline', label: 'Offline' },
                    { value: 'warning', label: 'Warning' }
                  ]}
                  buttonClassName="px-3 py-2.5 text-sm min-h-[42px]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Group</label>
                <CustomSelect
                  value={editScreen.groupId ?? ''}
                  onChange={val => setEditScreen(p => p && ({ ...p, groupId: val || undefined }))}
                  placeholder="None (Ungrouped)"
                  options={[
                    { value: '', label: 'None (Ungrouped)' },
                    ...groups.map(g => ({ value: g.id, label: g.name }))
                  ]}
                  buttonClassName="px-3 py-2.5 text-sm min-h-[42px]"
                />
              </div>
              {videoConferencingEnabled && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div>
                    <span className="text-xs font-semibold text-gray-700 block">Camera Mounted</span>
                    <span className="text-[11px] text-gray-400">Makes this TV selectable for Video Conferencing</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!!editScreen.cameraMountEnabled}
                    onChange={e => setEditScreen(p => p && ({ ...p, cameraMountEnabled: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                  />
                </div>
              )}
              {!editScreen.groupId && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                  <CustomSelect
                    value={editScreen.playlist}
                    onChange={val => {
                      const play = userPlaylists.find(p => p.name === val);
                      setEditScreen(p => p && ({ ...p, playlist: val, playlistId: play ? play.id : '' }));
                    }}
                    options={[
                      { value: 'Normal', label: 'Normal' },
                      { value: 'None', label: 'None (Stop Playback)' },
                      ...userPlaylists.map(pl => ({ value: pl.name, label: pl.name }))
                    ]}
                    buttonClassName="px-3 py-2.5 text-sm min-h-[42px]"
                  />
                </div>
              )}
              {editScreen.groupId && (() => {
                const gp = groups.find(g => g.id === editScreen.groupId);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 space-y-2">
                    <p>Playlist is managed by group <strong>{gp?.name}</strong> (Inherited: <strong>{gp?.playlist || 'None'}</strong>).</p>
                    <button
                      type="button"
                      onClick={() => setEditScreen(p => p && ({ ...p, groupId: undefined }))}
                      className="w-full mt-1.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FolderMinus size={13} />
                      Remove Screen from Group
                    </button>
                  </div>
                );
              })()}
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
