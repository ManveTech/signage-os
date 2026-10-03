import { useEffect, useState } from 'react';
import { User as UserIcon, Camera, Eye, EyeOff, Key, Lock, CreditCard, Palette, Image as ImageIcon, ChevronRight, Check } from 'lucide-react';
import { API_BASE } from '../../config';
import { getAuthToken } from '../../lib/authStorage';
import { pushToDatabase, syncCollection } from '../../lib/syncHelper';
import { licensingStore, License } from '../../lib/licensingStore';
import { toast } from '../Toast';
import AvatarCropper from './AvatarCropper';
import { licenseState, formatDate, planLabel } from '../licenses/licenseStatus';

// Matches the server's mask for a saved Razorpay secret (controllers/payments.ts).
const RZP_SECRET_MASK = '••••••••••••';

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white disabled:bg-slate-50 disabled:text-slate-500';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

function errorText(result: any, fallback: string): string {
  const raw = result?.error;
  if (typeof raw !== 'string') return fallback;
  try { const p = JSON.parse(raw); return p.error || p.message || raw; } catch { return raw || fallback; }
}

function Section({ title, description, icon, children }: { title: string; description?: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">{icon}</span>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Account page for both dashboards. Admin and client keep their own cached
 * keys/events (the header and sidebar listen for them); everything else —
 * details, photo, password — is shared.
 */
export default function ProfileView({ role, userEmail, onNavigate }: { role: 'admin' | 'client'; userEmail: string; onNavigate?: (view: string) => void }) {
  const admin = role === 'admin';
  const key = (field: 'name' | 'mobile' | 'avatar' | 'email') => (admin ? `signageos_admin_${field}` : `signageos_user_${field}_${userEmail}`);
  const profileEvent = admin ? 'signageos_admin_profile_updated' : 'signageos_user_profile_updated';

  // Cached values only paint the page instantly; the real account record
  // replaces them below. (Previously these fell back to invented values —
  // "<email prefix> User" and a sample +91 number — and saving the form wrote
  // that sample number onto the account.)
  const [name, setName] = useState(() => localStorage.getItem(key('name')) || '');
  const [email, setEmail] = useState(() => (admin ? localStorage.getItem(key('email')) : null) || userEmail);
  const [mobile, setMobile] = useState(() => localStorage.getItem(key('mobile')) || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem(key('avatar')) || '');
  const [saved, setSaved] = useState(() => ({ name: localStorage.getItem(key('name')) || '', mobile: localStorage.getItem(key('mobile')) || '' }));
  const [savingDetails, setSavingDetails] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  const [rzp, setRzp] = useState({ keyId: '', secret: '' });
  const [savingRzp, setSavingRzp] = useState(false);

  const [license, setLicense] = useState<License | undefined>(() => (admin ? undefined : licensingStore.getUserLicense(userEmail) || undefined));
  const [org, setOrg] = useState<any>(null);
  const [brand, setBrand] = useState({ name: localStorage.getItem('signageos_client_name') || '', logo: localStorage.getItem('signageos_client_logo') || '' });
  const [savingBrand, setSavingBrand] = useState(false);

  const userId = localStorage.getItem('signageos_user_id');
  const authHeaders = () => ({ Authorization: `Bearer ${getAuthToken()}` });

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/users/${userId}`, { headers: authHeaders() })
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then(data => {
        const n = data.name || '';
        const m = data.mobile || '';
        setName(n); setMobile(m); setSaved({ name: n, mobile: m });
        localStorage.setItem(key('name'), n);
        localStorage.setItem(key('mobile'), m);
        if (admin && data.email) { setEmail(data.email); localStorage.setItem(key('email'), data.email); }
        if (data.avatarUrl !== undefined) { setAvatar(data.avatarUrl); localStorage.setItem(key('avatar'), data.avatarUrl); }
      })
      .catch(() => { /* keep cached values */ });

    if (admin) {
      localStorage.removeItem('signageos_admin_rzp_secret');
      fetch(`${API_BASE}/payments/config`, { headers: authHeaders() })
        .then(res => (res.ok ? res.json() : Promise.reject()))
        .then(data => setRzp({ keyId: data.keyId || '', secret: data.keySecret || '' }))
        .catch(() => setRzp(r => ({ ...r, keyId: localStorage.getItem('signageos_admin_rzp_key') || '' })));
    } else {
      // Old builds stored Razorpay credentials for clients in this browser.
      localStorage.removeItem(`signageos_user_rzp_key_${userEmail}`);
      localStorage.removeItem(`signageos_user_rzp_secret_${userEmail}`);
      Promise.all([
        syncCollection('licenses', 'signageos_licenses'),
        syncCollection('organizations', 'signageos_organizations'),
      ]).then(([, orgs]) => {
        const lic = licensingStore.getUserLicense(userEmail) || undefined;
        setLicense(lic);
        const mine = (orgs as any[]).find(o => o.id === lic?.assignedOrgId || o.name === lic?.assignedOrgName || (o.email || '').toLowerCase() === userEmail.toLowerCase());
        if (mine) {
          setOrg(mine);
          setBrand({ name: mine.websiteName || mine.name || '', logo: mine.websiteLogo || '' });
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail]);

  // ── Photo ────────────────────────────────────────────────────────────────
  // Picking a photo opens the cropper; the cropped 512×512 JPEG is what's uploaded.
  const pickAvatar = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warning('Pick an image file'); return; }
    if (file.size > 25 * 1024 * 1024) { toast.warning('That image is too large (max 25 MB)'); return; }
    setCropFile(file);
  };

  const uploadAvatar = async (blob: Blob) => {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onloadend = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
      const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarData: dataUrl.split(',')[1], mimeType: 'image/jpeg', fileName: 'avatar.jpg' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || 'Could not upload the photo'); return; }
      setAvatar(data.avatarUrl || '');
      localStorage.setItem(key('avatar'), data.avatarUrl || '');
      window.dispatchEvent(new Event(profileEvent));
      setCropFile(null);
      toast.success('Photo updated');
    } catch {
      toast.error("Can't reach the server");
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!userId) return;
    setAvatarBusy(true);
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/avatar`, {
        method: 'PUT',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeAvatar: true }),
      });
      if (!res.ok) { toast.error('Could not remove the photo'); return; }
      setAvatar('');
      localStorage.setItem(key('avatar'), '');
      window.dispatchEvent(new Event(profileEvent));
      toast.success('Photo removed');
    } catch {
      toast.error("Can't reach the server");
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Details ──────────────────────────────────────────────────────────────
  const detailsChanged = name.trim() !== saved.name || mobile.trim() !== saved.mobile;
  const saveDetails = async () => {
    if (!name.trim()) { toast.warning('Your name can\'t be empty'); return; }
    if (!userId) { toast.error('Not signed in'); return; }
    setSavingDetails(true);
    const res = await pushToDatabase('users', userId, { name: name.trim(), mobile: mobile.trim() }, 'PUT');
    setSavingDetails(false);
    if (!res.ok) { toast.error(`Couldn't save: ${errorText(res, 'please try again')}`); return; }
    localStorage.setItem(key('name'), name.trim());
    localStorage.setItem(key('mobile'), mobile.trim());
    setSaved({ name: name.trim(), mobile: mobile.trim() });
    window.dispatchEvent(new Event(profileEvent));
    toast.success('Details saved');
  };

  // ── Password ─────────────────────────────────────────────────────────────
  const pwChecks = [
    { ok: pw.next.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(pw.next) && /\d/.test(pw.next), label: 'Letters and numbers' },
    { ok: !!pw.next && pw.next === pw.confirm, label: 'Both new passwords match' },
  ];
  const changePassword = async () => {
    if (!pw.current) { toast.warning('Enter your current password'); return; }
    if (!pwChecks.every(c => c.ok)) { toast.warning('The new password doesn\'t meet the requirements yet'); return; }
    if (!userId) { toast.error('Not signed in'); return; }
    setSavingPw(true);
    try {
      // There's no separate "verify password" endpoint, so the current
      // password is checked by signing in with it.
      const verify = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pw.current }),
      });
      if (!verify.ok) { toast.error('Your current password is incorrect'); return; }
      const res = await pushToDatabase('users', userId, { password: pw.next, passwordConfirm: pw.next, currentPassword: pw.current }, 'PUT');
      if (!res.ok) { toast.error(errorText(res, 'Could not change the password')); return; }
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch {
      toast.error("Can't reach the server");
    } finally {
      setSavingPw(false);
    }
  };

  // ── Razorpay (admin) ─────────────────────────────────────────────────────
  const saveRazorpay = async () => {
    if (!rzp.keyId.trim()) { toast.warning('Enter the Razorpay Key ID'); return; }
    setSavingRzp(true);
    try {
      const res = await fetch(`${API_BASE}/payments/config`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyId: rzp.keyId.trim(), keySecret: rzp.secret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.message || 'Could not save the Razorpay keys'); return; }
      localStorage.setItem('signageos_admin_rzp_key', rzp.keyId.trim());
      if (rzp.secret && rzp.secret !== RZP_SECRET_MASK) setRzp(r => ({ ...r, secret: RZP_SECRET_MASK }));
      toast.success('Razorpay keys saved');
    } catch {
      toast.error("Can't reach the server");
    } finally {
      setSavingRzp(false);
    }
  };

  // ── Branding (client with white label) ───────────────────────────────────
  const saveBranding = async () => {
    if (!org) { toast.error('Your organization isn\'t set up yet — contact support'); return; }
    if (!brand.name.trim()) { toast.warning('Enter a brand name'); return; }
    setSavingBrand(true);
    const res = await pushToDatabase('organizations', org.id, { websiteName: brand.name.trim(), websiteLogo: brand.logo }, 'PUT');
    setSavingBrand(false);
    if (!res.ok) { toast.error(errorText(res, 'Could not save branding')); return; }
    const savedLogo = (res as any).data?.websiteLogo ?? brand.logo;
    localStorage.setItem('signageos_client_name', brand.name.trim());
    localStorage.setItem('signageos_client_logo', savedLogo);
    setBrand(b => ({ ...b, logo: savedLogo }));
    window.dispatchEvent(new Event('signageos_branding_updated'));
    toast.success('Branding saved — your screens pick it up on their next sync');
  };

  const initials = (name || email).split(/[\s@]+/).filter(Boolean).slice(0, 2).map(p => p[0]!.toUpperCase()).join('');
  const st = license ? licenseState(license) : null;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-5">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Profile</h1>
        <p className="text-sm text-gray-500 mt-0.5">Your account{admin ? ' and payment settings' : ', plan and branding'}</p>
      </div>

      {/* Identity */}
      <section className="bg-white rounded-2xl border border-slate-100 p-5 sm:p-6 flex flex-col sm:flex-row items-center sm:items-center gap-4 sm:gap-5 text-center sm:text-left">
        <label className="relative shrink-0 cursor-pointer group" aria-label="Change photo">
          <span className={`block w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden ring-4 ring-white shadow-md ${avatarBusy ? 'opacity-60' : ''}`}>
            {avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <span className="w-full h-full bg-gradient-to-br from-blue-600 to-teal-500 text-white text-3xl font-semibold flex items-center justify-center">{initials || '?'}</span>}
          </span>
          <span className="absolute bottom-0.5 right-0.5 w-9 h-9 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center ring-4 ring-white shadow">
            <Camera size={16} />
          </span>
          <input type="file" accept="image/*" className="hidden" disabled={avatarBusy} onChange={e => { pickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-slate-900 truncate">{name || 'Your name'}</p>
          <p className="text-sm text-slate-500 truncate">{email}</p>
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">{admin ? 'Administrator' : 'Client account'}</span>
          <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
            <label className={`h-9 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer ${avatarBusy ? 'opacity-50 pointer-events-none' : ''}`}>
              <Camera size={14} /> {avatar ? 'Change photo' : 'Add photo'}
              <input type="file" accept="image/*" className="hidden" onChange={e => { pickAvatar(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            {avatar && (
              <button type="button" onClick={removeAvatar} disabled={avatarBusy} className="h-9 px-3 rounded-xl text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">Remove</button>
            )}
          </div>
        </div>
      </section>

      {cropFile && (
        <AvatarCropper file={cropFile} saving={avatarBusy} onCancel={() => setCropFile(null)} onSave={uploadAvatar} />
      )}

      {/* Plan (client) */}
      {!admin && license && st && (
        <button
          type="button"
          onClick={() => onNavigate?.('license-billing')}
          className="w-full bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 flex items-center gap-3 text-left hover:bg-slate-50"
        >
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Key size={17} /></span>
          <span className="flex-1 min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 truncate">{license.name}</span>
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.className}`}>{st.label}</span>
            </span>
            <span className="block text-xs text-slate-500 mt-0.5 truncate">
              {planLabel(license)} · {license.deviceLimit || 5} screens · {license.storageLimit || 5} GB · renews {formatDate(license.expiryDate)}
            </span>
          </span>
          <ChevronRight size={16} className="text-slate-300 shrink-0" />
        </button>
      )}

      <Section title="Personal details" icon={<UserIcon size={17} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} autoComplete="name" />
          </div>
          <div>
            <label className={labelCls}>Phone <span className="text-slate-400 font-normal">(optional)</span></label>
            <input type="tel" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="+91 98765 43210" className={inputCls} autoComplete="tel" />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Email</label>
            <input value={email} disabled className={inputCls} />
            <p className="text-xs text-slate-400 mt-1.5">This is your sign-in, so it can't be changed here.</p>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" onClick={saveDetails} disabled={!detailsChanged || savingDetails} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold">
            {savingDetails ? 'Saving…' : 'Save details'}
          </button>
        </div>
      </Section>

      <Section title="Password" description="Use at least 8 characters with letters and numbers" icon={<Lock size={17} />}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {([
            ['current', 'Current password', 'current-password'],
            ['next', 'New password', 'new-password'],
            ['confirm', 'Confirm new password', 'new-password'],
          ] as const).map(([k, label, ac]) => (
            <div key={k}>
              <label className={labelCls}>{label}</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw[k]}
                  onChange={e => setPw(p => ({ ...p, [k]: e.target.value }))}
                  autoComplete={ac}
                  className={`${inputCls} pr-10`}
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={showPw ? 'Hide passwords' : 'Show passwords'}>
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          ))}
        </div>
        {pw.next && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
            {pwChecks.map(c => (
              <li key={c.label} className={`flex items-center gap-1 text-xs ${c.ok ? 'text-emerald-600' : 'text-slate-400'}`}>
                <Check size={12} /> {c.label}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end mt-4">
          <button type="button" onClick={changePassword} disabled={savingPw || !pw.current || !pw.next} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold">
            {savingPw ? 'Updating…' : 'Change password'}
          </button>
        </div>
      </Section>

      {admin && (
        <Section title="Razorpay" description="Keys used to take license payments from clients" icon={<CreditCard size={17} />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Key ID</label>
              <input value={rzp.keyId} onChange={e => setRzp(r => ({ ...r, keyId: e.target.value }))} placeholder="rzp_live_…" className={`${inputCls} font-mono`} autoCapitalize="none" />
            </div>
            <div>
              <label className={labelCls}>Key secret</label>
              <input
                type="password"
                value={rzp.secret}
                onFocus={() => rzp.secret === RZP_SECRET_MASK && setRzp(r => ({ ...r, secret: '' }))}
                onChange={e => setRzp(r => ({ ...r, secret: e.target.value }))}
                placeholder={rzp.secret === '' ? 'Leave empty to keep the saved secret' : ''}
                className={`${inputCls} font-mono`}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">The secret is stored on the server only and never shown again after saving.</p>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={saveRazorpay} disabled={savingRzp} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold">
              {savingRzp ? 'Saving…' : 'Save keys'}
            </button>
          </div>
        </Section>
      )}

      {!admin && license?.whiteLabel && (
        <Section title="Branding" description="Your name and logo in the dashboard and on your screens' start-up" icon={<Palette size={17} />}>
          <div className="flex items-center gap-4">
            <span className="w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
              {brand.logo ? <img src={brand.logo} alt="" className="w-full h-full object-contain" /> : <ImageIcon size={20} className="text-slate-400" />}
            </span>
            <div className="flex gap-2">
              <label className="h-10 px-4 flex items-center rounded-xl border border-slate-200 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                {brand.logo ? 'Change logo' : 'Upload logo'}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { toast.warning('Logo must be under 2 MB'); return; }
                    const r = new FileReader();
                    r.onloadend = () => setBrand(b => ({ ...b, logo: r.result as string }));
                    r.readAsDataURL(file);
                  }}
                />
              </label>
              {brand.logo && <button type="button" onClick={() => setBrand(b => ({ ...b, logo: '' }))} className="h-10 px-3 rounded-xl text-sm text-rose-600 hover:bg-rose-50">Remove</button>}
            </div>
          </div>
          <div className="mt-4">
            <label className={labelCls}>Brand name</label>
            <input value={brand.name} onChange={e => setBrand(b => ({ ...b, name: e.target.value }))} className={inputCls} />
          </div>
          <div className="flex justify-end mt-4">
            <button type="button" onClick={saveBranding} disabled={savingBrand} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-semibold">
              {savingBrand ? 'Saving…' : 'Save branding'}
            </button>
          </div>
        </Section>
      )}
    </div>
  );
}
