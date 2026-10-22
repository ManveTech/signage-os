import { pushToDatabase, generatePocketBaseId, PushResult } from './syncHelper';
import { apiPost } from './screenActions';
import { API_BASE } from '../config';
import { getAuthToken } from './authStorage';

export interface TicketMessage {
  id: string;
  from: 'support' | 'client';
  authorName?: string;
  text: string;
  at: string;
}

export interface Ticket {
  id: string;
  /** Replies after the original description, oldest first. */
  messages?: TicketMessage[];
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
  sortOrder?: number;
}

/** A highlight on a guide screenshot, in percent of the image. Numbered by position. */
export interface GuideMark {
  kind: 'box' | 'arrow';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GuideStep {
  /** Refers to the marks as (1), (2)… */
  text: string;
  image?: string;
  imageW?: number;
  imageH?: number;
  marks?: GuideMark[];
}

export interface SupportDoc {
  id: string;
  title: string;
  category: string;
  /** The summary on step-by-step guides; the whole text on simple ones. */
  content: string;
  images: string[]; // base64 strings
  youtubeUrl?: string;
  steps?: GuideStep[];
  tips?: string[];
  sortOrder?: number;
  createdDate: string;
}

/** Guide categories, in the order the Help Center shows them. */
export const HELP_CATEGORIES = ['Getting started', 'Screens', 'Content', 'Plan & billing', 'Troubleshooting', 'General'];

/** Admin's order first (sortOrder), then oldest first, so new ones land at the end. */
export function byHelpOrder<T extends { sortOrder?: number; created?: string; createdDate?: string }>(a: T, b: T): number {
  const ao = a.sortOrder ?? Number.MAX_SAFE_INTEGER, bo = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return String((a as any).created || a.createdDate || '').localeCompare(String((b as any).created || b.createdDate || ''));
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
      lastUpdated: new Date().toISOString(),
      messages: []
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
      tickets[index] = { ...tickets[index], status, lastUpdated: new Date().toISOString() };
      this.saveTickets(tickets);
      pushToDatabase('tickets', id, tickets[index], 'PUT');
    }
  },

  /** Admin only — the server refuses anyone else. */
  async deleteTicket(id: string): Promise<PushResult> {
    const res = await pushToDatabase('tickets', id, null, 'DELETE');
    if (res.ok) this.saveTickets(this.getTickets().filter(t => t.id !== id));
    return res;
  },

  /**
   * Reply on a ticket (and/or change its status) through the server, which
   * also emails the client when support replies. See
   * server/controllers/tickets.ts.
   */
  async postMessage(id: string, body: { text?: string; status?: Ticket['status'] }): Promise<Ticket> {
    const updated: Ticket = await apiPost(`/tickets/${id}/messages`, body);
    const tickets = this.getTickets().map(t => (t.id === id ? { ...t, ...updated } : t));
    this.saveTickets(tickets);
    return tickets.find(t => t.id === id) || updated;
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

  async updateFAQ(id: string, faq: Omit<FAQ, 'id'>): Promise<PushResult> {
    const faqs = this.getFAQs().map(f => (f.id === id ? { ...f, ...faq } : f));
    this.saveFAQs(faqs);
    return pushToDatabase('faqs', id, { id, ...faq }, 'PUT');
  },

  deleteFAQ(id: string) {
    const faqs = this.getFAQs();
    const filtered = faqs.filter(f => f.id !== id);
    this.saveFAQs(filtered);
    pushToDatabase('faqs', id, null, 'DELETE');
  },

  /** Adds the standard guides and FAQs; skips any whose title or question already exists. */
  async addDefaultHelp(): Promise<{ guides: number; faqs: number }> {
    return apiPost('/help/defaults', {});
  },

  /** Uploads a guide screenshot and returns its URL. */
  async uploadHelpImage(file: File): Promise<string> {
    const res = await fetch(`${API_BASE}/help/images`, {
      method: 'POST',
      headers: { 'Content-Type': file.type, ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) },
      credentials: 'include',
      body: file,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Upload failed (${res.status})`);
    return data.url;
  },

  getDocs(): SupportDoc[] {
    // Guides from the database, edited in the admin Helpdesk. This used to
    // seed a "Using YouTube Videos" guide for a feature the platform doesn't
    // have — browsers that still hold it drop it.
    const data = localStorage.getItem('signageos_docs');
    const docs: SupportDoc[] = data ? JSON.parse(data) : [];
    return docs.filter(d => d.id !== 'youtube-guide-doc');
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

  async updateDoc(id: string, doc: Partial<Omit<SupportDoc, 'id' | 'createdDate'>>): Promise<PushResult> {
    const docs = this.getDocs().map(d => (d.id === id ? { ...d, ...doc } : d));
    this.saveDocs(docs);
    const full = docs.find(d => d.id === id);
    return pushToDatabase('support_docs', id, full, 'PUT');
  },

  deleteDoc(id: string) {
    const docs = this.getDocs();
    const filtered = docs.filter(d => d.id !== id);
    this.saveDocs(filtered);
    pushToDatabase('support_docs', id, null, 'DELETE');
  }
};
