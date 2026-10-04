import type { Invoice, BusinessDetails } from '../../lib/licensingStore';
import { taxSplit, amountInWords, stateCode, stateFromGstin } from '../../lib/gst';
import { formatDate } from './licenseStatus';
import defaultLogo from '../../assets/brand-logo.png';

const money = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * A GST tax invoice (or receipt once paid): supplier and recipient with
 * GSTINs, place of supply, SAC, the CGST+SGST or IGST split, the total in
 * words and the payment reference. Rendered on screen and printed to A4
 * (see .print-invoice in index.css). Prices include GST.
 */
export default function TaxInvoice({ invoice, biz, planLabel }: { invoice: Invoice; biz: BusinessDetails; planLabel?: string }) {
  const supplierState = biz.state || 'Karnataka';
  const to = invoice.billTo || { name: invoice.clientName, email: invoice.clientEmail, address: '', state: '', gstin: '' };
  const place = to.state || stateFromGstin(to.gstin) || supplierState;
  const t = taxSplit(Number(invoice.amount) || 0, supplierState, place);
  const paid = invoice.status === 'paid';
  const ref = invoice.paymentRef ? (invoice.paymentRef.startsWith('manual_') ? 'Recorded by hand' : invoice.paymentRef) : '';
  const cell = 'px-3 py-2';

  return (
    <div id="invoice-print-area" className="bg-white text-slate-800 rounded-2xl border border-slate-200 p-5 sm:p-7 text-[13px] leading-relaxed">
      {/* Supplier + title */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <img src={biz.logoUrl || defaultLogo} alt={biz.name} className="h-11 w-auto max-w-[200px] object-contain mb-2" />
          <p className="font-semibold text-slate-900">{biz.name || 'BlueStar DigiTech'}</p>
          {biz.address && <p className="text-slate-500 whitespace-pre-line">{biz.address}</p>}
          <p className="text-slate-500">
            {biz.gstNumber && <>GSTIN <span className="font-mono text-slate-700">{biz.gstNumber}</span> · </>}
            {supplierState}{stateCode(supplierState) && ` (${stateCode(supplierState)})`}
          </p>
          {(biz.contactEmail || biz.contactPhone) && <p className="text-slate-500">{[biz.contactEmail, biz.contactPhone].filter(Boolean).join(' · ')}</p>}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold tracking-wide text-slate-900">TAX INVOICE</p>
          <p className="font-mono text-slate-700 mt-0.5">{invoice.number || '—'}</p>
          <span className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide border ${paid ? 'text-emerald-700 border-emerald-300 bg-emerald-50' : 'text-amber-700 border-amber-300 bg-amber-50'}`}>{paid ? 'PAID' : 'DUE'}</span>
        </div>
      </div>

      {/* Dates + recipient */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-200">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Billed to</p>
          <p className="font-semibold text-slate-900">{to.name || invoice.clientName}</p>
          {to.address && <p className="text-slate-600 whitespace-pre-line">{to.address}</p>}
          {to.gstin && <p className="text-slate-600">GSTIN <span className="font-mono">{to.gstin}</span></p>}
          <p className="text-slate-500">{to.email || invoice.clientEmail}</p>
        </div>
        <div className="sm:text-right space-y-0.5">
          <p><span className="text-slate-400">Invoice date </span>{formatDate(invoice.issuedDate)}</p>
          {paid
            ? <p><span className="text-slate-400">Paid on </span>{formatDate(invoice.paidDate || invoice.issuedDate)}</p>
            : <p><span className="text-slate-400">Due by </span>{formatDate(invoice.dueDate)}</p>}
          <p><span className="text-slate-400">Place of supply </span>{place}{stateCode(place) && ` (${stateCode(place)})`}</p>
        </div>
      </div>

      {/* Line item */}
      <table className="w-full mt-6 border border-slate-200 rounded-lg overflow-hidden">
        <thead>
          <tr className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
            <th className={cell}>Description</th>
            <th className={`${cell} hidden sm:table-cell`}>SAC</th>
            <th className={`${cell} text-right`}>Taxable value</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200 align-top">
            <td className={cell}>
              <p className="font-medium text-slate-900">{invoice.licenseName}</p>
              <p className="text-slate-500">{planLabel || 'Digital signage software license'}</p>
            </td>
            <td className={`${cell} hidden sm:table-cell font-mono text-slate-600`}>{biz.sac || '997331'}</td>
            <td className={`${cell} text-right`}>{money(t.taxable)}</td>
          </tr>
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mt-3">
        <table className="w-full sm:w-72">
          <tbody>
            <tr><td className="py-1 text-slate-500">Taxable value</td><td className="py-1 text-right">{money(t.taxable)}</td></tr>
            {t.intra ? (
              <>
                <tr><td className="py-1 text-slate-500">CGST 9%</td><td className="py-1 text-right">{money(t.cgst)}</td></tr>
                <tr><td className="py-1 text-slate-500">SGST 9%</td><td className="py-1 text-right">{money(t.sgst)}</td></tr>
              </>
            ) : (
              <tr><td className="py-1 text-slate-500">IGST 18%</td><td className="py-1 text-right">{money(t.igst)}</td></tr>
            )}
            <tr className="border-t border-slate-300"><td className="pt-2 font-bold text-slate-900">Total</td><td className="pt-2 text-right font-bold text-slate-900 text-base">{money(Number(invoice.amount) || 0)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-slate-600"><span className="text-slate-400">Amount in words: </span>{amountInWords(Number(invoice.amount) || 0)}</p>

      {/* Payment */}
      <div className="mt-5 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div className="text-slate-500">
          {paid
            ? <p>Paid{invoice.paymentRef?.startsWith('manual_') ? ' · recorded by hand' : ref && <> · Payment ref <span className="font-mono text-slate-700">{ref}</span></>}</p>
            : <p>Pay online from the Billing page of your dashboard.</p>}
          <p className="text-[11px] text-slate-400 mt-1">Reverse charge: No. This is a computer-generated invoice and needs no signature.</p>
        </div>
        <p className="text-[11px] text-slate-400 sm:text-right">{biz.name}</p>
      </div>
    </div>
  );
}
