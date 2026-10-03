import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ScanLine, CheckCircle2, AlertCircle, Monitor } from 'lucide-react';
import { API_BASE } from '../../config';
import { mediaStore } from '../../lib/mediaStore';
import { licensingStore, License } from '../../lib/licensingStore';
import { pushToDatabase, syncCollection } from '../../lib/syncHelper';
import { getAuthToken } from '../../lib/authStorage';
import { toast } from '../Toast';
import QrScannerModal from '../QrScannerModal';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const SCREEN_SIZES = ['32"', '43"', '50"', '55"', '65"', '75"', '86"', '98"'];

const STEPS = ['Screen', 'Location', 'Content', 'Connect'] as const;

/**
 * Who the new screen is for:
 *  - 'client':       a client adding a screen to their own account
 *  - 'admin-client': an admin adding a screen for one of their clients (picks the organization)
 *  - 'admin-my':     an admin adding a screen to their own channel
 */
export type AddScreenMode = 'client' | 'admin-client' | 'admin-my';

const fieldLabel = 'block text-xs font-semibold text-slate-600 mb-1.5';
const inputClass = 'w-full h-11 px-3.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white';

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {hint && <p className="text-sm text-slate-500 mt-0.5">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </div>
  );
}

/**
 * The Add Screen flow, shared by the admin and client dashboards. Collects
 * only what's actually used — name, orientation, size, state/city, group or
 * playlist — then connects the TV by its pairing code, or saves the screen as
 * "not linked" to pair later.
 */
