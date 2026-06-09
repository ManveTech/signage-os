import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, BookOpen, HelpCircle, ChevronDown, ChevronUp, Send, 
  Plus, CheckCircle, Search, Clock, FileText, ShieldAlert, Image as ImageIcon
} from 'lucide-react';
import { supportStore, Ticket, FAQ, SupportDoc } from '../../../lib/supportStore';
import { syncCollection } from '../../../lib/syncHelper';

type Tab = 'tickets' | 'help';

const statusColors: Record<Ticket['status'], string> = {
  open: 'bg-rose-50 text-rose-700 border-rose-100',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-100 animate-pulse',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  closed: 'bg-gray-100 text-gray-500 border-gray-200',
};

const priorityColors: Record<Ticket['priority'], string> = {
  high: 'text-rose-600 font-extrabold',
  medium: 'text-amber-600 font-bold',
  low: 'text-slate-500 font-semibold',
};

interface Props {
  activeTab?: Tab;
  userEmail?: string;
  onNavigate?: (view: string) => void;
}

export default function Support({ activeTab = 'tickets', userEmail = 'priya@demo.com', onNavigate }: Props) {
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

  // Accordion faq states
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  // New ticket form states
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketPriority, setTicketPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [ticketDescription, setTicketDescription] = useState('');

  // Selected doc for viewing details
  const [selectedDoc, setSelectedDoc] = useState<SupportDoc | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadData();
  }, [userEmail]);

  const loadData = async () => {
    await Promise.all([
      syncCollection('tickets', 'signageos_tickets'),
      syncCollection('faqs', 'signageos_faqs'),
      syncCollection('support_docs', 'signageos_docs'),
    ]);
    // Filter tickets raised by this client email
    const allTickets = supportStore.getTickets();
    const clientTickets = allTickets.filter(t => t.clientEmail === userEmail);
    setTickets(clientTickets);

    setFaqs(supportStore.getFAQs());
    setDocs(supportStore.getDocs());
  };

  const handleRaiseTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject || !ticketDescription) return;

    // Retrieve nice name from email prefix
    const namePrefix = userEmail.split('@')[0];
    const clientName = namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1);

    supportStore.createTicket({
      subject: ticketSubject,
      description: ticketDescription,
      priority: ticketPriority,
      status: 'open',
      clientEmail: userEmail,
      clientName: clientName
    });

    showToast('Support ticket raised successfully!');
    setTicketSubject('');
    setTicketPriority('medium');
    setTicketDescription('');
    setShowNewTicket(false);
    loadData();
  };

  return (
    <div className="p-6 space-y-6 text-left relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border border-slate-700 animate-slideIn z-50">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
          <p className="text-sm text-gray-500 mt-0.5">Browse support guides or open a ticket with our executive team</p>
        </div>
        {tab === 'tickets' && !showNewTicket && (
          <button 
            onClick={() => setShowNewTicket(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={15} /> Raise Support Ticket
          </button>
        )}
      </div>


      {/* 1. TICKETS TAB */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {/* New Ticket Form Panel */}
          {showNewTicket && (
            <div className="bg-white rounded-2xl border border-blue-100 p-6 shadow-xs space-y-4 animate-fadeIn">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-600" /> Raise New Ticket
              </h2>
              <form onSubmit={handleRaiseTicket} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Subject / Summary</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Brief description of the issue"
                      value={ticketSubject}
                      onChange={e => setTicketSubject(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority</label>
                    <select 
                      value={ticketPriority}
                      onChange={e => setTicketPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white font-bold"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Detailed Description</label>
                  <textarea 
                    rows={4} 
                    required
                    placeholder="Describe what occurred, steps to reproduce, and any details that might assist troubleshooting..."
                    value={ticketDescription}
                    onChange={e => setTicketDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-400 resize-none font-medium leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowNewTicket(false)} 
                    className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 font-bold"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="px-4 py-2 font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={13} /> Submit Ticket
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Ticket Listing */}
          <div className="space-y-3.5">
            {tickets.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-slate-400 italic">
                You haven't opened any support tickets yet. Click "Raise Support Ticket" to report an issue.
              </div>
            ) : (
              tickets.map(ticket => (
                <div key={ticket.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-xs transition-shadow space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10.5px] font-mono text-gray-400 font-bold">{ticket.id}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase border tracking-wider ${statusColors[ticket.status]}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">{ticket.subject}</h3>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-700 capitalize`}>
                      Priority: <span className={priorityColors[ticket.priority].split(' ')[0]}>{ticket.priority}</span>
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-600 leading-relaxed bg-gray-50/50 p-3 rounded-lg border border-gray-100 whitespace-pre-line font-medium">{ticket.description}</p>
                  
                  <div className="flex items-center justify-between text-[10px] text-gray-400 font-semibold pt-1 border-t border-gray-50">
                    <span>Opened: {ticket.createdDate}</span>
                    <span>Last Activity: {ticket.lastUpdated}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2. HELP CENTER TAB */}
      {tab === 'help' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Support Documents Articles list */}
          <div className="lg:col-span-8 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><BookOpen size={16} className="text-indigo-600" /> Platform Documentation</h2>
            
            {docs.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center text-slate-400 italic">
                No guides are currently published by the system administrator.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {docs.map(doc => (
                  <div 
                    key={doc.id} 
                    onClick={() => setSelectedDoc(doc)}
                    className={`bg-white rounded-2xl border p-5 shadow-xs cursor-pointer hover:border-indigo-400 hover:shadow-sm transition-all text-left flex flex-col justify-between min-h-[160px] ${
                      selectedDoc?.id === doc.id ? 'ring-2 ring-indigo-500 border-transparent' : 'border-slate-150'
                    }`}
                  >
                    <div className="space-y-2">
                      <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">{doc.category}</span>
                      <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">{doc.title}</h3>
                      <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed">{doc.content}</p>
                    </div>
                    <span className="text-[9px] text-indigo-600 font-extrabold flex items-center gap-1 mt-3">Read Article &rarr;</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Document Full View */}
            {selectedDoc && (
              <div className="bg-white border border-indigo-100 rounded-2xl p-6 space-y-4 shadow-sm animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded text-[9px] font-black uppercase tracking-wider">{selectedDoc.category}</span>
                    <h3 className="text-base font-black text-slate-900 mt-2">{selectedDoc.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedDoc(null)}
                    className="text-slate-400 hover:text-slate-600 font-extrabold text-sm p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                </div>
                
                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line font-medium">{selectedDoc.content}</p>

                {/* Images uploaded by admin are shown at the bottom here */}
                {selectedDoc.images && selectedDoc.images.length > 0 && (
                  <div className="space-y-2 border-t border-slate-100 pt-4">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-wider flex items-center gap-1">
                      <ImageIcon size={12} className="text-indigo-600" /> Attached Screenshots & Diagrams
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {selectedDoc.images.map((img, index) => (
                        <div key={index} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-video flex items-center justify-center shadow-2xs hover:scale-[1.03] transition-transform">
                          <img src={img} alt="Screenshot guide" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* FAQ Accordion Side panel */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><HelpCircle size={16} className="text-blue-600" /> Frequently Asked Questions</h2>
            
            {faqs.length === 0 ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-6 text-center text-slate-400 italic">
                No FAQs available.
              </div>
            ) : (
              <div className="space-y-2.5">
                {faqs.map(faq => {
                  const isOpen = openFaqId === faq.id;
                  return (
                    <div key={faq.id} className="bg-white rounded-xl border border-slate-150 overflow-hidden transition-all duration-150">
                      <button 
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        className="w-full flex items-start justify-between p-4 text-left gap-3"
                      >
                        <span className="text-xs font-extrabold text-slate-800 leading-snug">{faq.question}</span>
                        {isOpen ? <ChevronUp size={14} className="text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown size={14} className="text-slate-400 shrink-0 mt-0.5" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 text-[11.5px] text-slate-600 border-t border-slate-50 pt-2.5 leading-relaxed font-semibold">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
