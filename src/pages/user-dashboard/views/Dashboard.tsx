import React, { useState, useEffect } from 'react';
import {
  Monitor, AlertTriangle, Film, List, Key,
  Upload, Edit, UserCheck, HardDrive, Cpu
} from 'lucide-react';
import { licensingStore } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { syncCollection } from '../../../lib/syncHelper';

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

export default function Dashboard({ userEmail = 'priya@demo.com' }: { userEmail?: string }) {
  const [, setRefreshTick] = useState(0);

  // Sync all relevant collections from server on mount
  useEffect(() => {
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('invoices', 'signageos_invoices'),
    ]).then(() => setRefreshTick(t => t + 1));
  }, [userEmail]);

  // 1. Fetch live data for this specific user
  const licenses = licensingStore.getLicenses();
  const userLicense = licenses.find(l => l.assignedUserEmail === userEmail);
  
  const allScreens = mediaStore.getScreens();
  const myScreens = allScreens.filter(s => s.assignedToUserEmail === userEmail);
  
  const allPlaylists = mediaStore.getPlaylists();
  const myPlaylists = allPlaylists.filter(p => p.createdBy === userEmail);
  
  const allMedia = mediaStore.getMedia();
  const myMedia = allMedia.filter(m => m.uploadedBy === userEmail);
  
  const allInvoices = licensingStore.getInvoices();
  const myInvoices = allInvoices.filter(i => i.clientEmail === userEmail);
  const unpaidInvoices = myInvoices.filter(i => i.status === 'unpaid');
  
  // Find the earliest unpaid invoice for payment countdown
  const unpaidInvoice = unpaidInvoices.length > 0 
    ? [...unpaidInvoices].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
    : null;

  // 2. Calculations
  const calculateDaysLeft = (dateStr?: string) => {
    if (!dateStr) return 0;
    const diffTime = new Date(dateStr).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const daysUntilExpiry = userLicense ? calculateDaysLeft(userLicense.expiryDate) : 0;
  const daysUntilPayment = unpaidInvoice ? calculateDaysLeft(unpaidInvoice.dueDate) : null;

  const onlineScreens = myScreens.filter(s => s.status === 'online' || s.status === 'active').length;
  const offlineScreens = myScreens.filter(s => s.status === 'offline').length;
  const warningScreens = myScreens.filter(s => s.status === 'warning').length;

  const deviceLimit = userLicense ? userLicense.deviceLimit : 0;
  const slotsRemaining = Math.max(0, deviceLimit - myScreens.length);

  // Advanced details calculations
  const activePlaylistNames = Array.from(new Set(myScreens.map(s => s.playlist).filter(p => p && p !== 'None' && p !== 'Normal')));
  const playlistSummary = activePlaylistNames.length > 0 ? activePlaylistNames.join(', ') : 'None';

  const totalStorageUsedBytes = mediaStore.getClientStorageUsedBytes(userEmail);
  const storageLimitGb = userLicense ? userLicense.storageLimit : 5;
  const storageUsedMb = (totalStorageUsedBytes / (1024 * 1024)).toFixed(1);
  const storageUsedPercent = Math.min(100, (totalStorageUsedBytes / (storageLimitGb * 1024 * 1024 * 1024)) * 100);

  const uptimeText = myScreens.length > 0 
    ? `${((myScreens.filter(s => s.status === 'online' || s.status === 'active').length / myScreens.length) * 100).toFixed(0)}% Uptime` 
    : 'No Screens';

  // 3. Dynamic Alerts
  const myAlerts: { type: 'error' | 'warning' | 'info'; title: string; desc: string; time: string }[] = [];
  
  myScreens.forEach(s => {
    if (s.status === 'offline') {
      myAlerts.push({
        type: 'error',
        title: `Screen "${s.name}" is offline`,
        desc: `Location: ${s.location} · Last seen ${s.lastHeartbeat}`,
        time: s.lastHeartbeat
      });
    } else if (s.status === 'warning') {
      myAlerts.push({
        type: 'warning',
        title: `Screen "${s.name}" storage warning`,
        desc: `Location: ${s.location} · Storage space is ${s.storageUsed}% full`,
        time: s.lastHeartbeat
      });
    }
  });

  if (userLicense && daysUntilExpiry < 15) {
    myAlerts.push({
      type: 'warning',
      title: `License expiring soon`,
      desc: `Your profile ${userLicense.id} expires on ${userLicense.expiryDate} (${daysUntilExpiry} days left)`,
      time: '1d'
    });
  }

  if (unpaidInvoice) {
    const isOverdue = daysUntilPayment !== null && daysUntilPayment <= 0;
    myAlerts.push({
      type: isOverdue ? 'error' : 'warning',
      title: isOverdue ? `Payment Overdue` : `Pending Subscription Payment`,
      desc: `Invoice ${unpaidInvoice.id} (₹${unpaidInvoice.amount.toLocaleString()}) is due on ${unpaidInvoice.dueDate} (${isOverdue ? 'Overdue' : `${daysUntilPayment} days left`})`,
      time: 'Just now'
    });
  }

  // 4. Recent Activity — built from real creation timestamps on this user's
  // own media and playlists, rather than the fabricated "5 min ago" /
  // "20 min ago" placeholder events this previously showed regardless of
  // whether anything had actually happened.
  const myActivityFeed = [
    ...myMedia.map(m => ({ id: `media-${m.id}`, text: `"${m.title}" added to your media library`, time: m.createdDate, ts: new Date(m.createdDate || 0).getTime(), type: 'media' as const })),
    ...myPlaylists.map(p => ({ id: `playlist-${p.id}`, text: `Playlist "${p.name}" created`, time: p.createdDate, ts: new Date(p.createdDate || 0).getTime(), type: 'playlist' as const })),
  ]
    .filter(a => Number.isFinite(a.ts) && a.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 8);

  const activityIconMap: Record<string, React.ReactNode> = {
    screen: <Monitor size={14} />,
    media: <Upload size={14} />,
    playlist: <Edit size={14} />,
    user: <UserCheck size={14} />,
  };

  const activityColorMap: Record<string, string> = {
    screen: 'bg-blue-50 text-blue-600',
    media: 'bg-emerald-50 text-emerald-600',
    playlist: 'bg-amber-50 text-amber-600',
    user: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 text-left">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-ink-950 tracking-tight">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Welcome back — manage your screens and licenses at a glance</p>
      </div>

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Screen Network & Playbacks */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 flex flex-col justify-between transition-colors hover:border-slate-300">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <Monitor size={20} />
            </div>
            <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {onlineScreens} / {myScreens.length} Online
            </span>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
            <h3 className="text-2xl font-bold text-slate-800">
              {myScreens.length} <span className="text-xs text-slate-400 font-semibold">of {deviceLimit} slots</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Status: <span className="font-semibold text-green-600">{uptimeText}</span>
            </p>
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Active Campaign Loops</p>
              <p className="text-xs text-slate-700 font-semibold truncate mt-0.5" title={playlistSummary}>
                {playlistSummary}
              </p>
            </div>
          </div>
        </div>

        {/* License Profile */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 flex flex-col justify-between transition-colors hover:border-slate-300">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Key size={20} />
            </div>
            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {userLicense?.name || 'PRO'}
            </span>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
            <h3 className="text-lg font-bold text-slate-800 truncate" title={userLicense?.id}>
              {userLicense?.id || 'NO LICENSE'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Slots: {deviceLimit} · Storage: {storageLimitGb} GB
            </p>
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Expires In</p>
              <p className="text-xs text-blue-600 font-semibold mt-0.5">
                {daysUntilExpiry} days left ({userLicense?.expiryDate})
              </p>
            </div>
          </div>
        </div>

        {/* Storage Vault Stats */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 flex flex-col justify-between transition-colors hover:border-slate-300">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <HardDrive size={20} />
            </div>
            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {storageUsedPercent.toFixed(1)}% Capacity
            </span>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
            <h3 className="text-2xl font-bold text-slate-800">
              {storageUsedMb} <span className="text-xs text-slate-400 font-semibold">MB of {storageLimitGb} GB</span>
            </h3>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100 mt-1">
              <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${storageUsedPercent}%` }} />
            </div>
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Asset Pool</p>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                {myMedia.length} Media Files Uploaded
              </p>
            </div>
          </div>
        </div>

        {/* Diagnostics & Warnings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-5 flex flex-col justify-between transition-colors hover:border-slate-300">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <Cpu size={20} />
            </div>
            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              {myAlerts.length} Alerts
            </span>
          </div>
          <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
            <h3 className="text-2xl font-bold text-slate-800">
              {offlineScreens} <span className="text-xs text-slate-400 font-semibold">offline</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Diagnostics check: {warningScreens} warning(s)
            </p>
            <div className="pt-2 border-t border-slate-100 mt-2">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Payment Status</p>
              <p className="text-xs text-slate-700 font-semibold mt-0.5">
                {unpaidInvoice ? `Overdue: ₹${unpaidInvoice.amount.toLocaleString()}` : 'No Pending Dues'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Media and Playlist Summary */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Film size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">Media</p>
              <p className="text-[10px] text-slate-400 truncate hidden sm:block">Total uploaded image/video files</p>
            </div>
          </div>
          <span className="text-lg font-bold text-slate-700 self-end sm:self-auto">{myMedia.length}</span>
        </div>

        <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
              <List size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800">Loops</p>
              <p className="text-[10px] text-slate-400 truncate hidden sm:block">Total play sequences built</p>
            </div>
          </div>
          <span className="text-lg font-bold text-slate-700 self-end sm:self-auto">{myPlaylists.length}</span>
        </div>
      </div>

      {/* Warnings Alerts Panel and Activity Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">Recent Activity</h2>
          </div>
          <div className="space-y-3.5">
            {myActivityFeed.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Nothing added yet — new media and playlists will show up here.
              </div>
            ) : (
              myActivityFeed.map(item => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${activityColorMap[item.type]}`}>
                    {activityIconMap[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed">{item.text}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{timeAgo(item.time)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts & Critical Warnings */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-3.5 sm:space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-800">Alerts & Notifications</h2>
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              myAlerts.length > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-400'
            }`}>
              {myAlerts.length} Active
            </span>
          </div>

          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {myAlerts.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center justify-center">
                <UserCheck size={28} className="text-emerald-400 mb-1.5" />
                <p className="text-xs font-bold text-slate-700">All systems operational</p>
                <p className="text-[9.5px] text-slate-400 mt-0.5">No warnings or billing action items reported.</p>
              </div>
            ) : (
              myAlerts.map((alert, i) => (
                <div key={i} className={`p-3 rounded-xl border ${
                  alert.type === 'error' ? 'bg-rose-50/50 border-rose-100' : 'bg-amber-50/50 border-amber-100'
                }`}>
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={15} className={`mt-0.5 flex-shrink-0 ${
                      alert.type === 'error' ? 'text-rose-500' : 'text-amber-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800">{alert.title}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5 leading-relaxed">{alert.desc}</p>
                    </div>
                    <span className="text-[9px] text-slate-400 font-semibold">{alert.time}</span>
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
