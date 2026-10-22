import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Mail, Copy, Check, RefreshCw, Trash2, Eye, EyeOff } from 'lucide-react';
import { pushToDatabase, syncCollection } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';

/**
 * The people who can sign in to this dashboard and run the system.
 *
 * Clients live on the Clients page; this is the other side of the counter.
 * An invite creates the account with a password you choose and emails the
 * sign-in link with those details. The first sign-in makes them pick their own
 * password (the same firstTimeLogin step clients go through), so the one in
 * the email stops working as soon as it has been used.
 */

type Admin = {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: 'active' | 'inactive';
  firstTimeLogin?: boolean;
  created?: string;
};

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

const isAdmin = (u: any) => u?.role === 'super_admin' || u?.role === 'admin';

function initials(name: string) {
  return (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]!.toUpperCase()).join('');
}

/** 12 characters from an alphabet without look-alikes (0/O, 1/l/I) — it gets read off an email. */
function strongPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => chars[b % chars.length]).join('');
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

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Admins({ userEmail = '' }: { userEmail?: string }) {
  const [admins, setAdmins] = useState<Admin[]>(() =>
    JSON.parse(localStorage.getItem('signageos_users') || '[]').filter(isAdmin));
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', password: '', sendEmail: true });
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const [removeTarget, setRemoveTarget] = useState<Admin | null>(null);

  const refresh = async () => {
    const users = await syncCollection('users', 'signageos_users');
    setAdmins(users.filter(isAdmin));
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const me = userEmail.toLowerCase();
  const sorted = [...admins].sort((a, b) =>
    (a.email.toLowerCase() === me ? -1 : 0) - (b.email.toLowerCase() === me ? -1 : 0) || (a.name || '').localeCompare(b.name || ''));

  const openInvite = () => {
    setDraft({ name: '', email: '', password: strongPassword(), sendEmail: true });
    setShowPassword(false);
    setCopied(false);
    setInviteOpen(true);
  };

  const sendInvite = async () => {
    const name = draft.name.trim();
    const email = draft.email.trim().toLowerCase();
    if (!name || !email) { toast.warning('Name and email are required'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.warning('That email doesn\'t look right'); return; }
    if (draft.password.length < 8) { toast.warning('The password needs at least 8 characters'); return; }

    setSending(true);
    const result = await pushToDatabase('users', '', {
      name,
      email,
      password: draft.password,
      role: 'admin',
      sendEmail: draft.sendEmail,
    }, 'POST');
    setSending(false);

    if (!result.ok) {
      toast.error(`Couldn't add the admin: ${errorText(result)}`);
      return;
    }
    await refresh();
    setInviteOpen(false);
    if (!draft.sendEmail) toast.success(`${name} added — share the password with them yourself`);
    else if (result.data?.emailSent) toast.success(`Invite sent to ${email}`);
    else toast.warning(`${name} added, but the email didn't go out — check Integrations → Email, and share the password yourself`);
  };

  const remove = async (a: Admin) => {
    const result = await pushToDatabase('users', a.id, null, 'DELETE');
    if (!result.ok) {
      toast.error(errorText(result));
      return;
    }
    setRemoveTarget(null);
    toast.success(`${a.name || a.email} can no longer sign in`);
    refresh();
  };

  const statusPill = (a: Admin) => {
    if (a.status === 'inactive') return <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-slate-100 text-slate-600 border-slate-200">Disabled</span>;
    if (a.firstTimeLogin) return <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200">Invited</span>;
    return <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>;
  };

  const canRemove = (a: Admin) => a.email.toLowerCase() !== me && admins.length > 1;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">Admin team</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {admins.length ? `${admins.length} admin${admins.length === 1 ? '' : 's'} · full access to every client, screen and setting` : 'People who can run this dashboard'}
          </p>
        </div>
        <button onClick={openInvite} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Invite admin
        </button>
      </div>

      {sorted.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_120px_100px_44px] gap-4 px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>Name</span><span>Email</span><span>Added</span><span>Status</span><span />
          </div>
          <div className="divide-y divide-slate-100">
            {sorted.map(a => {
              const isMe = a.email.toLowerCase() === me;
              return (
                <div key={a.id} className="flex md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_120px_100px_44px] gap-3 md:gap-4 items-center px-4 md:px-5 py-3">
                  <span className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-blue-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">{initials(a.name || a.email)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 truncate">
                        {a.name || a.email.split('@')[0]}{isMe && <span className="text-slate-400 font-normal"> (you)</span>}
                      </span>
                      <span className="block md:hidden text-xs text-slate-500 truncate">{a.email}</span>
                    </span>
                  </span>
                  <span className="hidden md:block text-sm text-slate-600 truncate">{a.email}</span>
                  <span className="hidden md:block text-sm text-slate-600">{formatDate(a.created)}</span>
                  <span className="flex">{statusPill(a)}</span>
                  <span className="flex justify-end">
                    {canRemove(a) ? (
                      <button
                        type="button"
                        onClick={() => setRemoveTarget(a)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label={`Remove ${a.name || a.email}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : <span className="w-9" />}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && admins.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <ShieldCheck size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No admins found</p>
          <p className="text-xs text-gray-500 mt-1">Invite someone to help run the dashboard.</p>
        </div>
      )}

      <p className="text-xs text-slate-500 px-1">
        Admins can see and change everything, including clients, licenses and other admins. Only invite people you'd trust with that.
      </p>

      {inviteOpen && (
        <ScreenDetailsSheet
          open
          onClose={() => !sending && setInviteOpen(false)}
          title="Invite an admin"
          subtitle="They get the sign-in link and these details by email"
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Name</label>
                <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="e.g. Rahul Verma" className={inputCls} autoFocus />
              </div>
              <div>
                <label className={labelCls}>Email — their login</label>
                <input type="email" inputMode="email" autoCapitalize="none" value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))} placeholder="rahul@bluestardigitech.com" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={draft.password}
                      onChange={e => setDraft(d => ({ ...d, password: e.target.value }))}
                      autoComplete="new-password"
                      className={`${inputCls} font-mono pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                    onClick={() => { setDraft(d => ({ ...d, password: strongPassword() })); setShowPassword(true); }}
                    className="w-11 h-11 shrink-0 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                    aria-label="Generate a password"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                <p className={`text-xs mt-1.5 ${draft.password && draft.password.length < 8 ? 'text-red-600' : 'text-slate-500'}`}>
                  {draft.password && draft.password.length < 8
                    ? 'At least 8 characters.'
                    : 'Type your own or keep the generated one. They\'ll choose a new one the first time they sign in.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDraft(d => ({ ...d, sendEmail: !d.sendEmail }))}
                aria-pressed={draft.sendEmail}
                className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-2xl border border-slate-100 hover:bg-slate-50"
              >
                <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Mail size={17} /></span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-slate-900">Email the invite</span>
                  <span className="block text-xs text-slate-500 truncate">Sign-in link, email and password to {draft.email.trim() || 'them'}</span>
                </span>
                <span className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${draft.sendEmail ? 'bg-blue-600' : 'bg-slate-200'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${draft.sendEmail ? 'left-[18px]' : 'left-0.5'}`} />
                </span>
              </button>
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                disabled={sending}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={sendInvite}
                disabled={sending || !draft.name.trim() || !draft.email.trim() || draft.password.length < 8}
                className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold"
              >
                {sending ? 'Sending…' : draft.sendEmail ? 'Send invite' : 'Add admin'}
              </button>
            </div>
          }
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title={`Remove ${removeTarget.name || removeTarget.email}?`}
          body={<p>Their admin account is deleted and they can no longer sign in. Clients and client screens aren't affected, but any screens on their own channel go back to pairing.</p>}
          confirmLabel="Remove admin"
          tone="danger"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => remove(removeTarget)}
        />
      )}
    </div>
  );
}
