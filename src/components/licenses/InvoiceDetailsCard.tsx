import { useEffect, useState } from 'react';
import { Building2, Loader2, Pencil } from 'lucide-react';
import { API_BASE } from '../../config';
import { getHeaders } from '../../lib/syncHelper';
import { STATE_NAMES, GSTIN_PATTERN, stateFromGstin } from '../../lib/gst';
import CustomSelect from '../CustomSelect';
import { toast } from '../Toast';

type Billing = { billingName: string; billingAddress: string; state: string; gstin: string; noOrganization?: boolean };

/**
 * License & Billing → the client's own details printed on their invoices:
 * registered business name, address, state and GSTIN (so they can claim
 * input tax credit). New invoices use them; issued ones keep what they had.
 */
export default function InvoiceDetailsCard() {
  const [data, setData] = useState<Billing | null>(null);
  const [draft, setDraft] = useState<Billing | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/me/billing`, { headers: getHeaders() })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data || data.noOrganization) return null;

  const gstinOk = !draft?.gstin || GSTIN_PATTERN.test(draft.gstin.toUpperCase());
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/me/billing`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(draft) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Could not save');
      setData(body); setDraft(null);
      toast.success('Invoice details saved — new invoices will use them');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
  const empty = !data.billingAddress && !data.gstin;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0"><Building2 size={16} /></span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900">Invoice details</p>
          {!draft && (
            empty
              ? <p className="text-xs text-slate-500 mt-0.5">Add your business address and GSTIN to show them on your invoices.</p>
              : <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                  <p className="font-medium text-slate-800">{data.billingName}</p>
                  {data.billingAddress && <p className="whitespace-pre-line">{data.billingAddress}</p>}
                  <p>{[data.state, data.gstin && `GSTIN ${data.gstin}`].filter(Boolean).join(' · ')}</p>
                </div>
          )}
        </div>
        {!draft && (
          <button type="button" onClick={() => setDraft({ ...data })} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50">
            <Pencil size={13} /> {empty ? 'Add' : 'Edit'}
          </button>
        )}
      </div>

      {draft && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-600 mb-1">Registered business name</span>
            <input className={input} value={draft.billingName} onChange={e => setDraft({ ...draft, billingName: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-semibold text-slate-600 mb-1">Billing address</span>
            <textarea rows={2} className={`${input} h-auto py-2.5`} value={draft.billingAddress} onChange={e => setDraft({ ...draft, billingAddress: e.target.value })} />
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">GSTIN <span className="font-normal text-slate-400">(optional)</span></span>
            <input
              className={`${input} font-mono uppercase ${gstinOk ? '' : 'border-rose-300'}`}
              value={draft.gstin}
              placeholder="29ABCDE1234F1Z5"
              maxLength={15}
              onChange={e => {
                const gstin = e.target.value.toUpperCase();
                setDraft({ ...draft, gstin, state: stateFromGstin(gstin) || draft.state });
              }}
            />
            {!gstinOk && <span className="block text-[11px] text-rose-600 mt-1">15 characters, like 29ABCDE1234F1Z5</span>}
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-slate-600 mb-1">State</span>
            <CustomSelect value={draft.state} onChange={v => setDraft({ ...draft, state: v })} options={[{ value: '', label: 'Select state' }, ...STATE_NAMES.map(n => ({ value: n, label: n }))]} buttonClassName="h-11 px-3 text-sm" />
          </label>
          <div className="sm:col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setDraft(null)} className="h-10 px-4 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !gstinOk} className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-1.5">
              {saving && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
