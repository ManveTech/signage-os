import { useEffect, useState } from 'react';
import { Monitor, Wifi, WifiOff, Film, HardDrive, AlertTriangle, ChevronRight, Building2, Trash2, ListVideo } from 'lucide-react';
import { BarChart, Bar as RBar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { syncCollection } from '../../lib/syncHelper';
import { mediaStore } from '../../lib/mediaStore';
import { licensingStore } from '../../lib/licensingStore';
import { getEffectiveStatus } from '../../pages/admin-dashboard/views/screens/MyScreens';
import { lastSeenText } from '../screens/screenStatus';
import { licenseState, formatDate } from '../licenses/licenseStatus';

export type ReportsSection = 'overview' | 'screens' | 'media' | 'clients' | 'activity';

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const days = Math.floor(totalSeconds / 86400);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
}

function uptimeSeconds(screen: any): number {
  let total = screen.cumulativeUptime || 0;
  if ((screen.status === 'online' || screen.status === 'active') && screen.onlineSince) {
    const session = Math.floor((Date.now() - new Date(screen.onlineSince).getTime()) / 1000);
    if (session > 0) total += session;
  }
  return total;
}

const isOnline = (s: any) => {
  const eff = getEffectiveStatus(s);
  return eff === 'online' || eff === 'active';
};
// Screens still waiting to be paired (or unlinked) aren't part of the fleet
// yet — the old reports counted them, so "online %" was always understated.
const isPaired = (s: any) => s.status !== 'pairing' && s.status !== 'unlinked';

