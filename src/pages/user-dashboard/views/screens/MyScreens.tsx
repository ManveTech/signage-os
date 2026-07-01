import { useState, useEffect, useRef } from 'react';
import { API_BASE } from '../../../../config';
import {
  Search, Plus, Wifi, WifiOff, AlertTriangle, RefreshCw, Trash2, Edit,
  Clock, Monitor, X, Check, CheckCircle, MapPin,
  Grid3X3, List, Pause, Eraser, Lock, Trash,
  Calendar, Link, ListVideo, FolderMinus
} from 'lucide-react';
import { mediaStore, Playlist } from '../../../../lib/mediaStore';
import { licensingStore } from '../../../../lib/licensingStore';
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

const getStatusColors = (status: string) => {
  switch (status) {
    case 'online':
      return {
        borderColor: '#10B981', // emerald-500
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-550/10',
        glowColor: 'rgba(16, 185, 129, 0.2)',
        label: 'Online'
      };
    case 'active':
      return {
        borderColor: '#10B981', // emerald-500
        textColor: 'text-emerald-700',
        badgeBg: 'bg-emerald-550/10',
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

const renderStatusBadge = (status: string) => {
  const info = getStatusColors(status);
  return (
    <span 
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border backdrop-blur-md shadow-2xs ${info.badgeBg} ${info.textColor}`}
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
  const [mediaList, setMediaList] = useState(() => mediaStore.getMedia());
  const [organizations, setOrganizations] = useState<any[]>(() => {
    const data = localStorage.getItem('signageos_organizations');
    return data ? JSON.parse(data) : [];
  });
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'offline' | 'warning'>('all');
  const [editScreen, setEditScreen] = useState<Screen | null>(null);
  const [deleteScreen, setDeleteScreen] = useState<Screen | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [reconnectScreen, setReconnectScreen] = useState<Screen | null>(null);
  const [reconnectPairingCode, setReconnectPairingCode] = useState('');
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
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      if (serverScreens.length > 0) {
        setScreens(serverScreens.filter((s: Screen) => s.assignedToUserEmail === userEmail));
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
    const matchOrg = orgFilter === 'all' || getScreenOrgName(s) === orgFilter;
    const matchGroup = groupFilter === 'all' ? true : (groupFilter === 'none' ? !s.groupId : s.groupId === groupFilter);
    return matchSearch && matchStatus && matchOrg && matchGroup;
  });

  const getScreenStorageInfo = (screen: Screen) => {
    let playlistName = 'Normal';
    if (screen.groupId) {
      const gp = groups.find(g => g.id === screen.groupId);
      if (gp) {
        playlistName = gp.playlist || 'Normal';
      }
    } else {
      playlistName = screen.playlist || 'Normal';
    }

    const allPlaylists = mediaStore.getPlaylists();
    let playlist = allPlaylists.find(p => p.name === playlistName && p.createdBy === screen.assignedToUserEmail);
    if (!playlist && screen.playlistId) {
      playlist = allPlaylists.find(p => p.id === screen.playlistId);
    }
    if (!playlist) {
      playlist = allPlaylists.find(p => p.name === playlistName);
    }

    const mediaIds = playlist?.mediaIds || [];
    let totalSizeBytes = 0;
    mediaIds.forEach(id => {
      const item = mediaList.find(m => m.id === id);
      if (item) {
        totalSizeBytes += item.fileSizeBytes || 0;
      }
    });

    const myLicense = licenses.find(l => l.assignedUserEmail === screen.assignedToUserEmail);
    const limitGb = myLicense?.storageLimit || 5;
    const limitBytes = limitGb * 1024 * 1024 * 1024;
    const percentage = limitBytes > 0 ? (totalSizeBytes / limitBytes) * 100 : 0;

    let friendlySize = '0 Bytes';
    if (totalSizeBytes > 0) {
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(totalSizeBytes) / Math.log(k));
      friendlySize = parseFloat((totalSizeBytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    return {
      usedBytes: totalSizeBytes,
      friendlySize,
      limitGb,
      percentage: Math.min(percentage, 100)
    };
  };



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

  const handleDisconnectDevice = async (screen: any) => {
    const confirm = window.confirm(`Are you sure you want to disconnect "${screen.name}"? The player will return to the pairing screen.`);
    if (!confirm) return;

    try {
      const token = localStorage.getItem('signageos_token');
      const res = await fetch(`${API_BASE}/screens/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ screenId: screen.id })
      });
      if (res.ok) {
        addToast(`Successfully disconnected "${screen.name}"`, 'success');
        const allScreens = mediaStore.getScreens().map(s => s.id === screen.id ? { ...s, status: 'pairing' as any, assignedToUserEmail: '' } : s);
        mediaStore.saveScreens(allScreens);
        setScreens(prev => prev.filter(s => s.id !== screen.id));
      } else {
        const err = await res.json().catch(() => ({}));
        addToast(`Failed to disconnect screen: ${err.message || 'Unknown error'}`, 'error');
      }
    } catch (e: any) {
      addToast(`Error disconnecting screen: ${e.message}`, 'error');
    }
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

  const handleReconnectSave = () => {
    if (!reconnectScreen) return;
    if (!reconnectPairingCode.trim()) {
      addToast('Please enter a pairing code', 'error');
      return;
    }
    fetch(`${API_BASE}/screens/reconnect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('signageos_token')}`
      },
      body: JSON.stringify({
        screenId: reconnectScreen.id,
        pairingCode: reconnectPairingCode.trim().toUpperCase()
      })
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || 'Failed to reconnect screen');
        }
        return res.json();
      })
      .then((updatedScreen) => {
        addToast(`Successfully reconnected "${reconnectScreen.name}"`, 'success');
        const allScreens = mediaStore.getScreens();
        const updatedAll = allScreens.map(s => s.id === reconnectScreen.id ? { ...s, hardware_uuid: updatedScreen.hardware_uuid, status: 'active' as const, onlineSince: updatedScreen.onlineSince } : s);
        mediaStore.saveScreens(updatedAll);
        setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
        setReconnectScreen(null);
        setReconnectPairingCode('');
      })
      .catch((err) => {
        addToast(err.message, 'error');
      });
  };

  const handleSync = (screen: Screen) => {
    setOpenMenu(null);
    setHoveredScreen(null);
    const updatedScreen = { ...screen, force_sync: true };
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT').then(res => {
      if (res.ok) {
        addToast(`Sync signal sent to "${screen.name}"`, 'success');
      } else {
        addToast(`Failed to send sync signal`, 'info');
      }
    });
  };

  const handleStopPlayback = (screen: Screen) => {
    setOpenMenu(null);
    const updatedScreen = { ...screen, playlist: 'None', playlistId: '' };
    const allScreens = mediaStore.getScreens();
    const updatedAll = allScreens.map(s => s.id === screen.id ? updatedScreen : s);
    mediaStore.saveScreens(updatedAll);
    setScreens(updatedAll.filter(s => s.assignedToUserEmail === userEmail));
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT');
    addToast(`Playback stopped for "${screen.name}"`);
  };

  const handleClearCache = (screen: Screen) => {
    setOpenMenu(null);
    const updatedScreen = { ...screen, clear_cache: true };
    pushToDatabase('screens', screen.id, updatedScreen, 'PUT').then(res => {
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
        'Authorization': `Bearer ${localStorage.getItem('signageos_token')}`
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
    <div className="p-6 space-y-5" onClick={() => openMenu && setOpenMenu(null)}>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white animate-fade-in ${
            toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
          }`}>
            <CheckCircle size={15} />
            {toast.message}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Screens</h1>
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
                  isSelectionMode ? 'bg-slate-100 border-slate-350 text-slate-700' : 'bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100'
                }`}
              >
                <CheckCircle size={15} />
                {isSelectionMode ? 'Cancel Selection' : 'Select'}
              </button>
              {isSelectionMode && selectedIds.length > 0 && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-semibold hover:bg-red-100 hover:border-red-300 transition-all shadow-sm cursor-pointer"
                >
                  <Trash size={15} />
                  Delete Selected ({selectedIds.length})
                </button>
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
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={orgFilter}
            onChange={e => setOrgFilter(e.target.value)}
            className="text-xs border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none text-gray-700 focus:border-blue-400 cursor-pointer"
          >
            <option value="all">All Organizations</option>
            {Array.from(new Set(organizations.map(o => o.name)))
              .filter(name => name && name !== 'x')
              .map(orgName => (
                <option key={orgName} value={orgName}>{orgName}</option>
              ))
            }
          </select>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            className="text-xs border border-gray-200 bg-white rounded-lg px-3 py-2 outline-none text-gray-700 focus:border-blue-400 cursor-pointer"
          >
            <option value="all">All Groups</option>
            <option value="none">No Group</option>
            {(() => {
              const myLicense = licenses.find(l => l.assignedUserEmail === userEmail);
              const myOrgId = myLicense?.assignedOrgId;
              const filteredGroups = myOrgId ? groups.filter(g => g.orgId === myOrgId) : groups;
              return filteredGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ));
            })()}
          </select>
          {(['all', 'online', 'offline', 'warning'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors capitalize ${
                statusFilter === f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
          <div className="flex border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
              title="Grid view"
            >
              <Grid3X3 size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
              title="List view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.map(screen => {
            const info = getStatusColors(screen.status);
            const isHovered = hoveredScreen === screen.id;
            const shadowStyle = isHovered ? { 
              boxShadow: `0 12px 30px -8px ${info.glowColor}, 0 8px 16px -8px ${info.glowColor}`,
              borderColor: info.borderColor,
              transform: 'translateY(-4px)'
            } : {};
            return (
              <div 
                key={screen.id} 
                className="bg-white rounded-3xl border border-slate-150 transition-all duration-300 group flex flex-col justify-between hover:border-slate-200 relative"
                style={shadowStyle}
                onMouseEnter={() => setHoveredScreen(screen.id)}
                onMouseLeave={() => { if (openMenu !== screen.id) setHoveredScreen(null); }}
              >
                {isSelectionMode && (
                  <div 
                    className="absolute inset-0 bg-slate-900/[0.02] hover:bg-slate-900/[0.05] z-40 rounded-3xl cursor-pointer flex items-start p-3"
                    onClick={() => toggleSelect(screen.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(screen.id)}
                      onChange={() => {}}
                      className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-550 cursor-pointer shadow-sm"
                    />
                  </div>
                )}

                {/* Status badge */}
                {!isSelectionMode && (
                  <div className="absolute top-3 left-3 z-30">
                    {renderStatusBadge(screen.status)}
                  </div>
                )}

                {/* 3-dot menu removed */}

                {/* Visual Preview */}
                <div className="relative h-44 overflow-hidden flex items-center justify-center p-4 bg-slate-900 border-b border-slate-800 rounded-t-3xl">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:1rem_1rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 z-0" />
                  <div className="flex flex-col items-center justify-center h-full w-full relative z-10 pt-2">
                    <div className="w-[85%] aspect-[16/10] rounded-xl border-2 flex flex-col justify-between relative shadow-2xl transition-all duration-300 overflow-hidden bg-slate-950 border-slate-800 group-hover:border-slate-700/80">
                      {screen.thumbnail ? (
                        <div className="absolute inset-0 bg-cover bg-center z-0 transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: `url(${screen.thumbnail})` }} />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 z-0" />
                      )}
                      <div className="absolute inset-0 bg-slate-950/40 z-10 group-hover:bg-slate-950/20 transition-colors duration-300" />
                      <div className="relative z-20 p-1.5 flex justify-between items-center opacity-70">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500/80" />
                          <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500/80" />
                        </div>
                        <div className="w-12 h-1 rounded-full bg-white/20" />
                      </div>
                      <div className="relative z-20 flex flex-col items-center justify-center flex-1">
                        {!screen.thumbnail && (
                          <Monitor size={24} className="text-white/60 transition-transform duration-300 group-hover:scale-110" />
                        )}
                        {screen.playlist !== 'None' && (
                          <span className="mt-1 px-1.5 py-0.5 rounded bg-blue-600/90 text-[7px] text-white font-bold tracking-widest uppercase animate-pulse">
                            Playing
                          </span>
                        )}
                      </div>
                      <div className="relative z-20 bg-slate-950/90 border-t border-white/5 py-1.5 px-2 flex justify-between items-center text-[8px] text-white/50">
                        <span className="font-semibold tracking-wider font-mono text-[7px] uppercase bg-white/10 px-1 rounded-xs">
                          {screen.licenseType || 'PRO'}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[7px] uppercase font-mono text-white/40">{screen.status}</span>
                          <span className={`h-1.5 w-1.5 rounded-full shadow-xs ${
                            screen.status === 'active' || screen.status === 'online'
                              ? 'bg-emerald-500 shadow-emerald-500/50 animate-pulse'
                              : screen.status === 'offline'
                              ? 'bg-rose-500 shadow-rose-500/50'
                              : screen.status === 'pairing'
                              ? 'bg-amber-500 shadow-amber-500/50'
                              : 'bg-slate-500'
                          }`} />
                        </div>
                      </div>
                    </div>
                    <div className="w-3 h-2 bg-gradient-to-b from-slate-700 to-slate-800 border-x border-slate-800" />
                    <div className="w-14 h-1 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-t border-t border-x border-slate-800 shadow-sm" />
                  </div>
                </div>

                {/* Details Section */}
                <div className="p-4 space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 truncate leading-snug group-hover:text-blue-600 transition-colors duration-200">
                      {screen.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{screen.location}</span>
                    </div>
                  </div>

                  {/* Storage Progress Bar */}
                  {(() => {
                    const storageInfo = getScreenStorageInfo(screen);
                    return (
                      <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex justify-between text-[9.5px] font-bold text-slate-450 uppercase tracking-wide">
                          <span>Signage Storage</span>
                          <span>{storageInfo.friendlySize} / {storageInfo.limitGb} GB</span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              storageInfo.percentage > 85 ? 'bg-rose-500' : storageInfo.percentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${storageInfo.percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })()}



                  {/* Group / Playlist Section */}
                  {screen.groupId ? (() => {
                    const gp = groups.find(g => g.id === screen.groupId);
                    const c = gp ? (groupColorMap[gp.color] ?? groupColorMap.blue) : groupColorMap.blue;
                    return (
                      <div className={`p-2.5 rounded-xl border ${c.bg} ${c.border} ${c.text} text-[10.5px] space-y-1 relative group/group-badge`}>
                        <div className="font-bold flex items-center gap-1">
                          <span className={`w-2 h-2 rounded-full ${c.iconBg}`} />
                          Group: {gp?.name}
                        </div>
                        <div className="opacity-90 font-medium">Inherited Playlist: <span className="underline font-bold">{gp?.playlist || 'Normal'}</span></div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveScreenFromGroup(screen);
                          }}
                          className="absolute top-2 right-2 px-1.5 py-0.5 text-[9px] bg-red-100 hover:bg-red-200 text-red-750 border border-red-200 rounded cursor-pointer font-bold opacity-0 group-hover/group-badge:opacity-100 transition-opacity flex items-center gap-0.5"
                          title="Remove from group"
                        >
                          Remove Group
                        </button>
                      </div>
                    );
                  })() : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Active Loop Playlist</label>
                      <div className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
                        {screen.playlist || 'Normal'}
                      </div>
                      {screen.schedulePlaylist && (
                        <div className="mt-1.5 flex items-center gap-1.5 text-[9.5px] text-amber-700 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 font-bold">
                          <Clock size={10} className="text-amber-500" />
                          <span className="truncate">Next Scheduled: {screen.schedulePlaylist} ({screen.scheduleDate})</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons Row — always visible */}
                  <div className="flex flex-wrap items-center gap-1 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setEditScreen({ ...screen })}
                      className="p-1 text-blue-600 bg-blue-550/10 hover:bg-blue-550/20 border border-blue-200/50 rounded-lg transition-colors cursor-pointer"
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
                      onClick={() => setReconnectScreen(screen)}
                      className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-colors cursor-pointer"
                      title="Reconnect Screen"
                    >
                      <Link size={13} />
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
                      onClick={() => handleStopPlayback(screen)}
                      className={`p-1 rounded-lg transition-colors cursor-pointer border ${
                        screen.groupId
                          ? 'text-gray-400 bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
                          : 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-100'
                      }`}
                      title="Stop Playback"
                      disabled={!!screen.groupId}
                    >
                      <Pause size={13} />
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
                      onClick={() => handleDisconnectDevice(screen)}
                      className="p-1 text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg transition-colors cursor-pointer"
                      title="Disconnect Device"
                    >
                      <WifiOff size={13} />
                    </button>
                    <button
                      onClick={() => setDeleteScreen(screen)}
                      className="p-1 text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors cursor-pointer"
                      title="Remove Screen"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Footer: Organization & Version */}
                  <div className="flex items-center justify-between text-[10px] font-semibold text-slate-400">
                    <span className="truncate max-w-[140px]">{getScreenOrgName(screen)}</span>
                    {screen.playerVersion && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[9px]">
                        v{screen.playerVersion}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-550 cursor-pointer"
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
                      {renderStatusBadge(screen.status)}
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
                          className="p-1 text-blue-600 bg-blue-550/10 hover:bg-blue-550/20 border border-blue-200/50 rounded-lg transition-colors cursor-pointer"
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
                          onClick={() => setReconnectScreen(screen)}
                          className="p-1 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg transition-colors cursor-pointer"
                          title="Reconnect Screen"
                        >
                          <Link size={13} />
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
                          onClick={() => handleStopPlayback(screen)}
                          className={`p-1 rounded-lg transition-colors cursor-pointer border ${
                            screen.groupId
                              ? 'text-gray-400 bg-gray-50 border-gray-100 cursor-not-allowed opacity-50'
                              : 'text-orange-600 bg-orange-50 hover:bg-orange-100 border-orange-100'
                          }`}
                          title="Stop Playback"
                          disabled={!!screen.groupId}
                        >
                          <Pause size={13} />
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
                          onClick={() => handleDisconnectDevice(screen)}
                          className="p-1 text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-100 rounded-lg transition-colors cursor-pointer"
                          title="Disconnect Device"
                        >
                          <WifiOff size={13} />
                        </button>
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
                <select
                  value={editScreen.groupId ?? ''}
                  onChange={e => setEditScreen(p => p && ({ ...p, groupId: e.target.value || null }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">None (Ungrouped)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

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
                      className="w-full mt-1.5 py-2 text-xs font-semibold text-red-650 bg-red-50 hover:bg-red-100 border border-red-200/60 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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
                        className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-550 accent-blue-600 cursor-pointer"
                      />
                    </div>
                    {editScreen.schedulePlaylist !== undefined && (
                      <div className="space-y-3 p-3 bg-gray-50 border border-gray-100 rounded-xl">
                        <div>
                          <label className="block text-[10px] font-medium text-gray-500 mb-1">Target Playlist</label>
                          <select
                            value={editScreen.schedulePlaylist}
                            onChange={e => setEditScreen(p => p && ({ ...p, schedulePlaylist: e.target.value }))}
                            className="w-full px-2.5 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-blue-400 bg-white"
                          >
                            {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                          </select>
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
      )}      {/* Reconnect Screen Modal */}
      {reconnectScreen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setReconnectScreen(null); setReconnectPairingCode(''); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6 text-left space-y-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2 text-emerald-600">
                <RefreshCw size={22} />
              </div>
              <div className="text-center">
                <h2 className="text-base font-bold text-gray-900 mb-1">Reconnect Screen</h2>
                <p className="text-xs text-gray-500">Enter the 6-character pairing code from the TV player screen to link it to "{reconnectScreen.name}".</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-500 uppercase tracking-widest font-black text-center">Pairing Code</label>
                <input
                  type="text"
                  value={reconnectPairingCode}
                  onChange={e => setReconnectPairingCode(e.target.value.toUpperCase())}
                  placeholder="e.g. ABCDEF"
                  maxLength={6}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl outline-none focus:border-blue-550 font-mono font-bold text-center text-lg uppercase text-slate-850"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setReconnectScreen(null); setReconnectPairingCode(''); }} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">Cancel</button>
                <button onClick={handleReconnectSave} className="flex-1 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer">Reconnect</button>
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
                        <select
                          value={scheduleScreen.schedulePlaylist || ''}
                          onChange={e => setScheduleScreen(p => p && ({ ...p, schedulePlaylist: e.target.value }))}
                          className="w-full px-3 py-2 border border-indigo-200 rounded-xl text-sm outline-none focus:border-indigo-400 bg-white font-medium"
                        >
                          {userPlaylists.length === 0 && <option value="">No playlists available</option>}
                          {userPlaylists.map(pl => <option key={pl.id} value={pl.name}>{pl.name}</option>)}
                        </select>
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
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
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
