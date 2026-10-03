import React, { useState, useEffect } from 'react';
import {
  Monitor, Upload, Edit, Plus, ChevronRight, CheckCircle2, WifiOff, HardDrive,
  Clock, CreditCard, List, Key
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

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const gb = bytes / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${Math.max(0.1, bytes / (1024 ** 2)).toFixed(1)} MB`;
}

function Meter({ label, used, total, display }: { label: string; used: number; total: number; display: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const tone = pct >= 100 ? 'bg-rose-500' : pct >= 85 ? 'bg-amber-500' : 'bg-blue-600';
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-900">{display}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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
 * Client home: screen health, what needs attention, and plan usage — in that
 * order. Replaces six dense tiles that showed raw values ("NaN% capacity",
 * "0.0 MB of GB", ISO timestamps, the license's internal id).
 */
export default function Dashboard({
  userEmail = 'priya@demo.com',
  onNavigate = () => {}
}: { userEmail?: string; onNavigate?: (view: string) => void }) {
  const [, setRefreshTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAllAttention, setShowAllAttention] = useState(false);

  useEffect(() => {
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('playlists', 'signageos_playlists'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('invoices', 'signageos_invoices'),
    ]).finally(() => {
      setLoading(false);
      setRefreshTick(t => t + 1);
    });
  }, [userEmail]);

  const userLicense = licensingStore.getLicenses().find(l => l.assignedUserEmail === userEmail);
  const ownedScreens = mediaStore.getScreens().filter(s => s.assignedToUserEmail === userEmail);
  // Unlinked screens have no TV attached — keep them out of the online/offline health numbers.
  const myScreens = ownedScreens.filter(s => s.status !== 'unlinked');
  const notLinked = ownedScreens.length - myScreens.length;
  const myPlaylists = mediaStore.getPlaylists().filter(p => p.createdBy === userEmail);
  const myMedia = mediaStore.getMedia().filter(m => m.uploadedBy === userEmail);
  const unpaidInvoice = licensingStore.getInvoices()
    .filter(i => i.clientEmail === userEmail && i.status === 'unpaid')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

  const onlineScreens = myScreens.filter(s => s.status === 'online' || s.status === 'active').length;
  const offlineScreens = myScreens.filter(s => s.status === 'offline').length;
  const pairingScreens = myScreens.filter(s => s.status === 'pairing').length;
  const onlinePct = myScreens.length > 0 ? Math.round((onlineScreens / myScreens.length) * 100) : 0;
  const healthTone = myScreens.length === 0 ? 'idle' : offlineScreens === 0 ? 'good' : offlineScreens / myScreens.length > 0.25 ? 'bad' : 'warn';

  const deviceLimit = Number(userLicense?.deviceLimit) || 0;
  const storageLimitGb = Number(userLicense?.storageLimit) || 0;
  const storageUsedBytes = mediaStore.getClientStorageUsedBytes(userEmail) || 0;
  const expiryDays = userLicense ? daysLeft(userLicense.expiryDate) : 0;

  const attention: Attention[] = [
    ...myScreens.filter(s => s.status === 'offline').map(s => ({
      id: `off-${s.id}`,
      tone: 'bad' as const,
      icon: <WifiOff size={14} />,
      title: `${s.name} is offline`,
      detail: [s.location, s.lastHeartbeat ? `last seen ${timeAgo(s.lastHeartbeat) || formatDate(s.lastHeartbeat)}` : ''].filter(Boolean).join(' · '),
      target: 'my-screens-list'
    })),
    ...myScreens.filter(s => s.status === 'warning').map(s => ({
      id: `warn-${s.id}`,
      tone: 'warn' as const,
      icon: <HardDrive size={14} />,
      title: `${s.name} is low on storage`,
      detail: `${s.storageUsed}% used${s.location ? ` · ${s.location}` : ''}`,
      target: 'my-screens-list'
    })),
    ...(userLicense && expiryDays < 15 ? [{
      id: 'license',
      tone: (expiryDays <= 3 ? 'bad' : 'warn') as 'bad' | 'warn',
      icon: <Clock size={14} />,
      title: expiryDays === 0 ? 'Your plan has expired' : `Your plan expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'}`,
      detail: `Renew by ${formatDate(userLicense.expiryDate)} to keep your screens running`,
      target: 'license-billing'
    }] : []),
    ...(unpaidInvoice ? [{
      id: 'invoice',
      tone: (daysLeft(unpaidInvoice.dueDate) === 0 ? 'bad' : 'warn') as 'bad' | 'warn',
      icon: <CreditCard size={14} />,
      title: daysLeft(unpaidInvoice.dueDate) === 0 ? 'Payment overdue' : 'Payment due',
      detail: `₹${Number(unpaidInvoice.amount || 0).toLocaleString()} · due ${formatDate(unpaidInvoice.dueDate)}`,
      target: 'license-billing'
    }] : [])
  ];
  const visibleAttention = showAllAttention ? attention : attention.slice(0, 3);

  const recentActivity = [
    ...myMedia.map(m => ({ id: `media-${m.id}`, type: 'media' as const, text: m.title, sub: 'Media uploaded', time: m.createdDate, ts: new Date(m.createdDate || 0).getTime() })),
    ...myPlaylists.map(p => ({ id: `playlist-${p.id}`, type: 'playlist' as const, text: p.name, sub: 'Playlist created', time: p.createdDate, ts: new Date(p.createdDate || 0).getTime() })),
  ]
    .filter(a => Number.isFinite(a.ts) && a.ts > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  const quickActions = [
    { label: 'Add screen', icon: <Plus size={16} />, target: 'screens-add' },
    { label: 'Upload media', icon: <Upload size={16} />, target: 'media-library' },
    { label: 'New playlist', icon: <Edit size={16} />, target: 'playlists-create' },
  ];

  const healthCard = (
    <button
      type="button"
      data-tour="kpi-cards"
      onClick={() => onNavigate('my-screens-list')}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <Monitor size={14} /> Your screens
        </div>
        <span className="flex items-center gap-0.5 text-xs font-semibold text-blue-600">
          View all <ChevronRight size={14} />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold text-ink-950 tracking-tight">{loading && myScreens.length === 0 ? '—' : onlineScreens}</span>
        <span className="text-sm text-gray-500">of {myScreens.length} online</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
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
        {notLinked > 0 && (
          <span className="flex items-center gap-1.5 text-gray-600"><span className="w-2 h-2 rounded-full bg-slate-300" />{notLinked} not linked</span>
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

  const planSection = (
    <button
      type="button"
      onClick={() => onNavigate('license-billing')}
      className="w-full text-left bg-white rounded-2xl border border-gray-100 p-4 sm:p-5 hover:border-gray-200 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
          <Key size={14} /> Your plan
        </div>
        <ChevronRight size={15} className="text-gray-300" />
      </div>
      {userLicense ? (
        <>
          <p className="mt-2 text-base font-semibold text-ink-950">{userLicense.name || 'Subscription'}</p>
          <p className={`text-xs mt-0.5 ${expiryDays < 15 ? 'text-amber-700 font-semibold' : 'text-gray-500'}`}>
            {expiryDays === 0 ? 'Expired' : `Renews ${formatDate(userLicense.expiryDate)}`}
            {expiryDays > 0 && ` · ${expiryDays} day${expiryDays === 1 ? '' : 's'} left`}
          </p>
          <div className="mt-4 space-y-3">
            <Meter
              label="Screens"
              used={ownedScreens.length}
              total={deviceLimit}
              display={deviceLimit > 0 ? `${ownedScreens.length} of ${deviceLimit}` : `${ownedScreens.length}`}
            />
            <Meter
              label="Storage"
              used={storageUsedBytes}
              total={storageLimitGb * 1024 ** 3}
              display={storageLimitGb > 0 ? `${formatBytes(storageUsedBytes)} of ${storageLimitGb} GB` : formatBytes(storageUsedBytes)}
            />
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-500">{loading ? 'Loading…' : 'No plan assigned yet.'}</p>
      )}
    </button>
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
        <p className="text-sm text-gray-500 mt-0.5">Your screens and plan at a glance</p>
      </div>

      {/* Phones stack in priority order; desktop puts actions and plan in a side column. */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 items-start">
        <div className="lg:col-span-2 lg:row-start-1">{healthCard}</div>
        <div className="lg:col-start-3 lg:row-start-1">{quickActionsSection}</div>
        {attentionSection && <div className="lg:col-span-2 lg:row-start-2">{attentionSection}</div>}
        <div className="lg:col-start-3 lg:row-start-2 lg:row-span-2">{planSection}</div>
        <div className="lg:col-span-2 lg:row-start-3">{activitySection}</div>
      </div>
    </div>
  );
}
