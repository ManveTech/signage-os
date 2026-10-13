import { useEffect, useMemo, useState } from 'react';
import { Search, Inbox, Phone, Mail, MessageCircle, Trash2, RefreshCw } from 'lucide-react';
import { syncCollection, pushToDatabase } from '../../../lib/syncHelper';
import CustomSelect from '../../../components/CustomSelect';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import { toast } from '../../../components/Toast';

/**
 * Enquiries from the public website (bluestardigitech.com).
 *
 * The leads collection and its sync entry already existed but nothing ever
 * rendered them — a lead would land in the database with nowhere to be read.
 * This is that page: the list, where each conversation has got to, and the
 * one-tap ways of answering it.
 *
 * Rows arrive from POST /api/v1/public/leads (see server/controllers/
 * publicLeads.ts). Nothing here creates a lead: a salesperson taking an
 * enquiry over the phone writes it down in their own system, and inventing a
 * second way in would mean two sources of truth for the same pipeline.
 */

export type Lead = {
  id: string;
  clientName: string;
  company?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  product?: string;
  displaySize?: string;
  finish?: string;
  quantity?: string;
  city?: string;
  message?: string;
  source?: string;
  date?: string;
  status?: LeadStatus;
  estimatedValue?: string;
  created?: string;
};

export type LeadStatus = 'New' | 'Contacted' | 'Quoted' | 'Won' | 'Lost';

/* Where the conversation has got to — not an approval queue. */
const STATUSES: LeadStatus[] = ['New', 'Contacted', 'Quoted', 'Won', 'Lost'];

const STATUS_STYLE: Record<LeadStatus, string> = {
  New: 'bg-blue-50 text-blue-700 border-blue-100',
  Contacted: 'bg-amber-50 text-amber-700 border-amber-100',
  Quoted: 'bg-violet-50 text-violet-700 border-violet-100',
  Won: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Lost: 'bg-slate-100 text-slate-500 border-slate-200'
};

const LOCAL_KEY = 'signageos_leads';

function statusOf(l: Lead): LeadStatus {
  return STATUSES.includes(l.status as LeadStatus) ? (l.status as LeadStatus) : 'New';
}

/** Sorts newest first on whichever timestamp the row actually has. */
function timeOf(l: Lead): number {
  const t = Date.parse(l.date || l.created || '');
  return Number.isFinite(t) ? t : 0;
}

function whenLabel(l: Lead): string {
  const t = timeOf(l);
  if (!t) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 8) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** wa.me wants digits only; a bare 10-digit Indian mobile gets its 91. */
