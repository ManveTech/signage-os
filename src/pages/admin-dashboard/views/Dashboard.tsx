import React, { useState, useEffect } from 'react';
import { Monitor, Wifi, WifiOff, AlertTriangle, Film, List, Key, Clock, Upload, Edit, UserCheck, RefreshCw, HardDrive, Cpu } from 'lucide-react';
import { licensingStore } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { activityFeed } from '../data/mockData';
import { syncCollection } from '../../../lib/syncHelper';

const colorMap: Record<string, { bg: string; text: string; light: string }> = {
  blue: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-600', light: 'bg-emerald-50' },
  red: { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-50' },
  yellow: { bg: 'bg-yellow-500', text: 'text-yellow-600', light: 'bg-yellow-50' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-700', light: 'bg-teal-50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-50' },
};

const activityIconMap: Record<string, React.ReactNode> = {
  screen: <Monitor size={14} />,
  media: <Upload size={14} />,
  playlist: <Edit size={14} />,
  license: <Key size={14} />,
  user: <UserCheck size={14} />,
  alert: <AlertTriangle size={14} />,
};

const activityColorMap: Record<string, string> = {
  screen: 'bg-blue-100 text-blue-600',
  media: 'bg-teal-100 text-teal-600',
  playlist: 'bg-yellow-100 text-yellow-600',
  license: 'bg-purple-100 text-purple-600',
  user: 'bg-emerald-100 text-emerald-600',
  alert: 'bg-red-100 text-red-600',
};

export default function Dashboard() {
  const [, setRefreshTick] = useState(0);

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
  const myScreens = screens.filter(s => s.assignedToUserEmail === 'admin@demo.com').length;
  const onlineScreens = screens.filter(s => s.status === 'online').length;
  const offlineScreens = screens.filter(s => s.status === 'offline').length;
  const totalMedia = media.length;
  const activePlaylists = playlists.length;
  const totalLicenses = licenses.length;
  const expiringLicenses = licenses.filter(l => calculateDaysLeft(l.expiryDate) < 15 && l.status === 'active').length;

  const kpiCards = [
    { label: 'Total Screens', value: totalScreens.toString(), icon: <Monitor size={20} />, color: 'blue' },
    { label: 'My Screens', value: myScreens.toString(), icon: <Monitor size={20} />, color: 'teal' },
    { label: 'Online', value: onlineScreens.toString(), icon: <Wifi size={20} />, color: 'green' },
    { label: 'Offline', value: offlineScreens.toString(), icon: <WifiOff size={20} />, color: 'red' },
    { label: 'Total Media', value: totalMedia.toString(), icon: <Film size={20} />, color: 'blue' },
    { label: 'Active Playlists', value: activePlaylists.toString(), icon: <List size={20} />, color: 'teal' },
    { label: 'Total Licenses', value: totalLicenses.toString(), icon: <Key size={20} />, color: 'blue' },
    { label: 'Expiring Licenses', value: expiringLicenses.toString(), icon: <Clock size={20} />, color: 'orange' },
  ];

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

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — here's your network at a glance</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        {kpiCards.map(card => {
          const c = colorMap[card.color] || colorMap.blue;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow">
              <div className="mb-3">
                <div className={`w-9 h-9 rounded-lg ${c.light} ${c.text} flex items-center justify-center`}>
                  {card.icon}
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Activity Feed</h2>
            <button className="text-xs text-blue-600 hover:underline font-medium">View all</button>
          </div>
          <div className="space-y-3">
            {activityFeed.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                No recent activity logged.
              </div>
            ) : (
              activityFeed.map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColorMap[item.type]}`}>
                    {activityIconMap[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700 leading-relaxed">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Alerts</h2>
            <span className="text-xs bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">{alerts.length}</span>
          </div>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-emerald-600 font-semibold">
                All systems active. No critical alerts.
              </div>
            ) : (
              alerts.map((alert, i) => (
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
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
