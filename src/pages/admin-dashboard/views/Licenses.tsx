import React, { useState, useEffect } from 'react';
import { 
  Key, Plus, Clock, UserPlus, Trash2, Edit2, ShieldAlert, CheckCircle, 
  XCircle, Receipt, FileText, Send, Building, ShieldCheck, Mail, MapPin, 
  Phone, Globe, Image as ImageIcon, CreditCard
} from 'lucide-react';
import { licensingStore, License, PaymentRecord, Invoice, BusinessDetails } from '../../../lib/licensingStore';
import { syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';

type Tab = 'management' | 'payments' | 'expirations' | 'invoices';

const statusColors: Record<License['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  expired: 'bg-rose-50 text-rose-700 border-rose-100',
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-100',
};

export default function Licenses({ activeTab: initTab = 'management', onNavigate }: { activeTab?: Tab; onNavigate?: (view: string) => void }) {
  const [tab, setTab] = useState<Tab>(initTab);

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (onNavigate) {
      onNavigate(`licenses-${newTab}`);
    }
  };

  const [licenses, setLicenses] = useState<License[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [businessDetails, setBusinessDetails] = useState<BusinessDetails | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [currentLicense, setCurrentLicense] = useState<License | null>(null);

  // Form states (Create)
  const [newLicId, setNewLicId] = useState('');
  const [newLicName, setNewLicName] = useState('');
  const [newLicPrice, setNewLicPrice] = useState(1000);
  const [newLicTenure, setNewLicTenure] = useState<'monthly' | 'yearly'>('monthly');
  const [newLicOrg, setNewLicOrg] = useState('');
  const [newLicUserEmail, setNewLicUserEmail] = useState('');
  const [newLicExpiry, setNewLicExpiry] = useState('');
  const [newLicStorage, setNewLicStorage] = useState(5);
  const [newLicDevice, setNewLicDevice] = useState(5);
  const [newLicWhiteLabel, setNewLicWhiteLabel] = useState(false);

  // Form states (Edit)
  const [editLicName, setEditLicName] = useState('');
  const [editLicPrice, setEditLicPrice] = useState(1000);
  const [editLicTenure, setEditLicTenure] = useState<'monthly' | 'yearly'>('monthly');
  const [editLicOrg, setEditLicOrg] = useState('');
  const [editLicUserEmail, setEditLicUserEmail] = useState('');
  const [editLicExpiry, setEditLicExpiry] = useState('');
  const [editLicStatus, setEditLicStatus] = useState<License['status']>('active');
  const [editLicStorage, setEditLicStorage] = useState(5);
  const [editLicDevice, setEditLicDevice] = useState(5);
  const [editLicWhiteLabel, setEditLicWhiteLabel] = useState(false);

  // Business settings state
  const [bizName, setBizName] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizGst, setBizGst] = useState('');
  const [bizLogo, setBizLogo] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizRzpKey, setBizRzpKey] = useState('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setTab(initTab);
  }, [initTab]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // Sync from server first so localStorage is up to date
    await Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('payments', 'signageos_payments'),
      syncCollection('invoices', 'signageos_invoices'),
      syncCollection('users', 'signageos_users'),
      syncCollection('organizations', 'signageos_organizations'),
    ]);

    setLicenses(licensingStore.getLicenses());
    setPayments(licensingStore.getPayments());
    setInvoices(licensingStore.getInvoices());
    const biz = licensingStore.getBusinessDetails();
    setBusinessDetails(biz);
    if (biz) {
      setBizName(biz.name);
      setBizAddress(biz.address);
      setBizGst(biz.gstNumber);
      setBizLogo(biz.logoUrl);
      setBizEmail(biz.contactEmail);
      setBizPhone(biz.contactPhone);
      setBizRzpKey(biz.razorpayKeyId || '');
    }

    const storedUsers = localStorage.getItem('signageos_users');
    setUsers(storedUsers ? JSON.parse(storedUsers) : []);
    const storedOrgs = localStorage.getItem('signageos_organizations');
    setOrganizations(storedOrgs ? JSON.parse(storedOrgs) : []);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleCreateLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLicId || !newLicName) {
      toast.warning('Please fill out ID and Name');
      return;
    }

    const org = organizations.find(o => o.id === newLicOrg);
    const user = users.find(u => u.email === newLicUserEmail);

    const generatedExpiry = newLicExpiry || (newLicTenure === 'monthly' ? '2026-07-02' : '2027-06-02');

    licensingStore.createLicense({
      id: newLicId.toUpperCase(),
      name: newLicName,
      price: Number(newLicPrice),
      tenure: newLicTenure,
      assignedOrgId: org?.id,
      assignedOrgName: org?.name,
      assignedUserEmail: newLicUserEmail || user?.email,
      expiryDate: generatedExpiry,
      status: newLicUserEmail ? 'pending_payment' : 'active', // If assigned, make it pending payment so they checkout
      storageLimit: Number(newLicStorage),
      deviceLimit: Number(newLicDevice),
      whiteLabel: newLicWhiteLabel
    });

    // Auto-generate unpaid invoice if assigned to a user
    if (newLicUserEmail) {
      const clientName = user?.name || org?.adminName || 'Valued Client';
      const amountWithGst = Math.round(Number(newLicPrice) * 1.18);
      licensingStore.addInvoice({
        id: `INV-AUTO-${Math.floor(1000 + Math.random() * 9000)}`,
        licenseId: newLicId.toUpperCase(),
        licenseName: newLicName,
        clientName,
        clientEmail: newLicUserEmail,
        amount: amountWithGst,
        dueDate: generatedExpiry,
        status: 'unpaid',
        issuedDate: new Date().toISOString().split('T')[0]
      });
    }

    showToast(`License ${newLicId.toUpperCase()} created successfully!`);
    setIsCreateModalOpen(false);
    // Reset fields
    setNewLicId('');
    setNewLicName('');
    setNewLicPrice(1000);
    setNewLicTenure('monthly');
    setNewLicOrg('');
    setNewLicUserEmail('');
    setNewLicExpiry('');
    setNewLicStorage(5);
    setNewLicDevice(5);
    setNewLicWhiteLabel(false);
    loadData();
  };

  const openEditModal = (lic: License) => {
    setCurrentLicense(lic);
    setEditLicName(lic.name);
    setEditLicPrice(lic.price);
    setEditLicTenure(lic.tenure);
    setEditLicOrg(lic.assignedOrgId || '');
    setEditLicUserEmail(lic.assignedUserEmail || '');
    setEditLicExpiry(lic.expiryDate);
    setEditLicStatus(lic.status);
    setEditLicStorage(lic.storageLimit || 5);
    setEditLicDevice(lic.deviceLimit || 5);
    setEditLicWhiteLabel(lic.whiteLabel || false);
    setIsEditModalOpen(true);
  };

  const handleEditLicense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLicense) return;

    const org = organizations.find(o => o.id === editLicOrg);
    const user = users.find(u => u.email === editLicUserEmail);

    // If price or tenure changes, it's a "rework" - we update the checkout status to pending payment
    const pricingChanged = editLicPrice !== currentLicense.price || editLicTenure !== currentLicense.tenure;
    let statusUpdate = editLicStatus;

    if (pricingChanged) {
      statusUpdate = 'pending_payment';
      // Create a fresh unpaid invoice for the new pricing structure
      const clientName = user?.name || org?.adminName || 'Valued Client';
      const amountWithGst = Math.round(Number(editLicPrice) * 1.18);
      licensingStore.addInvoice({
        id: `INV-REWORK-${Math.floor(1000 + Math.random() * 9000)}`,
        licenseId: currentLicense.id,
        licenseName: editLicName,
        clientName,
        clientEmail: editLicUserEmail || currentLicense.assignedUserEmail || 'billing@client.com',
        amount: amountWithGst,
        dueDate: editLicExpiry,
        status: 'unpaid',
        issuedDate: new Date().toISOString().split('T')[0]
      });
      showToast(`Pricing updated! License set to pending payment and new invoice sent.`);
    } else {
      showToast(`License ${currentLicense.id} updated successfully!`);
    }

    licensingStore.updateLicense(currentLicense.id, {
      name: editLicName,
      price: Number(editLicPrice),
      tenure: editLicTenure,
      assignedOrgId: org?.id,
      assignedOrgName: org?.name,
      assignedUserEmail: editLicUserEmail,
      expiryDate: editLicExpiry,
      status: statusUpdate,
      storageLimit: Number(editLicStorage),
      deviceLimit: Number(editLicDevice),
      whiteLabel: editLicWhiteLabel
    });

    setIsEditModalOpen(false);
    loadData();
  };

  const handleDeleteLicense = (id: string) => {
    if (confirm(`Are you sure you want to delete/revoke License ${id}?`)) {
      licensingStore.deleteLicense(id);
      showToast(`License ${id} revoked.`);
      loadData();
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBizLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveBusinessSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const details: BusinessDetails = {
      name: bizName,
      address: bizAddress,
      gstNumber: bizGst,
      logoUrl: bizLogo,
      contactEmail: bizEmail,
      contactPhone: bizPhone,
      razorpayKeyId: bizRzpKey
    };
    licensingStore.saveBusinessDetails(details);
    showToast("Business & billing settings updated successfully!");
    loadData();
  };

  const sendReminder = (email: string, licenseId: string, itemType: 'license' | 'invoice', extraInfo = '') => {
    showToast(`Billing alert: Automated ${itemType} email sent to ${email} for ${licenseId}!`);
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
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Licensing Command Center</h1>
          <p className="text-xs text-slate-500 font-semibold mt-1">Manage billing schedules, Razorpay invoices, and client access limits</p>
        </div>
        <button 
          onClick={() => {
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            setNewLicId(`LN-BLST-${randomDigits}`);
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 shadow-md shadow-blue-600/10 cursor-pointer"
        >
          <Plus size={15} /> Create New License
        </button>
      </div>



      {/* 1. LICENSE MANAGEMENT */}
      {tab === 'management' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Active License Pool</span>
            <span className="text-xs font-bold text-slate-400">{licenses.length} Total Licenses</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">License ID</th>
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Tenure / Pricing</th>
                  <th className="px-5 py-3.5">Assigned To</th>
                  <th className="px-5 py-3.5">Limits</th>
                  <th className="px-5 py-3.5">Expiry Date</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {licenses.map(lic => (
                  <tr key={lic.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">{lic.id}</td>
                    <td className="px-5 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-800">{lic.name}</p>
                          {lic.whiteLabel && (
                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded text-[9px] font-black uppercase tracking-wider">
                              White Label
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Created: {lic.createdAt}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-900">₹{lic.price.toLocaleString()}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-semibold capitalize">{lic.tenure}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {lic.assignedUserEmail ? (
                        <div>
                          <p className="font-semibold text-slate-700">{lic.assignedOrgName || 'Individual User'}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{lic.assignedUserEmail}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned (Available)</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-[10.5px] text-slate-600 font-semibold space-y-0.5">
                        <p>Storage: <span className="text-slate-900 font-bold">{lic.storageLimit || 5} GB</span></p>
                        <p>Screens: <span className="text-slate-900 font-bold">{lic.deviceLimit || 5} Max</span></p>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{lic.expiryDate}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border tracking-wider ${statusColors[lic.status]}`}>
                        {lic.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-1.5">
                        <button 
                          onClick={() => openEditModal(lic)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Pricing / Tenure"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => handleDeleteLicense(lic.id)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Revoke / Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. PAYMENT HISTORY */}
      {tab === 'payments' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Razorpay Payment Logs</span>
            <span className="text-xs font-bold text-slate-400">{payments.length} Payments Registered</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">License</th>
                  <th className="px-5 py-3.5">Client User</th>
                  <th className="px-5 py-3.5">Amount Paid</th>
                  <th className="px-5 py-3.5">Payment Date</th>
                  <th className="px-5 py-3.5">Razorpay Ref</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {payments.map(pmt => (
                  <tr key={pmt.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-800">{pmt.id}</td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-bold text-slate-800">{pmt.licenseName}</p>
                        <p className="text-[10px] font-mono text-slate-400">{pmt.licenseId}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-semibold text-slate-700">{pmt.clientName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{pmt.clientEmail}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-extrabold text-slate-900">₹{pmt.amount.toLocaleString()}</td>
                    <td className="px-5 py-4 font-medium text-slate-500">{pmt.paymentDate}</td>
                    <td className="px-5 py-4">
                      <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                        <p>ID: {pmt.razorpayPaymentId}</p>
                        <p className="text-slate-400">Ord: {pmt.razorpayOrderId}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span className="flex items-center gap-1 text-emerald-600 font-bold uppercase text-[10px] tracking-wider">
                        <CheckCircle size={12} /> Success
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. UPCOMING EXPIRATIONS */}
      {tab === 'expirations' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Expiry Timeline (Next 30 Days)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3.5">License</th>
                  <th className="px-5 py-3.5">Assigned Client</th>
                  <th className="px-5 py-3.5">Pricing</th>
                  <th className="px-5 py-3.5">Expiration Date</th>
                  <th className="px-5 py-3.5">Time Left</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {licenses
                  .filter(l => l.assignedUserEmail) // Only assigned ones
                  .map(lic => {
                    const daysRemaining = Math.ceil(
                      (new Date(lic.expiryDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24)
                    );
                    return { lic, daysRemaining };
                  })
                  .filter(item => item.daysRemaining < 10) // only show expirations below 10 days
                  .sort((a, b) => a.daysRemaining - b.daysRemaining) // sort ascending of days left
                  .map(({ lic, daysRemaining }) => {
                    const isExpiringSoon = daysRemaining <= 30;
                    const isOverdue = daysRemaining < 0;

                    return (
                      <tr key={lic.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-bold text-slate-800">{lic.name}</p>
                            <p className="text-[10px] font-mono text-blue-600 font-semibold">{lic.id}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-700">{lic.assignedOrgName || 'Direct Client'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{lic.assignedUserEmail}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-bold text-slate-800">₹{lic.price.toLocaleString()}</span>
                          <span className="text-[10px] text-slate-400 ml-1">/ {lic.tenure}</span>
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-slate-700">{lic.expiryDate}</td>
                        <td className="px-5 py-4">
                          {isOverdue ? (
                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-600 font-bold border border-rose-100 text-[10px]">
                              Overdue by {Math.abs(daysRemaining)} days
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 font-bold border border-amber-100 text-[10px]">
                              Expiring in {daysRemaining} days
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 font-semibold border border-emerald-100 text-[10px]">
                              {daysRemaining} days remaining
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => sendReminder(lic.assignedUserEmail!, lic.id, 'license')}
                            className="flex items-center gap-1.5 px-3 py-1.5 ml-auto bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold uppercase rounded-lg transition-colors cursor-pointer"
                          >
                            <Send size={11} /> Send Alert
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. INVOICES & BUSINESS SETTINGS */}
      {tab === 'invoices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Invoices List */}
          <div className="lg:col-span-8 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Billing Invoice Registry</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-gray-50/50 border-b border-gray-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="px-5 py-3.5">Invoice ID</th>
                    <th className="px-5 py-3.5">Client User</th>
                    <th className="px-5 py-3.5">License</th>
                    <th className="px-5 py-3.5">Total Amount</th>
                    <th className="px-5 py-3.5">Due Date</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-slate-800">{inv.id}</td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-semibold text-slate-700">{inv.clientName}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{inv.clientEmail}</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-600">{inv.licenseName}</td>
                      <td className="px-5 py-4">
                        <div>
                          <p className="font-extrabold text-slate-900">₹{inv.amount.toLocaleString()}</p>
                          <p className="text-[9px] text-slate-400">Includes 18% GST</p>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono font-medium text-slate-500">{inv.dueDate}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-0.5 rounded-full font-black uppercase tracking-wider text-[9px] border ${
                          inv.status === 'paid' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                            : 'bg-rose-50 text-rose-700 border-rose-100 animate-pulse'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {inv.status === 'unpaid' && (
                          <button
                            onClick={() => sendReminder(inv.clientEmail, inv.id, 'invoice')}
                            className="flex items-center gap-1 px-2.5 py-1.5 ml-auto text-[10px] font-black uppercase text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <Send size={10} /> Remind
                          </button>
                        )}
                        {inv.status === 'paid' && (
                          <span className="text-[10px] font-bold text-slate-400 italic">Settled</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Business Settings Form */}
          <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Building size={16} className="text-blue-600" />
              <h2 className="text-xs font-black uppercase text-slate-900 tracking-wider">Business & Invoice Details</h2>
            </div>

            <form onSubmit={handleSaveBusinessSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-450 uppercase tracking-widest font-black mb-1">Registered Business Name</label>
                <input 
                  type="text"
                  value={bizName}
                  onChange={e => setBizName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Billing Address</label>
                <textarea 
                  rows={3}
                  value={bizAddress}
                  onChange={e => setBizAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">GSTIN Number</label>
                <input 
                  type="text"
                  value={bizGst}
                  onChange={e => setBizGst(e.target.value)}
                  placeholder="e.g. 29AAAAA1111A1Z1"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-mono font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Billing Email</label>
                  <input 
                    type="email"
                    value={bizEmail}
                    onChange={e => setBizEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Billing Phone</label>
                  <input 
                    type="text"
                    value={bizPhone}
                    onChange={e => setBizPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Company Logo</label>
                <div className="flex items-center gap-3 mt-1.5">
                  {bizLogo ? (
                    <div className="relative w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center group">
                      <img src={bizLogo} alt="Business Logo" className="w-full h-full object-contain" />
                      <button 
                        type="button"
                        onClick={() => setBizLogo('')}
                        className="absolute inset-0 bg-rose-600/90 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[9px] font-black uppercase tracking-wider transition-opacity cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center text-slate-400">
                      <ImageIcon size={16} />
                    </div>
                  )}
                  <label className="px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex-1 text-center select-none">
                    Select Logo File
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-2.5 bg-slate-900 hover:bg-black text-white text-xs uppercase tracking-wider font-extrabold rounded-lg transition-colors cursor-pointer"
              >
                Save Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn text-left p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Key size={16} className="text-blue-600" /> Create License Profile
              </h2>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateLicense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">License ID / Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. LIC-981"
                  required
                  value={newLicId}
                  onChange={e => setNewLicId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold uppercase placeholder-slate-350 outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Title</label>
                <input 
                  type="text" 
                  placeholder="e.g. Phoenix Mall Entry Display"
                  required
                  value={newLicName}
                  onChange={e => setNewLicName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold placeholder-slate-350 outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Price (INR)</label>
                  <input 
                    type="number" 
                    required
                    value={newLicPrice}
                    onChange={e => setNewLicPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-extrabold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Billing Tenure</label>
                  <select 
                    value={newLicTenure}
                    onChange={e => setNewLicTenure(e.target.value as 'monthly' | 'yearly')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Assign to Organization (Optional)</label>
                <select 
                  value={newLicOrg}
                  onChange={e => setNewLicOrg(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white"
                >
                  <option value="">Do not assign yet</option>
                  {organizations.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Assign User / Billing Email</label>
                <select
                  value={newLicUserEmail}
                  onChange={e => setNewLicUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-white font-mono"
                >
                  <option value="">No Email Assigned (Free to pool)</option>
                  {users.map(u => (
                    <option key={u.email} value={u.email}>{u.email} ({u.name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Storage Limit (GB)</label>
                  <input 
                    type="number" 
                    required
                    value={newLicStorage}
                    onChange={e => setNewLicStorage(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Allowed Screens</label>
                  <input 
                    type="number" 
                    required
                    value={newLicDevice}
                    onChange={e => setNewLicDevice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Expiry Date (Optional)</label>
                <input 
                  type="date" 
                  value={newLicExpiry}
                  onChange={e => setNewLicExpiry(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="newLicWhiteLabel"
                  checked={newLicWhiteLabel}
                  onChange={e => setNewLicWhiteLabel(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="newLicWhiteLabel" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Enable White Labeling (Custom Branding)
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold uppercase rounded-xl cursor-pointer"
                >
                  Confirm & Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-scaleIn text-left p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-black uppercase text-slate-900 flex items-center gap-2">
                <Edit2 size={16} className="text-indigo-600" /> Rework License Settings
              </h2>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>


            <form onSubmit={handleEditLicense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">License ID</label>
                <input 
                  type="text" 
                  value={currentLicense?.id} 
                  disabled 
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold uppercase outline-none bg-gray-100 text-gray-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Title</label>
                <input 
                  type="text" 
                  value={editLicName}
                  onChange={e => setEditLicName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-semibold outline-none focus:border-blue-500 bg-slate-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Price (INR)</label>
                  <input 
                    type="number" 
                    value={editLicPrice}
                    onChange={e => setEditLicPrice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-extrabold outline-none focus:border-blue-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Billing Tenure</label>
                  <select 
                    value={editLicTenure}
                    onChange={e => setEditLicTenure(e.target.value as 'monthly' | 'yearly')}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Assign User / Billing Email</label>
                <select
                  value={editLicUserEmail}
                  onChange={e => setEditLicUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-white font-mono"
                >
                  <option value="">No Email Assigned (Free to pool)</option>
                  {users.map(u => (
                    <option key={u.email} value={u.email}>{u.email} ({u.name})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Storage Limit (GB)</label>
                  <input 
                    type="number" 
                    required
                    value={editLicStorage}
                    onChange={e => setEditLicStorage(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Allowed Screens</label>
                  <input 
                    type="number" 
                    required
                    value={editLicDevice}
                    onChange={e => setEditLicDevice(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Expiration Date</label>
                  <input 
                    type="date" 
                    value={editLicExpiry}
                    onChange={e => setEditLicExpiry(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl outline-none focus:border-indigo-500 bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-455 uppercase tracking-widest font-black mb-1">Status</label>
                  <select 
                    value={editLicStatus}
                    onChange={e => setEditLicStatus(e.target.value as License['status'])}
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl font-bold outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="pending_payment">Pending Payment</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 py-1">
                <input 
                  type="checkbox" 
                  id="editLicWhiteLabel"
                  checked={editLicWhiteLabel}
                  onChange={e => setEditLicWhiteLabel(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="editLicWhiteLabel" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Enable White Labeling (Custom Branding)
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button 
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold uppercase rounded-xl cursor-pointer"
                >
                  Apply & Rework
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
