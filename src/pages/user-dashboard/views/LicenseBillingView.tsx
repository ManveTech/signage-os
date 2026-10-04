import { useEffect, useState } from 'react';
import { Key, Receipt, CreditCard, Printer, AlertTriangle, CheckCircle, Video, Palette, LifeBuoy, ChevronRight, Loader2 } from 'lucide-react';
import { licensingStore, License, PaymentRecord, Invoice, BusinessDetails } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { syncCollection } from '../../../lib/syncHelper';
import { getAuthToken } from '../../../lib/authStorage';
import { API_BASE } from '../../../config';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import { licenseState, licenseAccess, formatDate, formatInr, relativeDays, planLabel } from '../../../components/licenses/licenseStatus';

interface Props {
  userEmail: string;
  onNavigate?: (view: string) => void;
}

const lower = (v?: string) => (v || '').toLowerCase().trim();

/**
 * Client License & Billing: what plan they're on and how much of it they
 * use, anything that needs paying, and their invoices and payments.
 */
export default function LicenseBillingView({ userEmail, onNavigate }: Props) {
  const me = lower(userEmail);
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses().filter(l => lower(l.assignedUserEmail) === me));
  const [invoices, setInvoices] = useState<Invoice[]>(() => licensingStore.getInvoices().filter(i => lower(i.clientEmail) === me));
  const [payments, setPayments] = useState<PaymentRecord[]>(() => licensingStore.getPayments().filter(p => lower(p.clientEmail) === me));
  const [biz, setBiz] = useState<BusinessDetails>(() => licensingStore.getBusinessDetails());
  const [screensUsed, setScreensUsed] = useState(0);
  const [storageBytes, setStorageBytes] = useState(0);
  const [loading, setLoading] = useState(true);

  const [paying, setPaying] = useState<string | null>(null); // license id
  const [paidLicense, setPaidLicense] = useState<string | null>(null);
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [openPaymentId, setOpenPaymentId] = useState<string | null>(null);

  const load = () => {
    setLicenses(licensingStore.getLicenses().filter(l => lower(l.assignedUserEmail) === me));
    setInvoices(licensingStore.getInvoices().filter(i => lower(i.clientEmail) === me)
      .sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || '')));
    setPayments(licensingStore.getPayments().filter(p => lower(p.clientEmail) === me)
      .sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || '')));
    const screens = mediaStore.getScreens();
    setScreensUsed(screens.filter(s => lower(s.assignedToUserEmail) === me && s.status !== 'pairing' && s.status !== 'unlinked').length);
    // Uses the real media fields (uploadedBy / fileSizeBytes) — the old page
    // read a cache key and field names that don't exist, so storage always
    // showed 0 GB.
    setStorageBytes(mediaStore.getClientStorageUsedBytes(userEmail));
  };

  useEffect(() => {
    load();
    Promise.all([
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('payments', 'signageos_payments'),
      syncCollection('invoices', 'signageos_invoices'),
      syncCollection('screens', 'signageos_screens'),
      syncCollection('media_items', 'signageos_media'),
    ]).finally(() => { load(); setLoading(false); });
    licensingStore.fetchBusinessDetails().then(setBiz);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // ── Payment (real Razorpay checkout only) ────────────────────────────────
  const loadCheckout = (): Promise<void> => {
    if (typeof (window as any).Razorpay !== 'undefined') return Promise.resolve();
    return new Promise(resolve => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
      const script = existing || document.createElement('script');
      script.addEventListener('load', () => resolve());
      script.addEventListener('error', () => resolve());
      if (!existing) {
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.async = true;
        script.dataset.razorpayCheckout = 'true';
        document.head.appendChild(script);
      }
      setTimeout(resolve, 10000);
    });
  };

  const pay = async (lic: License) => {
    setPaying(lic.id);
    const fail = (msg: string) => { setPaying(null); toast.error(msg, 7000); };

    await loadCheckout();
    if (typeof (window as any).Razorpay === 'undefined') {
      fail('The payment page couldn\'t load. Check your connection, turn off any ad-blocker for this site, and try again.');
      return;
    }
    const headers = { 'Content-Type': 'application/json', ...(getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : {}) };

    let order: any;
    try {
      const res = await fetch(`${API_BASE}/payments/create-order`, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ licenseId: lic.id }) });
      order = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(order.message || 'Could not start the payment.');
    } catch (err: any) {
      fail(err.message || 'Could not start the payment.');
      return;
    }

    try {
      const rzp = new (window as any).Razorpay({
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency || 'INR',
        name: biz.name || 'License renewal',
        description: `${lic.name} — ${lic.tenure === 'yearly' ? '1 year' : '1 month'}`,
        image: biz.logoUrl && biz.logoUrl.startsWith('https://') ? biz.logoUrl : undefined,
        order_id: order.orderId,
        prefill: { email: userEmail },
        theme: { color: '#2563EB' },
        handler: async (response: any) => {
          setPaying(lic.id);
          try {
            const res = await fetch(`${API_BASE}/payments/verify`, {
              method: 'POST', headers, credentials: 'include',
              body: JSON.stringify({
                razorpayPaymentId: response.razorpay_payment_id,
                razorpayOrderId: response.razorpay_order_id,
                razorpaySignature: response.razorpay_signature,
                licenseId: lic.id,
              }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              fail(data.message || 'We couldn\'t confirm the payment yet. If money was taken, your plan updates automatically within a few minutes.');
              return;
            }
            setPaying(null);
            setPaidLicense(lic.id);
            await Promise.all([
              syncCollection('licenses', 'signageos_licenses', { force: true }),
              syncCollection('invoices', 'signageos_invoices', { force: true }),
              syncCollection('payments', 'signageos_payments', { force: true }),
            ]).catch(() => {});
            load();
            // Lifts the "paused" screen / grace banner straight away.
            window.dispatchEvent(new Event('signageos_license_updated'));
          } catch {
            fail('Connection lost while confirming. If money was taken, your plan updates automatically once the payment is confirmed.');
          }
        },
        modal: { ondismiss: () => setPaying(null) },
      });
      rzp.open();
    } catch {
      fail('The payment page couldn\'t open. Please try again.');
    }
  };

  // Print only the invoice, not the whole dashboard (see index.css).
  const printInvoice = () => {
    document.documentElement.classList.add('print-invoice');
    const done = () => { document.documentElement.classList.remove('print-invoice'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const main = [...licenses].sort((a, b) => (b.expiryDate || '').localeCompare(a.expiryDate || ''))[0];
  const unpaid = invoices.filter(i => i.status === 'unpaid');
  const deviceLimit = licenses.reduce((s, l) => s + (l.deviceLimit || 0), 0) || 5;
  const storageLimitGb = licenses.reduce((s, l) => s + (l.storageLimit || 0), 0) || 5;
  const storageGb = storageBytes / 1024 ** 3;
  const openInvoice = openInvoiceId ? invoices.find(i => i.id === openInvoiceId) : null;
  const openPayment = openPaymentId ? payments.find(p => p.id === openPaymentId) : null;
  const licenseFor = (inv: Invoice) => licenses.find(l => l.id === inv.licenseId);
  const askSupport = () => onNavigate?.('support-tickets');

  // The one thing that most needs doing, shown at the top.
  const attention = (() => {
    if (!main) return null;
    const st = licenseState(main);
    if (st.key === 'expired') {
      const acc = licenseAccess(main as any);
      return acc.state === 'grace'
        ? { tone: 'rose', title: 'Your plan has expired', body: `Renew by ${formatDate(acc.graceEnds || '')} to keep using your dashboard. Your screens keep playing either way. Renewing starts a new period from today.`, lic: main }
        : { tone: 'rose', title: 'Your dashboard is paused', body: 'The grace period has ended. Renew to get back in straight away — your screens are still playing. Renewing starts a new period from today.', lic: main };
    }
    if (st.key === 'pending') return { tone: 'amber', title: 'Payment needed to activate your plan', body: unpaid.length ? `You have ${unpaid.length} unpaid invoice${unpaid.length === 1 ? '' : 's'}.` : 'Complete the payment to start using your plan.', lic: main };
    if (st.days !== null && st.days <= 14) return { tone: 'amber', title: `Your plan renews in ${st.days} day${st.days === 1 ? '' : 's'}`, body: 'Renew now to avoid a gap — paying early adds the new period after the current one ends, so you lose nothing.', lic: main };
    return null;
  })();

  const bar = (pct: number) => (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
      <div className={`h-full rounded-full ${pct > 90 ? 'bg-rose-500' : pct > 75 ? 'bg-amber-400' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl space-y-4 sm:space-y-5">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">License & Billing</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your plan, what you're using, and your invoices</p>
      </div>

      {paidLicense && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5">
          <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-900">Payment received — thank you!</p>
            <p className="text-xs text-emerald-800 mt-0.5">Your plan is active{main ? ` until ${formatDate(main.expiryDate)}` : ''}. A receipt is in your invoices below.</p>
          </div>
          <button onClick={() => setPaidLicense(null)} className="text-xs text-emerald-700 font-medium">Dismiss</button>
        </div>
      )}

      {attention && !paidLicense && (
        <div className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3.5 ${attention.tone === 'rose' ? 'border-rose-100 bg-rose-50' : 'border-amber-100 bg-amber-50'}`}>
          <AlertTriangle size={18} className={`shrink-0 ${attention.tone === 'rose' ? 'text-rose-600' : 'text-amber-600'}`} />
          <div className="flex-1">
            <p className={`text-sm font-semibold ${attention.tone === 'rose' ? 'text-rose-900' : 'text-amber-900'}`}>{attention.title}</p>
            <p className={`text-xs mt-0.5 ${attention.tone === 'rose' ? 'text-rose-800' : 'text-amber-800'}`}>{attention.body}</p>
          </div>
          <button
            onClick={() => pay(attention.lic)}
            disabled={!!paying}
            className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 shrink-0"
          >
            {paying === attention.lic.id && <Loader2 size={15} className="animate-spin" />}
            Pay {formatInr(attention.lic.price)}
          </button>
        </div>
      )}

      {!loading && licenses.length === 0 && (
        <div className="py-12 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Key size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No plan on your account yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">Ask us to set one up and your screens can start playing.</p>
          {onNavigate && (
            <button onClick={askSupport} className="inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium">
              <LifeBuoy size={16} /> Contact support
            </button>
          )}
        </div>
      )}

      {licenses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Plan(s) */}
          <div className="lg:col-span-3 space-y-4">
            {licenses.map(lic => {
              const st = licenseState(lic);
              const due = st.key === 'expired' || st.key === 'pending';
              return (
                <section key={lic.id} className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Key size={18} /></span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-semibold text-slate-900">{lic.name}</h2>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.className}`}>{st.label}</span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{planLabel(lic)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">{st.key === 'expired' ? 'Expired on' : 'Renews on'}</p>
                      <p className={`text-sm font-semibold mt-0.5 ${st.key === 'expired' ? 'text-rose-600' : 'text-slate-900'}`}>{formatDate(lic.expiryDate)}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{relativeDays(st.days)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs text-slate-500">Includes</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{lic.deviceLimit || 5} screens · {lic.storageLimit || 5} GB</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 ${lic.enableVideoConferencing ? 'text-slate-600' : 'line-through'}`}><Video size={11} /> Video calls</span>
                        <span className={`inline-flex items-center gap-1 ${lic.whiteLabel ? 'text-slate-600' : 'line-through'}`}><Palette size={11} /> Branding</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-4">
                    <button
                      onClick={() => pay(lic)}
                      disabled={!!paying}
                      className={`h-11 sm:h-10 px-5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 ${
                        due ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {paying === lic.id && <Loader2 size={15} className="animate-spin" />}
                      {due ? `Pay ${formatInr(lic.price)}` : `Renew early · ${formatInr(lic.price)}`}
                    </button>
                    <p className="text-xs text-slate-500 sm:ml-1">
                      {due ? `Activates for 1 ${lic.tenure === 'yearly' ? 'year' : 'month'} once paid.` : `Adds 1 ${lic.tenure === 'yearly' ? 'year' : 'month'} after ${formatDate(lic.expiryDate)}.`} Secure payment by Razorpay.
                    </p>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Usage */}
          <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 space-y-5 h-fit">
            <h2 className="text-sm font-semibold text-slate-900">What you're using</h2>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Screens</span>
                <span className="font-semibold text-slate-900">{screensUsed} of {deviceLimit}</span>
              </div>
              {bar((screensUsed / deviceLimit) * 100)}
              {screensUsed >= deviceLimit && <p className="text-xs text-amber-700 mt-1.5">You've used every screen on your plan — contact us to add more.</p>}
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-slate-600">Storage</span>
                <span className="font-semibold text-slate-900">{storageGb >= 1 ? `${storageGb.toFixed(1)} GB` : `${Math.round(storageBytes / 1024 ** 2)} MB`} of {storageLimitGb} GB</span>
              </div>
              {bar((storageGb / storageLimitGb) * 100)}
            </div>
            {onNavigate && (
              <button onClick={askSupport} className="w-full flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50">
                <LifeBuoy size={16} className="text-blue-600 shrink-0" />
                <span className="flex-1 text-sm text-slate-700">Need more screens or storage?</span>
                <ChevronRight size={15} className="text-slate-300" />
              </button>
            )}
          </section>
        </div>
      )}

      {/* Invoices & payments */}
      {(invoices.length > 0 || payments.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Invoices</p>
            {invoices.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {invoices.map(inv => (
                  <button key={inv.id} type="button" onClick={() => setOpenInvoiceId(inv.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}><Receipt size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{inv.licenseName}</span>
                      <span className="block text-xs text-slate-500">{formatDate(inv.issuedDate)}{inv.status === 'unpaid' ? ` · due ${formatDate(inv.dueDate)}` : ''}</span>
                    </span>
                    <span className="text-right shrink-0">
                      <span className="block text-sm font-semibold text-slate-900">{formatInr(inv.amount)}</span>
                      <span className={`block text-[11px] font-medium ${inv.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>{inv.status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 px-4 py-6 text-center">No invoices yet.</p>}
          </section>

          <section>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Payments</p>
            {payments.length > 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {payments.map(p => (
                  <button key={p.id} type="button" onClick={() => setOpenPaymentId(p.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
                    <span className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><CreditCard size={16} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{p.licenseName}</span>
                      <span className="block text-xs text-slate-500">{formatDate(p.paymentDate)}</span>
                    </span>
                    <span className="text-sm font-semibold text-slate-900 shrink-0">{formatInr(p.amount)}</span>
                  </button>
                ))}
              </div>
            ) : <p className="text-sm text-slate-500 bg-white rounded-2xl border border-slate-100 px-4 py-6 text-center">No payments yet.</p>}
          </section>
        </div>
      )}

      {/* ── Invoice ─────────────────────────────────────────────────────── */}
      {openInvoice && (() => {
        const lic = licenseFor(openInvoice);
        const base = Math.round(openInvoice.amount / 1.18);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenInvoiceId(null)}
            title={`Invoice · ${formatInr(openInvoice.amount)}`}
            subtitle={formatDate(openInvoice.issuedDate)}
            badge={<span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${openInvoice.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>{openInvoice.status === 'paid' ? 'Paid' : 'Unpaid'}</span>}
            details={[]}
            groups={[]}
            hero={
              <div id="invoice-print-area" className="rounded-2xl border border-slate-200 p-4 sm:p-5 space-y-5 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {biz.logoUrl && <img src={biz.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain" />}
                      <span className="text-sm font-semibold text-slate-900">{biz.name || 'Your provider'}</span>
                    </div>
                    {biz.address && <p className="text-xs text-slate-500 mt-1.5 whitespace-pre-line">{biz.address}</p>}
                    {biz.gstNumber && <p className="text-xs text-slate-500 mt-0.5">GSTIN {biz.gstNumber}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold text-slate-900 tracking-wide">TAX INVOICE</p>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">{openInvoice.id}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 mb-0.5">Billed to</p>
                    <p className="font-medium text-slate-800">{openInvoice.clientName}</p>
                    <p className="text-slate-500">{openInvoice.clientEmail}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">{openInvoice.status === 'paid' ? 'Paid' : 'Due'}</p>
                    <p className="font-medium text-slate-800">{formatDate(openInvoice.status === 'paid' ? openInvoice.issuedDate : openInvoice.dueDate)}</p>
                    {(biz.contactEmail || biz.contactPhone) && <p className="text-slate-500 mt-1">Questions: {[biz.contactEmail, biz.contactPhone].filter(Boolean).join(' · ')}</p>}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-100 divide-y divide-slate-100 text-sm">
                  <div className="flex justify-between gap-4 px-3 py-2.5"><span className="text-slate-700">{openInvoice.licenseName}</span><span className="text-slate-900">{formatInr(base)}</span></div>
                  <div className="flex justify-between gap-4 px-3 py-2.5"><span className="text-slate-500">GST (18%)</span><span className="text-slate-700">{formatInr(openInvoice.amount - base)}</span></div>
                  <div className="flex justify-between gap-4 px-3 py-2.5 font-semibold"><span>Total</span><span>{formatInr(openInvoice.amount)}</span></div>
                </div>
                <p className="text-[10px] text-slate-400 text-center">Computer-generated invoice — no signature required.</p>
              </div>
            }
            footer={
              <div className="flex gap-2">
                <button type="button" onClick={printInvoice} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 flex items-center justify-center gap-2"><Printer size={15} /> Print / save PDF</button>
                {openInvoice.status === 'unpaid' && lic && (
                  <button type="button" onClick={() => { setOpenInvoiceId(null); pay(lic); }} className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Pay now</button>
                )}
              </div>
            }
          />
        );
      })()}

      {/* ── Payment ─────────────────────────────────────────────────────── */}
      {openPayment && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpenPaymentId(null)}
          title={formatInr(openPayment.amount)}
          subtitle={`${openPayment.licenseName} · ${formatDate(openPayment.paymentDate)}`}
          badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-100">Successful</span>}
          details={[
            { label: 'Paid on', value: openPayment.paymentDate },
            { label: 'Payment ID', value: <span className="font-mono text-xs">{openPayment.razorpayPaymentId || '—'}</span> },
            { label: 'Order ID', value: <span className="font-mono text-xs">{openPayment.razorpayOrderId || '—'}</span> },
          ]}
          groups={onNavigate ? [{ title: 'Help', actions: [{ key: 'q', label: 'Question about this payment?', description: 'Open a support ticket', icon: <LifeBuoy size={17} />, onClick: askSupport }] }] : []}
        />
      )}

      {paying && (
        <div className="fixed inset-0 z-[400] bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl px-6 py-5 flex items-center gap-3">
            <Loader2 size={20} className="animate-spin text-blue-600" />
            <span className="text-sm font-medium text-slate-800">Opening secure payment…</span>
          </div>
        </div>
      )}
    </div>
  );
}
