import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertTriangle, Terminal, FileText, Trash2, Search, Eraser, ChevronRight, Monitor } from 'lucide-react';
import { API_BASE } from '../../config';
import { getAuthToken } from '../../lib/authStorage';
import { mediaStore } from '../../lib/mediaStore';
import { syncCollection } from '../../lib/syncHelper';
import { toast } from '../Toast';
import CustomSelect from '../CustomSelect';
import ScreenDetailsSheet from '../screens/ScreenDetailsSheet';
import ConfirmDialog from '../screens/ConfirmDialog';

interface ScreenLog {
  id: string;
  screenId: string;
  screenName: string;
  assignedToUserEmail: string;
  event: string;
  type: string;
  detail: string;
  totalUptime?: number;
  loopsPlayed?: number;
  groupName?: string;
  created: string;
}

const TYPE_STYLE: Record<string, { icon: React.ReactNode; dot: string; label: string }> = {
  online: { icon: <Wifi size={14} />, dot: 'bg-emerald-50 text-emerald-600', label: 'Online' },
  offline: { icon: <WifiOff size={14} />, dot: 'bg-rose-50 text-rose-600', label: 'Offline' },
  sync: { icon: <RefreshCw size={14} />, dot: 'bg-blue-50 text-blue-600', label: 'Sync' },
  clear_cache: { icon: <Eraser size={14} />, dot: 'bg-purple-50 text-purple-600', label: 'Cache' },
  error: { icon: <AlertTriangle size={14} />, dot: 'bg-amber-50 text-amber-600', label: 'Error' },
  other: { icon: <Terminal size={14} />, dot: 'bg-slate-100 text-slate-500', label: 'Other' }
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'sync', label: 'Sync' },
  { key: 'error', label: 'Errors' },
  { key: 'clear_cache', label: 'Cache' }
];

const PAGE_SIZE = 50;

