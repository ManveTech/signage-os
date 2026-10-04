import CustomSelect from '../../../components/CustomSelect';
import { STATE_NAMES, GSTIN_PATTERN, stateFromGstin } from '../../../lib/gst';
import { useEffect, useState } from 'react';
import { Plus, Search, Building2, Edit2, Trash2, Users, Globe, Image as ImageIcon } from 'lucide-react';
import { licensingStore, License } from '../../../lib/licensingStore';
import { mediaStore } from '../../../lib/mediaStore';
import { pushToDatabase, generatePocketBaseId, syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import { licenseState, formatDate, planLabel } from '../../../components/licenses/licenseStatus';
import { getEffectiveStatus } from './screens/MyScreens';

type Org = {
  id: string;
  name: string;
  adminName: string;
  email: string;
  planType?: string;
  screensAllowed?: number;
  storageLimit?: number;
  subscriptionStatus?: string;
  renewalDate?: string;
  customDomain?: string;
  websiteLogo?: string;
  websiteName?: string;
};

type FormState = { name: string; adminName: string; email: string; customDomain: string; websiteName: string; websiteLogo: string; billingName: string; billingAddress: string; state: string; gstin: string };

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

function errorText(result: any): string {
  const raw = result?.error;
  if (typeof raw !== 'string') return 'please try again';
  try { const p = JSON.parse(raw); return p.error || p.message || raw; } catch { return raw; }
}

/**
 * Client organizations: who they are, their license, how much of it they use,
 * and white-label branding. Organizations are normally created automatically
 * when a client is onboarded (Clients → Add client); this page is where they
 * are looked after.
 */
export default function Organizations({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  const [orgs, setOrgs] = useState<Org[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses());
  const [users, setUsers] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_users') || '[]'));
  const [screens, setScreens] = useState<any[]>(() => mediaStore.getScreens());
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [formFor, setFormFor] = useState<Org | 'new' | null>(null);
  const [form, setForm] = useState<FormState>({ name: '', adminName: '', email: '', customDomain: '', websiteName: '', websiteLogo: '', billingName: '', billingAddress: '', state: '', gstin: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);

  useEffect(() => {
    Promise.all([
      syncCollection('organizations', 'signageos_organizations').then(o => setOrgs(o)),
      syncCollection('licenses', 'signageos_licenses').then(() => setLicenses(licensingStore.getLicenses())),
      syncCollection('users', 'signageos_users').then(u => setUsers(u)),
      syncCollection('screens', 'signageos_screens').then(s => setScreens(s)),
      syncCollection('media_items', 'signageos_media'),
    ]);
  }, []);

  const lower = (v?: string) => (v || '').toLowerCase().trim();
  const membersOf = (o: Org) => users.filter(u => u.role !== 'admin' && u.role !== 'super_admin' && (lower(u.company) === lower(o.name) || lower(u.email) === lower(o.email)));
  const memberEmails = (o: Org) => new Set([lower(o.email), ...membersOf(o).map(u => lower(u.email))]);
  const licensesOf = (o: Org) => {
    const emails = memberEmails(o);
    return licenses.filter(l => (l.assignedUserEmail && emails.has(lower(l.assignedUserEmail))) || lower(l.assignedOrgName) === lower(o.name));
  };
  const mainLicense = (o: Org) => [...licensesOf(o)].sort((a, b) => (b.expiryDate || '').localeCompare(a.expiryDate || ''))[0];
  const screensOf = (o: Org) => {
    const emails = memberEmails(o);
    return screens.filter(s => emails.has(lower(s.assignedToUserEmail)) && s.status !== 'pairing' && s.status !== 'unlinked');
  };
  const onlineCount = (list: any[]) => list.filter(s => ['online', 'active'].includes(getEffectiveStatus(s))).length;
  const storageBytes = (o: Org) => [...memberEmails(o)].reduce((sum, e) => sum + mediaStore.getClientStorageUsedBytes(e), 0);

  // An org's status follows its license — the stored subscriptionStatus was
  // set once at creation and never updated, so it showed "active" forever.
  const stateOf = (o: Org) => {
    const lic = mainLicense(o);
    if (!lic) return { label: 'No license', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    const s = licenseState(lic);
    return { label: s.key === 'unassigned' ? 'Active' : s.label, className: s.key === 'unassigned' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : s.className };
  };

  const q = search.trim().toLowerCase();
  const visible = orgs
    .filter(o => !q || [o.name, o.adminName, o.email, o.customDomain].some(v => lower(v).includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name));

  const openForm = (o: Org | 'new') => {
    setForm(o === 'new'
      ? { name: '', adminName: '', email: '', customDomain: '', websiteName: '', websiteLogo: '', billingName: '', billingAddress: '', state: '', gstin: '' }
      : { name: o.name || '', adminName: o.adminName || '', email: o.email || '', customDomain: o.customDomain || '', websiteName: o.websiteName || '', websiteLogo: o.websiteLogo || '', billingName: (o as any).billingName || '', billingAddress: (o as any).billingAddress || '', state: (o as any).state || '', gstin: (o as any).gstin || '' });
    setFormFor(o);
  };

  const save = async () => {
    if (!form.name.trim() || !form.adminName.trim() || !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.warning('Name, contact and a valid email are required');
      return;
    }
    const domain = form.customDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const gstin = form.gstin.trim().toUpperCase();
    if (gstin && !GSTIN_PATTERN.test(gstin)) { toast.warning('That GSTIN should be 15 characters, like 29ABCDE1234F1Z5'); return; }
    const billing = { billingName: form.billingName.trim(), billingAddress: form.billingAddress.trim(), state: form.state || stateFromGstin(gstin), gstin };
    setSaving(true);
    if (formFor === 'new') {
      const org: Org = {
        id: generatePocketBaseId(),
        name: form.name.trim(),
        adminName: form.adminName.trim(),
        email: form.email.trim().toLowerCase(),
        planType: 'Starter',
        screensAllowed: 5,
        storageLimit: 5,
        subscriptionStatus: 'active',
        renewalDate: new Date(Date.now() + 365 * 86_400_000).toISOString().split('T')[0],
        customDomain: domain,
        ...billing,
      } as Org;
      const res = await pushToDatabase('organizations', org.id, org, 'POST');
      setSaving(false);
      if (!res.ok) { toast.error(`Couldn't create it: ${errorText(res)}`); return; }
      const next = [...orgs, org];
      setOrgs(next);
      localStorage.setItem('signageos_organizations', JSON.stringify(next));
      toast.success(`${org.name} added`);
    } else if (formFor) {
      // One save for the whole form — the custom-domain field used to send a
      // request to the server on every keystroke.
      const patch: Partial<Org> = {
        name: form.name.trim(),
        adminName: form.adminName.trim(),
        email: form.email.trim().toLowerCase(),
        customDomain: domain,
        websiteName: form.websiteName.trim(),
        websiteLogo: form.websiteLogo,
        ...billing,
      } as Partial<Org>;
      const res = await pushToDatabase('organizations', formFor.id, patch, 'PUT');
      setSaving(false);
      if (!res.ok) { toast.error(`Couldn't save: ${errorText(res)}`); return; }
      const saved = res.ok && res.data && typeof res.data === 'object' ? res.data : patch;
      const next = orgs.map(o => (o.id === formFor.id ? { ...o, ...patch, websiteLogo: (saved as any).websiteLogo ?? patch.websiteLogo } : o));
      setOrgs(next);
      localStorage.setItem('signageos_organizations', JSON.stringify(next));
      toast.success('Organization saved');
    }
    setFormFor(null);
  };

  const remove = async (o: Org) => {
    const res = await pushToDatabase('organizations', o.id, null, 'DELETE');
    if (!res.ok) { toast.error(`Couldn't delete: ${errorText(res)}`); return; }
    const next = orgs.filter(x => x.id !== o.id);
    setOrgs(next);
    localStorage.setItem('signageos_organizations', JSON.stringify(next));
    setDeleteTarget(null);
    setOpenId(null);
    toast.success(`${o.name} deleted`);
  };

  const open = openId ? orgs.find(o => o.id === openId) : null;
  const pill = (text: string, cls: string) => <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{text}</span>;
  const gb = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);
  const editingWhiteLabel = formFor && formFor !== 'new' && licensesOf(formFor).some(l => l.whiteLabel);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Organizations</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orgs.length ? `${orgs.length} organization${orgs.length === 1 ? '' : 's'} — tap one for details` : 'The companies your clients belong to'}</p>
        </div>
        <button onClick={() => openForm('new')} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Add organization
        </button>
      </div>

      {orgs.length > 3 && (
        <div className="relative md:max-w-sm">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search organizations" className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white" />
        </div>
      )}

      {visible.length > 0 && (
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_80px_130px_130px] gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>Organization</span><span>Contact</span><span>People</span><span>Screens online</span><span className="text-right">License</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map(o => {
              const sc = screensOf(o);
              const st = stateOf(o);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOpenId(o.id)}
                  className="w-full grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_80px_130px_130px] gap-4 items-center px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 overflow-hidden">
                      {o.websiteLogo ? <img src={o.websiteLogo} alt="" className="w-full h-full object-contain" /> : <Building2 size={16} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{o.name}</span>
                      {o.customDomain && <span className="block text-xs text-slate-500 truncate">{o.customDomain}</span>}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{o.adminName}</span>
                    <span className="block text-xs text-slate-500 truncate">{o.email}</span>
                  </span>
                  <span className="text-sm text-slate-700">{membersOf(o).length}</span>
                  <span className="text-sm text-slate-700">{onlineCount(sc)} / {sc.length}</span>
                  <span className="flex justify-end">{pill(st.label, st.className)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
        {visible.map(o => {
          const sc = screensOf(o);
          const lic = mainLicense(o);
          const st = stateOf(o);
          const people = membersOf(o).length;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOpenId(o.id)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 flex items-center gap-3 transition-colors"
            >
              <span className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 overflow-hidden">
                {o.websiteLogo ? <img src={o.websiteLogo} alt="" className="w-full h-full object-contain" /> : <Building2 size={19} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-900 truncate">{o.name}</span>
                <span className="block text-xs text-slate-500 truncate">{o.adminName}{people > 1 ? ` · ${people} people` : ''}</span>
                <span className="block text-xs text-slate-400 mt-0.5 truncate">
                  {onlineCount(sc)}/{sc.length} screens online{lic ? ` · ${lic.deviceLimit || 5} allowed` : ''}
                </span>
              </span>
              {pill(st.label, st.className)}
            </button>
          );
        })}
      </div>

      {orgs.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Building2 size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No organizations yet</p>
          <p className="text-xs text-gray-500 mt-1">They're created automatically when you add a client.</p>
          {onNavigate && (
            <button onClick={() => onNavigate('users')} className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium">
              <Users size={16} /> Add a client
            </button>
          )}
        </div>
      )}
      {orgs.length > 0 && visible.length === 0 && <p className="text-sm text-gray-500 text-center py-8">No organizations match.</p>}

      {open && (() => {
        const sc = screensOf(open);
        const lic = mainLicense(open);
        const st = stateOf(open);
        const members = membersOf(open);
        const limitScreens = licensesOf(open).reduce((s, l) => s + (l.deviceLimit || 0), 0);
        const limitGb = licensesOf(open).reduce((s, l) => s + (l.storageLimit || 0), 0);
        const used = storageBytes(open);
        const whiteLabel = licensesOf(open).some(l => l.whiteLabel);
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={open.name}
            subtitle={`${open.adminName} · ${open.email}`}
            badge={pill(st.label, st.className)}
            hero={limitScreens > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Screens', value: `${sc.length} of ${limitScreens}`, sub: `${onlineCount(sc)} online`, pct: sc.length / limitScreens },
                  { label: 'Storage', value: `${gb(used)} of ${limitGb} GB`, sub: `${Math.round((used / (limitGb * 1024 ** 3 || 1)) * 100)}% used`, pct: used / (limitGb * 1024 ** 3 || 1) },
                ].map(k => (
                  <div key={k.label} className="rounded-2xl border border-slate-100 p-3">
                    <p className="text-xs text-slate-500">{k.label}</p>
                    <p className="text-sm font-semibold text-slate-900 mt-0.5">{k.value}</p>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2">
                      <div className={`h-full rounded-full ${k.pct > 0.9 ? 'bg-rose-500' : k.pct > 0.7 ? 'bg-amber-400' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, k.pct * 100)}%` }} />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{k.sub}</p>
                  </div>
                ))}
              </div>
            ) : undefined}
            details={[
              { label: 'License', value: lic ? `${lic.name}` : <span className="text-slate-400">None</span> },
              ...(lic ? [{ label: 'Plan', value: planLabel(lic) }, { label: 'Renews', value: formatDate(lic.expiryDate) }] : []),
              { label: 'People', value: members.length ? members.map(m => m.name).join(', ') : <span className="text-slate-400">No sign-ins yet</span> },
              { label: 'White label', value: whiteLabel ? (open.websiteName || 'On — not set up yet') : <span className="text-slate-400">Not in their license</span> },
              ...(open.customDomain ? [{ label: 'Custom domain', value: open.customDomain }] : []),
              ...((open as any).gstin || (open as any).billingAddress ? [{ label: 'Invoices to', value: [(open as any).billingName || open.name, (open as any).state, (open as any).gstin && `GSTIN ${(open as any).gstin}`].filter(Boolean).join(' · ') }] : []),
            ]}
            groups={[
              {
                title: 'Organization',
                actions: [
                  { key: 'edit', label: 'Edit details', description: whiteLabel ? 'Name, contact, domain and branding' : 'Name, contact and custom domain', icon: <Edit2 size={17} />, onClick: () => openForm(open) },
                  ...(onNavigate ? [{ key: 'people', label: 'Manage people & license', description: 'Open them in Clients', icon: <Users size={17} />, onClick: () => onNavigate('users') }] : []),
                ]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'delete',
                  label: 'Delete organization',
                  description: members.length ? `${members.length} client account${members.length === 1 ? '' : 's'} stay — remove them in Clients` : 'This can\'t be undone',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setDeleteTarget(open)
                }]
              }
            ]}
          />
        );
      })()}

      {formFor && (
        <ScreenDetailsSheet
          open
          onClose={() => setFormFor(null)}
          title={formFor === 'new' ? 'Add organization' : 'Edit organization'}
          subtitle={formFor === 'new' ? 'Usually created for you when you add a client' : formFor.name}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Organization name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Barista Coffee" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Contact person</label>
                  <input value={form.adminName} onChange={e => setForm(f => ({ ...f, adminName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Contact email</label>
                  <input type="email" inputMode="email" autoCapitalize="none" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}><Globe size={12} className="inline mr-1 -mt-0.5" />Custom domain <span className="text-slate-400 font-normal">(optional)</span></label>
                <input value={form.customDomain} onChange={e => setForm(f => ({ ...f, customDomain: e.target.value }))} placeholder="cms.theircompany.com" className={inputCls} autoCapitalize="none" />
                <p className="text-xs text-slate-500 mt-1.5">Point a CNAME for this domain at your dashboard so their team signs in on their own address.</p>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">Invoice details</p>
                  <p className="text-xs text-slate-500 mt-0.5">Printed on their invoices. They can also fill these in themselves under License & Billing.</p>
                </div>
                <div>
                  <label className={labelCls}>Registered business name</label>
                  <input value={form.billingName} onChange={e => setForm(f => ({ ...f, billingName: e.target.value }))} placeholder={form.name} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Billing address</label>
                  <textarea rows={2} value={form.billingAddress} onChange={e => setForm(f => ({ ...f, billingAddress: e.target.value }))} className={`${inputCls} h-auto py-2.5`} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>GSTIN <span className="text-slate-400 font-normal">(optional)</span></label>
                    <input value={form.gstin} maxLength={15} onChange={e => { const g = e.target.value.toUpperCase(); setForm(f => ({ ...f, gstin: g, state: stateFromGstin(g) || f.state })); }} placeholder="29ABCDE1234F1Z5" className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <CustomSelect value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} options={[{ value: '', label: 'Select state' }, ...STATE_NAMES.map(n => ({ value: n, label: n }))]} buttonClassName="h-11 px-3 text-sm" />
                  </div>
                </div>
              </div>

              {editingWhiteLabel && (
                <div className="rounded-2xl border border-slate-100 p-4 space-y-3">
                  <p className="text-sm font-medium text-slate-900">White-label branding</p>
                  <div>
                    <label className={labelCls}>Brand name shown in the app and on TVs</label>
                    <input value={form.websiteName} onChange={e => setForm(f => ({ ...f, websiteName: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-14 h-14 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                      {form.websiteLogo ? <img src={form.websiteLogo} alt="" className="w-full h-full object-contain" /> : <ImageIcon size={18} className="text-slate-400" />}
                    </span>
                    <label className="flex-1 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                      {form.websiteLogo ? 'Change logo' : 'Upload logo'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) { toast.warning('Logo must be under 2 MB'); return; }
                          const reader = new FileReader();
                          reader.onloadend = () => setForm(f => ({ ...f, websiteLogo: reader.result as string }));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                    {form.websiteLogo && <button type="button" onClick={() => setForm(f => ({ ...f, websiteLogo: '' }))} className="h-11 px-3 rounded-xl text-sm text-rose-600 hover:bg-rose-50">Remove</button>}
                  </div>
                </div>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setFormFor(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={save} disabled={saving} className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
                {saving ? 'Saving…' : formFor === 'new' ? 'Add organization' : 'Save changes'}
              </button>
            </div>
          }
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          body={<p>The organization record and its branding are removed. Client accounts and licenses aren't touched — manage those in Clients. This can't be undone.</p>}
          confirmLabel="Delete organization"
          tone="danger"
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => remove(deleteTarget)}
        />
      )}
    </div>
  );
}
