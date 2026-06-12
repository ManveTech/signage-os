import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, BookOpen, HelpCircle, ChevronDown, ChevronUp, Send, 
  Plus, Trash2, ShieldAlert, CheckCircle, Search, Clock, FileText, Image as ImageIcon, X
} from 'lucide-react';
import { supportStore, Ticket, FAQ, SupportDoc } from '../../../lib/supportStore';
import { syncCollection } from '../../../lib/syncHelper';

type Tab = 'issues' | 'faq' | 'docs';

const statusColors: Record<Ticket['status'], string> = {
  open: 'bg-rose-50 text-rose-700 border-rose-100',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const priorityColors: Record<Ticket['priority'], string> = {
  high: 'bg-rose-100 text-rose-800 font-extrabold',
  medium: 'bg-amber-100 text-amber-800 font-bold',
  low: 'bg-slate-100 text-slate-700 font-semibold',
};

interface Props {
  activeTab?: Tab;
  onNavigate?: (view: string) => void;
}

export default function Support({ activeTab = 'issues', onNavigate }: Props) {
  const [tab, setTab] = useState<Tab>(activeTab);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (onNavigate) {
      onNavigate(`support-${newTab}`);
    }
  };

  useEffect(() => {
    setTab(activeTab);
  }, [activeTab]);

  // Data states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [docs, setDocs] = useState<SupportDoc[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // FAQ Modal/Form states
  const [isFaqFormOpen, setIsFaqFormOpen] = useState(false);
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');

  // Doc Form states
  const [isDocFormOpen, setIsDocFormOpen] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('General');
  const [docContent, setDocContent] = useState('');
  const [docYoutubeUrl, setDocYoutubeUrl] = useState('');

  // Ticket Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([
      syncCollection('tickets', 'signageos_tickets'),
      syncCollection('faqs', 'signageos_faqs'),
      syncCollection('support_docs', 'signageos_docs'),
    ]);
    setTickets(supportStore.getTickets());
    setFaqs(supportStore.getFAQs());
    setDocs(supportStore.getDocs());
  };

  const handleCreateFAQ = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFaqQ || !newFaqA) return;
    supportStore.addFAQ({ question: newFaqQ, answer: newFaqA });
    showToast('FAQ created successfully!');
    setNewFaqQ('');
    setNewFaqA('');
    setIsFaqFormOpen(false);
    loadData();
  };

  const handleDeleteFAQ = (id: string) => {
    if (confirm('Are you sure you want to delete this FAQ?')) {
      supportStore.deleteFAQ(id);
      showToast('FAQ deleted.');
      loadData();
    }
  };

  const getYouTubeId = (url?: string): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = trimmed.match(regExp);
    return (match && match[2].trim().length === 11) ? match[2].trim() : null;
  };

  const handleCreateDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docContent) return;
    supportStore.addDoc({
      title: docTitle,
      category: docCategory,
      content: docContent,
      youtubeUrl: docYoutubeUrl,
      images: []
    });
    showToast('Support Document published successfully!');
    setDocTitle('');
    setDocCategory('General');
    setDocContent('');
    setDocYoutubeUrl('');
    setIsDocFormOpen(false);
    loadData();
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm('Are you sure you want to delete this support document?')) {
      supportStore.deleteDoc(id);
      showToast('Support document deleted.');
      loadData();
    }
  };

  const handleTicketStatusChange = (id: string, newStatus: Ticket['status']) => {
    supportStore.updateTicketStatus(id, newStatus);
    showToast(`Ticket status updated to ${newStatus.replace('_', ' ')}`);
    loadData();
    // Update active modal ticket details
    const updated = supportStore.getTickets().find(t => t.id === id);
    if (updated) setSelectedTicket(updated);
  };

  // Filtered Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.clientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 text-left relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-slideIn z-50">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Client Helpdesk & Support</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Manage raised issues, edit FAQs, and draft helper documentation guides</p>
        </div>
        {tab === 'faq' && (
          <button 
            onClick={() => setIsFaqFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md shadow-blue-600/10 cursor-pointer"
          >
            <Plus size={15} /> Add New FAQ
          </button>
        )}
        {tab === 'docs' && !isDocFormOpen && (
          <button 
            onClick={() => setIsDocFormOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            <Plus size={15} /> Draft Document
          </button>
        )}
      </div>


      {/* 1. ONGOING ISSUES TAB */}
      {tab === 'issues' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-xs">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input 
                placeholder="Search ticket subject, client email, or ID..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-blue-400 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Issues Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-150 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Ticket ID</th>
                    <th className="px-5 py-3.5">Client User</th>
                    <th className="px-5 py-3.5">Issue Subject</th>
                    <th className="px-5 py-3.5">Priority</th>
                    <th className="px-5 py-3.5">Created Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-400 italic">No tickets found matches your search filter</td>
                    </tr>
                  ) : (
                    filteredTickets.map(ticket => (
                      <tr key={ticket.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4 font-mono font-bold text-slate-900">{ticket.id}</td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-slate-800">{ticket.clientName}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{ticket.clientEmail}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-semibold text-slate-700 max-w-xs truncate">{ticket.subject}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-black tracking-wider ${priorityColors[ticket.priority]}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-500">{ticket.createdDate}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${statusColors[ticket.status]}`}>
                            {ticket.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button 
                            onClick={() => setSelectedTicket(ticket)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[10.5px] font-bold cursor-pointer transition-colors"
                          >
                            View & Manage
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. FAQ TAB */}
      {tab === 'faq' && (
        <div className="max-w-4xl space-y-4">
          {faqs.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-slate-450 italic">
              No FAQs created yet. Click "Add New FAQ" to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {faqs.map(faq => (
                <div key={faq.id} className="bg-white p-5 rounded-2xl border border-slate-150 hover:shadow-xs transition-shadow flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={15} className="text-blue-600 shrink-0" />
                      <h3 className="text-sm font-extrabold text-slate-800">{faq.question}</h3>
                    </div>
                    <p className="text-xs text-slate-600 pl-5 leading-relaxed">{faq.answer}</p>
                    <span className="inline-block text-[9px] font-mono font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ID: {faq.id}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteFAQ(faq.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                    title="Delete FAQ"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. SUPPORT DOCUMENTS TAB */}
      {tab === 'docs' && (
        <div className="space-y-6">
          {isDocFormOpen ? (
            /* Document Editor Builder Form */
            <div className="max-w-2xl bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                  <FileText size={16} className="text-indigo-600" /> Draft Support Documentation
                </h2>
                <button 
                  onClick={() => setIsDocFormOpen(false)}
                  className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleCreateDoc} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Document Title</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Setting Up Dual HDMI Displays"
                      value={docTitle}
                      onChange={e => setDocTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold placeholder-slate-350 outline-none focus:border-indigo-500 bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Category</label>
                    <select 
                      value={docCategory}
                      onChange={e => setDocCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-white"
                    >
                      <option value="General">General</option>
                      <option value="Screens">Screens</option>
                      <option value="Playlists">Playlists</option>
                      <option value="Troubleshooting">Troubleshooting</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Content / Body Text</label>
                  <textarea 
                    rows={8}
                    required
                    placeholder="Draft the helper documentation article detailing setup procedures, configuration variables, and step-by-step instructions..."
                    value={docContent}
                    onChange={e => setDocContent(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold placeholder-slate-350 outline-none focus:border-indigo-500 bg-slate-50 resize-none leading-relaxed"
                  />
                </div>

                {/* YouTube Link Section */}
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">YouTube Video URL</label>
                  <input 
                    type="url" 
                    placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    value={docYoutubeUrl}
                    onChange={e => setDocYoutubeUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold placeholder-slate-350 outline-none focus:border-indigo-500 bg-slate-50 text-xs"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Provide a watch or share link to embed this video directly under the document.</p>
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsDocFormOpen(false);
                      setDocYoutubeUrl('');
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase rounded-xl cursor-pointer"
                  >
                    Publish Document
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Support Documents List grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {docs.length === 0 ? (
                <div className="md:col-span-2 bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-slate-455 italic">
                  No support documents created yet. Click "Draft Document" to publish one.
                </div>
              ) : (
                docs.map(doc => (
                  <div key={doc.id} className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs flex flex-col justify-between hover:shadow-sm transition-shadow space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">{doc.category}</span>
                        <span className="text-[9px] font-mono text-slate-400 font-semibold">{doc.createdDate}</span>
                      </div>
                      <h3 className="text-sm font-black text-slate-800 leading-snug">{doc.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-3 whitespace-pre-line">{doc.content}</p>

                      {/* YouTube Embed Player */}
                      {(doc.youtubeUrl || (doc as any).youtube_url) && getYouTubeId(doc.youtubeUrl || (doc as any).youtube_url) && (
                        <div className="space-y-1.5 border-t border-slate-50 pt-2.5">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">Embedded Video</p>
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-150 shadow-2xs">
                            <iframe
                              className="absolute top-0 left-0 w-full h-full"
                              src={`https://www.youtube.com/embed/${getYouTubeId(doc.youtubeUrl || (doc as any).youtube_url)}`}
                              title={doc.title}
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                      <span className="text-[9px] font-mono text-slate-400 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">ID: {doc.id}</span>
                      <button 
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE FAQ MODAL DIALOG */}
      {isFaqFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn text-left p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <HelpCircle size={16} className="text-blue-600" /> Create Platform FAQ
              </h2>
              <button 
                onClick={() => setIsFaqFormOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateFAQ} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Question / Query Title</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. How do I pair a new screen?"
                  value={newFaqQ}
                  onChange={e => setNewFaqQ(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold placeholder-slate-350 outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Answer Description</label>
                <textarea 
                  rows={4}
                  required
                  placeholder="Describe step-by-step resolution details clearly..."
                  value={newFaqA}
                  onChange={e => setNewFaqA(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold placeholder-slate-350 outline-none focus:border-blue-500 bg-slate-50 resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsFaqFormOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer"
                >
                  Save FAQ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TICKET DETAILS MODAL DIALOG */}
      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn text-left p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{selectedTicket.id}</span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border tracking-wider ${statusColors[selectedTicket.status]}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-sm font-black text-slate-800 mt-1">Manage Ticket Details</h2>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                <p className="font-extrabold text-slate-800 text-[13px]">{selectedTicket.subject}</p>
                <p className="text-slate-600 font-medium leading-relaxed whitespace-pre-line">{selectedTicket.description}</p>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold text-slate-500 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                <div>
                  <p>Client Name: <span className="text-slate-800 font-bold">{selectedTicket.clientName}</span></p>
                  <p className="mt-1">Client Email: <span className="text-slate-800 font-mono">{selectedTicket.clientEmail}</span></p>
                </div>
                <div>
                  <p>Created Date: <span className="text-slate-800 font-bold">{selectedTicket.createdDate}</span></p>
                  <p className="mt-1">Last Update: <span className="text-slate-800 font-bold">{selectedTicket.lastUpdated}</span></p>
                </div>
              </div>

              {/* Status Update Options */}
              <div className="space-y-1.5">
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black">Change Ticket Status</label>
                <div className="flex gap-2">
                  {(['open', 'in_progress', 'resolved', 'closed'] as Ticket['status'][]).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleTicketStatusChange(selectedTicket.id, st)}
                      className={`px-3 py-1.5 border rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                        selectedTicket.status === st
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="px-5 py-2 bg-slate-900 hover:bg-black text-white font-extrabold uppercase rounded-xl cursor-pointer"
                >
                  Close Manager
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
