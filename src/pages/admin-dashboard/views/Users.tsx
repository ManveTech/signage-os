import { useEffect, useState } from 'react';
import {
  Plus, Search, Edit2, Trash2, Mail, Phone, Key, Users as UsersIcon, RefreshCw, Copy, Check,
  Radio, MessageSquare, Camera, Video
} from 'lucide-react';
import type { User as UserType } from '../types';
import { licensingStore, License } from '../../../lib/licensingStore';
import { pushToDatabase, generateClientPassword, syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';
import { licenseState, LicenseStateKey, formatDate, planLabel } from '../../../components/licenses/licenseStatus';

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

type ClientState = LicenseStateKey | 'none';

function initials(name: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]!.toUpperCase()).join('');
}

function errorText(result: any): string {
  const raw = result?.error;
  if (typeof raw !== 'string') return 'please try again';
  try {
    const parsed = JSON.parse(raw);
    return parsed.error || parsed.message || raw;
  } catch {
    return raw;
  }
}

function FeatureToggle({ checked, onChange, label, hint, icon }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint: string; icon: React.ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50">
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

/** Pool license as a selectable card (used when onboarding and when changing a client's license). */
function LicenseOption({ lic, selected, onSelect, note }: { lic: License; selected: boolean; onSelect: () => void; note?: string }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}
    >
      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-blue-600' : 'border-slate-300'}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900 truncate">{lic.name}</span>
        <span className="block text-xs text-slate-500 truncate">
          {planLabel(lic)} · {lic.deviceLimit || 5} screens · {lic.storageLimit || 5} GB{note ? ` · ${note}` : ''}
        </span>
      </span>
    </button>
  );
}

