import { useEffect, useState } from 'react';
import { DatabaseBackup, Loader2, AlertTriangle, CheckCircle2, ChevronDown } from 'lucide-react';
import { API_BASE } from '../../config';
import { getHeaders } from '../../lib/syncHelper';
import { toast } from '../Toast';

type Backup = { key: string; size: number; modified: string };
type Status = {
  enabled: boolean;
  offsite: boolean;
  bucket: string;
  cron: string;
  keep: number;
  warning?: string;
  items: Backup[];
  lastBackupAt: string | null;
};

const fmtSize = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtWhen = (iso: string) => new Date(iso.replace(' ', 'T')).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

/** "30 21 * * *" (UTC) → "Daily at 3:00 am". */
function scheduleLabel(cron: string): string {
  const [m, h, ...rest] = cron.split(' ');
  if (rest.join(' ') !== '* * *' || !/^\d+$/.test(m) || !/^\d+$/.test(h)) return `Schedule: ${cron} (UTC)`;
  const d = new Date(Date.UTC(2026, 0, 1, Number(h), Number(m)));
  return `Daily at ${d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })}`;
}

/**
 * Admin → Integrations: whether the database is being backed up, where to,
 * and the latest backups, with "Back up now". Restoring isn't offered here
 * on purpose — it replaces everything — and is done from the database's own
 * admin screen (Settings → Backups).
 */
export default function BackupsCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const load = () =>
    fetch(`${API_BASE}/backups`, { headers: getHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((s: Status) => { setStatus(s); setError(false); })
      .catch(() => setError(true));
  useEffect(() => { load(); }, []);

  const backUpNow = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/backups`, { method: 'POST', headers: getHeaders() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Backup failed');
      toast.success('Backup made');
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Backup failed');
    } finally {
      setBusy(false);
    }
  };

  const pill = !status ? null
    : !status.enabled ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Off</span>
    : status.offsite ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Off-site</span>
    : <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">On this server only</span>;

  const items = status?.items || [];
  const visible = showAll ? items : items.slice(0, 3);

  return (
    <section className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-4">
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status?.offsite ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
          <DatabaseBackup size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">Backups</span>
            {status ? pill : !error && <Loader2 size={13} className="animate-spin text-slate-300" />}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            A copy of all your data — clients, licences, invoices, payments, screens and playlists. (Images and videos stay in your media bucket.)
            {status?.enabled && ` ${scheduleLabel(status.cron)}, keeping the last ${status.keep}${status.offsite ? ` in “${status.bucket}”` : ''}.`}
          </p>
          {status && (
            <p className={`flex items-center gap-1 text-[11px] mt-1 ${status.lastBackupAt ? 'text-emerald-600' : 'text-slate-500'}`}>
              {status.lastBackupAt ? <><CheckCircle2 size={12} /> Last backup {fmtWhen(status.lastBackupAt)}</> : 'No backups yet'}
            </p>
          )}
          {status?.warning && (
            <p className="flex items-start gap-1.5 text-xs text-amber-800 bg-amber-50 rounded-lg px-2.5 py-2 mt-2">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" /> {status.warning}
            </p>
          )}
          {error && <p className="text-xs text-rose-600 mt-1">Couldn't read the backup status.</p>}
        </div>
        <button
          type="button"
          onClick={backUpNow}
          disabled={busy || !status}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy && <Loader2 size={13} className="animate-spin" />} {busy ? 'Backing up…' : 'Back up now'}
        </button>
      </div>

      {items.length > 0 && (
        <div className="border-t border-slate-100">
          <ul className="divide-y divide-slate-100">
            {visible.map(b => (
              <li key={b.key} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className="flex-1 min-w-0 truncate text-slate-700">{fmtWhen(b.modified)}</span>
                <span className="text-slate-400">{b.key.startsWith('@auto') ? 'Daily' : 'Manual'}</span>
                <span className="w-16 text-right text-slate-500">{fmtSize(b.size)}</span>
              </li>
            ))}
          </ul>
          {items.length > 3 && (
            <button type="button" onClick={() => setShowAll(v => !v)} className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-blue-600 hover:bg-slate-50">
              {showAll ? 'Show fewer' : `Show all ${items.length}`} <ChevronDown size={13} className={showAll ? 'rotate-180' : ''} />
            </button>
          )}
          <p className="px-4 py-2.5 text-[11px] text-slate-400 border-t border-slate-100">
            To restore one, open the database admin (PocketBase → Settings → Backups). Restoring replaces all current data.
          </p>
        </div>
      )}
    </section>
  );
}
