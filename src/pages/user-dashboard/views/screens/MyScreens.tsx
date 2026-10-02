import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../../../config';
import {
  Search, Plus, Wifi, WifiOff, AlertTriangle, AlertCircle, Info, RefreshCw, Trash2, Edit,
  Clock, Monitor, X, Check, CheckCircle, MapPin,
  Grid3X3, List, Pause, Eraser, Lock, Trash, Square,
  Calendar, Link, ListVideo, FolderMinus, ChevronRight, Play, Activity, Unlink, Tv
} from 'lucide-react';
import ScreenDetailsSheet from '../../../../components/screens/ScreenDetailsSheet';
import PairTvDialog from '../../../../components/screens/PairTvDialog';
import ConfirmDialog from '../../../../components/screens/ConfirmDialog';
import { pingScreen, unlinkScreen, pairTvToScreen } from '../../../../lib/screenActions';
import { mediaStore, Playlist } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';
import CustomSelect from '../../../../components/CustomSelect';
import { pushToDatabase, syncCollection } from '../../../../lib/syncHelper';
import { getAuthToken } from '../../../../lib/authStorage';
import type { Screen } from '../../types';

const groupColorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
  blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-100',    iconBg: 'bg-blue-600' },
  teal:    { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-100',    iconBg: 'bg-teal-600' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-100', iconBg: 'bg-emerald-600' },
  yellow:  { bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-100',  iconBg: 'bg-yellow-500' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-100',    iconBg: 'bg-rose-500' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-100',   iconBg: 'bg-slate-500' },
};

const getStatusColors = (status: string) => {
  switch (status) {
    case 'online':
      return {
        borderColor: '#10B981', // emerald-500
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-500/10',
        glowColor: 'rgba(16, 185, 129, 0.2)',
        label: 'Online'
      };
    case 'active':
      return {
        borderColor: '#10B981', // emerald-500
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-500/10',
        glowColor: 'rgba(16, 185, 129, 0.2)',
        label: 'Active'
      };
    case 'offline':
      return {
        borderColor: '#F43F5E', // rose-500
        textColor: 'text-rose-700',
        badgeBg: 'bg-rose-500/10',
        glowColor: 'rgba(244, 63, 94, 0.2)',
        label: 'Offline'
      };
    case 'warning':
      return {
        borderColor: '#F59E0B', // amber-500
        textColor: 'text-amber-700',
        badgeBg: 'bg-amber-500/10',
        glowColor: 'rgba(245, 158, 11, 0.2)',
        label: 'Warning'
      };
    case 'pairing':
      return {
        borderColor: '#3B82F6', // blue-500
        textColor: 'text-blue-700',
        badgeBg: 'bg-blue-500/10',
        glowColor: 'rgba(59, 130, 246, 0.2)',
        label: 'Pairing'
      };
    case 'unlinked':
      return {
        borderColor: '#94A3B8', // slate-400
        textColor: 'text-slate-500',
        badgeBg: 'bg-slate-500/10',
        glowColor: 'rgba(148, 163, 184, 0.2)',
        label: 'Not linked'
      };
    case 'suspended':
      return {
        borderColor: '#64748B', // slate-500
        textColor: 'text-slate-700',
        badgeBg: 'bg-slate-500/10',
        glowColor: 'rgba(100, 116, 139, 0.2)',
        label: 'Suspended'
      };
    default:
      return {
        borderColor: '#64748B',
        textColor: 'text-slate-700',
        badgeBg: 'bg-slate-500/10',
        glowColor: 'rgba(100, 116, 139, 0.2)',
        label: status
      };
  }
};

export const getEffectiveStatus = (screen: any): string => {
  if (!screen) return 'offline';
  const status = screen?.status || 'offline';
  if (status === 'online' || status === 'active') {
    const hb = screen?.lastHeartbeat || screen?.lastSeen;
    if (!hb) return 'offline';

    let hbTime = NaN;
    if (typeof hb === 'number') {
      hbTime = hb;
    } else if (typeof hb === 'string') {
      const trimmed = hb.trim();
      if (/^\d+$/.test(trimmed)) {
        hbTime = parseInt(trimmed, 10);
      } else if (/^just now$/i.test(trimmed) || /^recently$/i.test(trimmed) || /^online$/i.test(trimmed)) {
        hbTime = Date.now();
      } else if (/^never$/i.test(trimmed)) {
        return 'offline';
      } else {
        hbTime = new Date(trimmed).getTime();
      }
    }

    if (isNaN(hbTime) || (Date.now() - hbTime > 90000)) {
      return 'offline';
    }
  }
  return status;
};

