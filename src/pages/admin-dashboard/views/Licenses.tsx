import { useEffect, useState } from 'react';
import {
  Key, Plus, Search, Edit2, Trash2, Send, Receipt, CreditCard, Building, CheckCircle,
  Image as ImageIcon, Video, Palette, Mail, AlertTriangle, Printer
} from 'lucide-react';
import { API_BASE } from '../../../config';
import { licensingStore, License, PaymentRecord, Invoice, BusinessDetails } from '../../../lib/licensingStore';
import { syncCollection, pushToDatabase } from '../../../lib/syncHelper';
import { isTestPayment, isTestInvoice } from '../../../lib/testPayments';
import { getAuthToken } from '../../../lib/authStorage';
import { apiPost } from '../../../lib/screenActions';
import { toast } from '../../../components/Toast';
import CustomSelect from '../../../components/CustomSelect';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import TaxInvoice from '../../../components/licenses/TaxInvoice';
import { STATE_NAMES, stateFromGstin, withGst, withoutGst, DEFAULT_GST_PERCENT, GST_PRESETS } from '../../../lib/gst';
import {
  licenseState, LicenseStateKey, daysUntil, formatDate, formatInr, relativeDays, defaultExpiry, planLabel, localDate, isRenewalDue
} from '../../../components/licenses/licenseStatus';

type Tab = 'management' | 'expirations' | 'invoices' | 'payments';

const TABS: { key: Tab; label: string }[] = [
  { key: 'management', label: 'Licenses' },
  { key: 'expirations', label: 'Expiring' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'payments', label: 'Payments' },
];

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

