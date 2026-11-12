import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, ShieldAlert, FileText, ChevronDown, Globe, User as UserIcon } from 'lucide-react';
import { API_BASE } from '../../config';
import { getAuthToken } from '../../lib/authStorage';
import CustomSelect from '../CustomSelect';
import {
  AuditCategory, CATEGORY_LABELS, CATEGORY_STYLES, CATEGORY_ORDER,
  actionLabel, actorLabel, categoryOf, isNotable, fullTime, timeAgo
} from '../../lib/auditText';

/**
 * The activity log — who did what, when, from where.
 *
 * Entries come from the server's logAudit() (services/auditLog.ts) and are
 * read-only: there is no edit or delete here, and the API offers neither, so
 * nobody can tidy away the record of something they did. Entries leave only by
 * ageing out on retention — a year for sign-ins, accounts, billing and email,
 * 90 days for content edits.
 *
 * Filtering happens on the server because the log outgrows what's worth
 * sending to a phone: this loads a page at a time and asks for more as you
 * scroll, rather than pulling everything and filtering in the browser.
 */

const PAGE_SIZE = 50;

type Entry = {
  id: string;
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: string;
  ip?: string;
  created: string;
  category?: AuditCategory;
};

type Summary = {
  days: number;
  total: number;
  counts: Record<string, number>;
  actors: string[];
};

function authHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function dayLabel(iso: string): string {
  const d = new Date(String(iso).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return 'Earlier';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    weekday: diff < 7 ? 'long' : undefined,
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric'
  });
}

