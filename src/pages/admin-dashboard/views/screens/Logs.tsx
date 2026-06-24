import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Cpu, Terminal, Clock, FileText, Filter, Trash2 } from 'lucide-react';
import { syncCollection } from '../../../../lib/syncHelper';
import { mediaStore } from '../../../../lib/mediaStore';
import { toast } from '../../../../components/Toast';

const API_BASE = 'http://localhost:5000/api/v1';

function getHeaders() {
  const token = localStorage.getItem('signageos_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

interface ScreenLog {
  id: string;
  screenId: string;
  screenName: string;
  assignedToUserEmail: string;
  event: string;
  type: string; // 'online' | 'offline' | 'sync' | 'clear_cache' | 'error' | etc.
  detail: string;
  totalUptime?: number;
  loopsPlayed?: number;
  created: string; // ISO timestamp from PocketBase
}

const typeConfig: Record<string, { icon: React.ReactNode; cls: string }> = {
  online: { icon: <Wifi size={13} />, cls: 'bg-emerald-100 text-emerald-600 border border-emerald-200' },
  offline: { icon: <WifiOff size={13} />, cls: 'bg-red-100 text-red-600 border border-red-200' },
  sync: { icon: <RefreshCw size={13} />, cls: 'bg-blue-100 text-blue-600 border border-blue-200' },
  clear_cache: { icon: <AlertTriangle size={13} />, cls: 'bg-purple-100 text-purple-600 border border-purple-200' },
  error: { icon: <AlertTriangle size={13} />, cls: 'bg-orange-100 text-orange-600 border border-orange-200' },
  other: { icon: <Terminal size={13} />, cls: 'bg-slate-100 text-slate-655 border border-slate-200' }
};

interface Props {
  userEmail?: string;
  mode?: 'my' | 'all';
}

export default function Logs({ userEmail = 'admin@demo.com', mode = 'my' }: Props) {
  const [logs, setLogs] = useState<ScreenLog[]>([]);
  const [screens, setScreens] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const showAssignedTo = mode === 'all';

  useEffect(() => {
    loadLogs();
  }, [userEmail, mode]);

  const loadLogs = () => {
    setLoading(true);
    
    // Load local screens, groups, and playlists synchronously from mediaStore cache
    setScreens(mediaStore.getScreens());
    setGroups(mediaStore.getScreenGroups());
    setPlaylists(mediaStore.getPlaylists());

    // Sync screens and playlists from server to get fresh uptime/loops
    syncCollection('screens', 'signageos_screens').then(serverScreens => {
      setScreens(serverScreens);
    }).catch(err => console.error('Failed to sync screens on logs view:', err));

    syncCollection('playlists', 'signageos_playlists').then(serverPlaylists => {
      setPlaylists(serverPlaylists);
    }).catch(err => console.error('Failed to sync playlists on logs view:', err));

    syncCollection('screen_logs', 'signageos_logs').then(serverLogs => {
      // Sort logs by creation time descending (newest first)
      const sorted = [...serverLogs].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime());
      
      if (mode === 'all') {
        // System Admin sees all logs
        setLogs(sorted);
      } else {
        // Users see only logs for screens assigned to them
        setLogs(sorted.filter((l: ScreenLog) => l.assignedToUserEmail === userEmail));
      }
      setLoading(false);
    }).catch(err => {
      console.error('Error loading screen logs:', err);
      setLoading(false);
    });
  };

  const handleClearLogs = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }

    setConfirmClear(false);
    setClearing(true);
    try {
      const emailQuery = mode === 'all' ? selectedUserFilter : userEmail;
      const res = await fetch(`${API_BASE}/screen_logs`, {
        method: 'DELETE',
        headers: {
          ...getHeaders(),
          'X-Assigned-To-User-Email': emailQuery
        }
      });

      if (!res.ok) throw new Error('Failed to clear logs');
      
      toast.success('Successfully cleared screen logs.');
      loadLogs();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Error clearing logs.');
    } finally {
      setClearing(false);
    }
  };

  const getUniqueEmails = () => {
    const storedUsers = localStorage.getItem('signageos_users');
    const allUsersList = storedUsers ? JSON.parse(storedUsers) : [];
    const fromUsers = allUsersList.map((u: any) => u.email).filter(Boolean);
    const fromLogs = logs.map(l => l.assignedToUserEmail).filter(Boolean);
    const fromScreens = screens.map(s => s.assignedToUserEmail).filter(Boolean);
    return Array.from(new Set([...fromUsers, ...fromLogs, ...fromScreens]));
  };

  const uniqueEmails = getUniqueEmails();

  const filtered = logs.filter(l => {
    const matchType = typeFilter === 'all' || l.type === typeFilter;
    const matchEmail = selectedUserFilter === 'all' || l.assignedToUserEmail === selectedUserFilter;
    return matchType && matchEmail;
  });

  const formatLogTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const formatDuration = (totalSeconds: number) => {
    if (totalSeconds <= 0) return '0s';
    const seconds = totalSeconds % 60;
    const minutes = Math.floor((totalSeconds / 60) % 60);
    const hours = Math.floor((totalSeconds / 3600) % 24);
    const days = Math.floor(totalSeconds / 86400);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const getScreenTotalUptime = (screen: any) => {
    if (!screen) return 'N/A (Deleted)';
    let totalSeconds = screen.cumulativeUptime || 0;
    const isOnline = screen.status === 'online' || screen.status === 'active';
    if (isOnline && screen.onlineSince) {
      const sessionSeconds = Math.floor((Date.now() - new Date(screen.onlineSince).getTime()) / 1000);
      if (sessionSeconds > 0) {
        totalSeconds += sessionSeconds;
      }
    }
    return formatDuration(totalSeconds) + (isOnline ? '' : ' (Offline)');
  };

  const calculateLoops = (screen: any, groupsList: any[], playlistsList: any[]) => {
    if (!screen) return 'N/A';
    const baseLoops = screen.cumulativeLoops || 0;
    if (!screen.onlineSince || (screen.status !== 'online' && screen.status !== 'active')) return baseLoops;
    const seconds = Math.floor((Date.now() - new Date(screen.onlineSince).getTime()) / 1000);
    if (seconds < 0) return baseLoops;

    let playlistName = 'Normal';
    if (screen.groupId) {
      const gp = groupsList.find(g => g.id === screen.groupId);
      if (gp) {
        playlistName = gp.playlist || 'Normal';
      }
    } else {
      playlistName = screen.playlist || 'Normal';
    }

    let playlist = playlistsList.find(p => p.name === playlistName && p.createdBy === screen.assignedToUserEmail);
    if (!playlist && screen.playlistId) {
      playlist = playlistsList.find(p => p.id === screen.playlistId);
    }
    if (!playlist) {
      playlist = playlistsList.find(p => p.name === playlistName);
    }

    if (!playlist || !playlist.slides || playlist.slides.length === 0) return baseLoops;
    const playlistLength = playlist.slides.reduce((acc: number, slide: any) => acc + (slide.duration || 10), 0);
    if (playlistLength <= 0) return baseLoops;

    return baseLoops + Math.floor(seconds / playlistLength);
  };

  const totalColumns = showAssignedTo ? 7 : 6;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-950">System Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time TV screen heartbeat events, pairing, and sync logs</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={clearing}
            onClick={handleClearLogs}
            className={`flex items-center gap-2 px-3.5 py-2 border rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer ${
              confirmClear 
                ? 'border-red-300 bg-red-50 hover:bg-red-100 text-red-700 animate-pulse' 
                : 'border-slate-200 hover:border-slate-350 bg-white text-slate-700'
            }`}
          >
            <Trash2 size={13} className={clearing ? 'animate-spin' : ''} />
            {clearing ? 'Clearing...' : confirmClear ? 'Confirm Clear?' : 'Clear Logs'}
          </button>
          <button 
            onClick={loadLogs} 
            className="flex items-center gap-2 px-3.5 py-2 border border-slate-200 hover:border-slate-350 bg-white rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer animate-fadeIn"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Logs
          </button>
        </div>
      </div>

      {/* Log Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {['all', 'online', 'offline', 'sync', 'clear_cache', 'error'].map(f => (
              <button 
                key={f} 
                onClick={() => setTypeFilter(f)} 
                className={`px-3 py-2 text-xs font-bold rounded-xl capitalize transition-colors cursor-pointer ${
                  typeFilter === f ? 'bg-blue-600 text-white shadow' : 'bg-slate-50 text-slate-655 hover:bg-slate-100 border border-slate-200/50'
                }`}
              >
                {f === 'clear_cache' ? 'Clear Cache' : f}
              </button>
            ))}
          </div>

          {showAssignedTo && (
            <div className="flex gap-2 items-center w-full md:w-auto shrink-0">
              <Filter size={13} className="text-gray-400" />
              <select 
                value={selectedUserFilter} 
                onChange={e => setSelectedUserFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-xl outline-none bg-white font-bold text-slate-700 min-w-[200px]"
              >
                <option value="all">All Users</option>
                {uniqueEmails.map(email => (
                  <option key={email} value={email}>{email}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-slate-455 uppercase font-black tracking-wider text-[10px]">
                <th className="text-left px-5 py-3.5">Event</th>
                <th className="text-left px-5 py-3.5">Screen Name</th>
                <th className="text-left px-5 py-3.5">Log Details</th>
                <th className="text-left px-5 py-3.5">Screen Uptime</th>
                <th className="text-left px-5 py-3.5">Loops Played</th>
                {showAssignedTo && <th className="text-left px-5 py-3.5">Assigned To</th>}
                <th className="text-left px-5 py-3.5">Event Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={totalColumns} className="px-5 py-12 text-center text-slate-400 font-medium">
                    <RefreshCw size={24} className="animate-spin mx-auto text-slate-300 mb-2" />
                    Fetching latest system records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={totalColumns} className="px-5 py-12 text-center text-slate-455 font-bold">
                    <FileText size={24} className="mx-auto text-slate-250 mb-2" />
                    No system logs available matching this filter
                  </td>
                </tr>
              ) : (
                filtered.map(log => {
                  const tc = typeConfig[log.type] ?? typeConfig.other;
                  const screen = screens.find(s => s.id === log.screenId);
                  const isScreenActive = screen && (screen.status === 'online' || screen.status === 'active');
                  const uptimeStr = log.totalUptime !== undefined && log.totalUptime !== null
                    ? formatDuration(log.totalUptime)
                    : getScreenTotalUptime(screen);
                  const loopsPlayed = log.loopsPlayed !== undefined && log.loopsPlayed !== null
                    ? log.loopsPlayed
                    : calculateLoops(screen, groups, playlists);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center ${tc.cls}`}>{tc.icon}</span>
                          <span className="font-extrabold text-slate-800">{log.event}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-bold text-slate-700">{log.screenName || 'N/A'}</td>
                      <td className="px-5 py-3.5 font-mono text-[10px] text-slate-500 max-w-xs truncate" title={log.detail}>{log.detail}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-700">{uptimeStr}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-bold px-1.5 py-0.5 rounded-md font-mono text-[10px] ${isScreenActive ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                          {loopsPlayed}
                        </span>
                      </td>
                      {showAssignedTo && <td className="px-5 py-3.5 font-bold text-slate-600">{log.assignedToUserEmail}</td>}
                      <td className="px-5 py-3.5 text-slate-400 font-semibold flex items-center gap-1.5">
                        <Clock size={11} />
                        {formatLogTime(log.created)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
