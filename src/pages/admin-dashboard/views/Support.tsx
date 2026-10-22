import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MessageSquare, HelpCircle, BookOpen, Edit2, Trash2, Compass, Loader2 } from 'lucide-react';
import { supportStore, Ticket, FAQ, SupportDoc, byHelpOrder } from '../../../lib/supportStore';
import { syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import { StatusPill, PRIORITY, TICKET_STATUS, TicketThread, Composer, GuideBody, timeAgo } from '../../../components/support/supportUi';
import { GuideArticle } from '../../../components/support/HelpGuide';
import HelpGuideEditor, { GuideDraft } from '../../../components/support/HelpGuideEditor';
import { runTour } from '../../../lib/tour/runner';
import { getAdminTourSteps } from '../../../lib/tour/adminTour';
import { markTourSeen } from '../../../lib/tour/state';

type Tab = 'issues' | 'faq' | 'docs';

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const areaCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none leading-relaxed';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

interface Props {
  activeTab?: Tab;
  onNavigate?: (view: string) => void;
  userEmail?: string;
}

/**
 * Helpdesk: client tickets (with a real reply thread), the FAQ clients see,
 * and help guides.
 */
export default function Support({ activeTab = 'issues', onNavigate, userEmail = 'admin@demo.com' }: Props) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(activeTab);
  const [tickets, setTickets] = useState<Ticket[]>(() => supportStore.getTickets());
  const [faqs, setFaqs] = useState<FAQ[]>(() => supportStore.getFAQs());
  // Step-by-step guides open as a page; plain-text ones in a sheet.
  const [readingGuideId, setReadingGuideId] = useState<string | null>(null);
  const [addingDefaults, setAddingDefaults] = useState(false);
  const [docs, setDocs] = useState<SupportDoc[]>(() => supportStore.getDocs());
  const [search, setSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'active' | 'done' | 'all'>('active');

  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [faqForm, setFaqForm] = useState<{ id?: string; question: string; answer: string } | null>(null);
  // The guide editor: { doc: null } for a new guide.
  const [docForm, setDocForm] = useState<{ doc: SupportDoc | null } | null>(null);
  const [readingDocId, setReadingDocId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'faq' | 'doc' | 'ticket'; id: string; title: string } | null>(null);

  useEffect(() => { setTab(activeTab); }, [activeTab]);

  const load = () => {
    setTickets(supportStore.getTickets());
    setFaqs(supportStore.getFAQs());
    setDocs(supportStore.getDocs());
  };

  useEffect(() => {
    Promise.all([
      syncCollection('tickets', 'signageos_tickets'),
      syncCollection('faqs', 'signageos_faqs'),
      syncCollection('support_docs', 'signageos_docs'),
    ]).finally(load);
  }, []);

  const goTab = (t: Tab) => { setTab(t); setSearch(''); onNavigate?.(`support-${t}`); };

  const q = search.trim().toLowerCase();
  const isActive = (t: Ticket) => t.status === 'open' || t.status === 'in_progress';
  const activeCount = tickets.filter(isActive).length;
  const waitingOnUs = (t: Ticket) => isActive(t) && ((t.messages || []).slice(-1)[0]?.from ?? 'client') === 'client';
  const lastActivity = (t: Ticket) => t.messages?.length ? t.messages[t.messages.length - 1].at : (t.lastUpdated || t.createdDate || (t as any).created);
  const sortKey = (t: Ticket) => { const v = new Date(lastActivity(t)).getTime(); return Number.isFinite(v) ? v : 0; };
  const visibleTickets = tickets
    .filter(t => ticketFilter === 'all' || (ticketFilter === 'active' ? isActive(t) : !isActive(t)))
    .filter(t => !q || [t.subject, t.clientEmail, t.clientName, t.description].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => Number(waitingOnUs(b)) - Number(waitingOnUs(a)) || sortKey(b) - sortKey(a));
  const visibleFaqs = [...faqs].sort(byHelpOrder).filter(f => !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
  const visibleDocs = [...docs].sort(byHelpOrder).filter(d => !q || [d.title, d.category, d.content].some(v => (v || '').toLowerCase().includes(q)));
  const readingGuide = readingGuideId ? docs.find(d => d.id === readingGuideId) : null;
  const openGuide = (d: SupportDoc) => (d.steps?.length ? setReadingGuideId(d.id) : setReadingDocId(d.id));
  const hasStepGuides = docs.some(d => d.steps?.length);

  // ── Tickets ──────────────────────────────────────────────────────────────
  const reply = async (id: string, body: { text?: string; status?: Ticket['status'] }) => {
    try {
      await supportStore.postMessage(id, body);
      load();
      if (body.text) toast.success('Reply sent — the client gets an email');
      return true;
    } catch (e: any) {
      toast.error(e.message || 'Could not send');
      return false;
    }
  };

  // ── FAQ / guides ─────────────────────────────────────────────────────────
  const saveFaq = async () => {
    if (!faqForm) return;
    const question = faqForm.question.trim();
    const answer = faqForm.answer.trim();
    if (!question || !answer) { toast.warning('Write both the question and the answer'); return; }
    if (faqForm.id) {
      const res = await supportStore.updateFAQ(faqForm.id, { question, answer });
      if (res.ok === false) { toast.error(`Couldn't save: ${res.error}`); return; }
      toast.success('FAQ updated');
    } else {
      supportStore.addFAQ({ question, answer });
      toast.success('FAQ added — clients see it in their Help Center');
    }
    setFaqForm(null);
    load();
  };

  const saveDoc = async (draft: GuideDraft): Promise<boolean> => {
    const existing = docForm?.doc;
    if (existing) {
      const res = await supportStore.updateDoc(existing.id, draft);
      if (res.ok === false) { toast.error(`Couldn't save: ${res.error}`); return false; }
      toast.success('Guide updated');
    } else {
      supportStore.addDoc({ ...draft, images: [] });
      toast.success('Guide published — clients see it in their Help Center');
    }
    load();
    return true;
  };

  /** Adds the standard guides and FAQs; anything already there by title is left alone. */
  const addDefaults = async () => {
    setAddingDefaults(true);
    try {
      const r = await supportStore.addDefaultHelp();
      await Promise.all([
        syncCollection('faqs', 'signageos_faqs', { force: true }),
        syncCollection('support_docs', 'signageos_docs', { force: true }),
      ]);
      load();
      toast.success(r.guides || r.faqs ? `Added ${r.guides} guide${r.guides === 1 ? '' : 's'} and ${r.faqs} FAQ${r.faqs === 1 ? '' : 's'}` : 'You already have all the standard guides and FAQs');
    } catch (e: any) {
      toast.error(e.message || 'Could not add the standard guides');
    } finally {
      setAddingDefaults(false);
    }
  };

  const doDelete = async () => {
    if (!confirm) return;
    if (confirm.kind === 'ticket') {
      const res = await supportStore.deleteTicket(confirm.id);
      if (res.ok === false) { toast.error(`Couldn't delete: ${res.error || 'please try again'}`); return; }
      toast.success('Ticket deleted');
      setConfirm(null);
      setOpenTicketId(null);
      load();
      return;
    }
    if (confirm.kind === 'faq') supportStore.deleteFAQ(confirm.id);
    else supportStore.deleteDoc(confirm.id);
    toast.success(confirm.kind === 'faq' ? 'FAQ deleted' : 'Guide deleted');
    setConfirm(null);
    setFaqForm(null);
    setReadingDocId(null);
    setReadingGuideId(null);
    load();
  };

  const openTicket = openTicketId ? tickets.find(t => t.id === openTicketId) : null;
  const readingDoc = readingDocId ? docs.find(d => d.id === readingDocId) : null;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Helpdesk</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {activeCount ? `${activeCount} open ticket${activeCount === 1 ? '' : 's'}` : 'No open tickets'} · FAQs and guides your clients see
          </p>
          <button
            onClick={() => runTour({ steps: getAdminTourSteps(), navigate, onFinish: () => markTourSeen('admin-dashboard', userEmail) })}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 mt-1.5"
          >
            <Compass size={13} /> Take the dashboard tour
          </button>
        </div>
        {tab === 'faq' && (
          <button onClick={() => setFaqForm({ question: '', answer: '' })} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> Add FAQ
          </button>
        )}
        {tab === 'docs' && (
          <button onClick={() => { setReadingGuideId(null); setDocForm({ doc: null }); }} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> New guide
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl md:max-w-md">
        {([
          { key: 'issues', label: 'Tickets', count: activeCount, alert: true },
          { key: 'faq', label: 'FAQs', count: faqs.length },
          { key: 'docs', label: 'Guides', count: docs.length },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => goTab(t.key)}
            className={`flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none ${'alert' in t ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="relative md:max-w-sm">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'issues' ? 'Search tickets or clients' : tab === 'faq' ? 'Search FAQs' : 'Search guides'}
          className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
        />
      </div>

      {/* ── Tickets ─────────────────────────────────────────────────────── */}
      {tab === 'issues' && (
        <>
          <div className="flex gap-2">
            {([
              { key: 'active', label: 'Open', count: activeCount },
              { key: 'done', label: 'Resolved', count: tickets.length - activeCount },
              { key: 'all', label: 'All', count: tickets.length },
            ] as const).map(c => (
              <button
                key={c.key}
                onClick={() => setTicketFilter(c.key)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold ${
                  ticketFilter === c.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {c.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${ticketFilter === c.key ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{c.count}</span>
              </button>
            ))}
          </div>

          {visibleTickets.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {visibleTickets.map(t => (
                <button key={t.id} type="button" onClick={() => setOpenTicketId(t.id)} className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORITY[t.priority]?.dot || 'bg-slate-300'}`} title={`${PRIORITY[t.priority]?.label} priority`} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className={`text-sm truncate ${waitingOnUs(t) ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{t.subject}</span>
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{t.clientName || t.clientEmail}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">
                      {waitingOnUs(t) ? <span className="text-rose-600 font-medium">Waiting for your reply</span> : `${(t.messages || []).length} repl${(t.messages || []).length === 1 ? 'y' : 'ies'}`}
                      {timeAgo(lastActivity(t)) ? ` · ${timeAgo(lastActivity(t))}` : ''}
                    </span>
                  </span>
                  <StatusPill status={t.status} />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <MessageSquare size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">{tickets.length ? 'No tickets here' : 'No tickets yet'}</p>
              <p className="text-xs text-gray-500 mt-1">Clients open tickets from Help & Support in their dashboard.</p>
            </div>
          )}
        </>
      )}

      {/* ── FAQs ────────────────────────────────────────────────────────── */}
      {tab === 'faq' && (
        <div className="space-y-4">
          {!hasStepGuides && (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <span className="w-9 h-9 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0"><BookOpen size={17} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Start with the standard guides</span>
                <span className="block text-xs text-slate-600 mt-0.5">10 step-by-step guides with screenshots and 13 FAQs — adding a screen, playlists, media, groups, billing and more. Edit or delete any of them afterwards.</span>
              </span>
              <button type="button" onClick={addDefaults} disabled={addingDefaults} className="shrink-0 h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium flex items-center gap-1.5">
                {addingDefaults && <Loader2 size={14} className="animate-spin" />} Add them
              </button>
            </div>
          )}
          {visibleFaqs.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {visibleFaqs.map(f => (
                <button key={f.id} type="button" onClick={() => setFaqForm({ id: f.id, question: f.question, answer: f.answer })} className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
                  <HelpCircle size={16} className="text-blue-600 mt-0.5 shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{f.question}</span>
                    <span className="block text-xs text-slate-500 mt-0.5 line-clamp-2">{f.answer}</span>
                  </span>
                  <Edit2 size={14} className="text-slate-300 mt-1 shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <HelpCircle size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">{faqs.length ? 'No FAQs match' : 'No FAQs yet'}</p>
              <p className="text-xs text-gray-500 mt-1">Answer common questions once — clients find them in their Help Center.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Guides ──────────────────────────────────────────────────────── */}
      {tab === 'docs' && docForm && (
        <HelpGuideEditor key={docForm.doc?.id || 'new'} initial={docForm.doc} onCancel={() => setDocForm(null)} onSave={saveDoc} />
      )}

      {tab === 'docs' && !docForm && readingGuide && (
        <GuideArticle
          doc={readingGuide}
          onBack={() => setReadingGuideId(null)}
          actions={
            <div className="flex gap-2">
              <button type="button" onClick={() => setDocForm({ doc: readingGuide })} className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 flex items-center gap-1.5"><Edit2 size={14} /> Edit</button>
              <button type="button" onClick={() => setConfirm({ kind: 'doc', id: readingGuide.id, title: readingGuide.title })} className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-red-600 flex items-center gap-1.5"><Trash2 size={14} /> Delete</button>
            </div>
          }
        />
      )}

      {tab === 'docs' && !docForm && !readingGuide && (
        <div className="space-y-4">
          {!hasStepGuides && (
            <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <span className="w-9 h-9 rounded-xl bg-white text-blue-600 flex items-center justify-center shrink-0"><BookOpen size={17} /></span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-900">Start with the standard guides</span>
                <span className="block text-xs text-slate-600 mt-0.5">10 step-by-step guides with screenshots and 13 FAQs — adding a screen, playlists, media, groups, billing and more. Edit or delete any of them afterwards.</span>
              </span>
              <button type="button" onClick={addDefaults} disabled={addingDefaults} className="shrink-0 h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium flex items-center gap-1.5">
                {addingDefaults && <Loader2 size={14} className="animate-spin" />} Add them
              </button>
            </div>
          )}
          {visibleDocs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {visibleDocs.map(d => (
                <button key={d.id} type="button" onClick={() => openGuide(d)} className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 transition-colors">
                  <span className="flex items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold">{d.category}</span>
                    <span className="text-[10px] text-slate-400">{d.steps?.length ? `${d.steps.length} steps` : d.youtubeUrl ? 'Has video' : ''}</span>
                  </span>
                  <span className="block text-sm font-semibold text-slate-900 mt-2">{d.title}</span>
                  <span className="block text-xs text-slate-500 mt-1 line-clamp-2 whitespace-pre-line">{d.content}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <BookOpen size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">{docs.length ? 'No guides match' : 'No guides yet'}</p>
              <p className="text-xs text-gray-500 mt-1">Step-by-step help with screenshots, or a simple text article.</p>
            </div>
          )}
          {hasStepGuides && (
            <button type="button" onClick={addDefaults} disabled={addingDefaults} className="text-xs font-medium text-slate-500 hover:text-blue-600 px-1">
              {addingDefaults ? 'Adding…' : 'Add any standard guides and FAQs that are missing'}
            </button>
          )}
        </div>
      )}

      {/* ── Ticket conversation ─────────────────────────────────────────── */}
      {openTicket && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpenTicketId(null)}
          title={openTicket.subject}
          subtitle={`${openTicket.clientName || ''}${openTicket.clientName ? ' · ' : ''}${openTicket.clientEmail}`}
          badge={<StatusPill status={openTicket.status} />}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`w-2 h-2 rounded-full ${PRIORITY[openTicket.priority]?.dot}`} />
                {PRIORITY[openTicket.priority]?.label} priority · opened {timeAgo(openTicket.createdDate || (openTicket as any).created)}
              </div>
              <TicketThread ticket={openTicket} viewer="support" />
              <div>
                <p className={labelCls}>Status</p>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
                  {(Object.keys(TICKET_STATUS) as Ticket['status'][]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => st !== openTicket.status && reply(openTicket.id, { status: st })}
                      className={`h-8 rounded-lg text-xs font-medium ${openTicket.status === st ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                    >
                      {TICKET_STATUS[st].label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => setConfirm({ kind: 'ticket', id: openTicket.id, title: openTicket.subject })}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600">
                <Trash2 size={13} /> Delete ticket
              </button>
            </div>
          }
          footer={<Composer onSend={text => reply(openTicket.id, { text })} placeholder={`Reply to ${openTicket.clientName || 'the client'}…`} />}
        />
      )}

      {/* ── FAQ editor ──────────────────────────────────────────────────── */}
      {faqForm && (
        <ScreenDetailsSheet
          open
          onClose={() => setFaqForm(null)}
          title={faqForm.id ? 'Edit FAQ' : 'New FAQ'}
          details={[]}
          groups={faqForm.id ? [{
            title: 'Danger zone',
            actions: [{ key: 'del', label: 'Delete FAQ', icon: <Trash2 size={17} />, tone: 'danger' as const, onClick: () => setConfirm({ kind: 'faq', id: faqForm.id!, title: faqForm.question }) }]
          }] : []}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Question</label>
                <input value={faqForm.question} onChange={e => setFaqForm(f => f && ({ ...f, question: e.target.value }))} placeholder="How do I pair a new screen?" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Answer</label>
                <textarea rows={6} value={faqForm.answer} onChange={e => setFaqForm(f => f && ({ ...f, answer: e.target.value }))} className={areaCls} />
              </div>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setFaqForm(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={saveFaq} className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">{faqForm.id ? 'Save' : 'Add FAQ'}</button>
            </div>
          }
        />
      )}

      {/* ── Guide reader ────────────────────────────────────────────────── */}
      {readingDoc && (
        <ScreenDetailsSheet
          open
          onClose={() => setReadingDocId(null)}
          title={readingDoc.title}
          subtitle={readingDoc.category}
          details={[]}
          hero={<GuideBody doc={readingDoc} />}
          groups={[{
            title: 'Guide',
            actions: [
              { key: 'edit', label: 'Edit guide', icon: <Edit2 size={17} />, onClick: () => { setReadingDocId(null); setDocForm({ doc: readingDoc }); } },
              { key: 'del', label: 'Delete guide', icon: <Trash2 size={17} />, tone: 'danger' as const, onClick: () => setConfirm({ kind: 'doc', id: readingDoc.id, title: readingDoc.title }) },
            ]
          }]}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={`Delete this ${confirm.kind === 'faq' ? 'FAQ' : confirm.kind === 'ticket' ? 'ticket' : 'guide'}?`}
          body={confirm.kind === 'ticket'
            ? <p>“{confirm.title}” and its replies are deleted for you and the client. This can't be undone.</p>
            : <p>“{confirm.title}” disappears from every client's Help Center. This can't be undone.</p>}
          confirmLabel="Delete"
          tone="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

