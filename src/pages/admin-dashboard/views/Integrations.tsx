import { useEffect, useState, ReactNode } from 'react';
import { Cloud, Mail, KeyRound, CheckCircle2, XCircle, Loader2, ChevronRight, Send, PlugZap, Eye, EyeOff } from 'lucide-react';
import { API_BASE } from '../../../config';
import { getHeaders } from '../../../lib/syncHelper';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import { toast } from '../../../components/Toast';

type IntegrationType = 'cloudflare' | 'smtp' | 'oauth_google';
type Source = 'dashboard' | 'environment' | 'off';

interface IntegrationState {
  type: IntegrationType;
  source: Source;
  config: Record<string, string>;
  enabled: boolean;
  lastTestStatus: 'untested' | 'success' | 'failure';
  lastTestError: string;
  lastTestedAt: string;
}

const SECRET_MASK = '__SECRET_UNCHANGED__';
const SECRET_FIELD: Record<IntegrationType, string> = { cloudflare: 'secretAccessKey', smtp: 'password', oauth_google: 'clientSecret' };

type FieldDef = { key: string; label: string; type?: 'text' | 'password' | 'number'; placeholder?: string; help?: string; wide?: boolean };

const FIELDS: Record<IntegrationType, FieldDef[]> = {
  cloudflare: [
    { key: 'bucket', label: 'Bucket', placeholder: 'my-signage-media' },
    { key: 'region', label: 'Region', placeholder: 'auto' },
    { key: 'endpoint', label: 'S3 endpoint', placeholder: 'https://<account-id>.r2.cloudflarestorage.com', wide: true },
    { key: 'accessKeyId', label: 'Access key ID' },
    { key: 'secretAccessKey', label: 'Secret access key', type: 'password' },
    { key: 'publicUrl', label: 'Public URL', placeholder: 'https://media.yourdomain.com', help: 'The bucket\'s public or custom domain — TVs download files from here.', wide: true },
  ],
  smtp: [
    { key: 'host', label: 'SMTP server', placeholder: 'smtp.gmail.com' },
    { key: 'port', label: 'Port', type: 'number', placeholder: '587', help: '587 (most providers) or 465 (SSL)' },
    { key: 'username', label: 'Username' },
    { key: 'password', label: 'Password', type: 'password', help: 'For Gmail, use an app password.' },
    { key: 'senderEmail', label: 'Send from', placeholder: 'noreply@yourdomain.com' },
    { key: 'senderName', label: 'Sender name', placeholder: 'BlueStar DigiTech' },
  ],
  oauth_google: [
    { key: 'clientId', label: 'Client ID', placeholder: 'xxxx.apps.googleusercontent.com', wide: true },
    { key: 'clientSecret', label: 'Client secret', type: 'password', wide: true },
  ],
};

const META: Record<IntegrationType, { title: string; purpose: string; offNote: string; icon: ReactNode }> = {
  cloudflare: {
    title: 'File storage',
    purpose: 'Where uploaded images and videos are kept (Cloudflare R2)',
    offNote: 'Off — uploads are stored on the app server itself.',
    icon: <Cloud size={18} />,
  },
  smtp: {
    title: 'Email',
    purpose: 'Logins for new clients, password resets, billing reminders and screen alerts',
    offNote: 'Off — no emails are sent.',
    icon: <Mail size={18} />,
  },
  oauth_google: {
    title: 'Google sign-in',
    purpose: '“Continue with Google” on the login page',
    offNote: 'Off — people sign in with email and password.',
    icon: <KeyRound size={18} />,
  },
};

const ORDER: IntegrationType[] = ['cloudflare', 'smtp', 'oauth_google'];

function emptyState(type: IntegrationType): IntegrationState {
  const config: Record<string, string> = {};
  FIELDS[type].forEach(f => { config[f.key] = ''; });
  return { type, source: 'off', config, enabled: false, lastTestStatus: 'untested', lastTestError: '', lastTestedAt: '' };
}

