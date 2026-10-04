import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MessageSquare, HelpCircle, BookOpen, ChevronDown, Compass, CheckCircle, LifeBuoy } from 'lucide-react';
import { supportStore, Ticket, FAQ, SupportDoc } from '../../../lib/supportStore';
import { syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import { StatusPill, PRIORITY, TicketThread, Composer, GuideBody, timeAgo } from '../../../components/support/supportUi';
import { runTour } from '../../../lib/tour/runner';
import { getUserTourSteps } from '../../../lib/tour/userTour';
import { markTourSeen } from '../../../lib/tour/state';

type Tab = 'tickets' | 'help';

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

interface Props {
  activeTab?: Tab;
  userEmail?: string;
  onNavigate?: (view: string) => void;
}

/** Client Help & Support: their tickets (with replies from support) and the Help Center. */
export default function Support({ activeTab = 'tickets', userEmail = '', onNavigate }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(activeTab);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>(() => supportStore.getFAQs());
  const [docs, setDocs] = useState<SupportDoc[]>(() => supportStore.getDocs());
  const [search, setSearch] = useState('');
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [readingDocId, setReadingDocId] = useState<string | null>(null);
  const [newTicket, setNewTicket] = useState<{ subject: string; priority: Ticket['priority']; description: string } | null>(null);

  useEffect(() => { setTab(activeTab); }, [activeTab]);

  const load = () => {
    setTickets(supportStore.getTickets().filter(t => (t.clientEmail || '').toLowerCase() === userEmail.toLowerCase()));
    setFaqs(supportStore.getFAQs());
    setDocs(supportStore.getDocs());
  };

  useEffect(() => {
    load();
    Promise.all([
      syncCollection('tickets', 'signageos_tickets'),
      syncCollection('faqs', 'signageos_faqs'),
      syncCollection('support_docs', 'signageos_docs'),
    ]).finally(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  const goTab = (t: Tab) => { setTab(t); onNavigate?.(`support-${t}`); };

  const myName = localStorage.getItem(`signageos_user_name_${userEmail}`) || userEmail.split('@')[0];

  const submitTicket = () => {
    if (!newTicket) return;
    if (!newTicket.subject.trim() || !newTicket.description.trim()) { toast.warning('Add a short subject and describe the problem'); return; }
    const t = supportStore.createTicket({
      subject: newTicket.subject.trim(),
      description: newTicket.description.trim(),
      priority: newTicket.priority,
      status: 'open',
      clientEmail: userEmail,
      clientName: myName,
    });
    toast.success('Ticket sent — we\'ll reply here and by email');
    setNewTicket(null);
    load();
    setOpenTicketId(t.id);
  };

  const send = async (id: string, body: { text?: string; status?: Ticket['status'] }) => {
    try {
      await supportStore.postMessage(id, body);
      load();
      if (body.status === 'resolved') toast.success('Marked as solved — thanks!');
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Could not send');
      return false;
    }
  };

  const q = search.trim().toLowerCase();
  const visibleFaqs = faqs.filter(f => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  const visibleDocs = docs.filter(d => !q || [d.title, d.category, d.content].some(v => (v || '').toLowerCase().includes(q)));
  const lastActivity = (t: Ticket) => (t.messages?.length ? t.messages[t.messages.length - 1].at : (t.lastUpdated || t.createdDate || (t as any).created));
  const sorted = [...tickets].sort((a, b) => (new Date(lastActivity(b)).getTime() || 0) - (new Date(lastActivity(a)).getTime() || 0));
  const unread = (t: Ticket) => (t.messages || []).slice(-1)[0]?.from === 'support' && (t.status === 'in_progress' || t.status === 'open');
  const openTicket = openTicketId ? tickets.find(t => t.id === openTicketId) : null;
  const readingDoc = readingDocId ? docs.find(d => d.id === readingDocId) : null;

  const newTicketButton = (
    <button onClick={() => setNewTicket({ subject: '', priority: 'medium', description: '' })} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
      <Plus size={16} /> New ticket
    </button>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Help & Support</h1>
          <p className="text-sm text-gray-500 mt-0.5">Find an answer, or ask our team</p>
          <button
            onClick={() => runTour({ steps: getUserTourSteps(), navigate, onFinish: () => markTourSeen('user-dashboard', userEmail) })}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mt-1.5"
          >
            <Compass size={13} /> Take the dashboard tour
          </button>
        </div>
        {tab === 'tickets' && newTicketButton}
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl md:max-w-sm">
        {([
          { key: 'tickets', label: 'My tickets', count: tickets.filter(unread).length },
          { key: 'help', label: 'Help Center', count: 0 },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => goTab(t.key)}
            className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
            {t.count > 0 && <span className="min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none bg-blue-100 text-blue-700">{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'tickets' && (
        sorted.length > 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
            {sorted.map(t => (
              <button key={t.id} type="button" onClick={() => setOpenTicketId(t.id)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                <MessageSquare size={16} className={`mt-0.5 shrink-0 ${unread(t) ? 'text-blue-600' : 'text-slate-300'}`} />
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm truncate ${unread(t) ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{t.subject}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">
                    {unread(t) ? <span className="text-blue-600 font-medium">New reply from support</span> : (t.messages?.length ? `${t.messages.length} repl${t.messages.length === 1 ? 'y' : 'ies'}` : 'Waiting for support')}
                    {timeAgo(lastActivity(t)) ? ` · ${timeAgo(lastActivity(t))}` : ''}
                  </span>
                </span>
                <StatusPill status={t.status} />
              </button>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <LifeBuoy size={30} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">No tickets yet</p>
            <p className="text-xs text-gray-500 mt-1 mb-4">Something not working? Tell us and we'll reply here and by email.</p>
            {newTicketButton}
          </div>
        )
      )}

      {tab === 'help' && (
        <div className="space-y-4">
          <div className="relative md:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search help — e.g. pair a screen" className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
          </div>

          {visibleDocs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Guides</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {visibleDocs.map(d => (
                  <button key={d.id} type="button" onClick={() => setReadingDocId(d.id)} className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 p-4 flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0"><BookOpen size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{d.title}</span>
                      <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line">{d.content}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {visibleFaqs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Frequently asked</p>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {visibleFaqs.map(f => {
                  const isOpen = openFaqId === f.id || (!!q && visibleFaqs.length <= 3);
                  return (
                    <div key={f.id}>
                      <button type="button" onClick={() => setOpenFaqId(openFaqId === f.id ? null : f.id)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
                        <HelpCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                        <span className="flex-1 text-sm font-medium text-slate-900">{f.question}</span>
                        <ChevronDown size={16} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isOpen && <p className="px-4 pb-4 pl-11 -mt-1 text-sm text-slate-600 leading-relaxed whitespace-pre-line">{f.answer}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {visibleDocs.length === 0 && visibleFaqs.length === 0 && (
            <div className="py-10 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <HelpCircle size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-600">{q ? `Nothing found for “${search}”` : 'No help articles yet'}</p>
            </div>
          )}

          <button
            onClick={() => { goTab('tickets'); setNewTicket({ subject: search.trim(), priority: 'medium', description: '' }); }}
            className="w-full flex items-center gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3.5 text-left hover:bg-slate-50"
          >
            <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><LifeBuoy size={17} /></span>
            <span className="flex-1">
              <span className="block text-sm font-medium text-slate-900">Still stuck?</span>
              <span className="block text-xs text-slate-500">Open a ticket — our team replies here and by email</span>
            </span>
          </button>
        </div>
      )}

      {newTicket && (
        <ScreenDetailsSheet
          open
          onClose={() => setNewTicket(null)}
          title="New ticket"
          subtitle="Tell us what's wrong — the more detail, the faster we can help"
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Subject</label>
                <input value={newTicket.subject} onChange={e => setNewTicket(t => t && ({ ...t, subject: e.target.value }))} placeholder="e.g. Lobby TV shows a black screen" className={inputCls} autoFocus />
              </div>
              <div>
                <label className={labelCls}>How urgent?</label>
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
                  {(['low', 'medium', 'high'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTicket(t => t && ({ ...t, priority: p }))}
                      className={`h-9 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 ${newTicket.priority === p ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${PRIORITY[p].dot}`} />
                      {p === 'low' ? 'Can wait' : p === 'medium' ? 'Soon' : 'Urgent'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>What's happening?</label>
                <textarea
                  rows={6}
                  value={newTicket.description}
                  onChange={e => setNewTicket(t => t && ({ ...t, description: e.target.value }))}
                  placeholder="Which screen, what you see, and what you've already tried"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none leading-relaxed"
                />
              </div>
            </div>
          }
          footer={
            <button type="button" onClick={submitTicket} className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Send ticket</button>
          }
        />
      )}

      {openTicket && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpenTicketId(null)}
          title={openTicket.subject}
          subtitle={`Opened ${timeAgo(openTicket.createdDate || (openTicket as any).created)}`}
          badge={<StatusPill status={openTicket.status} />}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <TicketThread ticket={openTicket} viewer="client" />
              {(openTicket.status === 'open' || openTicket.status === 'in_progress') && (openTicket.messages || []).some(m => m.from === 'support') && (
                <button
                  type="button"
                  onClick={() => send(openTicket.id, { status: 'resolved' })}
                  className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-medium"
                >
                  <CheckCircle size={15} /> This solved my problem
                </button>
              )}
              {(openTicket.status === 'resolved' || openTicket.status === 'closed') && (
                <p className="text-xs text-slate-500 text-center">Replying reopens this ticket.</p>
              )}
            </div>
          }
          footer={<Composer onSend={text => send(openTicket.id, { text })} placeholder="Add a message…" />}
        />
      )}

      {readingDoc && (
        <ScreenDetailsSheet
          open
          onClose={() => setReadingDocId(null)}
          title={readingDoc.title}
          subtitle={readingDoc.category}
          details={[]}
          groups={[]}
          hero={<GuideBody doc={readingDoc} />}
        />
      )}
    </div>
  );
}