function timeOf(iso: string): string {
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function ActivityView() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [categories, setCategories] = useState<AuditCategory[]>([]);
  const [actor, setActor] = useState('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Typing shouldn't fire a request per keystroke — the log can be large and
  // each search is a filtered query against the whole collection.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const params = useCallback((pageNumber: number) => {
    const p = new URLSearchParams({ page: String(pageNumber), perPage: String(PAGE_SIZE) });
    if (categories.length > 0) p.set('category', categories.join(','));
    if (actor !== 'all') p.set('actor', actor);
    if (query) p.set('q', query);
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p;
  }, [categories, actor, query, from, to]);

  const fetchPage = useCallback(async (pageNumber: number) => {
    const res = await fetch(`${API_BASE}/audit-logs?${params(pageNumber)}`, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.message || 'Could not load the activity log.');
    }
    return res.json() as Promise<{ items: Entry[]; totalPages: number; page: number; totalItems: number }>;
  }, [params]);

  const loadFirst = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPage(1);
      setEntries(data.items);
      setPage(1);
      setHasMore(data.page < data.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Could not load the activity log.');
      setEntries([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const data = await fetchPage(next);
      // Guard against a duplicate when an entry is written between pages.
      setEntries(prev => {
        const seen = new Set(prev.map(e => e.id));
        return [...prev, ...data.items.filter(e => !seen.has(e.id))];
      });
      setPage(next);
      setHasMore(data.page < data.totalPages);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, hasMore, loadingMore, page]);

  useEffect(() => { loadFirst(); }, [loadFirst]);

  // The chip counts and the actor list, over the last 30 days.
  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/audit-logs/summary?days=30`, { headers: authHeaders() });
      if (res.ok) setSummary(await res.json());
    } catch { /* chips fall back to no counts */ }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(items => {
      if (items.some(i => i.isIntersecting)) loadMore();
    }, { rootMargin: '200px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const toggleCategory = (c: AuditCategory) => {
    setCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const clearFilters = () => {
    setCategories([]);
    setActor('all');
    setSearch('');
    setFrom('');
    setTo('');
  };

  const filtersActive = categories.length > 0 || actor !== 'all' || !!search || !!from || !!to;

  const sections = useMemo(() => {
    const out: { label: string; items: Entry[] }[] = [];
    for (const entry of entries) {
      const label = dayLabel(entry.created);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else out.push({ label, items: [entry] });
    }
    return out;
  }, [entries]);

  const actorOptions = useMemo(() => ([
    { value: 'all', label: 'Everyone' },
    ...(summary?.actors || []).map(a => ({ value: a, label: a }))
  ]), [summary]);

  const inputCls = 'h-11 px-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white';

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Activity</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Who signed in, what changed, and which emails went out
          </p>
        </div>
        <button
          onClick={() => { loadFirst(); loadSummary(); }}
          className="w-10 h-10 shrink-0 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search person, action or detail"
              className={`w-full pl-10 pr-4 ${inputCls}`}
            />
          </div>
          <div className="sm:w-56 shrink-0">
            <CustomSelect
              value={actor}
              onChange={setActor}
              options={actorOptions}
              buttonClassName="text-xs h-11 px-3"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 no-scrollbar">
          {CATEGORY_ORDER.map(c => {
            const on = categories.includes(c);
            const count = summary?.counts?.[c];
            return (
              <button
                key={c}
                onClick={() => toggleCategory(c)}
                aria-pressed={on}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {CATEGORY_LABELS[c]}
                {count !== undefined && count > 0 && (
                  <span className={on ? 'ml-1.5 text-blue-100' : 'ml-1.5 text-slate-400'}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Two equal columns rather than one wrapping row: at phone width a
            single row leaves the second date on its own line with the word
            "to" stranded at the end of the first. */}
        <div className="flex items-end gap-2">
          <label className="flex-1 min-w-0">
            <span className="block text-xs text-slate-500 mb-1">From</span>
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => setFrom(e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </label>
          <label className="flex-1 min-w-0">
            <span className="block text-xs text-slate-500 mb-1">To</span>
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => setTo(e.target.value)}
              className={`w-full ${inputCls}`}
            />
          </label>
          {filtersActive && (
            <button
              onClick={clearFilters}
              className="h-11 px-3 shrink-0 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="py-10 px-4 text-center bg-rose-50 border border-rose-200 rounded-2xl">
          <ShieldAlert size={24} className="mx-auto text-rose-400 mb-2" />
          <p className="text-sm font-medium text-rose-800">{error}</p>
          <button onClick={loadFirst} className="mt-3 h-9 px-4 rounded-xl bg-white border border-rose-200 text-sm font-semibold text-rose-700">
            Try again
          </button>
        </div>
      ) : loading && entries.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-400">
          <RefreshCw size={22} className="animate-spin mx-auto mb-2 text-slate-300" /> Loading activity…
        </div>
      ) : entries.length === 0 ? (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <FileText size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-700">
            {filtersActive ? 'Nothing matches these filters' : 'No activity recorded yet'}
          </p>
          {filtersActive && (
            <button onClick={clearFilters} className="mt-3 text-sm font-semibold text-blue-600">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {sections.map(section => (
            <div key={section.label} className="space-y-2">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">{section.label}</h2>
              <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden">
                {section.items.map(entry => {
                  const category = entry.category || categoryOf(entry.action);
                  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES.system;
                  const notable = isNotable(entry.action);
                  const open = expanded === entry.id;
                  return (
                    <div key={entry.id}>
                      <button
                        onClick={() => setExpanded(open ? null : entry.id)}
                        aria-expanded={open}
                        className="w-full text-left px-3.5 py-3 flex items-start gap-3 hover:bg-slate-50/80 transition-colors"
                      >
                        <span
                          aria-hidden
                          className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${notable ? 'bg-rose-500' : style.dot}`}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${notable ? 'text-rose-700' : 'text-slate-800'}`}>
                              {actionLabel(entry.action)}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${style.chip}`}>
                              {CATEGORY_LABELS[category]}
                            </span>
                          </span>
                          {/* Collapsed summary only: expanded, every part of
                              this reappears below with a label, and showing
                              both printed the actor's email twice a line
                              apart. */}
                          {!open && (
                            <span className="block text-xs text-slate-500 mt-0.5 truncate">
                              {actorLabel(entry.actorEmail)}
                              {entry.detail ? ` · ${entry.detail}` : ''}
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <span className="text-[11px] text-slate-400" title={fullTime(entry.created)}>
                            {timeOf(entry.created)}
                          </span>
                          <ChevronDown size={14} className={`text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </span>
                      </button>

                      {open && (
                        <dl className="px-3.5 pb-3.5 pt-0 ml-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                          <div className="flex items-start gap-2">
                            <UserIcon size={13} className="text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <dt className="text-slate-400">Who</dt>
                              <dd className="text-slate-700 font-medium break-all">{actorLabel(entry.actorEmail)}</dd>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Globe size={13} className="text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <dt className="text-slate-400">From</dt>
                              <dd className="text-slate-700 font-medium break-all">{entry.ip || 'unknown'}</dd>
                            </div>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-slate-400">When</dt>
                            <dd className="text-slate-700 font-medium">
                              {fullTime(entry.created)}
                              {timeAgo(entry.created) && (
                                <span className="text-slate-400"> ({timeAgo(entry.created)})</span>
                              )}
                            </dd>
                          </div>
                          <div className="min-w-0">
                            <dt className="text-slate-400">Action</dt>
                            <dd className="text-slate-700 font-mono break-all">{entry.action}</dd>
                          </div>
                          {(entry.targetType || entry.targetId) && (
                            <div className="min-w-0 sm:col-span-2">
                              <dt className="text-slate-400">On</dt>
                              <dd className="text-slate-700 font-medium break-all">
                                {entry.targetType}{entry.targetId ? ` · ${entry.targetId}` : ''}
                              </dd>
                            </div>
                          )}
                          {entry.detail && (
                            <div className="min-w-0 sm:col-span-2">
                              <dt className="text-slate-400">Detail</dt>
                              <dd className="text-slate-700 break-words">{entry.detail}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div ref={sentinelRef} className="py-4 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          <p className="text-center text-[11px] text-slate-400 pb-2">
            Sign-ins, accounts, billing and email are kept for a year. Content changes are kept for 90 days.
          </p>
        </div>
      )}
    </div>
  );
}