const timeAgo = (iso: string) => {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

function SourcePill({ source }: { source: Source }) {
  const s = {
    dashboard: { text: 'On', cls: 'bg-emerald-50 text-emerald-700' },
    environment: { text: 'On · server settings', cls: 'bg-blue-50 text-blue-700' },
    off: { text: 'Off', cls: 'bg-slate-100 text-slate-500' },
  }[source];
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}`}>{s.text}</span>;
}

/**
 * Integrations: the outside services the platform uses. Each row shows
 * whether it's live (and from where); tapping it opens its settings with a
 * real test — for email, an actual message to you.
 */
export default function Integrations() {
  const [states, setStates] = useState<Record<IntegrationType, IntegrationState>>({
    cloudflare: emptyState('cloudflare'), smtp: emptyState('smtp'), oauth_google: emptyState('oauth_google'),
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState<IntegrationType | null>(null);
  const [draft, setDraft] = useState<{ config: Record<string, string>; enabled: boolean; hasSecret: boolean } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const normalise = (row: IntegrationState): IntegrationState => ({ ...emptyState(row.type), ...row, config: { ...emptyState(row.type).config, ...row.config } });

  useEffect(() => {
    fetch(`${API_BASE}/integrations`, { headers: getHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((rows: IntegrationState[]) => setStates(prev => {
        const next = { ...prev };
        rows.forEach(row => { next[row.type] = normalise(row); });
        return next;
      }))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  const openSheet = (type: IntegrationType) => {
    const st = states[type];
    const secret = SECRET_FIELD[type];
    // A saved secret arrives as the mask — show an empty box with a "saved"
    // hint; leaving it empty keeps the saved one.
    const hasSecret = st.config[secret] === SECRET_MASK;
    setDraft({ config: { ...st.config, [secret]: hasSecret ? '' : st.config[secret] }, enabled: st.enabled, hasSecret });
    setShowSecret(false);
    setTestResult(null);
    setOpen(type);
  };

  const payloadConfig = (type: IntegrationType) => {
    if (!draft) return {};
    const secret = SECRET_FIELD[type];
    const config: Record<string, unknown> = { ...draft.config };
    if (!draft.config[secret] && draft.hasSecret) config[secret] = SECRET_MASK;
    if (type === 'smtp' && draft.config.port) config.port = Number(draft.config.port);
    return config;
  };

  const dirty = (() => {
    if (!open || !draft) return false;
    const st = states[open];
    const secret = SECRET_FIELD[open];
    return draft.enabled !== st.enabled || !!draft.config[secret] ||
      FIELDS[open].some(f => f.key !== secret && (draft.config[f.key] || '') !== (st.config[f.key] || ''));
  })();

  const save = async () => {
    if (!open || !draft) return;
    setBusy('save');
    try {
      const res = await fetch(`${API_BASE}/integrations/${open}`, {
        method: 'PUT', headers: getHeaders(), body: JSON.stringify({ config: payloadConfig(open), enabled: draft.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error || 'Couldn\'t save'); return; }
      // Re-read so the "live" status reflects the change.
      const list: IntegrationState[] = await fetch(`${API_BASE}/integrations`, { headers: getHeaders() }).then(r => r.json()).catch(() => []);
      setStates(prev => {
        const next = { ...prev };
        list.forEach(row => { next[row.type] = normalise(row); });
        return next;
      });
      toast.success(`${META[open].title} saved`);
      setOpen(null);
    } catch {
      toast.error('No connection — try again');
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (!open || !draft) return;
    setBusy('test');
    setTestResult(null);
    try {
      const url = open === 'smtp' ? `${API_BASE}/integrations/smtp/send-test` : `${API_BASE}/integrations/${open}/test`;
      const res = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ config: payloadConfig(open) }) });
      const data = await res.json().catch(() => ({}));
      const ok = !!data.ok;
      const message = ok
        ? (open === 'smtp' ? `Test email sent to ${data.to} — check your inbox (and spam).` : data.note || 'Connected.')
        : (data.error || 'The test failed.');
      setTestResult({ ok, message });
      setStates(prev => ({ ...prev, [open]: { ...prev[open], lastTestStatus: ok ? 'success' : 'failure', lastTestError: ok ? '' : message, lastTestedAt: new Date().toISOString() } }));
    } catch {
      setTestResult({ ok: false, message: 'No connection — try again.' });
    } finally {
      setBusy(null);
    }
  };

  const st = open ? states[open] : null;

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-3xl">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Outside services the platform uses. Changes apply right away.</p>
      </div>

      {loadError && (
        <p className="text-sm text-rose-600">Couldn't load integrations. Refresh to try again.</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
        {ORDER.map(type => {
          const s = states[type];
          const m = META[type];
          return (
            <button key={type} type="button" onClick={() => openSheet(type)} disabled={loading} className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-slate-50 disabled:opacity-60">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${s.source === 'off' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-600'}`}>{m.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-900">{m.title}</span>
                  {loading ? <Loader2 size={13} className="animate-spin text-slate-300" /> : <SourcePill source={s.source} />}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">{m.purpose}</span>
                {s.lastTestStatus !== 'untested' && s.lastTestedAt && (
                  <span className={`flex items-center gap-1 text-[11px] mt-1 ${s.lastTestStatus === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {s.lastTestStatus === 'success' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {s.lastTestStatus === 'success' ? 'Last test passed' : 'Last test failed'} · {timeAgo(s.lastTestedAt)}
                  </span>
                )}
              </span>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>

      {open && st && draft && (
        <ScreenDetailsSheet
          open
          onClose={() => setOpen(null)}
          title={META[open].title}
          subtitle={META[open].purpose}
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Use these settings</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {draft.enabled ? 'On after you save.'
                      : st.source === 'environment' ? 'While off, the server\'s own settings stay in use.'
                      : META[open].offNote}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={draft.enabled}
                  aria-label="Use these settings"
                  onClick={() => setDraft(d => d && ({ ...d, enabled: !d.enabled }))}
                  className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${draft.enabled ? 'bg-blue-600' : 'bg-slate-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS[open].map(f => {
                  const isSecret = f.key === SECRET_FIELD[open];
                  return (
                    <label key={f.key} className={`block ${f.wide ? 'sm:col-span-2' : ''}`}>
                      <span className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</span>
                      <span className="relative block">
                        <input
                          type={isSecret && !showSecret ? 'password' : f.type === 'number' ? 'number' : 'text'}
                          value={draft.config[f.key] || ''}
                          onChange={e => setDraft(d => d && ({ ...d, config: { ...d.config, [f.key]: e.target.value } }))}
                          placeholder={isSecret && draft.hasSecret ? 'Saved — leave empty to keep it' : f.placeholder}
                          autoComplete="off"
                          className={`w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white ${isSecret ? 'pr-10' : ''}`}
                        />
                        {isSecret && (
                          <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600" aria-label={showSecret ? 'Hide' : 'Show'}>
                            {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        )}
                      </span>
                      {f.help && <span className="block text-[11px] text-slate-500 mt-1">{f.help}</span>}
                    </label>
                  );
                })}
              </div>

              {testResult && (
                <p className={`flex items-start gap-1.5 text-xs p-3 rounded-xl ${testResult.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  {testResult.ok ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <XCircle size={14} className="mt-0.5 shrink-0" />}
                  <span className="break-words min-w-0">{testResult.message}</span>
                </p>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={test}
                disabled={busy !== null}
                className="flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                {busy === 'test' ? <Loader2 size={15} className="animate-spin" /> : open === 'smtp' ? <Send size={15} /> : <PlugZap size={15} />}
                {open === 'smtp' ? 'Send test email' : 'Test'}
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy !== null || !dirty}
                className="flex-1 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {busy === 'save' ? 'Saving…' : dirty ? 'Save' : 'Saved'}
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}