const renderStatusBadge = (screenOrStatus: any) => {
  const status = typeof screenOrStatus === 'string' ? screenOrStatus : getEffectiveStatus(screenOrStatus);
  const info = getStatusColors(status);
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md shadow-2xs ${info.badgeBg} ${info.textColor}`}
      style={{ borderColor: `${info.borderColor}20` }}
    >
      {status === 'active' || status === 'online' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      ) : status === 'offline' ? (
        <span className="h-2 w-2 rounded-full bg-rose-500"></span>
      ) : status === 'pairing' ? (
        <span className="h-2.5 w-2.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
      ) : status === 'suspended' ? (
        <Lock size={9} className="text-slate-500" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-slate-500"></span>
      )}
      <span>{info.label}</span>
    </span>
  );
};

type Toast = { id: number; message: string; type: 'success' | 'info' | 'error' };
type ViewMode = 'grid' | 'list';

export default function MyScreens({ onNavigate, userEmail = 'priya@demo.com' }: { onNavigate: (v: string) => void; userEmail?: string }) {
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
  const [licenses, setLicenses] = useState(() => licensingStore.getLicenses());
  const videoConferencingEnabled = !!licenses.find(l => l.assignedUserEmail === userEmail)?.enableVideoConferencing;
  const [mediaList, setMediaList] = useState(() => mediaStore.getMedia());
  const [organizations, setOrganizations] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    return data ? JSON.parse(data) : [];
  });
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  // Screen whose details sheet is open (tapping a card opens it).
  const [detailsScreenId, setDetailsScreenId] = useState<string | null>(null);
  const [unlinkTarget, setUnlinkTarget] = useState<Screen | null>(null);
  const [pairTarget, setPairTarget] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [hoveredScreen, setHoveredScreen] = useState<string | null>(null);
  const [scheduleScreen, setScheduleScreen] = useState<Screen | null>(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  // Assign playlist modal
  const [assignScreen, setAssignScreen] = useState<Screen | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignHighlight, setAssignHighlight] = useState(0);
  const assignInputRef = useRef<HTMLInputElement>(null);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    const refreshData = () => {
      syncCollection('screens', 'signageos_screens').then(serverScreens => {
        if (serverScreens && serverScreens.length > 0) {
          setScreens(serverScreens.filter((s: Screen) => s.assignedToUserEmail === userEmail));
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
        setUserPlaylists(serverPlaylists.filter((p: any) => p.createdBy === userEmail));
      }
    });
    syncCollection('licenses', 'signageos_licenses').then(serverLicenses => {
      if (serverLicenses.length > 0) setLicenses(serverLicenses);
    });
    syncCollection('media_items', 'signageos_media').then(serverMedia => {
      if (serverMedia.length > 0) setMediaList(serverMedia);
    });
    syncCollection('organizations', 'signageos_organizations').then(serverOrgs => {
      if (serverOrgs.length > 0) setOrganizations(serverOrgs);
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
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.filter(s => s.id !== deleteScreen.id);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', deleteScreen.id, null, 'DELETE');
    setDeleteScreen(null);
    addToast(`"${deleteScreen.name}" removed from your screens`);
  };

  const handleDeleteSelected = () => {
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.filter(s => !selectedIds.includes(s.id));
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    selectedIds.forEach(id => pushToDatabase('screens', id, null, 'DELETE'));
    setSelectedIds([]);
    setIsSelectionMode(false);
    setDeleteConfirm(false);
    addToast(`Selected screen(s) removed successfully`, 'success');
  };

  const handleSyncSelected = () => {
    selectedIds.forEach(id => {
      pushToDatabase('screens', id, { force_sync: true }, 'PUT');
    });
    addToast(`Sync command sent to ${selectedIds.length} selected screen(s)`, 'success');
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleClearCacheSelected = () => {
    selectedIds.forEach(id => {
      pushToDatabase('screens', id, { clear_cache: true }, 'PUT');
    });
    addToast(`Cache clear command sent to ${selectedIds.length} selected screen(s)`, 'success');
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleStopPlaybackSelected = () => {
    selectedIds.forEach(id => {
      updateLocalScreen(id, { paused: true });
      pushToDatabase('screens', id, { paused: true }, 'PUT');
    });
    addToast(`Playback paused on ${selectedIds.length} selected screen(s)`, 'success');
    setSelectedIds([]);
    setIsSelectionMode(false);
  };

  const handleSync = (screen: Screen) => {
    setOpenMenu(null);
    setHoveredScreen(null);
    pushToDatabase('screens', screen.id, { force_sync: true }, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Sync signal sent to "${screen.name}"`, 'success');
      } else {
        addToast(`Failed to send sync signal`, 'info');
      }
    });
  };

  const updateLocalScreen = (id: string, patch: Partial<Screen>) => {
    const allScreens = mediaStore.getScreens();
    const updatedAll = allScreens.map(s => s.id === id ? { ...s, ...patch } as Screen : s);
    mediaStore.saveScreens(updatedAll);
    setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
  };

  // Pause keeps the playlist assigned — the TV shows a "paused" screen until
  // resumed. (The old "Stop playback" cleared the playlist, so there was
  // nothing to resume.)
  const handleTogglePause = (screen: Screen) => {
    setOpenMenu(null);
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

  const handleClearCache = (screen: Screen) => {
    setOpenMenu(null);
    pushToDatabase('screens', screen.id, { clear_cache: true }, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Cache purge command sent to "${screen.name}"`, 'success');
      } else {
        addToast(`Failed to send cache purge command`, 'info');
      }
    });
  };

  const handleRemoveScreenFromGroup = (screen: Screen) => {
    const updatedScreen = { ...screen, groupId: null };
    const allScreens = mediaStore.getScreens();
    const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
    mediaStore.saveScreens(updatedAll);
    setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
    addToast(`"${screen.name}" removed from group`);
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

  const handleScheduleSave = () => {
    if (!scheduleScreen) return;
    const finalScreen = scheduleEnabled
      ? scheduleScreen
      : { ...scheduleScreen, schedulePlaylist: '', scheduleDate: '', scheduleTime: '' };
    const allScreens = mediaStore.getScreens();
    const updated = allScreens.map(s => s.id === finalScreen.id ? finalScreen : s);
    mediaStore.saveScreens(updated);
    setScreens(updated.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', finalScreen.id, finalScreen, 'PUT');
    setScheduleScreen(null);
    setScheduleEnabled(false);
    addToast(scheduleEnabled ? `Schedule set for "${finalScreen.name}"` : `Schedule cleared for "${scheduleScreen.name}"`, 'success');
  };

  const handleAssignPlaylist = (playlist: Playlist) => {
    if (!assignScreen) return;
    mediaStore.assignPlaylistToScreen(assignScreen.id, playlist.id);
    const allScreens = mediaStore.getScreens();
    setScreens(allScreens.filter(s => s.assignedToUserEmail === userEmail));
    // Also push to server
    fetch(`${API_BASE}/screens/${assignScreen.id}/assign-playlist`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ playlistId: playlist.id, playlistName: playlist.name })
    }).catch(() => {});
    addToast(`"${playlist.name}" assigned to "${assignScreen.name}"`, 'success');
    setAssignScreen(null);
    setAssignSearch('');
    setAssignHighlight(0);
  };

  const stats = [
    { label: 'Total', count: screens.length, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
    { label: 'Online', count: screens.filter(s => s.status === 'online').length, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100' },
    { label: 'Offline', count: screens.filter(s => s.status === 'offline').length, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
    { label: 'Warning', count: screens.filter(s => s.status === 'warning').length, color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-100' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5" onClick={() => openMenu && setOpenMenu(null)}>
      {/* Toasts — z-[60], above the z-50 edit/delete/schedule modals below */}
      <div className="fixed top-4 right-4 z-[60] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle size={15} /> : toast.type === 'error' ? <AlertCircle size={15} /> : <Info size={15} />}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">My Screens</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {screens.length} screen{screens.length !== 1 ? 's' : ''} assigned to your account
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {screens.length > 0 && (
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedIds([]);
                }}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-semibold transition-all shadow-sm cursor-pointer ${
                  isSelectionMode ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <CheckCircle size={15} />
                {isSelectionMode ? 'Cancel Selection' : 'Select'}
              </button>
              {isSelectionMode && selectedIds.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleSyncSelected}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-all shadow-xs cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    Force Sync ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleClearCacheSelected}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Clear Cache ({selectedIds.length})
                  </button>
                  <button
                    onClick={handleStopPlaybackSelected}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
                  >
                    <Square size={13} />
                    Pause ({selectedIds.length})
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-semibold hover:bg-rose-100 hover:border-rose-300 transition-all shadow-xs cursor-pointer"
                  >
                    <Trash size={13} />
                    Delete ({selectedIds.length})
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => onNavigate('screens-add')}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={15} />
            Add Screen
          </button>
        </div>
      </div>

      {/* Search + view toggle. The search box used to sit in a column with
          items-start, so on phones it shrank to its content width and cut
          off its own placeholder; the icon was also pinned to the top of a
          44px-tall input. */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search screens"
            className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex h-11 shrink-0 border border-gray-200 rounded-xl overflow-hidden bg-white">
          <button
            onClick={() => setViewMode('grid')}
            className={`w-11 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            title="Grid view"
            aria-label="Grid view"
          >
            <Grid3X3 size={16} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`w-11 flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-600'}`}
            title="List view"
            aria-label="List view"
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* Status filters double as the counts — replaces four large stat tiles
          that repeated the same numbers above a second row of filter chips. */}
      {/* No "All" chip: tapping the active filter again clears it. */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {([
          { key: 'online', label: 'Online', count: stats[1].count, dot: 'bg-emerald-500' },
          { key: 'offline', label: 'Offline', count: stats[2].count, dot: 'bg-rose-500' },
          { key: 'warning', label: 'Warning', count: stats[3].count, dot: 'bg-amber-500' },
        ] as const).map(chip => {
          const active = statusFilter === chip.key;
          return (
            <button
              key={chip.key}
              onClick={() => setStatusFilter(active ? 'all' : chip.key)}
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
      <div className="flex justify-end -mt-1">
            <CustomSelect
              value={groupFilter}
              onChange={val => setGroupFilter(val)}
              options={[
                { value: 'all', label: 'All Groups' },
                { value: 'none', label: 'No Group' },
                ...(() => {
                  const myLicense = licenses.find(l => l.assignedUserEmail === userEmail);
                  const myOrgId = myLicense?.assignedOrgId;
                  const filteredGroups = myOrgId ? groups.filter(g => g.orgId === myOrgId) : groups;
                  return filteredGroups.map(g => ({ value: g.id, label: g.name }));
                })()
              ]}
              buttonClassName="text-xs py-2 px-3 min-w-[120px] rounded-full"
            />
        </div>

      {/* Grid View — compact cards; tapping one opens its details sheet. */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(screen => {
            const status = getEffectiveStatus(screen);
            const info = getStatusColors(status);
            const isLive = status === 'online' || status === 'active';
            const group = screen.groupId ? groups.find(g => g.id === screen.groupId) : null;
            const playing = group ? (group.playlist || 'Normal') : (screen.playlist && screen.playlist !== 'None' ? screen.playlist : '');
            const selected = selectedIds.includes(screen.id);
            return (
              <button
                key={screen.id}
                type="button"
                onClick={() => (isSelectionMode ? toggleSelect(screen.id) : setDetailsScreenId(screen.id))}
                className={`w-full text-left bg-white rounded-2xl border p-3 flex items-center gap-3 transition-colors cursor-pointer ${
                  selected ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-100 hover:border-slate-200 hover:shadow-sm'
                }`}
              >
                {isSelectionMode && (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {}}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 shrink-0 pointer-events-none"
                  />
                )}
                <span className="relative w-14 h-14 rounded-xl overflow-hidden bg-ink-950 shrink-0 flex items-center justify-center">
                  {screen.thumbnail ? (
                    <span className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${screen.thumbnail})` }} />
                  ) : (
                    <Monitor size={20} className="text-white/25" />
                  )}
                  <span
                    className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full ring-2 ring-ink-950"
                    style={{ backgroundColor: info.borderColor }}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-slate-900 truncate">{screen.name}</span>
                  <span className="flex items-center gap-1 text-xs text-slate-500 mt-0.5 min-w-0">
                    <span className={`font-semibold ${info.textColor}`}>{info.label}</span>
                    {screen.location && screen.location !== 'Not Specified' && (
                      <span className="truncate">· {screen.location}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs mt-1 min-w-0">
                    {status === 'unlinked' ? (
                      <span className="text-blue-600 font-medium">Tap to pair a TV</span>
                    ) : screen.paused ? (
                      <span className="truncate text-amber-700 font-medium">❚❚ Paused{playing ? ` · ${playing}` : ''}</span>
                    ) : playing ? (
                      <span className={`truncate ${isLive ? 'text-slate-700' : 'text-slate-400'}`}>
                        {isLive ? '▶ ' : ''}{playing}
                      </span>
                    ) : (
                      <span className="text-slate-400">No playlist</span>
                    )}
                    {group && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold truncate max-w-[90px]">{group.name}</span>
                    )}
                  </span>
                </span>
                {!isSelectionMode && <ChevronRight size={18} className="text-slate-300 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {(() => {
        const screen = detailsScreenId ? screens.find(s => s.id === detailsScreenId) : null;
        if (!screen) return null;
        const status = getEffectiveStatus(screen);
        const group = screen.groupId ? groups.find(g => g.id === screen.groupId) : null;
        const lastSeen = (() => {
          const t = screen.lastHeartbeat ? new Date(screen.lastHeartbeat).getTime() : NaN;
          if (!Number.isFinite(t)) return screen.lastHeartbeat || '—';
          const mins = Math.floor((Date.now() - t) / 60000);
          if (mins < 1) return 'Just now';
          if (mins < 60) return `${mins} min ago`;
          const hours = Math.floor(mins / 60);
          if (hours < 24) return `${hours} h ago`;
          const days = Math.floor(hours / 24);
          return `${days} day${days === 1 ? '' : 's'} ago`;
        })();
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setDetailsScreenId(null)}
            title={screen.name}
            subtitle={screen.location && screen.location !== 'Not Specified' ? <span className="flex items-center gap-1"><MapPin size={13} />{screen.location}</span> : undefined}
            badge={renderStatusBadge(screen)}
            hero={screen.thumbnail ? (
              <div className="aspect-video rounded-2xl bg-cover bg-center bg-ink-950" style={{ backgroundImage: `url(${screen.thumbnail})` }} />
            ) : undefined}
            details={[
              { label: group ? 'Playlist (from group)' : 'Playlist', value: group ? (group.playlist || 'Normal') : (screen.playlist && screen.playlist !== 'None' ? screen.playlist : 'None') },
              ...(screen.schedulePlaylist ? [{ label: 'Next scheduled', value: `${screen.schedulePlaylist} · ${screen.scheduleDate || ''} ${screen.scheduleTime || ''}`.trim() }] : []),
              ...(screen.paused ? [{ label: 'Playback', value: <span className="text-amber-700">Paused</span> }] : []),
              { label: 'TV', value: status === 'unlinked' ? <span className="text-slate-500">Not linked</span> : (status === 'online' || status === 'active' ? 'Online now' : `Last seen ${lastSeen}`) },
              ...(group ? [{ label: 'Group', value: group.name }] : []),
              { label: 'Organization', value: getScreenOrgName(screen) || '—' },
              ...(screen.playerVersion ? [{ label: 'Player version', value: `v${screen.playerVersion}` }] : []),
            ]}
            groups={status === 'unlinked' ? [
              {
                title: 'TV',
                actions: [
                  {
                    key: 'pair',
                    label: 'Pair a TV',
                    description: 'Enter the code shown on the TV — keeps this screen\'s settings',
                    icon: <Tv size={17} />,
                    onClick: () => setPairTarget(screen)
                  }
                ]
              },
              {
                title: 'Content',
                actions: [
                  {
                    key: 'assign',
                    label: 'Change playlist',
                    description: 'Choose what this screen plays',
                    icon: <ListVideo size={17} />,
                    disabled: !!group,
                    disabledReason: 'Set by its group — change the group\'s playlist instead',
                    onClick: () => {
                      setAssignScreen(screen);
                      setAssignSearch('');
                      setAssignHighlight(0);
                      setTimeout(() => assignInputRef.current?.focus(), 50);
                    }
                  },
                  {
                    key: 'schedule',
                    label: screen.schedulePlaylist ? 'Edit schedule' : 'Schedule a playlist',
                    description: 'Switch to another playlist at a set time',
                    icon: <Calendar size={17} />,
                    onClick: () => {
                      setScheduleEnabled(!!screen.schedulePlaylist);
                      setScheduleScreen({ ...screen,
                        schedulePlaylist: screen.schedulePlaylist || userPlaylists[0]?.name || '',
                        scheduleDate: screen.scheduleDate || new Date().toISOString().split('T')[0],
                        scheduleTime: screen.scheduleTime || '12:00'
                      });
                    }
                  }
                ]
              },
              {
                title: 'Settings',
                actions: [
                  {
                    key: 'edit',
                    label: 'Edit details',
                    description: 'Name, location and settings',
                    icon: <Edit size={17} />,
                    onClick: () => setEditScreen({ ...screen })
                  }
                ]
              },
              {
                title: 'Danger zone',
                actions: [
                  {
                    key: 'delete',
                    label: 'Remove screen',
                    description: 'Delete this screen and its settings',
                    icon: <Trash2 size={17} />,
                    tone: 'danger' as const,
                    onClick: () => setDeleteScreen(screen)
                  }
                ]
              }
            ] : [
              {
                title: 'Content',
                actions: [
                  {
                    key: 'assign',
                    label: 'Change playlist',
                    description: 'Choose what this screen plays',
                    icon: <ListVideo size={17} />,
                    disabled: !!group,
                    disabledReason: 'Set by its group — change the group\'s playlist instead',
                    onClick: () => {
                      setAssignScreen(screen);
                      setAssignSearch('');
                      setAssignHighlight(0);
                      setTimeout(() => assignInputRef.current?.focus(), 50);
                    }
                  },
                  {
                    key: 'schedule',
                    label: screen.schedulePlaylist ? 'Edit schedule' : 'Schedule a playlist',
                    description: 'Switch to another playlist at a set time',
                    icon: <Calendar size={17} />,
                    onClick: () => {
                      setScheduleEnabled(!!screen.schedulePlaylist);
                      setScheduleScreen({ ...screen,
                        schedulePlaylist: screen.schedulePlaylist || userPlaylists[0]?.name || '',
                        scheduleDate: screen.scheduleDate || new Date().toISOString().split('T')[0],
                        scheduleTime: screen.scheduleTime || '12:00'
                      });
                    }
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
                  {
                    key: 'edit',
                    label: 'Edit details',
                    description: 'Name, location and settings',
                    icon: <Edit size={17} />,
                    onClick: () => setEditScreen({ ...screen })
                  }
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
                    onClick: () => handleRemoveScreenFromGroup(screen)
                  }] : []),
                  {
                    key: 'delete',
                    label: 'Remove screen',
                    description: 'Unpair the TV and delete this screen',
                    icon: <Trash2 size={17} />,
                    tone: 'danger' as const,
                    onClick: () => setDeleteScreen(screen)
                  }
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
            <p>This screen stays in your account with its name, location, group and playlist. Use “Pair a TV” to connect a TV to it again.</p>
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

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {isSelectionMode && <th className="px-4 py-3 text-left w-10"></th>}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Screen</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Playlist</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(screen => (
                  <tr key={screen.id} className="hover:bg-gray-50 transition-colors">
                    {isSelectionMode && (
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(screen.id)}
                          onChange={() => toggleSelect(screen.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                          {screen.thumbnail ? (
                            <img src={screen.thumbnail} alt={screen.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                              <Monitor size={16} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{screen.name}</p>
                          {screen.playerVersion && (
                            <p className="text-xs text-gray-400">v{screen.playerVersion}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(screen)}
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
                          <div className="text-sm font-semibold text-gray-800">
                            {screen.playlist || 'Normal'}
                          </div>
                          {screen.schedulePlaylist && (
                            <div className="text-[9px] text-amber-600 font-medium">
                              Scheduled: {screen.schedulePlaylist} ({screen.scheduleDate} {screen.scheduleTime})
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[160px] truncate">
                      {getScreenOrgName(screen)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Always-visible action buttons in list view */}
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          onClick={() => setEditScreen({ ...screen })}
                          className="p-1 text-blue-600 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-200/50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Screen"
                        >
                          <Edit size={13} />
                        </button>
                        <button
                          onClick={() => handleSync(screen)}
                          className="p-1 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 border border-yellow-100 rounded-lg transition-colors cursor-pointer"
                          title="Sync Device"
                        >
                          <RefreshCw size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setAssignScreen(screen);
                            setAssignSearch('');
                            setAssignHighlight(0);
                            setTimeout(() => assignInputRef.current?.focus(), 50);
                          }}
                          className="p-1 text-teal-600 bg-teal-50 hover:bg-teal-100 border border-teal-100 rounded-lg transition-colors cursor-pointer"
                          title="Assign Playlist"
                        >
                          <ListVideo size={13} />
                        </button>
                        <button
                          onClick={() => {
                            setScheduleEnabled(!!screen.schedulePlaylist);
                            setScheduleScreen({ ...screen,
                              schedulePlaylist: screen.schedulePlaylist || userPlaylists[0]?.name || '',
                              scheduleDate: screen.scheduleDate || new Date().toISOString().split('T')[0],
                              scheduleTime: screen.scheduleTime || '12:00'
                            });
                          }}
                          className="p-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors cursor-pointer"
                          title="Schedule Playlist"
                        >
                          <Calendar size={13} />
                        </button>
                        <button
                          onClick={() => handleTogglePause(screen)}
                          className="p-1 rounded-lg transition-colors cursor-pointer border text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-100"
                          title={screen.paused ? 'Resume playback' : 'Pause playback'}
                        >
                          {screen.paused ? <Play size={13} /> : <Pause size={13} />}
                        </button>
                        <button
                          onClick={() => handleClearCache(screen)}
                          className="p-1 text-purple-600 bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-lg transition-colors cursor-pointer"
                          title="Clear Cache"
                        >
                          <Eraser size={13} />
                        </button>
                         {screen.groupId && (
                          <button
                            onClick={() => handleRemoveScreenFromGroup(screen)}
                            className="p-1 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-100 rounded-lg transition-colors cursor-pointer"
                            title="Remove from group"
                          >
                            <FolderMinus size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteScreen(screen)}
                          className="p-1 text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors cursor-pointer"
                          title="Remove Screen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
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

      {/* Grid View No Results */}
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
              <button onClick={() => setEditScreen(null)} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Screen Name</label>
                <input value={editScreen.name} onChange={e => setEditScreen(p => p && ({ ...p, name: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Location</label>
                <input value={editScreen.location} onChange={e => setEditScreen(p => p && ({ ...p, location: e.target.value }))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
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
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Group</label>
                <CustomSelect
                  value={editScreen.groupId ?? ''}
                  onChange={val => setEditScreen(p => p && ({ ...p, groupId: val || null }))}
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

              {editScreen.groupId && (() => {
                const gp = groups.find(g => g.id === editScreen.groupId);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-2">
                    <p className="font-semibold">Inherited from Group</p>
                    <p>This screen belongs to group <strong>{gp?.name}</strong>. Playlist, schedule, and assets are managed at the group level.</p>
                    <p className="mt-2">Inherited Playlist: <strong>{gp?.playlist || 'None'}</strong></p>
                    {gp?.schedulePlaylist && (
                      <p>Group Scheduled Playlist: <strong>{gp.schedulePlaylist}</strong> on {gp.scheduleDate} at {gp.scheduleTime}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditScreen(p => p && ({ ...p, groupId: null }))}
                      className="w-full mt-1.5 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/60 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FolderMinus size={13} />
                      Remove Screen from Group
                    </button>
                  </div>
                );
              })()}

              {!editScreen.groupId && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Assigned Playlist</label>
                    <div className="w-full px-3 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-slate-500 font-semibold select-none">
                      {editScreen.playlist || 'Normal'}
                    </div>
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
                              return { ...p, schedulePlaylist: userPlaylists[0]?.name || 'Normal', scheduleDate: new Date().toISOString().split('T')[0], scheduleTime: '12:00' };
                            } else {
                              return { ...p, schedulePlaylist: '', scheduleDate: '', scheduleTime: '' };
                            }
                          });
                        }}
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500 accent-blue-600 cursor-pointer"
                      />
                    </div>
                    {editScreen.schedulePlaylist !== undefined && (
                      <div className="space-y-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Playlist</label>
                          <CustomSelect
                            value={editScreen.schedulePlaylist || ''}
                            onChange={val => setEditScreen(p => p && ({ ...p, schedulePlaylist: val }))}
                            options={userPlaylists.map(pl => ({ value: pl.name, label: pl.name }))}
                            buttonClassName="px-2.5 py-2 text-xs min-h-[36px]"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Date</label>
                            <input type="date" value={editScreen.scheduleDate || ''} onChange={e => setEditScreen(p => p && ({ ...p, scheduleDate: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400 bg-white" />
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Time</label>
                            <input type="time" value={editScreen.scheduleTime || ''} onChange={e => setEditScreen(p => p && ({ ...p, scheduleTime: e.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400 bg-white" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => setEditScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleEditSave} className="flex-1 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"><Check size={15} /> Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Confirm */}
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
                <button onClick={() => setDeleteScreen(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2.5 text-sm font-medium bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash size={26} className="text-red-500" />
              </div>
              <h2 className="text-base font-bold text-gray-900 mb-1">Delete Selected Screens</h2>
              <p className="text-sm text-gray-500 mb-1">This will permanently remove the <strong>{selectedIds.length} selected screen(s)</strong> from your account.</p>
              <p className="text-xs text-red-500 font-medium mb-5">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                <button onClick={handleDeleteSelected} className="flex-1 py-2.5 text-sm font-semibold bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors">Delete Selected</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Playlist Modal */}
      {scheduleScreen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setScheduleScreen(null); setScheduleEnabled(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Calendar size={16} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Schedule Playlist</h2>
                  <p className="text-[10px] text-gray-400 font-medium">{scheduleScreen.name}</p>
                </div>
              </div>
              <button onClick={() => { setScheduleScreen(null); setScheduleEnabled(false); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {scheduleScreen.groupId ? (() => {
                const gp = groups.find(g => g.id === scheduleScreen.groupId);
                return (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-2">
                    <p className="font-semibold">Inherited from Group</p>
                    <p>This screen belongs to group <strong>{gp?.name}</strong>. Scheduling must be managed at the group level.</p>
                  </div>
                );
              })() : (
                <>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs text-slate-600">
                    Set a future date &amp; time to automatically switch this screen to a different playlist.
                  </div>
                  {/* Enable toggle */}
                  <label className="flex items-center justify-between cursor-pointer p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                    <span className="text-sm font-semibold text-gray-700">Enable scheduled switch</span>
                    <div
                      className={`w-11 h-6 rounded-full relative transition-colors duration-200 ${ scheduleEnabled ? 'bg-indigo-600' : 'bg-gray-200'}`}
                      onClick={() => setScheduleEnabled(v => !v)}
                    >
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${scheduleEnabled ? 'left-6' : 'left-1'}`} />
                    </div>
                  </label>
                  {scheduleEnabled && (
                    <div className="space-y-3 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl">
                      <div>
                        <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Target Playlist</label>
                        <CustomSelect
                          value={scheduleScreen.schedulePlaylist || ''}
                          onChange={val => setScheduleScreen(p => p && ({ ...p, schedulePlaylist: val }))}
                          placeholder={userPlaylists.length === 0 ? "No playlists available" : "Select Playlist"}
                          options={userPlaylists.map(pl => ({ value: pl.name, label: pl.name }))}
                          buttonClassName="px-3 py-2 text-sm min-h-[42px]"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Date</label>
                          <input
                            type="date"
                            value={scheduleScreen.scheduleDate || ''}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={e => setScheduleScreen(p => p && ({ ...p, scheduleDate: e.target.value }))}
                            className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Time</label>
                          <input
                            type="time"
                            value={scheduleScreen.scheduleTime || ''}
                            onChange={e => setScheduleScreen(p => p && ({ ...p, scheduleTime: e.target.value }))}
                            className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button onClick={() => { setScheduleScreen(null); setScheduleEnabled(false); }} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button
                onClick={handleScheduleSave}
                disabled={scheduleEnabled && !scheduleScreen.schedulePlaylist}
                className="flex-1 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
              >
                <Check size={15} /> {scheduleEnabled ? 'Save Schedule' : 'Clear Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Playlist Modal */}
      {assignScreen && (() => {
        const filteredPlaylists = userPlaylists.filter(p =>
          p.name.toLowerCase().includes(assignSearch.toLowerCase())
        );
        const clamped = Math.min(assignHighlight, filteredPlaylists.length - 1);
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => { setAssignScreen(null); setAssignSearch(''); }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center">
                    <ListVideo size={16} className="text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">Assign Playlist</h2>
                    <p className="text-[10px] text-gray-400 font-medium">{assignScreen.name}</p>
                  </div>
                </div>
                <button onClick={() => { setAssignScreen(null); setAssignSearch(''); }} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-3">
                {/* Current playlist indicator */}
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 px-3 py-2 rounded-xl">
                  <span className="font-semibold text-slate-600">Currently:</span>
                  <span className="font-bold text-teal-700">{assignScreen.playlist || 'Normal'}</span>
                </div>
                {/* Search input */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    ref={assignInputRef}
                    type="text"
                    value={assignSearch}
                    placeholder="Search playlists..."
                    onChange={e => { setAssignSearch(e.target.value); setAssignHighlight(0); }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setAssignHighlight(h => Math.min(h + 1, filteredPlaylists.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setAssignHighlight(h => Math.max(h - 1, 0)); }
                      else if (e.key === 'Enter') { if (filteredPlaylists[clamped]) handleAssignPlaylist(filteredPlaylists[clamped]); }
                      else if (e.key === 'Escape') { setAssignScreen(null); setAssignSearch(''); }
                    }}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-teal-400 bg-white"
                  />
                </div>
                {/* Playlist list — max 5 visible */}
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  {filteredPlaylists.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400 font-medium">
                      No playlists found
                    </div>
                  ) : (
                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                      {filteredPlaylists.map((pl, idx) => (
                        <button
                          key={pl.id}
                          onClick={() => handleAssignPlaylist(pl)}
                          className={`w-full text-left px-4 py-3 flex items-center justify-between transition-colors ${
                            idx === clamped ? 'bg-teal-50 border-l-2 border-teal-500' : 'hover:bg-gray-50'
                          } ${idx !== 0 ? 'border-t border-gray-50' : ''}`}
                          onMouseEnter={() => setAssignHighlight(idx)}
                        >
                          <div>
                            <p className={`text-sm font-semibold ${ idx === clamped ? 'text-teal-700' : 'text-gray-800'}`}>{pl.name}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pl.mediaIds?.length || 0} items · {pl.scheduleStatus}</p>
                          </div>
                          {assignScreen.playlistId === pl.id && (
                            <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 text-center">Use ↑ ↓ arrows to navigate, Enter to select, Esc to close</p>
              </div>
              <div className="px-4 pb-4">
                <button
                  onClick={() => { handleAssignPlaylist({ id: '', name: 'Normal', mediaIds: [], assignedScreenIds: [], assignedScreens: 0, mediaCount: 0, active: true, scheduleStatus: 'Running', createdDate: '', createdBy: '' }); }}
                  className="w-full py-2.5 text-xs font-semibold text-gray-500 border border-dashed border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Clear playlist (set to Normal)
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
