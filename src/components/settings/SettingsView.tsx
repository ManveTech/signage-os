import { useEffect, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Compass, Mail, Plug, Palette, UserRound, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../config';
import { getHeaders } from '../../lib/syncHelper';
import { licensingStore } from '../../lib/licensingStore';
import { ADMIN_ROUTES, USER_ROUTES } from '../../lib/routes';
import { runTour } from '../../lib/tour/runner';
import { getAdminTourSteps } from '../../lib/tour/adminTour';
import { getUserTourSteps } from '../../lib/tour/userTour';
import { markTourSeen } from '../../lib/tour/state';
import { toast } from '../Toast';

type MySettings = { email: string; emailReady: boolean; alertScreenOffline: boolean };

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold text-slate-500 px-1">{title}</h2>
      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">{children}</div>
    </section>
  );
}

function LinkRow({ icon, label, description, onClick }: { icon: ReactNode; label: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50">
      <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-slate-900">{label}</span>
        <span className="block text-xs text-slate-500 mt-0.5">{description}</span>
      </span>
      <ChevronRight size={16} className="text-slate-300 shrink-0" />
    </button>
  );
}

/**
 * Settings — only things that actually do something: email alerts, plus
 * shortcuts to where the rest lives (profile, branding, integrations) and a
 * way to replay the tour.
 */
export default function SettingsView({ userEmail, isAdmin = false }: { userEmail: string; isAdmin?: boolean }) {
  const navigate = useNavigate();
  const routes = isAdmin ? ADMIN_ROUTES : USER_ROUTES;
  const [settings, setSettings] = useState<MySettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const whiteLabel = !isAdmin && licensingStore.getLicenses().some(l => l.assignedUserEmail === userEmail && l.whiteLabel);

  useEffect(() => {
    fetch(`${API_BASE}/me/settings`, { headers: getHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setSettings)
      .catch(() => setLoadError(true));
  }, [userEmail]);

  const update = async (patch: Partial<MySettings>) => {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/me/settings`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(patch) });
      if (!res.ok) throw new Error();
      setSettings(await res.json());
      toast.success('Saved');
    } catch {
      setSettings(previous);
      toast.error('Couldn\'t save — check your connection and try again');
    } finally {
      setSaving(false);
    }
  };

  const replayTour = () => runTour({
    steps: isAdmin ? getAdminTourSteps() : getUserTourSteps(),
    navigate,
    onFinish: () => markTourSeen(isAdmin ? 'admin-dashboard' : 'user-dashboard', userEmail)
  });

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Alerts and shortcuts for your account</p>
      </div>

      <Card title="Alerts">
        <div className="flex items-start gap-3 px-4 py-4">
          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Bell size={17} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">Email me when a screen goes offline</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Sent to {settings?.email || userEmail} a few minutes after one of {isAdmin ? 'your own' : 'your'} screens stops responding — at most once every 30 minutes per screen. Not sent when you unlink a TV.
            </p>
            {settings && !settings.emailReady && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700 mt-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                {isAdmin
                  ? <span>Email isn't set up yet, so alerts can't be sent. <button type="button" onClick={() => navigate(routes['integrations'])} className="underline font-medium">Set up email</button></span>
                  : <span>Email isn't set up on this platform yet — alerts start once your provider turns it on.</span>}
              </p>
            )}
            {loadError && <p className="text-xs text-rose-600 mt-2">Couldn't load your settings. Refresh to try again.</p>}
          </div>
          {settings ? (
            <Toggle
              label="Email me when a screen goes offline"
              checked={settings.alertScreenOffline}
              disabled={saving}
              onChange={v => update({ alertScreenOffline: v })}
            />
          ) : !loadError && <Loader2 size={18} className="animate-spin text-slate-300 mt-1" />}
        </div>
      </Card>

      <Card title="Account">
        <LinkRow icon={<UserRound size={17} />} label="Profile" description="Photo, name and password" onClick={() => navigate(routes['profile'])} />
        {whiteLabel && (
          <LinkRow icon={<Palette size={17} />} label="Branding" description="Your name and logo on the dashboard and your screens" onClick={() => navigate(routes['profile'])} />
        )}
        {isAdmin && (
          <LinkRow icon={<Plug size={17} />} label="Integrations" description="File storage, email and Google sign-in" onClick={() => navigate(routes['integrations'])} />
        )}
        {isAdmin && (
          <LinkRow icon={<Mail size={17} />} label="Business details" description="Name, GST and address on invoices (Invoices → Billing details)" onClick={() => navigate(routes['licenses-invoices'])} />
        )}
      </Card>

      <Card title="Help">
        <LinkRow icon={<Compass size={17} />} label="Replay the guided tour" description="A quick walk through every section" onClick={replayTour} />
      </Card>
    </div>
  );
}
