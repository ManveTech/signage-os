import React, { useState, useEffect } from 'react';
import {
  Monitor, AlertTriangle, Film, List, Key, Clock, Upload, Edit, Plus, ChevronRight,
  CheckCircle2, WifiOff, HardDrive
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

function daysLeft(dateStr?: string): number {
  if (!dateStr) return 0;
  const diffDays = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

type Attention = {
  id: string;
  tone: 'bad' | 'warn';
  icon: React.ReactNode;
  title: string;
  detail: string;
  target: string;
};

/**
 * Admin home. Built around the two questions an admin opens the app to answer
 * — "is the network healthy?" and "does anything need me?" — instead of the
 * previous wall of eight equal-weight number tiles, which filled a phone's
 * whole first screen before showing anything actionable.
 */
export default function Dashboard({
  userEmail = 'admin@demo.com',
  onNavigate = () => {}
}: { userEmail?: string; onNavigate?: (view: string) => void } = {}) {
  const [, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllAttention, setShowAllAttention] = useState(false);

  useEffect(() => {
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('users', 'signageos_users'),
      syncCollection('organizations', 'signageos_organizations'),
    ]).finally(() => {
      setLoading(false);
      setRefreshTick(t => t + 1);
    });
  }, []);

  const licenses = licensingStore.getLicenses();
  const screens = mediaStore.getScreens();
  const media = mediaStore.getMedia();
  const playlists = mediaStore.getPlaylists();

  const totalScreens = screens.length;
  const myScreens = screens.filter(s => s.assignedToUserEmail === userEmail).length;
  const onlineScreens = screens.filter(s => s.status === 'online' || s.status === 'active').length;
  const offlineScreens = screens.filter(s => s.status === 'offline').length;
  const pairingScreens = screens.filter(s => s.status === 'pairing').length;
  const expiring = licenses.filter(l => l.status === 'active' && daysLeft(l.expiryDate) < 15);
  const onlinePct = totalScreens > 0 ? Math.round((onlineScreens / totalScreens) * 100) : 0;

  const attention: Attention[] = [
    ...screens
      .filter(s => s.status === 'offline')
      .map(s => ({
        id: `off-${s.id}`,
        tone: 'bad' as const,
        icon: <WifiOff size={14} />,
        title: `${s.name} is offline`,
        detail: [s.location, s.lastHeartbeat ? `last seen ${timeAgo(s.lastHeartbeat) || s.lastHeartbeat}` : ''].filter(Boolean).join(' · '),
        target: 'screens-all'
      })),
    ...screens
      .filter(s => s.status === 'warning')
      .map(s => ({
        id: `warn-${s.id}`,
        tone: 'warn' as const,
        icon: <HardDrive size={14} />,
        title: `${s.name} is low on storage`,
        detail: `${s.storageUsed}% used${s.location ? ` · ${s.location}` : ''}`,
        target: 'screens-all'
      })),
    ...expiring.map(l => {
      const d = daysLeft(l.expiryDate);
      return {
        id: `lic-${l.id}`,
        tone: (d <= 3 ? 'bad' : 'warn') as 'bad' | 'warn',
        icon: <Clock size={14} />,
        title: d === 0 ? `License expired · ${l.assignedOrgName || l.assignedUserEmail || l.id}` : `License expires in ${d} day${d === 1 ? '' : 's'}`,
        detail: `${l.assignedOrgName || l.assignedUserEmail || 'Unassigned'} · ${l.expiryDate}`,
        target: 'licenses-expirations'
      };
    })
  ];
  const visibleAttention = showAllAttention ? attention : attention.slice(0, 3);

  const recentActivity = [
    ...media.map(m => ({ id: `media-${m.id}`, type: 'media' as const, text: m.title, sub: 'Media uploaded', time: m.createdDate, ts: new Date(m.createdDate || 0).getTime() })),
    ...playlists.map(p => ({ id: `playlist-${p.id}`, type: 'playlist' as const, text: p.name, sub: 'Playlist created', time: p.createdDate, ts: new Date(p.createdDate || 0).getTime() })),
  ]
    .filter(a => Number.isFinite(a.ts) && a.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  const overview = [
    { label: 'Media files', value: media.length, icon: <Film size={15} />, target: 'media-library' },
    { label: 'Playlists', value: playlists.length, icon: <List size={15} />, target: 'playlists-all' },
    { label: 'Licenses', value: licenses.length, icon: <Key size={15} />, target: 'licenses-management' },
    { label: 'My screens', value: myScreens, icon: <Monitor size={15} />, target: 'my-screens-list' },
  ];

  const quickActions = [
    { label: 'Add screen', icon: <Plus size={16} />, target: 'screens-add-client' },
    { label: 'Upload media', icon: <Upload size={16} />, target: 'media-library' },
    { label: 'New playlist', icon: <Edit size={16} />, target: 'playlists-create' },
  ];

  const healthTone = totalScreens === 0 ? 'idle' : offlineScreens === 0 ? 'good' : offlineScreens / totalScreens > 0.25 ? 'bad' : 'warn';

  const healthCard = (
    <button
      type="button"
      onClick={() => onNavigate('screens-all')}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <Monitor size={14} /> Screens
        </div>
        <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-600">
          View all <ChevronRight size={14} />
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-ink-950 tracking-tight">{loading && totalScreens === 0 ? '—' : onlineScreens}</span>
        <span className="text-sm text-gray-500">of {totalScreens} online</span>
      </div>

      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden flex">
        <div
          className={`h-full transition-all duration-500 ${healthTone === 'bad' ? 'bg-rose-500' : healthTone === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${onlinePct}%` }}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />{onlineScreens} online</span>
        <span className={`flex items-center gap-1.5 ${offlineScreens > 0 ? 'text-rose-600 font-semibold' : 'text-gray-600'}`}><span className="w-2 h-2 rounded-full bg-rose-500" />{offlineScreens} offline</span>
        {pairingScreens > 0 && (
          <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full bg-gray-300" />{pairingScreens} waiting to pair</span>
        )}
      </div>
    </button>
  );

  const quickActionsSection = (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">Quick actions</h2>
      <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
        {quickActions.map(a => (
          <button
            key={a.label}
            type="button"
            onClick={() => onNavigate(a.target)}
            className="flex flex-col lg:flex-row items-center gap-1.5 lg:gap-3 bg-white border border-gray-100 rounded-2xl px-2 py-3 lg:px-4 hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">{a.icon}</span>
            <span className="text-xs lg:text-sm font-semibold text-gray-800 text-center">{a.label}</span>
          </button>
        ))}
      </div>
    </section>
  );

  const attentionSection = attention.length > 0 ? (
    <section className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-ink-950">Needs attention</h2>
        <span className="text-xs font-semibold bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">{attention.length}</span>
      </div>
      <ul className="divide-y divide-gray-50">
        {visibleAttention.map(item => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.target)}
              className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-gray-50 transition-colors"
            >
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.tone === 'bad' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                {item.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-gray-900 truncate">{item.title}</span>
                {item.detail && <span className="block text-xs text-gray-500 truncate mt-0.5">{item.detail}</span>}
              </span>
              <ChevronRight size={16} className="text-gray-300 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      {attention.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAllAttention(v => !v)}
          className="w-full py-2.5 text-xs font-semibold text-blue-600 border-t border-gray-50 hover:bg-gray-50"
        >
          {showAllAttention ? 'Show less' : `Show all ${attention.length}`}
        </button>
      )}
    </section>
  ) : !loading ? (
    <div className="flex items-center gap-2.5 bg-emerald-50/60 border border-emerald-100 text-emerald-700 rounded-2xl px-4 py-3 text-sm font-medium">
      <CheckCircle2 size={16} /> Everything's running — nothing needs your attention.
    </div>
  ) : null;

  const overviewSection = (
    <section data-tour="kpi-cards" className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <h2 className="text-sm font-semibold text-ink-950 px-4 sm:px-5 pt-4 pb-1">Overview</h2>
      <ul className="divide-y divide-gray-50">
        {overview.map(o => (
          <li key={o.label}>
            <button
              type="button"
              onClick={() => onNavigate(o.target)}
              className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-400">{o.icon}</span>
              <span className="flex-1 text-left text-sm text-gray-700">{o.label}</span>
              <span className="text-sm font-semibold text-ink-950">{o.value}</span>
              <ChevronRight size={15} className="text-gray-300" />
            </button>
          </li>
        ))}
        {expiring.length > 0 && (
          <li>
            <button
              type="button"
              onClick={() => onNavigate('licenses-expirations')}
              className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-amber-500"><AlertTriangle size={15} /></span>
              <span className="flex-1 text-left text-sm text-amber-700">Expiring soon</span>
              <span className="text-sm font-semibold text-amber-700">{expiring.length}</span>
              <ChevronRight size={15} className="text-gray-300" />
            </button>
          </li>
        )}
      </ul>
    </section>
  );

  const activitySection = (
    <section className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-ink-950 mb-3">Recent activity</h2>
      {recentActivity.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">New media and playlists will show up here.</p>
      ) : (
        <ul className="space-y-3">
          {recentActivity.map(item => (
            <li key={item.id} className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.type === 'media' ? 'bg-teal-50 text-teal-600' : 'bg-blue-50 text-blue-600'}`}>
                {item.type === 'media' ? <Upload size={14} /> : <List size={14} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-gray-800 truncate">{item.text}</span>
                <span className="block text-xs text-gray-400">{item.sub}</span>
              </span>
              <span className="text-xs text-gray-400 shrink-0">{timeAgo(item.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-5">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your network at a glance</p>
      </div>

      {/* One grid, explicitly placed: phones stack it in priority order
          (health, quick actions, alerts, overview, activity); desktop puts
          the actions and overview in a side column. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-2 lg:row-start-1">{healthCard}</div>
        <div className="lg:col-start-3 lg:row-start-1">{quickActionsSection}</div>
        {attentionSection && <div className="lg:col-span-2 lg:row-start-2">{attentionSection}</div>}
        <div className="lg:col-start-3 lg:row-start-2 lg:row-span-2">{overviewSection}</div>
        <div className="lg:col-span-2 lg:row-start-3">{activitySection}</div>
      </div>
    </div>
  );
}
