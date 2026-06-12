import { pushToDatabase, generatePocketBaseId } from './syncHelper';

export interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  clientEmail: string;
  clientName: string;
  createdDate: string;
  lastUpdated: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface SupportDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  images: string[]; // base64 strings
  youtubeUrl?: string;
  createdDate: string;
}

const INITIAL_TICKETS: Ticket[] = [];

const INITIAL_FAQS: FAQ[] = [];

const INITIAL_DOCS: SupportDoc[] = [];

export const supportStore = {
  getTickets(): Ticket[] {
    const data = localStorage.getItem('signageos_tickets');
    if (!data) {
      localStorage.setItem('signageos_tickets', JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    return JSON.parse(data);
  },

  saveTickets(tickets: Ticket[]) {
    localStorage.setItem('signageos_tickets', JSON.stringify(tickets));
  },

  createTicket(ticket: Omit<Ticket, 'id' | 'createdDate' | 'lastUpdated'>): Ticket {
    const tickets = this.getTickets();
    const newTicket: Ticket = {
      ...ticket,
      id: generatePocketBaseId(),
      createdDate: new Date().toISOString().split('T')[0],
      lastUpdated: 'Just now'
    };
    tickets.unshift(newTicket);
    this.saveTickets(tickets);
    pushToDatabase('tickets', newTicket.id, newTicket, 'POST');
    return newTicket;
  },

  updateTicketStatus(id: string, status: Ticket['status']) {
    const tickets = this.getTickets();
    const index = tickets.findIndex(t => t.id === id);
    if (index !== -1) {
      tickets[index] = { ...tickets[index], status, lastUpdated: 'Just now' };
      this.saveTickets(tickets);
      pushToDatabase('tickets', id, tickets[index], 'PUT');
    }
  },

  deleteTicket(id: string) {
    const tickets = this.getTickets();
    const filtered = tickets.filter(t => t.id !== id);
    this.saveTickets(filtered);
    pushToDatabase('tickets', id, null, 'DELETE');
  },

  getFAQs(): FAQ[] {
    const data = localStorage.getItem('signageos_faqs');
    if (!data) {
      localStorage.setItem('signageos_faqs', JSON.stringify(INITIAL_FAQS));
      return INITIAL_FAQS;
    }
    return JSON.parse(data);
  },

  saveFAQs(faqs: FAQ[]) {
    localStorage.setItem('signageos_faqs', JSON.stringify(faqs));
  },

  addFAQ(faq: Omit<FAQ, 'id'>): FAQ {
    const faqs = this.getFAQs();
    const newFaq: FAQ = { ...faq, id: generatePocketBaseId() };
    faqs.push(newFaq);
    this.saveFAQs(faqs);
    pushToDatabase('faqs', newFaq.id, newFaq, 'POST');
    return newFaq;
  },

  deleteFAQ(id: string) {
    const faqs = this.getFAQs();
    const filtered = faqs.filter(f => f.id !== id);
    this.saveFAQs(filtered);
    pushToDatabase('faqs', id, null, 'DELETE');
  },

  getDocs(): SupportDoc[] {
    const data = localStorage.getItem('signageos_docs');
    if (!data) {
      const defaultDocs: SupportDoc[] = [{
        id: 'youtube-guide-doc',
        title: 'Using YouTube Videos',
        category: 'Tutorial',
        content: `Supported URLs:
• youtube.com/watch?v=
• youtu.be/

How It Works:
1. Paste YouTube URL
2. System validates link
3. Video added to media library
4. Add to playlist
5. Assigned screens receive update automatically

Notes:
- Internet connection required
- Private videos not supported
- Age restricted videos may not play
- Deleted videos are skipped automatically`,
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        images: [],
        createdDate: new Date().toISOString().split('T')[0]
      }];
      localStorage.setItem('signageos_docs', JSON.stringify(defaultDocs));
      return defaultDocs;
    }
    return JSON.parse(data);
  },

  saveDocs(docs: SupportDoc[]) {
    localStorage.setItem('signageos_docs', JSON.stringify(docs));
  },

  addDoc(doc: Omit<SupportDoc, 'id' | 'createdDate'>): SupportDoc {
    const docs = this.getDocs();
    const newDoc: SupportDoc = {
      ...doc,
      id: generatePocketBaseId(),
      createdDate: new Date().toISOString().split('T')[0]
    };
    docs.unshift(newDoc);
    this.saveDocs(docs);
    pushToDatabase('support_docs', newDoc.id, newDoc, 'POST');
    return newDoc;
  },

  deleteDoc(id: string) {
    const docs = this.getDocs();
    const filtered = docs.filter(d => d.id !== id);
    this.saveDocs(filtered);
    pushToDatabase('support_docs', id, null, 'DELETE');
  }
};
