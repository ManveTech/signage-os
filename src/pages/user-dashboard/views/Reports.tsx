import { useEffect, useState } from 'react';
import { Monitor, Film, Wifi, HardDrive, Wifi as WifiIcon, WifiOff, RefreshCw, AlertTriangle, Terminal } from 'lucide-react';
import { syncCollection } from '../../../lib/syncHelper';
import { mediaStore } from '../../../lib/mediaStore';

const tabs = ['Overview', 'Screen Reports', 'Media Reports', 'Device Logs'] as const;
type Tab = typeof tabs[number];

interface ScreenLog {
  id: string;
  screenName: string;
  assignedToUserEmail?: string;
  event: string;
  type: string;
  detail: string;
  created: string;
}

const typeConfig: Record<string, { icon: React.ReactNode; cls: string }> = {
  online: { icon: <WifiIcon size={13} />, cls: 'bg-emerald-100 text-emerald-600 border border-emerald-200' },
  offline: { icon: <WifiOff size={13} />, cls: 'bg-red-100 text-red-600 border border-red-200' },
  sync: { icon: <RefreshCw size={13} />, cls: 'bg-blue-100 text-blue-600 border border-blue-200' },
  clear_cache: { icon: <AlertTriangle size={13} />, cls: 'bg-purple-100 text-purple-600 border border-purple-200' },
  error: { icon: <AlertTriangle size={13} />, cls: 'bg-orange-100 text-orange-600 border border-orange-200' },
  other: { icon: <Terminal size={13} />, cls: 'bg-slate-100 text-slate-600 border border-slate-200' }
};

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const seconds = totalSeconds % 60;
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getScreenTotalUptimeSeconds(screen: any): number {
  let totalSeconds = screen.cumulativeUptime || 0;
  const isOnline = screen.status === 'online' || screen.status === 'active';
  if (isOnline && screen.onlineSince) {
    const sessionSeconds = Math.floor((Date.now() - new Date(screen.onlineSince).getTime()) / 1000);
    if (sessionSeconds > 0) totalSeconds += sessionSeconds;
  }
  return totalSeconds;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0 || isNaN(diffMs)) return 'Unknown';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Bar({ val, max, color }: { val: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max > 0 ? Math.min(100, (val / max) * 100) : 0}%` }} />
      </div>
      <span className="text-xs text-gray-600 w-16 text-right">{val.toLocaleString()}</span>
    </div>
  );
}

export default function Reports({ activeTab: initTab = 'Overview', userEmail = '' }: { activeTab?: Tab; userEmail?: string }) {
  const [tab, setTab] = useState<Tab>(initTab);
  const [, setRefreshTick] = useState(0);
  const [logs, setLogs] = useState<ScreenLog[]>([]);

  useEffect(() => {
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
    ]).then(() => setRefreshTick(t => t + 1));

    syncCollection('screen_logs', 'signageos_logs').then((serverLogs: any) => {
      if (Array.isArray(serverLogs)) {
        const mine = serverLogs.filter((l: ScreenLog) => l.assignedToUserEmail === userEmail);
        setLogs(mine.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()).slice(0, 20));
      }
    });
  }, [tab, userEmail]);

  const screens = mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail);
  const media = mediaStore.getMedia().filter(m => m.uploadedBy === userEmail);

  const totalScreens = screens.length;
  const onlineScreens = screens.filter(s => s.status === 'online' || s.status === 'active').length;
  const onlinePct = totalScreens > 0 ? Math.round((onlineScreens / totalScreens) * 100) : 0;
  const totalMedia = media.length;
  const totalStorageBytes = media.reduce((sum, m) => sum + (m.fileSizeBytes || 0), 0);

  const mediaByType = ['video', 'image', 'layout', 'ticker'].map(type => ({
    type,
    count: media.filter(m => m.type === type).length
  })).filter(t => t.count > 0);
  const maxMediaTypeCount = Math.max(1, ...mediaByType.map(t => t.count));

  const topScreensByUptime = [...screens]
    .map(s => ({ ...s, uptimeSeconds: getScreenTotalUptimeSeconds(s) }))
    .sort((a, b) => b.uptimeSeconds - a.uptimeSeconds)
    .slice(0, 5);
  const maxUptimeSeconds = Math.max(1, ...topScreensByUptime.map(s => s.uptimeSeconds));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Live analytics computed from your own screens and media</p>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto max-w-full">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
            tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && (
        <div className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Your Screens', value: totalScreens.toString(), icon: <Monitor size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Screens Online', value: `${onlineScreens} (${onlinePct}%)`, icon: <Wifi size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Your Media Items', value: totalMedia.toString(), icon: <Film size={18} />, color: 'text-teal-600', bg: 'bg-teal-50' },
              { label: 'Storage Used', value: formatBytes(totalStorageBytes), icon: <HardDrive size={18} />, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center mb-3`}>{kpi.icon}</div>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{kpi.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Media by Type</h2>
              {mediaByType.length === 0 ? (
                <p className="text-xs text-gray-400">No media uploaded yet.</p>
              ) : (
                <div className="space-y-3">
                  {mediaByType.map(t => (
                    <div key={t.type}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1 capitalize"><span>{t.type}</span></div>
                      <Bar val={t.count} max={maxMediaTypeCount} color="bg-blue-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Your Top Screens by Uptime</h2>
              {topScreensByUptime.length === 0 ? (
                <p className="text-xs text-gray-400">No screens registered yet.</p>
              ) : (
                <div className="space-y-3">
                  {topScreensByUptime.map(s => (
                    <div key={s.id}>
                      <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{s.name}</span><span>{formatDuration(s.uptimeSeconds)}</span></div>
                      <Bar val={s.uptimeSeconds} max={maxUptimeSeconds} color="bg-teal-500" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'Screen Reports' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {screens.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No screens registered yet.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Screen', 'Status', 'Uptime', 'Loops Played', 'Storage Used', 'Last Heartbeat'].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {screens.map((s: any) => {
                      const isOnline = s.status === 'online' || s.status === 'active';
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{s.status}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{formatDuration(getScreenTotalUptimeSeconds(s))}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{(s.cumulativeLoops || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{s.storageUsed || 0}%</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{timeAgo(s.lastHeartbeat)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden divide-y divide-gray-50">
                {screens.map((s: any) => {
                  const isOnline = s.status === 'online' || s.status === 'active';
                  return (
                    <div key={s.id} className="p-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{s.status}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-x-3 text-[11px]">
                        <div>
                          <p className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Uptime</p>
                          <p className="text-gray-700 font-medium mt-0.5">{formatDuration(getScreenTotalUptimeSeconds(s))}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Loops</p>
                          <p className="text-gray-700 font-medium mt-0.5">{(s.cumulativeLoops || 0).toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Storage</p>
                          <p className="text-gray-700 font-medium mt-0.5">{s.storageUsed || 0}%</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'Media Reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5 lg:col-span-2">
            {media.length === 0 ? (
              <p className="text-xs text-gray-400">No media uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Title', 'Type', 'Size', 'Created', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {media.map(m => (
                      <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{m.title}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-600 capitalize">{m.type}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-600">{formatBytes(m.fileSizeBytes)}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-500">{m.createdDate}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : m.status === 'expired' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{m.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'Device Logs' && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">No device activity recorded yet.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {logs.map(log => {
                const cfg = typeConfig[log.type] || typeConfig.other;
                return (
                  <div key={log.id} className="p-4 flex items-start gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.cls}`}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{log.screenName || 'Unknown Screen'} — {log.event}</p>
                        <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(log.created)}</span>
                      </div>
                      {log.detail && <p className="text-xs text-gray-500 mt-0.5">{log.detail}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
