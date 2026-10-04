import { pushToDatabase, generatePocketBaseId, PushResult, getHeaders } from './syncHelper';
import { API_BASE } from '../config';

export interface License {
  id: string;
  name: string;
  assignedOrgId?: string;
  assignedOrgName?: string;
  assignedUserEmail?: string;
  price: number;
  tenure: 'monthly' | 'yearly';
  status: 'active' | 'expired' | 'pending_payment';
  expiryDate: string;
  createdAt: string;
  storageLimit: number; // in GB
  deviceLimit: number; // number of screens
  whiteLabel?: boolean;
  enableVideoConferencing?: boolean;
}

export interface PaymentRecord {
  id: string;
  licenseId: string;
  licenseName: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  paymentDate: string;
  status: 'success' | 'failed';
  razorpayPaymentId: string;
  razorpayOrderId: string;
}

export interface Invoice {
  id: string;
  licenseId: string;
  licenseName: string;
  clientName: string;
  clientEmail: string;
  amount: number;
  dueDate: string;
  status: 'paid' | 'unpaid';
  issuedDate: string;
}

export interface BusinessDetails {
  name: string;
  address: string;
  gstNumber: string;
  logoUrl: string;
  contactEmail: string;
  contactPhone: string;
}

// Empty until the admin fills in Licensing → Invoices → Billing details.
// (These used to be demo values — "123 Demo Street", a sample GSTIN — which
// is what every client saw on their invoices.)
const DEFAULT_BUSINESS_DETAILS: BusinessDetails = {
  name: '',
  address: '',
  gstNumber: '',
  logoUrl: '',
  contactEmail: '',
  contactPhone: ''
};

const INITIAL_LICENSES: License[] = [];

const INITIAL_PAYMENTS: PaymentRecord[] = [];

const INITIAL_INVOICES: Invoice[] = [];

