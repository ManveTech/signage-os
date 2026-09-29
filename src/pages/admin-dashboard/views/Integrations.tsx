import { useEffect, useState } from 'react';
import { Cloud, Mail, KeyRound, CheckCircle2, XCircle, Loader2, Save, PlugZap } from 'lucide-react';
import { API_BASE } from '../../../config';
import { getAuthToken } from '../../../lib/authStorage';

type IntegrationType = 'cloudflare' | 'smtp' | 'oauth_google';

interface IntegrationState {
  type: IntegrationType;
  config: Record<string, string>;
  enabled: boolean;
  lastTestStatus: 'untested' | 'success' | 'failure';
  lastTestError: string;
  lastTestedAt: string;
}

const SECRET_MASK = '__SECRET_UNCHANGED__';

const SECRET_FIELD: Record<IntegrationType, string> = {
  cloudflare: 'secretAccessKey',
  smtp: 'password',
  oauth_google: 'clientSecret'
};

type FieldDef = { key: string; label: string; type: 'text' | 'password' | 'number'; placeholder?: string };

const FIELDS: Record<IntegrationType, FieldDef[]> = {
  cloudflare: [
    { key: 'bucket', label: 'Bucket name', type: 'text', placeholder: 'my-signage-media' },
    { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://<accountid>.r2.cloudflarestorage.com' },
    { key: 'region', label: 'Region', type: 'text', placeholder: 'auto' },
    { key: 'accessKeyId', label: 'Access Key ID', type: 'text', placeholder: '' },
    { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', placeholder: '' },
    { key: 'publicUrl', label: 'Public / custom domain URL', type: 'text', placeholder: 'https://media.yourdomain.com' }
  ],
  smtp: [
    { key: 'host', label: 'SMTP Host', type: 'text', placeholder: 'smtp.yourprovider.com' },
    { key: 'port', label: 'Port', type: 'number', placeholder: '587' },
    { key: 'username', label: 'Username', type: 'text', placeholder: '' },
    { key: 'password', label: 'Password', type: 'password', placeholder: '' },
    { key: 'senderEmail', label: 'Sender Email', type: 'text', placeholder: 'noreply@yourdomain.com' },
    { key: 'senderName', label: 'Sender Name', type: 'text', placeholder: 'SignageOS' }
  ],
  oauth_google: [
    { key: 'clientId', label: 'Client ID', type: 'text', placeholder: 'xxxxx.apps.googleusercontent.com' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '' }
  ]
};

const PANEL_META: Record<IntegrationType, { title: string; description: string; icon: React.ReactNode }> = {
  cloudflare: {
    title: 'Cloudflare R2 Storage',
    description: 'Media uploads (images, videos, logos) are stored here instead of PocketBase\'s local storage.',
    icon: <Cloud size={18} />
  },
  smtp: {
    title: 'SMTP (Email)',
    description: 'Used to send account credentials and password reset emails.',
    icon: <Mail size={18} />
  },
  oauth_google: {
    title: 'Google OAuth',
    description: 'Lets admins/users sign in with Google instead of email + password. Full verification only happens on the first real sign-in.',
    icon: <KeyRound size={18} />
  }
};

function emptyState(type: IntegrationType): IntegrationState {
  const config: Record<string, string> = {};
  FIELDS[type].forEach(f => { config[f.key] = ''; });
  return { type, config, enabled: false, lastTestStatus: 'untested', lastTestError: '', lastTestedAt: '' };
}

export default function Integrations() {
  const [states, setStates] = useState<Record<IntegrationType, IntegrationState>>({
    cloudflare: emptyState('cloudflare'),
    smtp: emptyState('smtp'),
    oauth_google: emptyState('oauth_google')
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<IntegrationType | null>(null);
  const [testing, setTesting] = useState<IntegrationType | null>(null);
  const [toasts, setToasts] = useState<{ id: number; message: string; isError?: boolean }[]>([]);

  const addToast = (message: string, isError?: boolean) => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, isError }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  };

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getAuthToken() || ''}`
  });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/integrations`, { headers: authHeaders() });
        if (!res.ok) {
          addToast('Failed to load integration settings.', true);
          return;
        }
        const data: IntegrationState[] = await res.json();
        setStates(prev => {
          const next = { ...prev };
          data.forEach(row => {
            // The secret field arrives masked (SECRET_MASK) if already set —
            // keep the input blank rather than showing the sentinel, but
            // remember a value is set via the badge below the field.
            const config = { ...row.config };
            next[row.type] = { ...row, config: { ...emptyState(row.type).config, ...config } };
          });
          return next;
        });
      } catch (err) {
        console.error('Error loading integrations:', err);
        addToast('Network error loading integration settings.', true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateField = (type: IntegrationType, key: string, value: string) => {
    setStates(prev => ({ ...prev, [type]: { ...prev[type], config: { ...prev[type].config, [key]: value } } }));
  };

  const toggleEnabled = (type: IntegrationType) => {
    setStates(prev => ({ ...prev, [type]: { ...prev[type], enabled: !prev[type].enabled } }));
  };

  // A secret field left blank by the admin means "don't change it" — send
  // the mask sentinel so the server keeps whatever's already stored instead
  // of overwriting a real secret with an empty string.
  const buildPayloadConfig = (type: IntegrationType): Record<string, any> => {
    const secretKey = SECRET_FIELD[type];
    const config: Record<string, any> = { ...states[type].config };
    if (!config[secretKey]) {
      config[secretKey] = SECRET_MASK;
    }
    if (type === 'smtp' && config.port) {
      config.port = Number(config.port);
    }
    return config;
  };

  const handleSave = async (type: IntegrationType) => {
    setSaving(type);
    try {
      const res = await fetch(`${API_BASE}/integrations/${type}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ config: buildPayloadConfig(type), enabled: states[type].enabled })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || `Failed to save ${PANEL_META[type].title} settings.`, true);
        return;
      }
      setStates(prev => ({
        ...prev,
        [type]: { ...data, config: { ...emptyState(type).config, ...data.config } }
      }));
      addToast(`${PANEL_META[type].title} settings saved.`);
    } catch (err) {
      console.error(`Error saving ${type} integration:`, err);
      addToast('Network error while saving.', true);
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (type: IntegrationType) => {
    setTesting(type);
    try {
      const res = await fetch(`${API_BASE}/integrations/${type}/test`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ config: buildPayloadConfig(type) })
      });
      const data = await res.json();
      setStates(prev => ({
        ...prev,
        [type]: {
          ...prev[type],
          lastTestStatus: data.ok ? 'success' : 'failure',
          lastTestError: data.ok ? (data.note || '') : (data.error || 'Connection failed'),
          lastTestedAt: new Date().toISOString()
        }
      }));
      addToast(
        data.ok ? `${PANEL_META[type].title}: connection succeeded.` : `${PANEL_META[type].title}: ${data.error || 'connection failed'}`,
        !data.ok
      );
    } catch (err) {
      console.error(`Error testing ${type} integration:`, err);
      addToast('Network error while testing connection.', true);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-gray-500">Loading integrations…</div>;
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 text-left">
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white border animate-slideIn ${t.isError ? 'bg-rose-600 border-rose-500' : 'bg-slate-900 border-slate-700'}`}
          >
            {t.isError ? <XCircle size={16} /> : <CheckCircle2 size={16} className="text-emerald-400" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      <div>
        <h1 className="text-xl font-semibold text-ink-950 tracking-tight">Integrations</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure Cloudflare R2 storage, SMTP email, and Google OAuth from here — changes take effect immediately, no server restart needed.</p>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {(['cloudflare', 'smtp', 'oauth_google'] as IntegrationType[]).map(type => {
          const state = states[type];
          const meta = PANEL_META[type];
          return (
            <div key={type} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                    {meta.icon}
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900">{meta.title}</h2>
                    <p className="text-xs text-gray-500 mt-0.5 max-w-md">{meta.description}</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-500">{state.enabled ? 'Enabled' : 'Disabled'}</span>
                  <span
                    onClick={() => toggleEnabled(type)}
                    className={`w-9 h-5 rounded-full relative transition-colors ${state.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${state.enabled ? 'translate-x-4' : ''}`} />
                  </span>
                </label>
              </div>

              <div className="p-4 sm:p-5 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {FIELDS[type].map(field => {
                    const isSecret = field.key === SECRET_FIELD[type];
                    const hasSavedSecret = isSecret && state.config[field.key] === '';
                    return (
                      <div key={field.key} className={field.key === 'endpoint' || field.key === 'publicUrl' ? 'sm:col-span-2' : ''}>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">{field.label}</label>
                        <input
                          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                          value={state.config[field.key] || ''}
                          onChange={e => updateField(type, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-500 bg-white text-gray-800"
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleSave(type)}
                      disabled={saving === type}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {saving === type ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                    <button
                      onClick={() => handleTest(type)}
                      disabled={testing === type}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {testing === type ? <Loader2 size={14} className="animate-spin" /> : <PlugZap size={14} />}
                      Test Connection
                    </button>
                  </div>

                  {state.lastTestStatus !== 'untested' && (
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${state.lastTestStatus === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {state.lastTestStatus === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      <span>
                        {state.lastTestStatus === 'success' ? 'Connected' : 'Failed'}
                        {state.lastTestError ? ` — ${state.lastTestError}` : ''}
                        {state.lastTestedAt ? ` (${new Date(state.lastTestedAt).toLocaleString()})` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