function waLink(raw?: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  const dial = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${dial}`;
}

/** The one-line summary of what they asked about. */
function asked(l: Lead): string {
  const bits = [l.product, l.displaySize, l.quantity ? `× ${l.quantity}` : ''].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'No product specified';
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>(() => {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | LeadStatus>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (force = false) => {
    const rows = await syncCollection('leads', LOCAL_KEY, { force });
    setLeads(rows as Lead[]);
  };

  useEffect(() => { load(); }, []);

  const refresh = async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: leads.length };
    for (const s of STATUSES) c[s] = 0;
    for (const l of leads) c[statusOf(l)] += 1;
    return c;
  }, [leads]);

  const q = search.trim().toLowerCase();
  const visible = useMemo(() => leads
    .filter(l => filter === 'all' || statusOf(l) === filter)
    .filter(l => !q || [l.clientName, l.company, l.phone, l.email, l.product, l.city, l.message]
      .some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => timeOf(b) - timeOf(a)),
  [leads, filter, q]);

  const open = openId ? leads.find(l => l.id === openId) || null : null;

  /* Optimistic: the row moves the moment it is picked, and rolls back if the
     write is refused — a status dropdown that waits on a round trip feels
     broken on a slow connection. */
  const setStatus = async (lead: Lead, status: LeadStatus) => {
    const previous = leads;
    const next = leads.map(l => (l.id === lead.id ? { ...l, status } : l));
    setLeads(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    const res = await pushToDatabase('leads', lead.id, { status }, 'PUT');
    if (!res.ok) {
      setLeads(previous);
      localStorage.setItem(LOCAL_KEY, JSON.stringify(previous));
      toast.error("Couldn't update that lead — try again.");
    }
  };

  const remove = async (lead: Lead) => {
    const res = await pushToDatabase('leads', lead.id, null, 'DELETE');
    if (!res.ok) { toast.error("Couldn't delete that lead."); return; }
    const next = leads.filter(l => l.id !== lead.id);
    setLeads(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    setDeleteTarget(null);
    setOpenId(null);
    toast.success('Lead deleted');
  };

  const pill = (s: LeadStatus) => (
    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLE[s]}`}>{s}</span>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Enquiries</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {leads.length
              ? `${counts.New} new of ${leads.length} — tap one to answer it`
              : 'Enquiries from the website arrive here'}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={refreshing}
          className="flex items-center gap-2 h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-medium disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {leads.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative sm:max-w-sm flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, company, product, city"
              className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
          </div>
          <div className="sm:w-48">
            <CustomSelect
              value={filter}
              onChange={v => setFilter(v as 'all' | LeadStatus)}
              options={[
                { value: 'all', label: `All (${counts.all})` },
                ...STATUSES.map(s => ({ value: s, label: `${s} (${counts[s]})` }))
              ]}
              buttonClassName="h-11 px-3 text-sm"
            />
          </div>
        </div>
      )}

      {/* Desktop table */}
      {visible.length > 0 && (
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_110px_100px] gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>Who</span><span>Asked about</span><span>Reach them</span><span>When</span><span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map(l => {
              const s = statusOf(l);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setOpenId(l.id)}
                  className="w-full grid grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_110px_100px] gap-4 items-center px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                      <Inbox size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{l.clientName}</span>
                      {l.company && <span className="block text-xs text-slate-500 truncate">{l.company}</span>}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{asked(l)}</span>
                    {l.city && <span className="block text-xs text-slate-500 truncate">{l.city}</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{l.phone || '—'}</span>
                    {l.email && <span className="block text-xs text-slate-500 truncate">{l.email}</span>}
                  </span>
                  <span className="text-xs text-slate-500">{whenLabel(l)}</span>
                  <span className="flex justify-end">{pill(s)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Phone / tablet cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
        {visible.map(l => (
          <button
            key={l.id}
            type="button"
            onClick={() => setOpenId(l.id)}
            className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 flex items-start gap-3 transition-colors"
          >
            <span className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <Inbox size={19} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-slate-900 truncate">{l.clientName}</span>
              <span className="block text-xs text-slate-500 truncate">{asked(l)}</span>
              <span className="block text-xs text-slate-400 mt-0.5 truncate">
                {[l.company, l.city, whenLabel(l)].filter(Boolean).join(' · ')}
              </span>
            </span>
            {pill(statusOf(l))}
          </button>
        ))}
      </div>

      {leads.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Inbox size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No enquiries yet</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Enquiries sent from the form on bluestardigitech.com land here. Check the WhatsApp number
            and enquiry email under Licensing → Invoices → Business details.
          </p>
        </div>
      )}
      {leads.length > 0 && visible.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No enquiries match.</p>
      )}

      {open && (() => {
        const l = open;
        const s = statusOf(l);
        const wa = waLink(l.whatsapp || l.phone);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={l.clientName}
            subtitle={[l.company, l.city].filter(Boolean).join(' · ') || undefined}
            badge={pill(s)}
            hero={
              <div className="space-y-3">
                {l.message && (
                  <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                    <p className="text-xs text-slate-500 mb-1">What they said</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap break-words">{l.message}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-slate-500 mb-1.5">Status</p>
                  <CustomSelect
                    value={s}
                    onChange={v => setStatus(l, v as LeadStatus)}
                    options={STATUSES.map(x => ({ value: x, label: x }))}
                    buttonClassName="h-11 px-3 text-sm"
                  />
                </div>
              </div>
            }
            details={[
              { label: 'Asked about', value: asked(l) },
              ...(l.finish ? [{ label: 'Finish', value: l.finish }] : []),
              { label: 'Phone', value: l.phone || '—' },
              ...(l.email ? [{ label: 'Email', value: l.email }] : []),
              ...(l.city ? [{ label: 'Site / city', value: l.city }] : []),
              ...(l.source ? [{ label: 'Came from', value: l.source }] : []),
              { label: 'Received', value: whenLabel(l) || '—' }
            ]}
            groups={[
              {
                title: 'Answer it',
                actions: [
                  ...(wa ? [{
                    key: 'whatsapp',
                    label: 'Reply on WhatsApp',
                    description: l.whatsapp || l.phone,
                    icon: <MessageCircle size={16} />,
                    onClick: () => window.open(wa, '_blank', 'noopener,noreferrer')
                  }] : []),
                  ...(l.phone ? [{
                    key: 'call',
                    label: 'Call them',
                    description: l.phone,
                    icon: <Phone size={16} />,
                    onClick: () => { window.location.href = `tel:${l.phone}`; }
                  }] : []),
                  ...(l.email ? [{
                    key: 'email',
                    label: 'Email them',
                    description: l.email,
                    icon: <Mail size={16} />,
                    onClick: () => {
                      const subject = l.product ? `Your enquiry — ${l.product}` : 'Your enquiry';
                      window.location.href = `mailto:${l.email}?subject=${encodeURIComponent(subject)}`;
                    }
                  }] : [])
                ]
              },
              {
                title: 'Manage',
                actions: [{
                  key: 'delete',
                  label: 'Delete enquiry',
                  description: 'Removes it for everyone',
                  icon: <Trash2 size={16} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteTarget(l)
                }]
              }
            ]}
          />
        );
      })()}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this enquiry?"
          body={<>The enquiry from <strong>{deleteTarget.clientName}</strong> will be removed for everyone. This cannot be undone.</>}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove(deleteTarget)}
        />
      )}
    </div>
  );
}