export const licensingStore = {
  getLicenses(): License[] {
    const data = localStorage.getItem('signageos_licenses');
    if (!data) {
      localStorage.setItem('signageos_licenses', JSON.stringify(INITIAL_LICENSES));
      return INITIAL_LICENSES;
    }
    return JSON.parse(data);
  },

  saveLicenses(licenses: License[]) {
    localStorage.setItem('signageos_licenses', JSON.stringify(licenses));
  },

  /** Saves locally and waits for the server — the caller reports a failed save. */
  async createLicense(license: Omit<License, 'createdAt' | 'status'> & { status?: License['status'] }): Promise<{ license: License; result: PushResult }> {
    const licenses = this.getLicenses();
    const newLicense: License = {
      ...license,
      id: license.id && license.id.length === 15 ? license.id : generatePocketBaseId(),
      status: license.status || 'pending_payment',
      createdAt: new Date().toISOString().split('T')[0]
    };
    licenses.push(newLicense);
    this.saveLicenses(licenses);
    const result = await pushToDatabase('licenses', newLicense.id, newLicense, 'POST');
    if (result.ok === false) this.saveLicenses(this.getLicenses().filter(l => l.id !== newLicense.id));
    return { license: newLicense, result };
  },

  async updateLicense(id: string, updates: Partial<Omit<License, 'id' | 'createdAt'>>): Promise<PushResult> {
    const licenses = this.getLicenses();
    const index = licenses.findIndex(l => l.id === id);
    if (index !== -1) {
      licenses[index] = { ...licenses[index], ...updates };
      this.saveLicenses(licenses);
      return await pushToDatabase('licenses', id, licenses[index], 'PUT');
    }
    return { ok: false, status: 404, error: 'License not found' };
  },

  deleteLicense(id: string) {
    const licenses = this.getLicenses();
    const filtered = licenses.filter(l => l.id !== id);
    this.saveLicenses(filtered);
    pushToDatabase('licenses', id, null, 'DELETE');
  },

  getPayments(): PaymentRecord[] {
    const data = localStorage.getItem('signageos_payments');
    if (!data) {
      localStorage.setItem('signageos_payments', JSON.stringify(INITIAL_PAYMENTS));
      return INITIAL_PAYMENTS;
    }
    return JSON.parse(data);
  },

  addPayment(payment: PaymentRecord) {
    const payments = this.getPayments();
    const newPayment: PaymentRecord = {
      ...payment,
      id: payment.id && payment.id.length === 15 ? payment.id : generatePocketBaseId()
    };
    payments.unshift(newPayment); // Add to the top
    localStorage.setItem('signageos_payments', JSON.stringify(payments));
    pushToDatabase('payments', newPayment.id, newPayment, 'POST');
  },

  getInvoices(): Invoice[] {
    const data = localStorage.getItem('signageos_invoices');
    if (!data) {
      localStorage.setItem('signageos_invoices', JSON.stringify(INITIAL_INVOICES));
      return INITIAL_INVOICES;
    }
    return JSON.parse(data);
  },

  saveInvoices(invoices: Invoice[]) {
    localStorage.setItem('signageos_invoices', JSON.stringify(invoices));
  },

  async addInvoice(invoice: Invoice): Promise<PushResult> {
    const invoices = this.getInvoices();
    const newInvoice: Invoice = {
      ...invoice,
      id: invoice.id && invoice.id.length === 15 ? invoice.id : generatePocketBaseId()
    };
    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    const result = await pushToDatabase('invoices', newInvoice.id, newInvoice, 'POST');
    if (result.ok === false) this.saveInvoices(this.getInvoices().filter(i => i.id !== newInvoice.id));
    return result;
  },

  /** Last known billing details (cached copy of GET /business-details). */
  getBusinessDetails(): BusinessDetails {
    try {
      const data = localStorage.getItem('signageos_business_details');
      return data ? { ...DEFAULT_BUSINESS_DETAILS, ...JSON.parse(data) } : DEFAULT_BUSINESS_DETAILS;
    } catch {
      return DEFAULT_BUSINESS_DETAILS;
    }
  },

  /**
   * Billing details from the server — shared by the admin and every client.
   * They used to be saved only in the admin's own browser. Falls back to the
   * cached copy when offline.
   */
  async fetchBusinessDetails(): Promise<BusinessDetails> {
    try {
      const res = await fetch(`${API_BASE}/business-details`, { headers: getHeaders() });
      if (res.ok) {
        const details = { ...DEFAULT_BUSINESS_DETAILS, ...(await res.json()) };
        localStorage.setItem('signageos_business_details', JSON.stringify(details));
        return details;
      }
    } catch { /* offline — use cache */ }
    return this.getBusinessDetails();
  },

  async saveBusinessDetails(details: BusinessDetails): Promise<PushResult> {
    try {
      const res = await fetch(`${API_BASE}/business-details`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(details)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { ok: false, status: res.status, error: body.message || body.error || `Request failed (${res.status})` };
      }
      localStorage.setItem('signageos_business_details', JSON.stringify(details));
      return { ok: true, status: res.status, data: details };
    } catch {
      return { ok: false, status: 0, error: "Can't reach the server" };
    }
  },

  getUserLicense(userEmail: string): License | null {
    if (!userEmail) return null;
    const licenses = this.getLicenses();
    const cleanEmail = userEmail.toLowerCase().trim();
    return licenses.find(l => l.assignedUserEmail && l.assignedUserEmail.toLowerCase().trim() === cleanEmail) || null;
  },

  getUserPayments(userEmail: string): PaymentRecord[] {
    if (!userEmail) return [];
    const payments = this.getPayments();
    const cleanEmail = userEmail.toLowerCase().trim();
    return payments.filter(p => p.clientEmail && p.clientEmail.toLowerCase().trim() === cleanEmail);
  },

  getUserInvoices(userEmail: string): Invoice[] {
    if (!userEmail) return [];
    const invoices = this.getInvoices();
    const cleanEmail = userEmail.toLowerCase().trim();
    return invoices.filter(i => i.clientEmail && i.clientEmail.toLowerCase().trim() === cleanEmail);
  },

  async updateInvoiceStatus(invoiceId: string, status: 'paid' | 'unpaid'): Promise<PushResult> {
    const invoices = this.getInvoices();
    const index = invoices.findIndex(i => i.id === invoiceId);
    if (index !== -1) {
      invoices[index].status = status;
      this.saveInvoices(invoices);
      return await pushToDatabase('invoices', invoiceId, invoices[index], 'PUT');
    }
    return { ok: false, status: 404, error: 'Invoice not found' };
  }
};
