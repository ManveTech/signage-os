import React, { useState, useEffect } from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, Film, List, Key, Clock, Upload, Edit } from 'lucide-react';
import { licensingStore } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { syncCollection } from '../../../lib/syncHelper';

// Accent color per KPI — deliberately neutral (gray) by default. Color is
// reserved for the cards where it's actually a signal (Online is good news,
// Offline/Expiring are bad news), not decoration on every tile.
const accentMap: Record<string, string> = {
  neutral: 'text-gray-400',
  good: 'text-emerald-600',
  bad: 'text-rose-600',
  warn: 'text-amber-600',
};

const activityIconMap: Record<string, React.ReactNode> = {
  media: <Upload size={13} />,
  playlist: <Edit size={13} />,
};

const activityColorMap: Record<string, string> = {
  media: 'bg-teal-50 text-teal-600',
  playlist: 'bg-blue-50 text-blue-600',
};

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard({ userEmail = 'admin@demo.com' }: { userEmail?: string } = {}) {
  const [, setRefreshTick] = useState(0);
  const [alertsPage, setAlertsPage] = useState<number>(1);

  // Sync all collections from server on mount
  useEffect(() => {
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('users', 'signageos_users'),
      syncCollection('organizations', 'signageos_organizations'),
    ]).then(() => setRefreshTick(t => t + 1));
  }, []);

  const licenses = licensingStore.getLicenses();
  const screens = mediaStore.getScreens();
  const media = mediaStore.getMedia();
  const playlists = mediaStore.getPlaylists();

  const calculateDaysLeft = (dateStr?: string) => {
    if (!dateStr) return 0;
    const diffTime = new Date(dateStr).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const totalScreens = screens.length;
  const myScreens = screens.filter(s => s.assignedToUserEmail === userEmail).length;
  const onlineScreens = screens.filter(s => s.status === 'online' || s.status === 'active').length;
  const offlineScreens = screens.filter(s => s.status === 'offline').length;
  const totalMedia = media.length;
  const activePlaylists = playlists.length;
  const totalLicenses = licenses.length;
  const expiringLicenses = licenses.filter(l => calculateDaysLeft(l.expiryDate) < 15 && l.status === 'active').length;

  const kpiCards: { label: string; value: string; icon: React.ReactNode; accent: keyof typeof accentMap }[] = [
    { label: 'Total Screens', value: totalScreens.toString(), icon: <Monitor size={15} />, accent: 'neutral' },
    { label: 'My Screens', value: myScreens.toString(), icon: <Monitor size={15} />, accent: 'neutral' },
    { label: 'Online', value: onlineScreens.toString(), icon: <Wifi size={15} />, accent: onlineScreens > 0 ? 'good' : 'neutral' },
    { label: 'Offline', value: offlineScreens.toString(), icon: <WifiOff size={15} />, accent: offlineScreens > 0 ? 'bad' : 'neutral' },
    { label: 'Total Media', value: totalMedia.toString(), icon: <Film size={15} />, accent: 'neutral' },
    { label: 'Active Playlists', value: activePlaylists.toString(), icon: <List size={15} />, accent: 'neutral' },
    { label: 'Total Licenses', value: totalLicenses.toString(), icon: <Key size={15} />, accent: 'neutral' },
    { label: 'Expiring Licenses', value: expiringLicenses.toString(), icon: <Clock size={15} />, accent: expiringLicenses > 0 ? 'warn' : 'neutral' },
  ];

  // Recent Activity is built from real creation timestamps on media and
  // playlists (both already loaded for the KPI cards above) — the panel
  // used to read from a hardcoded, permanently-empty mock array, so it
  // never actually showed anything.
  const recentActivity = [
    ...media.map(m => ({ id: `media-${m.id}`, type: 'media' as const, text: `"${m.title}" added to the media library`, time: m.createdDate, ts: new Date(m.createdDate || 0).getTime() })),
    ...playlists.map(p => ({ id: `playlist-${p.id}`, type: 'playlist' as const, text: `Playlist "${p.name}" created`, time: p.createdDate, ts: new Date(p.createdDate || 0).getTime() })),
  ]
    .filter(a => Number.isFinite(a.ts) && a.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const alerts: { type: 'error' | 'warning' | 'info'; title: string; desc: string; time: string }[] = [];

  screens.forEach(s => {
    if (s.status === 'offline') {
      alerts.push({
        type: 'error',
        title: `Screen "${s.name}" is offline`,
        desc: `Location: ${s.location} · Last seen ${s.lastHeartbeat}`,
        time: s.lastHeartbeat
      });
    } else if (s.status === 'warning') {
      alerts.push({
        type: 'warning',
        title: `Screen "${s.name}" storage warning`,
        desc: `Location: ${s.location} · Storage space is ${s.storageUsed}% full`,
        time: s.lastHeartbeat
      });
    }
  });

  licenses.forEach(l => {
    const days = calculateDaysLeft(l.expiryDate);
    if (days < 15 && l.status === 'active') {
      alerts.push({
        type: 'warning',
        title: `License "${l.id}" expiring soon`,
        desc: `Assigned to ${l.assignedOrgName || l.assignedUserEmail || 'Unassigned'} — Expires ${l.expiryDate} (${days} days left)`,
        time: '1d'
      });
    }
  });

  const alertsPerPage = 5;
  const totalAlertPages = Math.ceil(alerts.length / alertsPerPage);
  const activeAlertPage = Math.min(alertsPage, totalAlertPages || 1);
  const paginatedAlerts = alerts.slice((activeAlertPage - 1) * alertsPerPage, activeAlertPage * alertsPerPage);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-semibold text-ink-950 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — here's your network at a glance</p>
      </div>

      {/* KPI Cards — a plain number and label, with color reserved for the
          two tiles where it's actually a signal (Online/Offline/Expiring),
          not scattered across every tile for decoration. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-4">
        {kpiCards.map(card => (
          <div
            key={card.label}
            className="bg-white rounded-2xl border border-gray-100 p-4 transition-colors hover:border-gray-200"
          >
            <div className={`flex items-center gap-1.5 mb-2.5 ${accentMap[card.accent]}`}>
              {card.icon}
            </div>
            <p className="text-2xl font-semibold text-ink-950 tracking-tight">{card.value}</p>
            <p className="text-[11px] text-gray-500 mt-1 font-medium truncate">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-950">Recent Activity</h2>
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Nothing added yet — new media and playlists will show up here.
              </div>
            ) : (
              recentActivity.map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColorMap[item.type]}`}>
                    {activityIconMap[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(item.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-ink-950">Alerts</h2>
            <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">{alerts.length}</span>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-600 font-semibold">
                All systems active. No critical alerts.
              </div>
            ) : (
              <>
                {paginatedAlerts.map((alert, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    alert.type === 'error' ? 'bg-red-50 border-red-100' :
                    alert.type === 'warning' ? 'bg-yellow-50 border-yellow-100' :
                    'bg-blue-50 border-blue-100'
                  }`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={13} className={`mt-0.5 flex-shrink-0 ${
                          alert.type === 'error' ? 'text-red-500' :
                          alert.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <p className="text-xs font-medium text-gray-900">{alert.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{alert.desc}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">{alert.time}</span>
                    </div>
                  </div>
                ))}
                {totalAlertPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400 font-semibold">
                      Page {activeAlertPage} of {totalAlertPages}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        disabled={activeAlertPage === 1}
                        onClick={() => setAlertsPage(activeAlertPage - 1)}
                        className="px-2 py-1 border border-gray-200 rounded text-[10px] font-bold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                      >
                        Prev
                      </button>
                      <button
                        disabled={activeAlertPage === totalAlertPages}
                        onClick={() => setAlertsPage(activeAlertPage + 1)}
                        className="px-2 py-1 border border-gray-200 rounded text-[10px] font-bold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