function headers(targetEmail: string) {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'X-Assigned-To-User-Email': targetEmail
  };
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const today = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: diff < 7 ? 'long' : undefined, day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatDuration(totalSeconds?: number): string {
  if (totalSeconds === undefined || totalSeconds === null) return '—';
  if (totalSeconds <= 0) return '0s';
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds / 3600) % 24);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSeconds}s`;
}

/**
 * Screen activity log shared by the admin and client dashboards: a timeline
 * grouped by day with type filters and search; tapping an entry opens its
 * full details. Loads 50 at a time and fetches more as you scroll.
 */
export default function LogsView({
  userEmail,
  mode,
  role,
  onNavigate
}: {
  userEmail: string;
  /** 'all' shows every account's logs (admin), with a filter by user. */
  mode: 'my' | 'all';
  role: 'admin' | 'user';
  onNavigate?: (view: string) => void;
}) {
  const [logs, setLogs] = useState<ScreenLog[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [openLog, setOpenLog] = useState<ScreenLog | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const targetEmail = mode === 'all' ? userFilter : userEmail;

  const fetchPage = useCallback(async (pageNumber: number) => {
    const params = new URLSearchParams({ page: String(pageNumber), perPage: String(PAGE_SIZE) });
    if (typeFilter !== 'all') params.set('type', typeFilter);
    const res = await fetch(`${API_BASE}/screen_logs?${params}`, { headers: headers(targetEmail) });
    if (!res.ok) throw new Error('Failed to fetch logs');
    const data: ScreenLog[] = await res.json();
    return data;
  }, [typeFilter, targetEmail]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPage(1);
      setLogs([...data].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()));
      setPage(1);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error('Error loading screen logs:', e);
      setLogs([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const data = await fetchPage(page + 1);
      if (data.length) {
        setLogs(prev => [...prev, ...data].sort((a, b) => new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()));
        setPage(p => p + 1);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      console.error('Error loading more logs:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => { loadFirst(); }, [loadFirst]);
  useEffect(() => { syncCollection('screens', 'signageos_screens'); }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading) return;
    const io = new IntersectionObserver(entries => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  const clearLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/screen_logs`, { method: 'DELETE', headers: headers(targetEmail) });
      if (!res.ok) throw new Error('Failed to clear logs');
      toast.success('Logs cleared');
      setConfirmClear(false);
      loadFirst();
    } catch (e: any) {
      toast.error(e.message || "Couldn't clear logs");
    }
  };

  const userOptions = (() => {
    if (mode !== 'all') return [];
    const users = JSON.parse(localStorage.getItem('signageos_users') || '[]').map((u: any) => u.email);
    const fromLogs = logs.map(l => l.assignedToUserEmail);
    return Array.from(new Set([...users, ...fromLogs].filter(Boolean))).sort();
  })();

  const q = search.trim().toLowerCase();
  const visible = q
    ? logs.filter(l => (l.screenName || '').toLowerCase().includes(q) || (l.event || '').toLowerCase().includes(q) || (l.detail || '').toLowerCase().includes(q))
    : logs;

  // Group consecutive entries by day for the timeline.
  const sections: { label: string; items: ScreenLog[] }[] = [];
  for (const log of visible) {
    const label = dayLabel(log.created);
    const last = sections[sections.length - 1];
    if (last && last.label === label) last.items.push(log);
    else sections.push({ label, items: [log] });
  }

  const screens = mediaStore.getScreens();

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Screens coming online, going offline, syncing and errors</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadFirst}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setConfirmClear(true)}
            disabled={logs.length === 0}
            className="h-10 px-3 rounded-xl border border-slate-200 bg-white flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Trash2 size={15} /> <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search screen or event"
              className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
          </div>
          {mode === 'all' && (
            <div className="sm:w-56 shrink-0">
              <CustomSelect
                value={userFilter}
                onChange={setUserFilter}
                options={[{ value: 'all', label: 'All users' }, ...userOptions.map(e => ({ value: e, label: e }))]}
                buttonClassName="text-xs h-11 px-3"
              />
            </div>
          )}
        </div>

        <div data-tour="logs-filters" className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 no-scrollbar">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              aria-pressed={typeFilter === f.key}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                typeFilter === f.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && logs.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-400">
          <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-slate-300" /> Loading activity…
        </div>
      ) : visible.length === 0 ? (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <FileText size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">{q || typeFilter !== 'all' ? 'Nothing matches these filters' : 'No activity yet'}</p>
          <p className="text-xs text-slate-500 mt-1">Events appear here as your screens connect, sync and play.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(section => (
            <section key={section.label}>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 px-1">{section.label}</h2>
              <ul className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {section.items.map(log => {
                  const t = TYPE_STYLE[log.type] ?? TYPE_STYLE.other;
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        onClick={() => setOpenLog(log)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                      >
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.dot}`}>{t.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-slate-900 truncate">{log.event}</span>
                          <span className="block text-xs text-slate-500 truncate mt-0.5">
                            {log.screenName || 'System'}
                            {mode === 'all' && log.assignedToUserEmail ? ` · ${log.assignedToUserEmail}` : ''}
                          </span>
                        </span>
                        <span className="text-xs text-slate-400 shrink-0">{timeOf(log.created)}</span>
                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
              {loadingMore ? 'Loading more…' : ' '}
            </div>
          )}
        </div>
      )}

      {openLog && (() => {
        const t = TYPE_STYLE[openLog.type] ?? TYPE_STYLE.other;
        const screen = screens.find(s => s.id === openLog.screenId);
        const created = new Date(openLog.created);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenLog(null)}
            title={openLog.event}
            subtitle={Number.isNaN(created.getTime()) ? undefined : created.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            badge={<span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${t.dot}`}>{t.label}</span>}
            hero={openLog.detail ? (
              <p className="text-sm text-slate-700 bg-slate-50 rounded-2xl px-4 py-3 whitespace-pre-wrap break-words">{openLog.detail}</p>
            ) : undefined}
            details={[
              { label: 'Screen', value: openLog.screenName || 'System' },
              ...(openLog.groupName ? [{ label: 'Group', value: openLog.groupName }] : []),
              ...(openLog.totalUptime !== undefined && openLog.totalUptime !== null ? [{ label: 'Total uptime then', value: formatDuration(openLog.totalUptime) }] : []),
              ...(openLog.loopsPlayed !== undefined && openLog.loopsPlayed !== null ? [{ label: 'Loops played then', value: String(openLog.loopsPlayed) }] : []),
              ...(mode === 'all' && openLog.assignedToUserEmail ? [{ label: 'Owner', value: openLog.assignedToUserEmail }] : []),
            ]}
            groups={screen && onNavigate ? [{
              title: 'Screen',
              actions: [{
                key: 'open',
                label: `Go to ${screen.name}`,
                description: 'Open the screen list to check or act on it',
                icon: <Monitor size={17} />,
                onClick: () => onNavigate(role === 'admin' ? (screen.assignedToUserEmail === userEmail ? 'my-screens-list' : 'screens-all') : 'my-screens-list')
              }]
            }] : []}
          />
        );
      })()}

      {confirmClear && (
        <ConfirmDialog
          title="Clear all activity?"
          body={<p>{mode === 'all' && userFilter === 'all' ? 'This deletes the activity log for every account.' : 'This deletes the activity log shown here.'} It can't be undone.</p>}
          confirmLabel="Clear activity"
          tone="danger"
          onCancel={() => setConfirmClear(false)}
          onConfirm={clearLogs}
        />
      )}
    </div>
  );
}
