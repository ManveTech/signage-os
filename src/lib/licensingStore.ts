import { pushToDatabase, generatePocketBaseId, PushResult } from './syncHelper';

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
  razorpayKeyId?: string;
}

const DEFAULT_BUSINESS_DETAILS: BusinessDetails = {
  name: "SignageOS Technologies Ltd.",
  address: "123 Demo Street, Bengaluru, Karnataka - 560001",
  gstNumber: "29AAAAA1111A1Z1",
  logoUrl: "",
  contactEmail: "billing@demo.com",
  contactPhone: "+91 99999 99999",
  razorpayKeyId: "rzp_live_demo83920194"
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

  createLicense(license: Omit<License, 'createdAt' | 'status'> & { status?: License['status'] }): License {
    const licenses = this.getLicenses();
    const newLicense: License = {
      ...license,
      id: license.id && license.id.length === 15 ? license.id : generatePocketBaseId(),
      status: license.status || 'pending_payment',
      createdAt: new Date().toISOString().split('T')[0]
    };
    licenses.push(newLicense);
    this.saveLicenses(licenses);
    pushToDatabase('licenses', newLicense.id, newLicense, 'POST');
    return newLicense;
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

  addInvoice(invoice: Invoice) {
    const invoices = this.getInvoices();
    const newInvoice: Invoice = {
      ...invoice,
      id: invoice.id && invoice.id.length === 15 ? invoice.id : generatePocketBaseId()
    };
    invoices.unshift(newInvoice);
    this.saveInvoices(invoices);
    pushToDatabase('invoices', newInvoice.id, newInvoice, 'POST');
  },

  getBusinessDetails(): BusinessDetails {
    const data = localStorage.getItem('signageos_business_details');
    if (!data) {
      localStorage.setItem('signageos_business_details', JSON.stringify(DEFAULT_BUSINESS_DETAILS));
      return DEFAULT_BUSINESS_DETAILS;
    }
    return JSON.parse(data);
  },

  saveBusinessDetails(details: BusinessDetails) {
    localStorage.setItem('signageos_business_details', JSON.stringify(details));
  }
};