function HBar({ data, labelKey, valueKey, format = (v: number) => v.toLocaleString(), color = '#2563EB' }: {
  data: Record<string, any>[]; labelKey: string; valueKey: string; format?: (v: number) => string; color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(110, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ top: 2, right: 56, left: 0, bottom: 2 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey={labelKey} width={110} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
        <Tooltip
          cursor={{ fill: 'rgba(15,23,42,0.03)' }}
          formatter={(v: number) => [format(v), '']}
          contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E2E8F0' }}
        />
        <RBar dataKey={valueKey} fill={color} radius={[0, 4, 4, 0]} barSize={14}>
          <LabelList dataKey={valueKey} position="right" formatter={format} style={{ fontSize: 11, fontWeight: 600, fill: '#334155' }} />
        </RBar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * Reports for the admin (scope "all": every account, plus a Clients section)
 * and for a client (scope "mine": their own screens and media).
 */
export default function ReportsView({
  scope,
  userEmail,
  initialSection = 'overview',
  onNavigate,
}: {
  scope: 'all' | 'mine';
  userEmail: string;
  initialSection?: ReportsSection;
  onNavigate?: (view: string) => void;
}) {
  const [section, setSection] = useState<ReportsSection>(initialSection);
  const [, setTick] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [screenFilter, setScreenFilter] = useState<'all' | 'online' | 'offline'>('all');

  useEffect(() => { setSection(initialSection); }, [initialSection]);

  useEffect(() => {
    Promise.all([
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
      syncCollection('playlists', 'signageos_playlists'),
      ...(scope === 'all' ? [syncCollection('licenses', 'signageos_licenses'), syncCollection('users', 'signageos_users')] : []),
    ]).finally(() => setTick(t => t + 1));
    syncCollection('screen_logs', 'signageos_logs').then((rows: any) => {
      if (Array.isArray(rows)) setLogs(scope === 'mine' ? rows.filter((l: any) => l.assignedToUserEmail === userEmail) : rows);
    });
  }, [scope, userEmail]);

  const allScreens = mediaStore.getScreens().filter(isPaired);
  const screens = scope === 'mine' ? allScreens.filter(s => s.assignedToUserEmail === userEmail) : allScreens;
  const media = scope === 'mine' ? mediaStore.getMedia().filter(m => m.uploadedBy === userEmail) : mediaStore.getMedia();
  const playlists = mediaStore.getPlaylists();
  const licenses = scope === 'all' ? licensingStore.getLicenses() : [];
  const users: any[] = scope === 'all' ? JSON.parse(localStorage.getItem('signageos_users') || '[]') : [];
  const clientEmails = scope === 'all'
    ? Array.from(new Set([
        ...users.filter(u => u.role !== 'admin' && u.role !== 'super_admin').map(u => u.email),
        ...licenses.map(l => l.assignedUserEmail).filter(Boolean) as string[],
      ]))
    : [];
  const clientName = (email: string) =>
    licenses.find(l => l.assignedUserEmail === email && l.assignedOrgName)?.assignedOrgName
    || users.find(u => u.email === email)?.company || email;

  const online = screens.filter(isOnline);
  const offline = screens.filter(s => !isOnline(s));
  const onlinePct = screens.length ? Math.round((online.length / screens.length) * 100) : 0;
  const storageBytes = media.reduce((sum, m) => sum + (m.fileSizeBytes || 0), 0);

  // Offline for more than a day — the ones worth a phone call.
  const longOffline = offline
    .map(s => ({ s, since: new Date(s.lastHeartbeat || 0).getTime() }))
    .filter(x => !x.since || Date.now() - x.since > 86_400_000)
    .sort((a, b) => a.since - b.since);

  const usedMediaIds = new Set<string>();
  playlists.forEach(p => {
    (p.mediaIds || []).forEach(id => usedMediaIds.add(id));
    (p.slides || []).forEach(sl => { usedMediaIds.add(sl.mediaId); if (sl.secondMediaId) usedMediaIds.add(sl.secondMediaId); });
  });
  const unused = media.filter(m => !usedMediaIds.has(m.id));
  const unusedBytes = unused.reduce((s, m) => s + (m.fileSizeBytes || 0), 0);
  const largest = [...media].sort((a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0)).slice(0, 8);
  const byType = ['image', 'video', 'ticker', 'layout']
    .map(t => ({ type: t[0].toUpperCase() + t.slice(1) + 's', count: media.filter(m => m.type === t).length }))
    .filter(t => t.count > 0);
  const topUptime = [...screens].map(s => ({ name: s.name, uptime: uptimeSeconds(s) }))
    .filter(x => x.uptime > 0).sort((a, b) => b.uptime - a.uptime).slice(0, 6);

  // Disconnects per screen over the last 7 days, from the screens' own logs.
  const weekAgo = Date.now() - 7 * 86_400_000;
  const recentOffline = logs.filter(l => l.type === 'offline' && new Date(l.created).getTime() > weekAgo);
  const disconnectCounts: Record<string, number> = {};
  recentOffline.forEach(l => {
    const k = l.screenName || 'Unknown screen';
    disconnectCounts[k] = (disconnectCounts[k] || 0) + 1;
  });
  const disconnects = Object.entries(disconnectCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const clientRows = clientEmails.map(email => {
    const sc = allScreens.filter(s => s.assignedToUserEmail === email);
    const own = mediaStore.getMedia().filter(m => m.uploadedBy === email);
    const lics = licenses.filter(l => l.assignedUserEmail === email);
    const lic = [...lics].sort((a, b) => (b.expiryDate || '').localeCompare(a.expiryDate || ''))[0];
    const limitGb = lics.reduce((s, l) => s + (l.storageLimit || 0), 0);
    const used = own.reduce((s, m) => s + (m.fileSizeBytes || 0), 0);
    return {
      email, name: clientName(email), screens: sc.length, online: sc.filter(isOnline).length,
      storage: used, limitBytes: limitGb * 1024 ** 3, lic, state: lic ? licenseState(lic) : null,
    };
  }).sort((a, b) => b.screens - a.screens);

  const sections: { key: ReportsSection; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'screens', label: 'Screens' },
    { key: 'media', label: 'Media' },
    ...(scope === 'all' ? [{ key: 'clients' as const, label: 'Clients' }] : []),
    { key: 'activity', label: 'Activity' },
  ];
  const logsView = scope === 'all' ? 'screens-logs-all' : 'screens-logs';
  const pct = (a: number, b: number) => (b ? Math.min(100, Math.round((a / b) * 100)) : 0);

  const screenList = screens
    .filter(s => screenFilter === 'all' || (screenFilter === 'online' ? isOnline(s) : !isOnline(s)))
    .sort((a, b) => Number(isOnline(a)) - Number(isOnline(b)) || a.name.localeCompare(b.name));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">{scope === 'all' ? 'How your whole network is doing' : 'How your screens and media are doing'}</p>
      </div>

      <div className={`grid gap-1 p-1 bg-slate-100 rounded-xl md:max-w-2xl ${sections.length === 5 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        {sections.map(s => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`h-9 rounded-lg text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap ${
              section === s.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Screens online', value: `${online.length}/${screens.length}`, sub: `${onlinePct}% of the fleet`, icon: <Wifi size={15} />, tone: online.length === screens.length && screens.length ? 'text-emerald-600' : 'text-slate-400' },
              { label: 'Offline now', value: String(offline.length), sub: longOffline.length ? `${longOffline.length} for over a day` : 'none for over a day', icon: <WifiOff size={15} />, tone: offline.length ? 'text-rose-500' : 'text-slate-400' },
              { label: 'Media files', value: String(media.length), sub: unused.length ? `${unused.length} not in any playlist` : 'all in use', icon: <Film size={15} />, tone: 'text-slate-400' },
              { label: 'Storage used', value: formatBytes(storageBytes), sub: unusedBytes ? `${formatBytes(unusedBytes)} unused` : '—', icon: <HardDrive size={15} />, tone: 'text-slate-400' },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-4">
                <span className={k.tone}>{k.icon}</span>
                <p className="text-2xl font-semibold text-slate-900 mt-2 tracking-tight">{k.value}</p>
                <p className="text-xs font-medium text-slate-600 mt-0.5">{k.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">{k.sub}</p>
              </div>
            ))}
          </div>

          {screens.length > 0 && (
            <div className="h-2 rounded-full bg-rose-100 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${onlinePct}%` }} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card
              title="Offline for over a day"
              action={longOffline.length > 0 && <button onClick={() => setSection('screens')} className="text-xs font-medium text-blue-600">All screens</button>}
            >
              {longOffline.length === 0 ? (
                <p className="text-sm text-slate-500">Every screen has checked in within the last day.</p>
              ) : (
                <ul className="divide-y divide-slate-100 -my-1">
                  {longOffline.slice(0, 5).map(({ s }) => (
                    <li key={s.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900 truncate">{s.name}</span>
                        {scope === 'all' && <span className="block text-xs text-slate-500 truncate">{clientName(s.assignedToUserEmail || '')}</span>}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{lastSeenText(s.lastHeartbeat)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Most disconnects · last 7 days" action={onNavigate && <button onClick={() => onNavigate(logsView)} className="text-xs font-medium text-blue-600">Logs</button>}>
              {disconnects.length === 0 ? (
                <p className="text-sm text-slate-500">No disconnects recorded this week.</p>
              ) : (
                <HBar data={disconnects} labelKey="name" valueKey="count" color="#F43F5E" />
              )}
            </Card>

            <Card title="Media by type">
              {byType.length === 0 ? <p className="text-sm text-slate-500">No media uploaded yet.</p> : <HBar data={byType} labelKey="type" valueKey="count" />}
            </Card>

            <Card title="Longest uptime">
              {topUptime.length === 0 ? <p className="text-sm text-slate-500">No uptime recorded yet.</p> : <HBar data={topUptime} labelKey="name" valueKey="uptime" format={formatDuration} color="#14B8A6" />}
            </Card>
          </div>
        </div>
      )}

      {section === 'screens' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {([
              { key: 'all', label: 'All', count: screens.length },
              { key: 'online', label: 'Online', count: online.length },
              { key: 'offline', label: 'Offline', count: offline.length },
            ] as const).map(c => (
              <button
                key={c.key}
                onClick={() => setScreenFilter(c.key)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold ${
                  screenFilter === c.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {c.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${screenFilter === c.key ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{c.count}</span>
              </button>
            ))}
          </div>
          {screenList.length === 0 ? (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <Monitor size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-600">No screens here.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {screenList.map(s => {
                const on = isOnline(s);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${on ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{s.name}</span>
                      <span className="block text-xs text-slate-500 truncate">
                        {scope === 'all' ? `${clientName(s.assignedToUserEmail || '')} · ` : ''}{on ? 'Online' : `Last seen ${lastSeenText(s.lastHeartbeat).toLowerCase()}`}
                      </span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-semibold text-slate-800">{formatDuration(uptimeSeconds(s))}</span>
                      <span className="block text-[11px] text-slate-400">{((s as any).cumulativeLoops || 0).toLocaleString()} loops</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-slate-400 px-1">Uptime is total time online since the screen was paired; a loop is one full pass through its playlist.</p>
        </div>
      )}

      {section === 'media' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title={`Not in any playlist · ${unused.length}`} action={unused.length > 0 && onNavigate && (
            <button onClick={() => onNavigate(scope === 'all' ? 'my-media' : 'media-library')} className="text-xs font-medium text-blue-600">Media library</button>
          )}>
            {unused.length === 0 ? (
              <p className="text-sm text-slate-500">Every file is used in a playlist.</p>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-2">{formatBytes(unusedBytes)} of storage — delete what you no longer need.</p>
                <ul className="divide-y divide-slate-100">
                  {unused.slice(0, 8).map(m => (
                    <li key={m.id} className="flex items-center gap-3 py-2.5">
                      <Trash2 size={14} className="text-slate-300 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-slate-800 truncate">{m.title}</span>
                        {scope === 'all' && <span className="block text-xs text-slate-500 truncate">{clientName(m.uploadedBy)}</span>}
                      </span>
                      <span className="text-xs text-slate-500 shrink-0">{formatBytes(m.fileSizeBytes)}</span>
                    </li>
                  ))}
                </ul>
                {unused.length > 8 && <p className="text-xs text-slate-400 mt-2">+{unused.length - 8} more</p>}
              </>
            )}
          </Card>

          <Card title="Largest files">
            {largest.length === 0 ? <p className="text-sm text-slate-500">No media uploaded yet.</p> : (
              <ul className="divide-y divide-slate-100">
                {largest.map(m => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <ListVideo size={14} className="text-slate-300 shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-slate-800 truncate">{m.title}</span>
                      <span className="block text-xs text-slate-500 truncate capitalize">{m.type}{scope === 'all' ? ` · ${clientName(m.uploadedBy)}` : ''}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-700 shrink-0">{formatBytes(m.fileSizeBytes)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Media by type">
            {byType.length === 0 ? <p className="text-sm text-slate-500">No media uploaded yet.</p> : <HBar data={byType} labelKey="type" valueKey="count" />}
          </Card>

          {scope === 'all' && clientRows.length > 0 && (
            <Card title="Storage by client">
              <ul className="space-y-3">
                {clientRows.filter(r => r.storage > 0 || r.limitBytes > 0).sort((a, b) => b.storage - a.storage).slice(0, 8).map(r => (
                  <li key={r.email}>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-700 truncate">{r.name}</span>
                      <span className="text-slate-500 shrink-0">{formatBytes(r.storage)}{r.limitBytes ? ` of ${formatBytes(r.limitBytes)}` : ''}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className={`h-full rounded-full ${pct(r.storage, r.limitBytes) > 90 ? 'bg-rose-500' : pct(r.storage, r.limitBytes) > 70 ? 'bg-amber-400' : 'bg-blue-600'}`}
                        style={{ width: `${r.limitBytes ? pct(r.storage, r.limitBytes) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {section === 'clients' && scope === 'all' && (
        clientRows.length === 0 ? (
          <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <Building2 size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-600">No clients yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {clientRows.map(r => (
              <button
                key={r.email}
                type="button"
                onClick={() => onNavigate?.('users')}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900 truncate">{r.name}</span>
                    {r.state && r.state.key !== 'active' && (
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${r.state.className}`}>{r.state.label}</span>
                    )}
                    {!r.lic && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">No license</span>}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {r.online}/{r.screens} screens online · {formatBytes(r.storage)}{r.limitBytes ? ` of ${formatBytes(r.limitBytes)}` : ''}{r.lic ? ` · renews ${formatDate(r.lic.expiryDate)}` : ''}
                  </span>
                </span>
                {r.screens > 0 && r.online < r.screens && <AlertTriangle size={15} className="text-amber-500 shrink-0" />}
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </button>
            ))}
          </div>
        )
      )}

      {section === 'activity' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Disconnects', value: recentOffline.length },
              { label: 'Syncs', value: logs.filter(l => l.type === 'sync' && new Date(l.created).getTime() > weekAgo).length },
              { label: 'Errors', value: logs.filter(l => l.type === 'error' && new Date(l.created).getTime() > weekAgo).length },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-2xl border border-slate-100 p-4">
                <p className="text-2xl font-semibold text-slate-900">{k.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{k.label} · 7 days</p>
              </div>
            ))}
          </div>
          <Card title="Most disconnects · last 7 days">
            {disconnects.length === 0 ? <p className="text-sm text-slate-500">No disconnects recorded this week.</p> : <HBar data={disconnects} labelKey="name" valueKey="count" color="#F43F5E" />}
          </Card>
          {onNavigate && (
            <button onClick={() => onNavigate(logsView)} className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-100 px-4 py-3.5 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Open the full activity log <ChevronRight size={16} className="text-slate-300" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