function Toggle({ checked, onChange, label, hint, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
      aria-pressed={checked}
    >
      <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
      <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

type FormState = {
  name: string;
  /** Before GST — the client is charged withGst(basePrice, gst). */
  basePrice: number;
  gst: number;
  tenure: 'monthly' | 'yearly';
  email: string;
  expiry: string;
  expiryTouched: boolean;
  storage: number;
  devices: number;
  whiteLabel: boolean;
  videoConferencing: boolean;
  status: License['status'];
  /** New licence for a client: invoice now, or the first period came with the sale. */
  firstPayment: 'now' | 'included';
};

const emptyForm = (): FormState => ({
  name: '', basePrice: 1000, gst: DEFAULT_GST_PERCENT, tenure: 'monthly', email: '', expiry: defaultExpiry('monthly'), expiryTouched: false,
  storage: 5, devices: 5, whiteLabel: false, videoConferencing: false, status: 'active', firstPayment: 'now'
});

export default function Licenses({ activeTab: initTab = 'management', onNavigate }: { activeTab?: Tab; onNavigate?: (view: string) => void }) {
  const [tab, setTab] = useState<Tab>(initTab);
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses());
  const [payments, setPayments] = useState<PaymentRecord[]>(() => licensingStore.getPayments());
  const [invoices, setInvoices] = useState<Invoice[]>(() => licensingStore.getInvoices());
  const [users, setUsers] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_users') || '[]'));
  const [organizations, setOrganizations] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [screens, setScreens] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_screens') || '[]'));

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<LicenseStateKey | 'all'>('all');
  const [invoiceFilter, setInvoiceFilter] = useState<'unpaid' | 'paid' | 'all'>('all');
  // Date range and order for the Invoices and Payments lists (shared by both).
  const [range, setRange] = useState<DateRange>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('newest');

  const [openLicenseId, setOpenLicenseId] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);
  // Deleting test payments / their invoices — the only billing records that can go.
  const [deleteRecord, setDeleteRecord] = useState<{ kind: 'invoice' | 'payment'; ids: string[]; label: string } | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<License | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [revokeTarget, setRevokeTarget] = useState<License | null>(null);
  const [billingOpen, setBillingOpen] = useState(false);
  const [biz, setBiz] = useState<BusinessDetails>(() => licensingStore.getBusinessDetails());
  // The saved details from the server, not just this browser's cached copy —
  // invoices opened on a new device showed none of them (only the state).
  useEffect(() => { licensingStore.fetchBusinessDetails().then(setBiz); }, []);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => { setTab(initTab); }, [initTab]);

  const load = () => {
    setLicenses(licensingStore.getLicenses());
    setInvoices(licensingStore.getInvoices());
    setUsers(JSON.parse(localStorage.getItem('signageos_users') || '[]'));
    setOrganizations(JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
    setScreens(JSON.parse(localStorage.getItem('signageos_screens') || '[]'));
  };

  useEffect(() => {
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('invoices', 'signageos_invoices'),
      syncCollection('users', 'signageos_users'),
      syncCollection('organizations', 'signageos_organizations'),
      syncCollection('screens', 'signageos_screens'),
    ]).finally(load);

    // Payments come from the payment history API (written by the Razorpay
    // verify/webhook handlers); the local list is only a fallback.
    (async () => {
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/payments/history`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (res.ok) {
          const data = await res.json();
          // The server's list, even when empty — falling back to the cached
          // copy here kept showing payments that had been deleted.
          if (Array.isArray(data.items)) {
            setPayments(data.items);
            localStorage.setItem('signageos_payments', JSON.stringify(data.items));
            // Older payments Razorpay just confirmed as tests — their invoices
            // were marked too, so fetch those again.
            if (data.reclassified > 0) syncCollection('invoices', 'signageos_invoices').finally(load);
            return;
          }
        }
      } catch { /* fall back to local */ }
      setPayments(licensingStore.getPayments());
    })();
  }, []);

  const removeRecord = async (r: { kind: 'invoice' | 'payment'; ids: string[]; label: string }) => {
    const coll = r.kind === 'invoice' ? 'invoices' : 'payments';
    const gone: string[] = [];
    for (const id of r.ids) {
      const res = await pushToDatabase(coll, id, null, 'DELETE');
      if (res.ok) gone.push(id);
    }
    if (r.kind === 'invoice') {
      localStorage.setItem('signageos_invoices', JSON.stringify(licensingStore.getInvoices().filter(i => !gone.includes(i.id))));
      setInvoices(list => list.filter(i => !gone.includes(i.id)));
      setOpenInvoiceId(null);
    } else {
      setPayments(list => {
        const next = list.filter(p => !gone.includes(p.id));
        localStorage.setItem('signageos_payments', JSON.stringify(next));
        return next;
      });
      setOpenPaymentId(null);
    }
    setDeleteRecord(null);
    if (gone.length === r.ids.length) toast.success(`Deleted ${gone.length} test ${r.kind}${gone.length === 1 ? '' : 's'}`);
    else toast.error(`Deleted ${gone.length} of ${r.ids.length} — the rest couldn't be deleted`);
  };

  const goTab = (t: Tab) => {
    setTab(t);
    onNavigate?.(`licenses-${t}`);
  };

  const clients = users.filter(u => u.role !== 'admin' && u.role !== 'super_admin');
  const clientName = (email?: string) => clients.find(u => u.email === email)?.name;
  const screensUsed = (email?: string) => (email ? screens.filter(s => s.assignedToUserEmail === email && s.status !== 'pairing' && s.status !== 'unlinked').length : 0);
  const orgFor = (email: string) => {
    const user = clients.find(u => u.email === email);
    const org = organizations.find(o => (o.email || '').toLowerCase() === email.toLowerCase())
      || (user?.company ? organizations.find(o => o.name === user.company) : undefined);
    return { id: org?.id as string | undefined, name: (org?.name || user?.company || undefined) as string | undefined };
  };

  // ── Reminders (real emails, see server/controllers/reminders.ts) ──────────
  const remind = async (body: { licenseId?: string; invoiceId?: string }, key: string) => {
    setSending(key);
    try {
      const res = await apiPost('/payments/remind', body);
      toast.success(`Reminder emailed to ${res.to}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not send the reminder');
    } finally {
      setSending(null);
    }
  };

  // ── Create / edit ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormMode('create');
  };

  const openEdit = (lic: License) => {
    setEditing(lic);
    setForm({
      name: lic.name,
      basePrice: withoutGst(lic.price, lic.gstPercent ?? DEFAULT_GST_PERCENT),
      gst: lic.gstPercent ?? DEFAULT_GST_PERCENT,
      tenure: lic.tenure,
      email: lic.assignedUserEmail || '',
      expiry: lic.expiryDate || defaultExpiry(lic.tenure),
      expiryTouched: true,
      storage: lic.storageLimit || 5,
      devices: lic.deviceLimit || 5,
      whiteLabel: !!lic.whiteLabel,
      videoConferencing: !!lic.enableVideoConferencing,
      status: lic.status,
      firstPayment: 'now',
    });
    setFormMode('edit');
  };

  const setF = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(f => ({ ...f, [key]: value }));

  // What the client pays: the price plus GST at the chosen rate.
  const total = withGst(form.basePrice, form.gst);
  const pricingChanged = !!editing && (total !== editing.price || form.gst !== (editing.gstPercent ?? DEFAULT_GST_PERCENT) || form.tenure !== editing.tenure);

  const issueInvoice = async (licenseId: string, email: string, dueDate: string) => {
    const user = clients.find(u => u.email === email);
    const res = await licensingStore.addInvoice({
      id: '',
      licenseId,
      licenseName: form.name,
      clientName: user?.name || orgFor(email).name || 'Client',
      clientEmail: email,
      // Prices include GST — the invoice total is what Razorpay charges.
      amount: total,
      gstPercent: form.gst,
      dueDate,
      status: 'unpaid',
      issuedDate: localDate(),
    });
    if (res.ok === false) toast.error(`The invoice couldn't be saved: ${res.error || 'please try again'}`);
  };

  const saveForm = async () => {
    if (!form.name.trim()) { toast.warning('Give the license a name'); return; }
    if (!(Number(form.basePrice) >= 0)) { toast.warning('Enter a valid price'); return; }
    if (!(Number(form.gst) >= 0 && Number(form.gst) <= 100)) { toast.warning('GST should be between 0 and 100%'); return; }
    if (!form.expiry) { toast.warning('Pick an expiry date'); return; }
    const org = form.email ? orgFor(form.email) : { id: undefined, name: undefined };

    if (formMode === 'create') {
      // Charge now: the licence waits for the first payment, and its period
      // starts the day they pay (the server adds one period from then). It
      // used to start with a year already on it and then add another year on
      // payment — the first payment bought two years.
      // Included with the sale: active right away until the chosen date; the
      // first invoice comes at renewal.
      const chargeNow = !!form.email && form.firstPayment === 'now';
      // Pay later: the first month/year is free — first payment due exactly
      // one period from today. No date to pick.
      const payLater = !!form.email && form.firstPayment === 'included';
      const firstDue = defaultExpiry(form.tenure);
      const today = localDate();
      const { license: created, result } = await licensingStore.createLicense({
        id: '',
        name: form.name.trim(),
        price: total,
        gstPercent: Number(form.gst),
        tenure: form.tenure,
        assignedOrgId: org.id,
        assignedOrgName: org.name,
        assignedUserEmail: form.email || undefined,
        expiryDate: chargeNow ? today : payLater ? firstDue : form.expiry,
        status: chargeNow ? 'pending_payment' : 'active',
        storageLimit: Number(form.storage),
        deviceLimit: Number(form.devices),
        whiteLabel: form.whiteLabel,
        enableVideoConferencing: form.videoConferencing,
      });
      if (result.ok === false) {
        toast.error(`Couldn't save: ${result.error || 'please try again'}`);
        load();
        return;
      }
      if (chargeNow) await issueInvoice(created.id, form.email, today);
      toast.success(
        // The invoice email goes out with the hourly reminder run (9 am–8 pm IST).
        chargeNow ? `License created — ${form.email} gets the invoice by email within the hour`
          : payLater ? `License active — first payment due ${formatDate(firstDue)}`
          : 'License added to the pool'
      );
    } else if (editing) {
      // A new price or billing period applies from the next renewal: the
      // client keeps the time they've already paid for, and gets an invoice
      // at the new price due on the renewal date. (This used to put the
      // licence on hold immediately, blocking a client with months paid.)
      // A licence that has already lapsed waits for payment now.
      const today = localDate();
      const lapsed = !form.expiry || form.expiry < today || form.status === 'expired';
      const status = pricingChanged && form.email && lapsed ? 'pending_payment' : form.status;
      const res = await licensingStore.updateLicense(editing.id, {
        name: form.name.trim(),
        price: total,
        gstPercent: Number(form.gst),
        tenure: form.tenure,
        assignedOrgId: org.id,
        assignedOrgName: org.name,
        assignedUserEmail: form.email || undefined,
        expiryDate: form.expiry,
        status,
        storageLimit: Number(form.storage),
        deviceLimit: Number(form.devices),
        whiteLabel: form.whiteLabel,
        enableVideoConferencing: form.videoConferencing,
      });
      if (res.ok === false) {
        toast.error(`Couldn't save: ${res.error || 'please try again'}`);
        return;
      }
      if (pricingChanged && form.email) {
        await issueInvoice(editing.id, form.email, lapsed ? today : form.expiry);
        toast.success(lapsed ? 'Saved — invoice at the new price sent' : `Saved — new price applies from ${formatDate(form.expiry)}`);
      } else {
        toast.success('License updated');
      }
    }
    setFormMode(null);
    load();
  };

  const revoke = (lic: License) => {
    licensingStore.deleteLicense(lic.id);
    toast.success(`"${lic.name}" revoked`);
    setRevokeTarget(null);
    setOpenLicenseId(null);
    load();
  };

  // Records a payment received outside Razorpay: the server renews the
  // licence exactly as an online payment would (it used to only flip the
  // invoice, leaving the client locked out).
  // Print only the invoice, not the whole dashboard (see .print-invoice in index.css).
  const printInvoice = () => {
    document.documentElement.classList.add('print-invoice');
    const done = () => { document.documentElement.classList.remove('print-invoice'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  };

  const markInvoicePaid = async (inv: Invoice) => {
    try {
      const res = await apiPost(`/payments/invoices/${inv.id}/mark-paid`, {});
      await Promise.all([
        syncCollection('licenses', 'signageos_licenses', { force: true }),
        syncCollection('invoices', 'signageos_invoices', { force: true }),
      ]).catch(() => {});
      toast.success(res.expiryDate ? `Payment recorded — licence renewed to ${formatDate(res.expiryDate)}` : 'Invoice marked as paid');
      setOpenInvoiceId(null);
      load();
    } catch (e: any) {
      toast.error(e.message || "Couldn't record the payment");
    }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const withState = licenses.map(lic => ({ lic, state: licenseState(lic) }));
  const stateCounts = (key: LicenseStateKey) => withState.filter(x => x.state.key === key).length;
  const visibleLicenses = withState
    .filter(x => stateFilter === 'all' || x.state.key === stateFilter)
    .filter(x => !q || [x.lic.name, x.lic.assignedOrgName, x.lic.assignedUserEmail, clientName(x.lic.assignedUserEmail)]
      .some(v => (v || '').toLowerCase().includes(q)));

  const expiringRows = licenses
    .filter(l => l.assignedUserEmail && isRenewalDue(l))
    .map(lic => ({ lic, days: daysUntil(lic.expiryDate) }))
    .filter((x): x is { lic: License; days: number } => x.days !== null)
    .sort((a, b) => a.days - b.days);
  const expiringGroups = [
    { title: 'Expired', rows: expiringRows.filter(x => x.days < 0) },
    { title: 'This week', rows: expiringRows.filter(x => x.days >= 0 && x.days <= 7) },
    { title: 'Later this month', rows: expiringRows.filter(x => x.days > 7) },
  ].filter(g => g.rows.length > 0);

  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid');
  const [rangeFrom, rangeTo] = rangeBounds(range, customFrom, customTo);
  const inRange = (d?: string) => { const day = (d || '').slice(0, 10); return (!rangeFrom || day >= rangeFrom) && (!rangeTo || day <= rangeTo); };
  const invoiceDate = (i: Invoice) => i.issuedDate || (i as any).created || '';
  const invoicesInRange = invoices.filter(i => inRange(invoiceDate(i)));
  const visibleInvoices = sortRows(invoices
    .filter(i => invoiceFilter === 'all' || i.status === invoiceFilter)
    .filter(i => inRange(invoiceDate(i)))
    .filter(i => !q || [i.clientName, i.clientEmail, i.licenseName].some(v => (v || '').toLowerCase().includes(q))), sortBy, invoiceDate);

  const visiblePayments = sortRows(payments
    .filter(p => inRange(p.paymentDate))
    .filter(p => !q || [p.clientName, p.clientEmail, p.licenseName, p.razorpayPaymentId].some(v => (v || '').toLowerCase().includes(q))), sortBy, p => p.paymentDate || '');
  const monthKey = new Date().toISOString().slice(0, 7);
  // Totals count real money only; test payments are listed and tagged, not added up.
  const testPayments = payments.filter(isTestPayment);
  const realPayments = payments.filter(p => !isTestPayment(p));
  const testInvoices = invoices.filter(isTestInvoice);
  const collectedThisMonth = realPayments.filter(p => (p.paymentDate || '').startsWith(monthKey)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  // The second card follows the date range; with no range it's all time.
  const realInRange = realPayments.filter(p => inRange(p.paymentDate));
  const collectedTotal = realInRange.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const tabCount: Record<Tab, number> = {
    management: licenses.length,
    expirations: expiringRows.length,
    invoices: unpaidInvoices.length,
    payments: payments.length,
  };

  const openLicense = openLicenseId ? licenses.find(l => l.id === openLicenseId) : null;
  const openInvoice = openInvoiceId ? invoices.find(i => i.id === openInvoiceId) : null;
  const openPayment = openPaymentId ? payments.find(p => p.id === openPaymentId) : null;

  const pill = (text: string, cls: string) => (
    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{text}</span>
  );

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Licensing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plans, renewals, invoices and payments for your clients</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'invoices' && (
            <button
              onClick={() => { setBiz(licensingStore.getBusinessDetails()); setBillingOpen(true); licensingStore.fetchBusinessDetails().then(setBiz); }}
              className="flex items-center gap-2 h-10 px-4 border border-slate-200 bg-white rounded-xl text-sm font-medium text-slate-700"
            >
              <Building size={15} /> Billing details
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> New license
          </button>
        </div>
      </div>

      {/* Section switcher */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl md:max-w-xl">
        {TABS.map(t => {
          const active = tab === t.key;
          const count = tabCount[t.key];
          const alert = (t.key === 'expirations' || t.key === 'invoices') && count > 0;
          return (
            <button
              key={t.key}
              onClick={() => goTab(t.key)}
              className={`flex items-center justify-center gap-1 h-9 px-1 rounded-lg text-[13px] sm:text-sm font-medium transition-colors whitespace-nowrap ${
                active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`min-w-[18px] px-1.5 py-0.5 rounded-full text-[10px] leading-none ${
                  alert ? 'bg-amber-100 text-amber-700' : 'hidden sm:inline bg-slate-200 text-slate-600'
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {(tab !== 'expirations') && (
        <div className="relative md:max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'management' ? 'Search licenses or clients' : tab === 'invoices' ? 'Search invoices' : 'Search payments'}
            className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
          />
        </div>
      )}

      {(tab === 'invoices' || tab === 'payments') && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <CustomSelect value={range} onChange={v => setRange(v as DateRange)} buttonClassName="h-10"
              options={(Object.keys(RANGE_LABEL) as DateRange[]).map(k => ({ value: k, label: RANGE_LABEL[k] }))} />
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input type="date" value={customFrom} max={customTo || undefined} onChange={e => setCustomFrom(e.target.value)} aria-label="From"
                className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-blue-400" />
              <span className="text-xs text-slate-400">to</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={e => setCustomTo(e.target.value)} aria-label="To"
                className="h-10 px-3 text-sm border border-gray-200 rounded-xl bg-white outline-none focus:border-blue-400" />
            </div>
          )}
          <div className="w-48">
            <CustomSelect value={sortBy} onChange={v => setSortBy(v as SortBy)} buttonClassName="h-10"
              options={(Object.keys(SORT_LABEL) as SortBy[]).map(k => ({ value: k, label: SORT_LABEL[k] }))} />
          </div>
          {(range !== 'all' || sortBy !== 'newest') && (
            <button type="button" onClick={() => { setRange('all'); setCustomFrom(''); setCustomTo(''); setSortBy('newest'); }}
              className="h-10 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800">Reset</button>
          )}
        </div>
      )}

      {/* ── LICENSES ─────────────────────────────────────────────────────── */}
      {tab === 'management' && (
        <>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
            {([
              { key: 'all', label: 'All', count: licenses.length },
              { key: 'active', label: 'Active', count: stateCounts('active') },
              { key: 'expiring', label: 'Expiring', count: stateCounts('expiring') },
              { key: 'expired', label: 'Expired', count: stateCounts('expired') },
              { key: 'pending', label: 'Awaiting payment', count: stateCounts('pending') },
              { key: 'unassigned', label: 'Unassigned', count: stateCounts('unassigned') },
            ] as const).filter(c => c.key === 'all' || c.count > 0).map(c => {
              const active = stateFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setStateFilter(c.key)}
                  aria-pressed={active}
                  className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {c.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{c.count}</span>
                </button>
              );
            })}
          </div>

          {visibleLicenses.length > 0 && (
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.6fr)_130px_100px_120px_130px] gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                <span>License</span><span>Client</span><span>Plan</span><span>Screens</span><span>Expires</span><span className="text-right">Status</span>
              </div>
              <div className="divide-y divide-slate-100">
                {visibleLicenses.map(({ lic, state }) => (
                  <button
                    key={lic.id}
                    type="button"
                    onClick={() => setOpenLicenseId(lic.id)}
                    className="w-full grid grid-cols-[minmax(0,1.8fr)_minmax(0,1.6fr)_130px_100px_120px_130px] gap-4 items-center px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Key size={15} /></span>
                      <span className="text-sm font-medium text-slate-900 truncate">{lic.name}</span>
                    </span>
                    <span className="min-w-0">
                      {lic.assignedUserEmail ? (
                        <>
                          <span className="block text-sm text-slate-700 truncate">{lic.assignedOrgName || clientName(lic.assignedUserEmail) || lic.assignedUserEmail}</span>
                          <span className="block text-xs text-slate-500 truncate">{lic.assignedUserEmail}</span>
                        </>
                      ) : <span className="text-sm text-slate-400">In the pool</span>}
                    </span>
                    <span className="text-sm text-slate-700">{formatInr(lic.price)}<span className="text-slate-400">/{lic.tenure === 'yearly' ? 'yr' : 'mo'}</span></span>
                    <span className="text-sm text-slate-700">{lic.assignedUserEmail ? `${screensUsed(lic.assignedUserEmail)} / ${lic.deviceLimit || 5}` : lic.deviceLimit || 5}</span>
                    <span className={`text-sm ${state.key === 'expired' ? 'text-rose-600' : state.key === 'expiring' ? 'text-orange-600' : 'text-slate-700'}`}>{state.key === 'pending' ? 'Starts when paid' : formatDate(lic.expiryDate)}</span>
                    <span className="flex justify-end">{pill(state.label, state.className)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
            {visibleLicenses.map(({ lic, state }) => (
              <button
                key={lic.id}
                type="button"
                onClick={() => setOpenLicenseId(lic.id)}
                className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 transition-colors"
              >
                <span className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Key size={17} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 truncate">{lic.name}</span>
                    </span>
                    <span className={`block text-xs mt-0.5 truncate ${lic.assignedUserEmail ? 'text-slate-600' : 'text-slate-400'}`}>
                      {lic.assignedUserEmail ? (lic.assignedOrgName || clientName(lic.assignedUserEmail) || lic.assignedUserEmail) : 'Not assigned to a client'}
                    </span>
                  </span>
                  {pill(state.label, state.className)}
                </span>
                <span className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                  <span>
                    <span className="block text-slate-400">Plan</span>
                    <span className="block font-semibold text-slate-800 truncate">{formatInr(lic.price)}<span className="font-normal text-slate-500">/{lic.tenure === 'yearly' ? 'yr' : 'mo'}</span></span>
                  </span>
                  <span>
                    <span className="block text-slate-400">Screens</span>
                    <span className="block font-semibold text-slate-800">
                      {lic.assignedUserEmail ? `${screensUsed(lic.assignedUserEmail)} of ${lic.deviceLimit || 5}` : `${lic.deviceLimit || 5}`}
                    </span>
                  </span>
                  <span>
                    <span className="block text-slate-400">{state.key === 'pending' ? 'Starts' : 'Expires'}</span>
                    <span className={`block font-semibold truncate ${state.key === 'expired' ? 'text-rose-600' : state.key === 'expiring' ? 'text-orange-600' : 'text-slate-800'}`}>
                      {state.key === 'pending' ? 'When paid' : formatDate(lic.expiryDate)}
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          {licenses.length === 0 && (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <Key size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">No licenses yet</p>
              <p className="text-xs text-gray-500 mt-1">Create one, then assign it to a client when you onboard them.</p>
              <button onClick={openCreate} className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium">
                <Plus size={16} /> New license
              </button>
            </div>
          )}
          {licenses.length > 0 && visibleLicenses.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No licenses match.</p>
          )}
        </>
      )}

      {/* ── EXPIRING ─────────────────────────────────────────────────────── */}
      {tab === 'expirations' && (
        expiringGroups.length === 0 ? (
          <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
            <CheckCircle size={30} className="mx-auto text-emerald-400 mb-2" />
            <p className="text-sm font-medium text-gray-700">Nothing expiring in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-5">
            {expiringGroups.map(group => (
              <div key={group.title}>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">{group.title} · {group.rows.length}</p>
                <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {group.rows.map(({ lic, days }) => (
                    <div key={lic.id} className="flex items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => setOpenLicenseId(lic.id)} className="flex-1 min-w-0 text-left">
                        <span className="block text-sm font-medium text-slate-900 truncate">{lic.assignedOrgName || clientName(lic.assignedUserEmail) || lic.assignedUserEmail}</span>
                        <span className="block text-xs text-slate-500 truncate">
                          {lic.name} · {planLabel(lic)}
                        </span>
                        <span className={`block text-xs font-medium mt-0.5 ${days < 0 ? 'text-rose-600' : days <= 7 ? 'text-orange-600' : 'text-amber-600'}`}>
                          {relativeDays(days)} · {formatDate(lic.expiryDate)}
                        </span>
                      </button>
                      <button
                        onClick={() => remind({ licenseId: lic.id }, lic.id)}
                        disabled={sending === lic.id}
                        className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Send size={13} /> {sending === lic.id ? 'Sending…' : 'Remind'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── INVOICES ─────────────────────────────────────────────────────── */}
      {tab === 'invoices' && (
        <>
          <div className="flex gap-2">
            {([
              { key: 'all', label: 'All', count: invoicesInRange.length },
              { key: 'unpaid', label: 'Unpaid', count: invoicesInRange.filter(i => i.status === 'unpaid').length },
              { key: 'paid', label: 'Paid', count: invoicesInRange.filter(i => i.status === 'paid').length },
            ] as const).map(c => {
              const active = invoiceFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setInvoiceFilter(c.key)}
                  className={`flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold ${
                    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {c.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-white/20' : 'bg-gray-100 text-gray-600'}`}>{c.count}</span>
                </button>
              );
            })}
          </div>
          {testInvoices.length > 0 && (
            <TestCleanup count={testInvoices.length} noun="invoice" note="Paid by test payments, not real money."
              onDelete={() => setDeleteRecord({ kind: 'invoice', ids: testInvoices.map(i => i.id), label: `${testInvoices.length} test invoice${testInvoices.length === 1 ? '' : 's'}` })} />
          )}
          {visibleInvoices.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {visibleInvoices.map(inv => (
                <button key={inv.id} type="button" onClick={() => setOpenInvoiceId(inv.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                    <Receipt size={16} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-slate-900 truncate">{inv.clientName}</span>
                      {isTestInvoice(inv) && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">TEST</span>}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{inv.licenseName} · due {formatDate(inv.dueDate)}</span>
                  </span>
                  <span className="text-right shrink-0">
                    <span className="block text-sm font-semibold text-slate-900">{formatInr(inv.amount)}</span>
                    <span className={`block text-[11px] font-medium ${inv.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{inv.status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <Receipt size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">{invoices.length ? 'No invoices match' : 'No invoices yet'}</p>
              <p className="text-xs text-gray-500 mt-1">Invoices are issued automatically when a license is assigned or repriced.</p>
            </div>
          )}
        </>
      )}

      {/* ── PAYMENTS ─────────────────────────────────────────────────────── */}
      {tab === 'payments' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">This month</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{formatInr(collectedThisMonth)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-100 p-4">
              <p className="text-xs text-slate-500">{RANGE_LABEL[range]} · {realInRange.length} payment{realInRange.length === 1 ? '' : 's'}</p>
              <p className="text-xl font-semibold text-slate-900 mt-1">{formatInr(collectedTotal)}</p>
            </div>
          </div>
          {testPayments.length > 0 && (
            <TestCleanup count={testPayments.length} noun="payment" note="Made in testing — no real money moved. Left out of the totals above."
              onDelete={() => setDeleteRecord({ kind: 'payment', ids: testPayments.map(p => p.id), label: `${testPayments.length} test payment${testPayments.length === 1 ? '' : 's'}` })} />
          )}
          {visiblePayments.length > 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
              {visiblePayments.map(p => (
                <button key={p.id} type="button" onClick={() => setOpenPaymentId(p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CreditCard size={16} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium text-slate-900 truncate">{p.clientName || p.clientEmail}</span>
                      {isTestPayment(p) && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold">TEST</span>}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{p.licenseName} · {formatDate(p.paymentDate)}</span>
                  </span>
                  <span className="text-sm font-semibold text-slate-900 shrink-0">{formatInr(p.amount)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
              <CreditCard size={30} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-700">{payments.length ? 'No payments match' : 'No payments yet'}</p>
              <p className="text-xs text-gray-500 mt-1">Razorpay payments from clients show up here.</p>
            </div>
          )}
        </>
      )}

      {/* ── License sheet ────────────────────────────────────────────────── */}
      {openLicense && (() => {
        const state = licenseState(openLicense);
        const email = openLicense.assignedUserEmail;
        const used = screensUsed(email);
        const licInvoices = invoices.filter(i => i.licenseId === openLicense.id && i.status === 'unpaid');
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenLicenseId(null)}
            title={openLicense.name}
            subtitle={email ? (openLicense.assignedOrgName || clientName(email) || email) : 'In the pool — not assigned'}
            badge={pill(state.label, state.className)}
            details={[
              ...(email ? [{ label: 'Client', value: email }] : []),
              { label: 'Plan', value: planLabel(openLicense) },
              state.key === 'pending'
                ? { label: 'Period', value: `Starts when paid · runs 1 ${openLicense.tenure === 'yearly' ? 'year' : 'month'}` }
                : { label: 'Expires', value: <span className={state.key === 'expired' ? 'text-rose-600' : ''}>{formatDate(openLicense.expiryDate)} · {relativeDays(state.days)}</span> },
              { label: 'Screens', value: email ? `${used} of ${openLicense.deviceLimit || 5} in use` : `Up to ${openLicense.deviceLimit || 5}` },
              { label: 'Storage', value: `${openLicense.storageLimit || 5} GB` },
              { label: 'Features', value: [openLicense.enableVideoConferencing && 'Video calls', openLicense.whiteLabel && 'White label'].filter(Boolean).join(', ') || <span className="text-slate-400">Standard</span> },
              ...(licInvoices.length ? [{ label: 'Unpaid invoices', value: <span className="text-amber-700">{licInvoices.length} · {formatInr(licInvoices.reduce((s, i) => s + i.amount, 0))}</span> }] : []),
              { label: 'Created', value: formatDate(openLicense.createdAt) },
            ]}
            groups={[
              {
                title: 'License',
                actions: [
                  { key: 'edit', label: 'Edit license', description: 'Plan, limits, expiry, client and features', icon: <Edit2 size={17} />, onClick: () => openEdit(openLicense) },
                  ...(email ? [{
                    key: 'remind',
                    label: state.key === 'expired' ? 'Email renewal notice' : 'Email renewal reminder',
                    description: `Sends a renew link to ${email}`,
                    icon: <Mail size={17} />,
                    onClick: () => remind({ licenseId: openLicense.id }, openLicense.id)
                  }] : []),
                ]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'revoke',
                  label: 'Revoke license',
                  description: email ? `${email} loses access to their screens` : 'Removes it from the pool',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setRevokeTarget(openLicense)
                }]
              }
            ]}
          />
        );
      })()}

      {/* ── Invoice sheet ────────────────────────────────────────────────── */}
      {openInvoice && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpenInvoiceId(null)}
          title={formatInr(openInvoice.amount)}
          subtitle={`${openInvoice.number || 'Invoice'} · ${openInvoice.clientName}`}
          badge={openInvoice.status === 'paid'
            ? pill('Paid', 'bg-emerald-50 text-emerald-700 border-emerald-100')
            : pill('Unpaid', 'bg-amber-50 text-amber-700 border-amber-100')}
          details={[]}
          hero={<TaxInvoice invoice={openInvoice} biz={biz} />}
          footer={
            <button type="button" onClick={printInvoice} className="w-full h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"><Printer size={15} /> Print / save PDF</button>
          }
          groups={[
            ...(openInvoice.status === 'unpaid' ? [{
              title: 'Collect payment',
              actions: [
                { key: 'remind', label: 'Email payment reminder', description: `Sends a pay link to ${openInvoice.clientEmail}`, icon: <Send size={17} />, onClick: () => remind({ invoiceId: openInvoice.id }, openInvoice.id) },
                { key: 'paid', label: 'Mark as paid', description: 'Received outside Razorpay — renews the licence like an online payment', icon: <CheckCircle size={17} />, onClick: () => markInvoicePaid(openInvoice) },
              ]
            }] : []),
            ...(isTestInvoice(openInvoice) ? [{
              title: 'Test invoice',
              actions: [{
                key: 'delete', label: 'Delete test invoice', description: 'Paid by a test payment — no real money',
                icon: <Trash2 size={17} />, tone: 'danger' as const,
                onClick: () => setDeleteRecord({ kind: 'invoice', ids: [openInvoice.id], label: `${openInvoice.number || 'This invoice'} (${formatInr(openInvoice.amount)})` }),
              }],
            }] : []),
          ]}
        />
      )}

      {/* ── Payment sheet ────────────────────────────────────────────────── */}
      {openPayment && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpenPaymentId(null)}
          title={formatInr(openPayment.amount)}
          subtitle={`${openPayment.clientName || openPayment.clientEmail} · ${formatDate(openPayment.paymentDate)}`}
          badge={pill('Received', 'bg-emerald-50 text-emerald-700 border-emerald-100')}
          details={[
            { label: 'Client', value: openPayment.clientEmail },
            { label: 'License', value: openPayment.licenseName },
            { label: 'Razorpay payment', value: <span className="font-mono text-xs">{openPayment.razorpayPaymentId || '—'}</span> },
            { label: 'Razorpay order', value: <span className="font-mono text-xs">{openPayment.razorpayOrderId || '—'}</span> },
          ]}
          groups={isTestPayment(openPayment) ? [{
            title: 'Test payment',
            actions: [{
              key: 'delete', label: 'Delete test payment', description: 'Not a real Razorpay payment — no money moved',
              icon: <Trash2 size={17} />, tone: 'danger' as const,
              onClick: () => setDeleteRecord({ kind: 'payment', ids: [openPayment.id], label: `This payment (${formatInr(openPayment.amount)}, ${openPayment.clientName || openPayment.clientEmail})` }),
            }],
          }] : []}
        />
      )}

      {/* ── Create / edit form ───────────────────────────────────────────── */}
      {formMode && (
        <ScreenDetailsSheet
          open
          onClose={() => setFormMode(null)}
          title={formMode === 'create' ? 'New license' : 'Edit license'}
          subtitle={formMode === 'create' ? 'Add to the pool, or assign it to a client right away' : editing?.name}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Name</label>
                <input value={form.name} onChange={e => setF('name', e.target.value)} placeholder="e.g. Phoenix Mall — 5 screens" className={inputCls} autoFocus={formMode === 'create'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Price before GST (₹)</label>
                  <input type="number" inputMode="numeric" min={0} value={form.basePrice} onChange={e => setF('basePrice', Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>GST</label>
                  <div className="relative">
                    <input type="number" inputMode="decimal" min={0} max={100} step="0.01" value={form.gst} onChange={e => setF('gst', Number(e.target.value))} className={`${inputCls} pr-8`} list="gst-presets" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">%</span>
                    <datalist id="gst-presets">{GST_PRESETS.map(g => <option key={g} value={g} />)}</datalist>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 -mt-1">
                {GST_PRESETS.map(g => (
                  <button key={g} type="button" onClick={() => setF('gst', g)}
                    className={`h-7 px-2.5 rounded-full border text-xs font-medium ${form.gst === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                    {g}%
                  </button>
                ))}
              </div>
              <p className="-mt-1 text-sm text-slate-700 bg-slate-50 rounded-xl px-3 py-2.5">
                Client pays <span className="font-semibold text-slate-900">{formatInr(total)}</span>
                <span className="text-slate-500"> = {formatInr(form.basePrice)} + {formatInr(total - Number(form.basePrice || 0))} GST ({form.gst}%) — charged through Razorpay</span>
              </p>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={labelCls}>Billed</label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl h-11">
                    {(['monthly', 'yearly'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tenure: t, expiry: f.expiryTouched ? f.expiry : defaultExpiry(t) }))}
                        className={`rounded-lg text-sm font-medium ${form.tenure === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
                      >
                        {t === 'monthly' ? 'Monthly' : 'Yearly'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className={labelCls}>Client</label>
                <CustomSelect
                  value={form.email}
                  onChange={v => setF('email', v)}
                  options={[
                    { value: '', label: 'Keep in the pool (unassigned)' },
                    ...clients.map(u => {
                      const has = licenses.some(l => l.assignedUserEmail === u.email && l.id !== editing?.id);
                      return { value: u.email, label: `${u.company || u.name} · ${u.email}${has ? ' (has a license)' : ''}` };
                    })
                  ]}
                  buttonClassName="h-11 text-sm px-3"
                />
              </div>

              {formMode === 'create' && form.email && (
                <div>
                  <label className={labelCls}>First payment</label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { key: 'now', title: 'Start now', hint: 'Invoice today' },
                      { key: 'included', title: `Start after 1 ${form.tenure === 'yearly' ? 'year' : 'month'}`, hint: `First ${form.tenure === 'yearly' ? 'year' : 'month'} free` },
                    ] as const).map(o => {
                      const active = form.firstPayment === o.key;
                      return (
                        <button
                          key={o.key}
                          type="button"
                          onClick={() => setF('firstPayment', o.key)}
                          aria-pressed={active}
                          className={`text-left rounded-xl border px-3 py-2.5 ${active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                          <span className="block text-sm font-semibold text-slate-900">{o.title}</span>
                          <span className="block text-xs text-slate-500 mt-0.5">{o.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    {form.firstPayment === 'now'
                      ? `They get an invoice for ${formatInr(total)} (incl. ${formatInr(total - Number(form.basePrice || 0))} GST). The licence starts the day they pay and runs one ${form.tenure === 'yearly' ? 'year' : 'month'}.`
                      : `Active right away, nothing to pay now. Their first payment (${formatInr(total)}) is due on ${formatDate(defaultExpiry(form.tenure))} — exactly one ${form.tenure === 'yearly' ? 'year' : 'month'} from today — then every ${form.tenure === 'yearly' ? 'year' : 'month'} after that.`}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Screens allowed</label>
                  <input type="number" inputMode="numeric" min={1} value={form.devices} onChange={e => setF('devices', Number(e.target.value))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Storage (GB)</label>
                  <input type="number" inputMode="numeric" min={1} value={form.storage} onChange={e => setF('storage', Number(e.target.value))} className={inputCls} />
                </div>
              </div>

              <div className={formMode === 'edit' ? 'grid grid-cols-2 gap-3' : ''}>
                {!(formMode === 'create' && form.email) && (
                  <div>
                    <label className={labelCls}>Expires on</label>
                    <input type="date" value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value, expiryTouched: true }))} className={inputCls} />
                  </div>
                )}
                {formMode === 'edit' && (
                  <div>
                    <label className={labelCls}>Status</label>
                    <CustomSelect
                      value={form.status}
                      onChange={v => setF('status', v as License['status'])}
                      options={[
                        { value: 'active', label: 'Active' },
                        { value: 'pending_payment', label: 'Awaiting payment' },
                        { value: 'expired', label: 'Expired' },
                      ]}
                      buttonClassName="h-11 text-sm px-3"
                    />
                  </div>
                )}
              </div>
              {formMode === 'create' && !form.expiryTouched && !form.email && (
                <p className="text-xs text-slate-500 -mt-2">One {form.tenure === 'yearly' ? 'year' : 'month'} from today.</p>
              )}

              <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                <Toggle checked={form.videoConferencing} onChange={v => setF('videoConferencing', v)} label="Video calls" hint="Calls between the dashboard and TVs" icon={<Video size={17} />} />
                <Toggle checked={form.whiteLabel} onChange={v => setF('whiteLabel', v)} label="White label" hint="Client's own logo and name in the app" icon={<Palette size={17} />} />
              </div>

              {pricingChanged && form.email && (
                <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  {form.expiry && form.expiry >= localDate() && form.status !== 'expired'
                    ? <>New price applies from the renewal on {formatDate(form.expiry)} — {form.email} keeps the time already paid and gets an invoice due that day.</>
                    : <>This licence has lapsed: it waits for payment and {form.email} gets an invoice at the new price.</>}
                </p>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormMode(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={saveForm} className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">
                {formMode === 'create' ? (form.email && form.firstPayment === 'now' ? 'Create & send invoice' : 'Create license') : 'Save changes'}
              </button>
            </div>
          }
        />
      )}

      {/* ── Billing details (shown on invoices) ──────────────────────────── */}
      {billingOpen && (
        <ScreenDetailsSheet
          open
          onClose={() => setBillingOpen(false)}
          title="Billing details"
          /* No longer only invoices — the last two fields drive the website. */
          subtitle="Printed on every client's invoices, and used by the website"
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Registered business name</label>
                <input value={biz.name} onChange={e => setBiz(b => ({ ...b, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Billing address</label>
                <textarea rows={3} value={biz.address} onChange={e => setBiz(b => ({ ...b, address: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>GSTIN</label>
                  <input value={biz.gstNumber} onChange={e => { const g = e.target.value.toUpperCase(); setBiz(b => ({ ...b, gstNumber: g, state: stateFromGstin(g) || b.state })); }} placeholder="29AAAAA1111A1Z1" className={`${inputCls} font-mono`} />
                </div>
                <div>
                  <label className={labelCls}>GST state</label>
                  <CustomSelect value={biz.state || 'Karnataka'} onChange={v => setBiz(b => ({ ...b, state: v }))} options={STATE_NAMES.map(n => ({ value: n, label: n }))} buttonClassName="h-11 px-3 text-sm" />
                </div>
                <div>
                  <label className={labelCls}>Invoice number prefix</label>
                  <input value={biz.invoicePrefix || 'BSD'} onChange={e => setBiz(b => ({ ...b, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} className={`${inputCls} font-mono`} />
                  <p className="text-[11px] text-slate-400 mt-1">Invoices are numbered {(biz.invoicePrefix || 'BSD')}/{'{year}'}/0001, starting again each April.</p>
                </div>
                <div>
                  <label className={labelCls}>SAC code</label>
                  <input value={biz.sac || '997331'} onChange={e => setBiz(b => ({ ...b, sac: e.target.value.replace(/\D/g, '').slice(0, 6) }))} className={`${inputCls} font-mono`} />
                  <p className="text-[11px] text-slate-400 mt-1">997331 = licensing the right to use software. Check with your accountant.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Billing email</label>
                  <input type="email" value={biz.contactEmail} onChange={e => setBiz(b => ({ ...b, contactEmail: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Billing phone</label>
                  <input type="tel" value={biz.contactPhone} onChange={e => setBiz(b => ({ ...b, contactPhone: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Not printed on invoices — these two drive the public website. */}
              <div className="pt-1 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-700 pt-3 mb-2">Website enquiries</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>WhatsApp number</label>
                    <input
                      type="tel"
                      value={biz.whatsappNumber || ''}
                      onChange={e => setBiz(b => ({ ...b, whatsappNumber: e.target.value }))}
                      placeholder="+91 80958 51597"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Every &ldquo;request a quote&rdquo; button on bluestardigitech.com opens a WhatsApp chat
                      with this number. Make sure WhatsApp is actually registered against it.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Enquiry email</label>
                    <input
                      type="email"
                      value={biz.enquiryEmail || ''}
                      onChange={e => setBiz(b => ({ ...b, enquiryEmail: e.target.value }))}
                      placeholder="sales@bluestardigitech.com"
                      className={inputCls}
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Where a new website enquiry is emailed. Leave blank to use the billing email above.
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Logo</label>
                <div className="flex items-center gap-3">
                  <span className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {biz.logoUrl ? <img src={biz.logoUrl} alt="" className="w-full h-full object-contain" /> : <ImageIcon size={18} className="text-slate-400" />}
                  </span>
                  <label className="flex-1 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                    {biz.logoUrl ? 'Change logo' : 'Upload logo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onloadend = () => setBiz(b => ({ ...b, logoUrl: reader.result as string }));
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {biz.logoUrl && (
                    <button type="button" onClick={() => setBiz(b => ({ ...b, logoUrl: '' }))} className="h-11 px-3 rounded-xl text-sm text-rose-600 hover:bg-rose-50">Remove</button>
                  )}
                </div>
              </div>
            </div>
          }
          footer={
            <button
              type="button"
              onClick={async () => {
                const res = await licensingStore.saveBusinessDetails(biz);
                if (res.ok === false) { toast.error(`Couldn't save: ${res.error}`); return; }
                toast.success('Billing details saved — clients see them on their invoices');
                setBillingOpen(false);
              }}
              className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
            >
              Save
            </button>
          }
        />
      )}

      {deleteRecord && (
        <ConfirmDialog
          title={deleteRecord.ids.length === 1 ? `Delete this test ${deleteRecord.kind}?` : `Delete ${deleteRecord.ids.length} test ${deleteRecord.kind}s?`}
          body={<p>{deleteRecord.label} {deleteRecord.ids.length === 1 ? 'is' : 'are'} deleted for good. {deleteRecord.kind === 'payment' ? 'These are test payments — no real money moved.' : 'These were paid by test payments.'} Licenses aren't changed, and real payments and invoices can't be deleted.</p>}
          confirmLabel={`Delete ${deleteRecord.ids.length === 1 ? '' : `${deleteRecord.ids.length} `}test ${deleteRecord.kind}${deleteRecord.ids.length === 1 ? '' : 's'}`}
          tone="danger"
          onCancel={() => setDeleteRecord(null)}
          onConfirm={() => removeRecord(deleteRecord)}
        />
      )}

      {revokeTarget && (
        <ConfirmDialog
          title={`Revoke “${revokeTarget.name}”?`}
          body={revokeTarget.assignedUserEmail
            ? <p>{revokeTarget.assignedUserEmail} will lose this license — their screens stop playing if it's their only one. This can't be undone.</p>
            : <p>The license is removed from the pool. This can't be undone.</p>}
          confirmLabel="Revoke license"
          tone="danger"
          onCancel={() => setRevokeTarget(null)}
          onConfirm={() => revoke(revokeTarget)}
        />
      )}
    </div>
  );
}

/** Shown only when there are test records: one button to clear them all. */
type DateRange = 'all' | 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom';
type SortBy = 'newest' | 'oldest' | 'amount-high' | 'amount-low';

const RANGE_LABEL: Record<DateRange, string> = {
  'all': 'All time',
  'this-month': 'This month',
  'last-month': 'Last month',
  'last-3-months': 'Last 3 months',
  'this-year': 'This year',
  'custom': 'Custom range',
};
const SORT_LABEL: Record<SortBy, string> = {
  'newest': 'Newest first',
  'oldest': 'Oldest first',
  'amount-high': 'Amount: high to low',
  'amount-low': 'Amount: low to high',
};

/** [from, to] as YYYY-MM-DD in local time; '' means open-ended. */
function rangeBounds(range: DateRange, from: string, to: string): [string, string] {
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  switch (range) {
    case 'this-month': return [ymd(new Date(y, m, 1)), ''];
    case 'last-month': return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    case 'last-3-months': return [ymd(new Date(y, m - 2, 1)), ''];
    case 'this-year': return [`${y}-01-01`, ''];
    case 'custom': return [from, to];
    default: return ['', ''];
  }
}

function sortRows<T extends { amount?: number | string }>(rows: T[], sortBy: SortBy, dateOf: (r: T) => string): T[] {
  const amt = (r: T) => Number(r.amount) || 0;
  return [...rows].sort((a, b) => {
    if (sortBy === 'amount-high') return amt(b) - amt(a);
    if (sortBy === 'amount-low') return amt(a) - amt(b);
    const cmp = dateOf(a).localeCompare(dateOf(b));
    return sortBy === 'oldest' ? cmp : -cmp;
  });
}

function TestCleanup({ count, noun, note, onDelete }: { count: number; noun: string; note: string; onDelete: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900">{count} test {noun}{count === 1 ? '' : 's'}</span>
        <span className="block text-xs text-slate-500">{note}</span>
      </span>
      <button type="button" onClick={onDelete} className="shrink-0 h-9 px-3.5 rounded-xl border border-red-200 bg-white text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-1.5">
        <Trash2 size={14} /> Delete {count === 1 ? 'it' : 'all'}
      </button>
    </div>
  );
}