export default function AddScreenFlow({
  mode,
  userEmail,
  onDone
}: {
  mode: AddScreenMode;
  userEmail: string;
  /** Called after the screen is created, or on cancel from the first step. */
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    orientation: 'landscape' as 'landscape' | 'portrait',
    screenSize: '',
    state: '',
    city: '',
    organization: '',
    group: '',
    playlist: ''
  });
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [done, setDone] = useState<null | 'paired' | 'later'>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const [organizations, setOrganizations] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_organizations') || '[]'));
  const [licenses, setLicenses] = useState<License[]>(() => licensingStore.getLicenses());
  const [groups, setGroups] = useState<any[]>(() => JSON.parse(localStorage.getItem('signageos_groups') || '[]'));
  const [playlists, setPlaylists] = useState<any[]>(() => mediaStore.getPlaylists());

  useEffect(() => {
    syncCollection('licenses', 'signageos_licenses').then(d => d.length && setLicenses(d));
    syncCollection('screen_groups', 'signageos_groups').then(d => d.length && setGroups(d));
    syncCollection('playlists', 'signageos_playlists').then(d => d.length && setPlaylists(d));
    if (mode === 'admin-client') {
      syncCollection('organizations', 'signageos_organizations').then(d => d.length && setOrganizations(d));
    }
  }, [mode]);

  useEffect(() => {
    if (step === 0) nameRef.current?.focus();
  }, [step]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm(p => ({ ...p, [key]: value }));

  // Who the screen will belong to, and the license that covers it.
  const selectedOrg = organizations.find(o => o.id === form.organization) || null;
  const license: License | null = useMemo(() => {
    if (mode === 'client') return licenses.find(l => l.assignedUserEmail === userEmail) || null;
    if (mode === 'admin-client' && form.organization) return licenses.find(l => l.assignedOrgId === form.organization) || null;
    return null;
  }, [mode, licenses, userEmail, form.organization]);
  const ownerEmail = mode === 'admin-client'
    ? (license?.assignedUserEmail || selectedOrg?.email || '')
    : userEmail;

  const availableGroups = groups.filter(g => {
    if (mode === 'admin-my') return !g.orgId;
    if (mode === 'admin-client') return !!g.orgId && (!form.organization || g.orgId === form.organization);
    return !license?.assignedOrgId || g.orgId === license.assignedOrgId;
  });
  const availablePlaylists = playlists.filter(p => !ownerEmail || p.createdBy === ownerEmail || (mode !== 'client' && p.createdBy === userEmail));
  const selectedGroup = form.group ? groups.find(g => g.id === form.group) : null;

  const location = [form.city.trim(), form.state].filter(Boolean).join(', ');
  const playlistId = selectedGroup ? (selectedGroup.playlistId || '') : form.playlist;
  const playlistName = selectedGroup
    ? (selectedGroup.playlist || '')
    : (playlists.find(p => p.id === form.playlist)?.name || '');

  const canContinue =
    step === 0 ? form.name.trim().length > 0 :
    step === 2 ? (mode !== 'admin-client' || !!form.organization) :
    true;

  const next = () => {
    if (!canContinue) {
      if (step === 0) toast.warning('Give the screen a name first.');
      if (step === 2) toast.warning('Choose which organization this screen is for.');
      return;
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => (step === 0 ? onDone() : setStep(s => s - 1));

  const connectTv = async () => {
    const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length < 4) {
      toast.warning('Enter the code shown on the TV.');
      return;
    }
    setBusy(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${API_BASE}/screens/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
        body: JSON.stringify({
          pairingCode: clean,
          name: form.name.trim(),
          location: location || 'Not Specified',
          groupId: form.group || '',
          playlist: playlistId,
          assignedToUserEmail: ownerEmail,
          orientation: form.orientation,
          screenSize: form.screenSize
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.message || "Couldn't connect the TV. Check the code and try again.");
        return;
      }
      await syncCollection('screens', 'signageos_screens', { force: true });
      setDone('paired');
    } catch {
      toast.error("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Saves the screen without a TV ("Not linked"); it can be paired later from
  // the screen's details with "Pair a TV".
  const connectLater = async () => {
    setBusy(true);
    try {
      const res = await pushToDatabase('screens', '', {
        name: form.name.trim(),
        status: 'unlinked',
        location: location || 'Not Specified',
        groupId: form.group || null,
        playlist: playlistName,
        playlistId,
        assignedToUserEmail: ownerEmail,
        orientation: form.orientation,
        screenSize: form.screenSize
      }, 'POST');
      if (res.ok === false) {
        let message = "Couldn't save the screen.";
        try { message = JSON.parse(res.error).error || message; } catch { /* plain text */ }
        toast.error(message);
        return;
      }
      await syncCollection('screens', 'signageos_screens', { force: true });
      setDone('later');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 text-center">
        <div className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center ${done === 'paired' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
          {done === 'paired' ? <CheckCircle2 size={28} /> : <Monitor size={26} />}
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mt-4">
          {done === 'paired' ? `“${form.name}” is connected` : `“${form.name}” is saved`}
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
          {done === 'paired'
            ? 'The TV will start playing its content in a few seconds.'
            : 'It shows as “Not linked”. Open it from your screens and choose “Pair a TV” when the TV is ready.'}
        </p>
        <button onClick={onDone} className="mt-6 w-full sm:w-auto sm:px-10 h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold">
          Done
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Progress */}
      <ol data-tour="add-steps" className="flex items-center gap-2 mb-5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-slate-200'}`} />
            <span className={`hidden sm:block mt-2 text-xs font-semibold ${i === step ? 'text-blue-700' : i < step ? 'text-slate-600' : 'text-slate-400'}`}>
              {i < step ? <Check size={11} className="inline -mt-0.5 mr-1" /> : null}{label}
            </span>
          </li>
        ))}
      </ol>
      <p className="sm:hidden text-xs font-semibold text-slate-500 mb-4">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>

      <div data-tour="add-form" className="bg-white rounded-3xl border border-slate-100 p-5 sm:p-7">
        {step === 0 && (
          <Section title="Name your screen" hint="Pick something people will recognise, like where it's mounted.">
            <div>
              <label className={fieldLabel} htmlFor="screen-name">Screen name</label>
              <input
                id="screen-name"
                ref={nameRef}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') next(); }}
                placeholder="e.g. Mall Entrance A"
                maxLength={60}
                className={inputClass}
              />
            </div>

            <div>
              <span className={fieldLabel}>Orientation</span>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'landscape', label: 'Landscape', hint: 'Wide', box: 'w-12 h-7' },
                  { value: 'portrait', label: 'Portrait', hint: 'Tall', box: 'w-7 h-12' }
                ] as const).map(o => {
                  const selected = form.orientation === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set('orientation', o.value)}
                      className={`h-28 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-colors ${
                        selected ? 'border-blue-600 bg-blue-50/60' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="h-12 flex items-center">
                        <span className={`${o.box} block rounded-md border-2 ${selected ? 'border-blue-600 bg-blue-100' : 'border-slate-400'}`} />
                      </span>
                      <span className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-700'}`}>{o.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <span className={fieldLabel}>Screen size <span className="font-normal text-slate-400">(optional)</span></span>
              <div className="grid grid-cols-4 gap-2">
                {SCREEN_SIZES.map(size => {
                  const selected = form.screenSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set('screenSize', selected ? '' : size)}
                      className={`h-10 rounded-xl border text-sm font-semibold transition-colors ${
                        selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section title="Where is it?" hint="Helps you find it in your list. You can skip this.">
            <div>
              <label className={fieldLabel} htmlFor="screen-state">State</label>
              <select
                id="screen-state"
                value={form.state}
                onChange={e => set('state', e.target.value)}
                className={`${inputClass} ${form.state ? 'text-slate-900' : 'text-slate-400'}`}
              >
                <option value="">Select state</option>
                {INDIAN_STATES.map(s => <option key={s} value={s} className="text-slate-900">{s}</option>)}
              </select>
            </div>
            <div>
              <label className={fieldLabel} htmlFor="screen-city">City or area</label>
              <input
                id="screen-city"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') next(); }}
                placeholder="e.g. Bandra West, Mumbai"
                maxLength={80}
                className={inputClass}
              />
            </div>
          </Section>
        )}

        {step === 2 && (
          <Section title="What should it play?" hint="You can change this any time from the screen's details.">
            {mode === 'admin-client' && (
              <div>
                <label className={fieldLabel} htmlFor="screen-org">Organization</label>
                <select
                  id="screen-org"
                  value={form.organization}
                  onChange={e => setForm(p => ({ ...p, organization: e.target.value, group: '', playlist: '' }))}
                  className={`${inputClass} ${form.organization ? 'text-slate-900' : 'text-slate-400'}`}
                >
                  <option value="">Choose organization</option>
                  {organizations.map(o => <option key={o.id} value={o.id} className="text-slate-900">{o.name}</option>)}
                </select>
              </div>
            )}

            {(mode === 'client' || (mode === 'admin-client' && form.organization)) && (
              license ? (
                <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${license.status === 'active' ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'}`}>
                  {license.status === 'active'
                    ? <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                    : <AlertCircle size={18} className="text-rose-600 shrink-0" />}
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-slate-900 truncate">{license.name || 'License'}</p>
                    <p className="text-xs text-slate-500">
                      {license.status === 'active' ? `Up to ${license.deviceLimit} screens` : 'Not active — renew before adding screens'}
                      {license.expiryDate ? ` · until ${new Date(license.expiryDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-4 py-3 text-sm text-amber-800">
                  <AlertCircle size={18} className="shrink-0" />
                  {mode === 'client' ? 'No license found for your account. Contact support to add screens.' : 'This organization has no license yet.'}
                </div>
              )
            )}

            <div>
              <label className={fieldLabel} htmlFor="screen-group">Screen group <span className="font-normal text-slate-400">(optional)</span></label>
              <select
                id="screen-group"
                value={form.group}
                onChange={e => set('group', e.target.value)}
                className={inputClass}
              >
                <option value="">No group</option>
                {availableGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {selectedGroup ? (
              <p className="text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3">
                Plays the group's playlist: <span className="font-semibold">{selectedGroup.playlist || 'none yet'}</span>
              </p>
            ) : (
              <div>
                <label className={fieldLabel} htmlFor="screen-playlist">Playlist <span className="font-normal text-slate-400">(optional)</span></label>
                <select
                  id="screen-playlist"
                  value={form.playlist}
                  onChange={e => set('playlist', e.target.value)}
                  className={inputClass}
                >
                  <option value="">Nothing yet</option>
                  {availablePlaylists.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
          </Section>
        )}

        {step === 3 && (
          <Section title="Connect the TV" hint="Open the signage app on the TV. Enter the code it shows on screen.">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900 truncate">{form.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {[form.orientation === 'portrait' ? 'Portrait' : 'Landscape', form.screenSize, location, selectedGroup?.name || playlistName]
                  .filter(Boolean).join(' · ')}
              </p>
            </div>

            <div>
              <label className={fieldLabel} htmlFor="pair-code">Pairing code</label>
              <input
                id="pair-code"
                value={code}
                onChange={e => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6))}
                onKeyDown={e => { if (e.key === 'Enter') connectTv(); }}
                placeholder="ABC123"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="w-full h-16 text-center text-3xl font-mono font-semibold tracking-[0.35em] border border-slate-200 rounded-2xl outline-none focus:border-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="mt-2 mx-auto flex items-center gap-1.5 text-xs font-semibold text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50"
              >
                <ScanLine size={14} /> Scan the QR code instead
              </button>
            </div>

            {scannerOpen && (
              <QrScannerModal
                title="Scan pairing code"
                instructions="Point your camera at the QR code on the TV's pairing screen."
                onClose={() => setScannerOpen(false)}
                onScan={value => {
                  setCode(value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6));
                  setScannerOpen(false);
                }}
              />
            )}
          </Section>
        )}
      </div>

      {/* Actions */}
      {step === 3 ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={connectTv}
            disabled={busy || code.length < 4}
            className="w-full h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
          >
            {busy ? 'Connecting…' : 'Connect TV'}
          </button>
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              disabled={busy}
              className="h-11 px-3 rounded-xl text-sm font-semibold text-slate-600 flex items-center gap-1 hover:bg-slate-100"
            >
              <ChevronLeft size={16} /> Back
            </button>
            <button
              type="button"
              onClick={connectLater}
              disabled={busy}
              className="h-11 px-3 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 whitespace-nowrap"
            >
              Connect later
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={back}
            className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 flex items-center gap-1"
          >
            {step === 0 ? 'Cancel' : <><ChevronLeft size={16} /> Back</>}
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={next}
            className={`h-11 px-6 rounded-xl text-white text-sm font-semibold ${canContinue ? 'bg-blue-600' : 'bg-blue-600/40'}`}
          >
            {step === 1 && !form.state && !form.city.trim() ? 'Skip' : 'Continue'}
          </button>
        </div>
      )}
    </div>
  );
}