export default function Users({ onNavigate }: { onNavigate?: (view: string) => void } = {}) {
  const [users, setUsers] = useState<UserType[]>(() => {
    const data = localStorage.getItem('signageos_users');
    return (data ? JSON.parse(data) : []).filter((u: any) => u.role !== 'super_admin' && u.role !== 'admin');
  });
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses());
  const [screens, setScreens] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_screens') || '[]'));
  const [organizations, setOrganizations] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | ClientState | 'attention'>('all');

  const [openId, setOpenId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserType | null>(null);

  // Edit details
  const [editing, setEditing] = useState<UserType | null>(null);
  const [edit, setEdit] = useState({ name: '', mobile: '', company: '', address: '' });
  const [saving, setSaving] = useState(false);

  // Change license
  const [licenseFor, setLicenseFor] = useState<UserType | null>(null);
  const [licenseChoice, setLicenseChoice] = useState('');

  // Add client
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState({ name: '', email: '', mobile: '', address: '', company: '', licenseId: '', password: '', sendEmail: true });
  const [features, setFeatures] = useState({ enableBroadcasting: true, enableLiveChat: true, enableCameraMonitoring: false });
  const [onboarding, setOnboarding] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    const [serverUsers] = await Promise.all([
      syncCollection('users', 'signageos_users'),
      syncCollection('licenses', 'signageos_licenses'),
      syncCollection('organizations', 'signageos_organizations').then(o => { if (o.length) setOrganizations(o); }),
      syncCollection('screens', 'signageos_screens').then(s => setScreens(s)),
    ]);
    setUsers(serverUsers.filter((u: any) => u.role !== 'super_admin' && u.role !== 'admin'));
    setLicenses(licensingStore.getLicenses());
  };

  useEffect(() => { refresh(); }, []);

  // A client can hold more than one license; the one expiring last decides
  // their status (that's how long their screens keep playing).
  const licenseOf = (email: string) => licenses
    .filter(l => l.assignedUserEmail?.toLowerCase() === email.toLowerCase())
    .sort((a, b) => (b.expiryDate || '').localeCompare(a.expiryDate || ''))[0];
  const stateOf = (u: UserType): { key: ClientState; label: string; className: string } => {
    const lic = licenseOf(u.email);
    if (!lic) return { key: 'none', label: 'No license', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    const s = licenseState(lic);
    return { key: s.key, label: s.label, className: s.className };
  };
  const screensUsed = (email: string) => screens.filter(s => s.assignedToUserEmail === email && s.status !== 'pairing' && s.status !== 'unlinked').length;
  const poolLicenses = licenses.filter(l => !l.assignedUserEmail);

  const needsAttention = (k: ClientState) => k === 'expired' || k === 'expiring' || k === 'pending' || k === 'none';
  const counts = {
    attention: users.filter(u => needsAttention(stateOf(u).key)).length,
    active: users.filter(u => stateOf(u).key === 'active').length,
  };
  const q = search.trim().toLowerCase();
  const visible = users
    .filter(u => filter === 'all' || (filter === 'attention' ? needsAttention(stateOf(u).key) : stateOf(u).key === filter))
    .filter(u => !q || [u.name, u.email, u.company, u.mobile].some(v => (v || '').toLowerCase().includes(q)))
    .sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name));

  // ── Edit details ──────────────────────────────────────────────────────────
  const openEdit = (u: UserType) => {
    setEditing(u);
    setEdit({ name: u.name || '', mobile: u.mobile || '', company: u.company || '', address: u.address || '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!edit.name.trim() || !edit.mobile.trim() || !edit.company.trim()) {
      toast.warning('Name, phone and organization are required');
      return;
    }
    setSaving(true);
    const updatedUser = { ...editing, name: edit.name.trim(), mobile: edit.mobile.trim(), company: edit.company.trim(), address: edit.address.trim() };
    const result = await pushToDatabase('users', editing.id, updatedUser, 'PUT');
    setSaving(false);
    if (!result.ok) {
      toast.error(`Couldn't save: ${errorText(result)}`);
      return;
    }
    // Renaming the organization renames it everywhere it shows up.
    if (editing.company && editing.company !== updatedUser.company) {
      licenses.filter(l => l.assignedUserEmail === editing.email).forEach(l => {
        licensingStore.updateLicense(l.id, { assignedOrgName: updatedUser.company });
      });
      const orgs = organizations.map((o: any) => {
        if ((o.name || '').toLowerCase() !== editing.company.toLowerCase()) return o;
        const renamed = { ...o, name: updatedUser.company };
        pushToDatabase('organizations', o.id, renamed, 'PUT');
        return renamed;
      });
      setOrganizations(orgs);
      localStorage.setItem('signageos_organizations', JSON.stringify(orgs));
    }
    const next = users.map(u => (u.id === editing.id ? updatedUser : u));
    setUsers(next);
    localStorage.setItem('signageos_users', JSON.stringify(next));
    setLicenses(licensingStore.getLicenses());
    setEditing(null);
    toast.success('Client details saved');
  };

  // ── Change license ────────────────────────────────────────────────────────
  const openLicensePicker = (u: UserType) => {
    setLicenseFor(u);
    setLicenseChoice(licenseOf(u.email)?.id || '');
  };

  const saveLicense = () => {
    if (!licenseFor) return;
    const current = licenseOf(licenseFor.email);
    if ((current?.id || '') === licenseChoice) { setLicenseFor(null); return; }
    if (current) {
      licensingStore.updateLicense(current.id, { assignedUserEmail: undefined, assignedOrgName: undefined, assignedOrgId: undefined });
    }
    if (licenseChoice) {
      const org = organizations.find((o: any) => o.name === licenseFor.company);
      licensingStore.updateLicense(licenseChoice, { assignedUserEmail: licenseFor.email, assignedOrgName: licenseFor.company, assignedOrgId: org?.id || '' });
    }
    setLicenses(licensingStore.getLicenses());
    setLicenseFor(null);
    toast.success(licenseChoice ? 'License assigned' : 'License removed — it\'s back in the pool');
  };

  // ── Remove ────────────────────────────────────────────────────────────────
  const removeClient = async (u: UserType) => {
    const result = await pushToDatabase('users', u.id, null, 'DELETE');
    if (!result.ok) {
      toast.error(`Couldn't remove ${u.name}: ${errorText(result)}`);
      return;
    }
    licenses.filter(l => l.assignedUserEmail === u.email).forEach(l => {
      licensingStore.updateLicense(l.id, { assignedUserEmail: undefined, assignedOrgName: undefined, assignedOrgId: undefined });
    });
    const next = users.filter(x => x.id !== u.id);
    setUsers(next);
    localStorage.setItem('signageos_users', JSON.stringify(next));
    setLicenses(licensingStore.getLicenses());
    setRemoveTarget(null);
    setOpenId(null);
    toast.success(`${u.name} removed`);
  };

  // ── Add client ────────────────────────────────────────────────────────────
  const openAdd = () => {
    setDraft({ name: '', email: '', mobile: '', address: '', company: '', licenseId: '', password: '', sendEmail: true });
    setFeatures({ enableBroadcasting: true, enableLiveChat: true, enableCameraMonitoring: false });
    setStep(1);
    setCopied(false);
    setAddOpen(true);
  };

  const nextStep = () => {
    if (step === 1) {
      if (!draft.name.trim() || !draft.email.trim() || !draft.mobile.trim()) { toast.warning('Name, email and phone are required'); return; }
      if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) { toast.warning('That email doesn\'t look right'); return; }
      if (users.some(u => u.email.toLowerCase() === draft.email.trim().toLowerCase())) { toast.warning('A client with this email already exists'); return; }
      setStep(2);
    } else if (step === 2) {
      if (!draft.company.trim()) { toast.warning('Enter the organization name'); return; }
      if (!draft.licenseId) { toast.warning('Pick a license for this client'); return; }
      if (!draft.password) setDraft(d => ({ ...d, password: generateClientPassword(d.name) }));
      setStep(3);
    }
  };

  const onboard = async () => {
    setOnboarding(true);
    const result = await pushToDatabase('users', '', {
      name: draft.name.trim(),
      email: draft.email.trim().toLowerCase(),
      mobile: draft.mobile.trim(),
      address: draft.address.trim(),
      company: draft.company.trim(),
      licenseId: draft.licenseId,
      password: draft.password,
      sendEmail: draft.sendEmail,
      role: 'org_admin',
      ...features,
    }, 'POST');
    setOnboarding(false);
    if (!result.ok) {
      toast.error(`Couldn't add the client: ${errorText(result)}`);
      return;
    }
    await refresh();
    setAddOpen(false);
    toast.success(draft.sendEmail ? `Client added — login details emailed to ${draft.email.trim()}` : 'Client added');
  };

  const open = openId ? users.find(u => u.id === openId) : null;
  const pill = (text: string, cls: string) => <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>{text}</span>;
  const selectedPoolLicense = licenses.find(l => l.id === draft.licenseId);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {users.length ? `${users.length} client${users.length === 1 ? '' : 's'}${counts.attention ? ` · ${counts.attention} need${counts.attention === 1 ? 's' : ''} attention` : ''}` : 'The businesses you run screens for'}
          </p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Add client
        </button>
      </div>

      {users.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative md:w-80 md:order-2 md:ml-auto">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients"
              className="w-full h-11 pl-10 pr-4 text-sm border border-gray-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 md:order-1">
            {([
              { key: 'all', label: 'All', count: users.length },
              { key: 'active', label: 'Active', count: counts.active },
              { key: 'attention', label: 'Needs attention', count: counts.attention },
            ] as const).map(c => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => setFilter(c.key)}
                  aria-pressed={active}
                  className={`shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-semibold transition-colors ${
                    active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {c.label}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] leading-none ${active ? 'bg-white/20' : c.key === 'attention' && c.count ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{c.count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Desktop: one row per client with aligned columns — cards stretched
          across a wide screen left big empty gaps. */}
      {visible.length > 0 && (
        <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_110px_120px_130px] gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>Client</span><span>Contact</span><span>Screens</span><span>Renews</span><span className="text-right">Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {visible.map(u => {
              const lic = licenseOf(u.email);
              const st = stateOf(u);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setOpenId(u.id)}
                  className="w-full grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_110px_120px_130px] gap-4 items-center px-5 py-3 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 text-white text-xs font-semibold flex items-center justify-center shrink-0">{initials(u.name)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">{u.company || u.name}</span>
                      <span className="block text-xs text-slate-500 truncate">{lic ? lic.name : 'No license'}</span>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-700 truncate">{u.name}</span>
                    <span className="block text-xs text-slate-500 truncate">{u.email}</span>
                  </span>
                  <span className="text-sm text-slate-700">{lic ? `${screensUsed(u.email)} / ${lic.deviceLimit || 5}` : screensUsed(u.email)}</span>
                  <span className="text-sm text-slate-700">{lic ? formatDate(lic.expiryDate) : '—'}</span>
                  <span className="flex justify-end">{pill(st.label, st.className)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:hidden">
        {visible.map(u => {
          const lic = licenseOf(u.email);
          const st = stateOf(u);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setOpenId(u.id)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 hover:border-slate-200 hover:shadow-sm p-4 flex items-center gap-3 transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-teal-500 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                {initials(u.name)}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 truncate">{u.company || u.name}</span>
                </span>
                <span className="block text-xs text-slate-500 truncate">{u.company ? u.name : u.email}</span>
                <span className="block text-xs text-slate-400 mt-0.5 truncate">
                  {lic ? `${screensUsed(u.email)}/${lic.deviceLimit || 5} screens · ${formatDate(lic.expiryDate)}` : 'No license — screens won\'t play'}
                </span>
              </span>
              {pill(st.label, st.className)}
            </button>
          );
        })}
      </div>

      {users.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <UsersIcon size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No clients yet</p>
          <p className="text-xs text-gray-500 mt-1">Add a client to give them their own dashboard and screens.</p>
          <button onClick={openAdd} className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> Add client
          </button>
        </div>
      )}
      {users.length > 0 && visible.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No clients match.</p>
      )}

      {/* ── Client sheet ─────────────────────────────────────────────────── */}
      {open && (() => {
        const lic = licenseOf(open.email);
        const st = stateOf(open);
        const extra = licenses.filter(l => l.assignedUserEmail === open.email).length - 1;
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setOpenId(null)}
            title={open.company || open.name}
            subtitle={open.company ? open.name : open.email}
            badge={pill(st.label, st.className)}
            details={[
              { label: 'Email', value: <a href={`mailto:${open.email}`} className="text-blue-600" onClick={e => e.stopPropagation()}>{open.email}</a> },
              ...(open.mobile ? [{ label: 'Phone', value: <a href={`tel:${open.mobile.replace(/\s+/g, '')}`} className="text-blue-600">{open.mobile}</a> }] : []),
              ...(open.address ? [{ label: 'Address', value: open.address }] : []),
              { label: 'License', value: lic ? `${lic.name}${extra > 0 ? ` +${extra} more` : ''}` : <span className="text-slate-400">None</span> },
              ...(lic ? [
                { label: 'Plan', value: planLabel(lic) },
                { label: 'Expires', value: formatDate(lic.expiryDate) },
                { label: 'Screens', value: `${screensUsed(open.email)} of ${lic.deviceLimit || 5} in use` },
              ] : [{ label: 'Screens', value: `${screensUsed(open.email)} paired` }]),
            ]}
            groups={[
              {
                title: 'Client',
                actions: [
                  { key: 'edit', label: 'Edit details', description: 'Name, phone, organization and address', icon: <Edit2 size={17} />, onClick: () => openEdit(open) },
                  {
                    key: 'license',
                    label: lic ? 'Change license' : 'Assign a license',
                    description: lic ? 'Swap for another license from the pool' : poolLicenses.length ? `${poolLicenses.length} available in the pool` : 'No free licenses — create one first',
                    icon: <Key size={17} />,
                    onClick: () => (lic || poolLicenses.length ? openLicensePicker(open) : onNavigate?.('licenses-management'))
                  },
                ]
              },
              {
                title: 'Contact',
                actions: [
                  { key: 'mail', label: 'Send an email', description: open.email, icon: <Mail size={17} />, onClick: () => { window.location.href = `mailto:${open.email}`; } },
                  ...(open.mobile ? [{ key: 'call', label: 'Call', description: open.mobile, icon: <Phone size={17} />, onClick: () => { window.location.href = `tel:${open.mobile.replace(/\s+/g, '')}`; } }] : []),
                ]
              },
              {
                title: 'Danger zone',
                actions: [{
                  key: 'remove',
                  label: 'Remove client',
                  description: 'Deletes their account; licenses go back to the pool',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  onClick: () => setRemoveTarget(open)
                }]
              }
            ]}
          />
        );
      })()}

      {/* ── Edit details ─────────────────────────────────────────────────── */}
      {editing && (
        <ScreenDetailsSheet
          open
          onClose={() => setEditing(null)}
          title="Edit client"
          subtitle={editing.email}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Contact name</label>
                <input value={edit.name} onChange={e => setEdit(v => ({ ...v, name: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone</label>
                <input type="tel" value={edit.mobile} onChange={e => setEdit(v => ({ ...v, mobile: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Organization</label>
                <input value={edit.company} onChange={e => setEdit(v => ({ ...v, company: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <textarea rows={2} value={edit.address} onChange={e => setEdit(v => ({ ...v, address: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none" />
              </div>
              <p className="text-xs text-slate-500">The email is their login, so it can't be changed here.</p>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
              <button type="button" onClick={saveEdit} disabled={saving} className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          }
        />
      )}

      {/* ── Change license ───────────────────────────────────────────────── */}
      {licenseFor && (() => {
        const current = licenseOf(licenseFor.email);
        // Only this client's license and free ones — the old picker listed
        // every license, so choosing one could silently take it from another
        // client.
        const options = [...(current ? [current] : []), ...poolLicenses];
        return (
          <ScreenDetailsSheet
            open
            onClose={() => setLicenseFor(null)}
            title={current ? 'Change license' : 'Assign a license'}
            subtitle={licenseFor.company || licenseFor.name}
            details={[]}
            groups={[]}
            hero={
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                  {options.map(l => (
                    <LicenseOption key={l.id} lic={l} selected={licenseChoice === l.id} onSelect={() => setLicenseChoice(l.id)} note={l.id === current?.id ? 'current' : undefined} />
                  ))}
                  {current && (
                    <button type="button" onClick={() => setLicenseChoice('')} className={`w-full flex items-center gap-3 px-4 py-3 text-left ${licenseChoice === '' ? 'bg-rose-50/60' : 'hover:bg-slate-50'}`}>
                      <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${licenseChoice === '' ? 'border-rose-500' : 'border-slate-300'}`}>
                        {licenseChoice === '' && <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-900">No license</span>
                        <span className="block text-xs text-slate-500">Their screens stop playing</span>
                      </span>
                    </button>
                  )}
                </div>
                {poolLicenses.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No free licenses in the pool.{' '}
                    {onNavigate && <button type="button" onClick={() => onNavigate('licenses-management')} className="text-blue-600 font-medium">Create one</button>}
                  </p>
                )}
              </div>
            }
            footer={
              <button type="button" onClick={saveLicense} className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold">Save</button>
            }
          />
        );
      })()}

      {/* ── Add client ───────────────────────────────────────────────────── */}
      {addOpen && (
        <ScreenDetailsSheet
          open
          onClose={() => setAddOpen(false)}
          title="Add client"
          subtitle={['Contact details', 'Organization & license', 'Review & send login'][step - 1]}
          badge={<span className="text-[11px] font-medium text-slate-400">Step {step} of 3</span>}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div className="flex gap-1.5">
                {[1, 2, 3].map(n => <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />)}
              </div>

              {step === 1 && (
                <>
                  <div>
                    <label className={labelCls}>Contact name</label>
                    <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Priya Sharma" className={inputCls} autoFocus />
                  </div>
                  <div>
                    <label className={labelCls}>Email — their login</label>
                    <input type="email" inputMode="email" autoCapitalize="none" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="priya@company.com" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Phone</label>
                    <input type="tel" value={draft.mobile} onChange={e => setDraft(d => ({ ...d, mobile: e.target.value }))} placeholder="+91 98765 43210" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Address <span className="text-slate-400 font-normal">(optional)</span></label>
                    <textarea rows={2} value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))} className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none" />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className={labelCls}>Organization</label>
                    <input list="client-orgs" value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))} placeholder="e.g. Phoenix Mall Group" className={inputCls} autoFocus />
                    <datalist id="client-orgs">
                      {organizations.map((o: any) => <option key={o.id} value={o.name} />)}
                    </datalist>
                    {organizations.some((o: any) => (o.name || '').toLowerCase() === draft.company.trim().toLowerCase()) && (
                      <p className="text-xs text-slate-500 mt-1.5">Joins the existing “{draft.company.trim()}” organization.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>License</label>
                    {poolLicenses.length > 0 ? (
                      <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                        {poolLicenses.map(l => (
                          <LicenseOption key={l.id} lic={l} selected={draft.licenseId === l.id} onSelect={() => setDraft(d => ({ ...d, licenseId: l.id }))} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-600 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        Every license is already assigned. Create a new one first.
                        {onNavigate && (
                          <button type="button" onClick={() => { setAddOpen(false); onNavigate('licenses-management'); }} className="block mt-2 text-blue-600 font-medium">
                            Go to Licensing →
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <dl className="rounded-2xl border border-slate-100 divide-y divide-slate-100">
                    {[
                      ['Contact', draft.name],
                      ['Email', draft.email],
                      ['Phone', draft.mobile],
                      ['Organization', draft.company],
                      ['License', selectedPoolLicense ? `${selectedPoolLicense.name} · ${planLabel(selectedPoolLicense)}` : '—'],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
                        <dt className="text-xs text-slate-500 shrink-0">{k}</dt>
                        <dd className="text-sm font-medium text-slate-800 text-right truncate">{v}</dd>
                      </div>
                    ))}
                  </dl>

                  <div>
                    <label className={labelCls}>Temporary password</label>
                    <div className="flex gap-2">
                      <input readOnly value={draft.password} className={`${inputCls} font-mono`} />
                      <button
                        type="button"
                        onClick={() => { navigator.clipboard?.writeText(draft.password); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                        className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                        aria-label="Copy password"
                      >
                        {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDraft(d => ({ ...d, password: generateClientPassword(d.name) }))}
                        className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                        aria-label="New password"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-1.5">They'll be asked to change it the first time they sign in.</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                    <FeatureToggle checked={draft.sendEmail} onChange={v => setDraft(d => ({ ...d, sendEmail: v }))} label="Email the login details" hint={`Sends the sign-in link and password to ${draft.email || 'the client'}`} icon={<Mail size={17} />} />
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">Features</p>
                    <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                      <FeatureToggle checked={features.enableBroadcasting} onChange={v => setFeatures(f => ({ ...f, enableBroadcasting: v }))} label="Live broadcasting" hint="Broadcast video or their screen to all TVs" icon={<Radio size={17} />} />
                      <FeatureToggle checked={features.enableLiveChat} onChange={v => setFeatures(f => ({ ...f, enableLiveChat: v }))} label="Live messages" hint="Pop-up messages on their TVs" icon={<MessageSquare size={17} />} />
                      <FeatureToggle checked={features.enableCameraMonitoring} onChange={v => setFeatures(f => ({ ...f, enableCameraMonitoring: v }))} label="Camera monitoring" hint="View their TVs' camera feeds" icon={<Camera size={17} />} />
                    </div>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-2 px-1">
                      <Video size={13} /> Video calls: {selectedPoolLicense?.enableVideoConferencing ? 'included with this license' : 'not included in this license'}
                    </p>
                  </div>
                </>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => (step === 1 ? setAddOpen(false) : setStep(s => s - 1))}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700"
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={step === 2 && poolLicenses.length === 0}
                  className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onboard}
                  disabled={onboarding || !draft.password}
                  className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
                >
                  {onboarding ? 'Adding…' : 'Add client'}
                </button>
              )}
            </div>
          }
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title={`Remove ${removeTarget.name}?`}
          body={<p>Their account is deleted and {licenses.some(l => l.assignedUserEmail === removeTarget.email) ? 'their license goes back to the pool' : 'they lose access'}. Their screens stop playing. This can't be undone.</p>}
          confirmLabel="Remove client"
          tone="danger"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => removeClient(removeTarget)}
        />
      )}
    </div>
  );
}
