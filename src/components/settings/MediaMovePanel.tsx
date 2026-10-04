import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader2, CheckCircle2, XCircle, Truck } from 'lucide-react';
import { API_BASE } from '../../config';
import { getHeaders } from '../../lib/syncHelper';

type Progress = {
  state: 'idle' | 'copying' | 'checking' | 'rewriting' | 'done' | 'failed';
  total: number; copied: number; skipped: number; failed: number; bytes: number;
  records: number; fields: number; error?: string;
};
type Info = { available: boolean; from: { bucket: string; publicUrl: string } | null; to: { bucket: string; publicUrl: string } | null; progress: Progress };

const host = (url?: string) => (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const running = (p?: Progress) => !!p && ['copying', 'checking', 'rewriting'].includes(p.state);

/**
 * File storage → moving to new storage: copies every existing file from the
 * server's old storage to the one saved here, checks it loads from the new
 * address, and points everything at the new address. The old bucket is
 * only read, so it stays as a fallback.
 */
export default function MediaMovePanel({ refreshKey }: { refreshKey: number }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<number | null>(null);

  const load = async () => {
    const res = await fetch(`${API_BASE}/integrations/cloudflare/migration`, { headers: getHeaders() }).catch(() => null);
    if (!res?.ok) return;
    const data: Info = await res.json();
    setInfo(data);
    if (running(data.progress)) timer.current = window.setTimeout(load, 1500);
  };
  useEffect(() => { load(); return () => { if (timer.current) clearTimeout(timer.current); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);

  const start = async () => {
    setStarting(true); setError('');
    const res = await fetch(`${API_BASE}/integrations/cloudflare/migration`, { method: 'POST', headers: getHeaders() }).catch(() => null);
    const body = await res?.json().catch(() => ({}));
    if (!res?.ok) setError(body?.error || 'Could not start the move.');
    setStarting(false);
    load();
  };

  const p = info?.progress;
  if (!info || (!info.available && (!p || p.state === 'idle'))) return null;
  const busy = running(p);

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Truck size={15} className="text-blue-600 shrink-0" />
        <p className="text-sm font-semibold text-slate-900">Move existing media</p>
      </div>
      {info.from && info.to && (
        <p className="flex items-center gap-1.5 flex-wrap text-xs text-slate-600">
          <span className="font-mono">{host(info.from.publicUrl)}</span>
          <ArrowRight size={12} />
          <span className="font-mono">{host(info.to.publicUrl)}</span>
        </p>
      )}
      <p className="text-xs text-slate-600">
        Copies every image and video already uploaded to this storage, checks they load from the new address, then switches screens and playlists over. The old storage isn't changed.
      </p>

      {p && p.state !== 'idle' && (
        <div className="text-xs space-y-1">
          {busy && (
            <p className="flex items-center gap-1.5 text-blue-700">
              <Loader2 size={13} className="animate-spin" />
              {p.state === 'copying' ? `Copying… ${p.copied + p.skipped} of ${p.total || '…'} files`
                : p.state === 'checking' ? 'Checking the new address…'
                : 'Updating screens and playlists…'}
            </p>
          )}
          {p.state === 'done' && (
            <p className="flex items-start gap-1.5 text-emerald-700">
              <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
              Done — all {p.total} files are in the new storage{p.records > 0 ? `, and ${p.records} item${p.records === 1 ? '' : 's'} now use the new address` : ''}. Screens pick it up on their next sync.
            </p>
          )}
          {p.state === 'failed' && (
            <p className="flex items-start gap-1.5 text-rose-700"><XCircle size={13} className="mt-0.5 shrink-0" /> {p.error}</p>
          )}
        </div>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}

      {info.available && !busy && p?.state !== 'done' && (
        <button type="button" onClick={start} disabled={starting} className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-1.5">
          {starting && <Loader2 size={14} className="animate-spin" />} {p?.state === 'failed' ? 'Try again' : 'Move files'}
        </button>
      )}
    </div>
  );
}
