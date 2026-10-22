import { useEffect, useRef, useState } from 'react';
import { Package, Upload, Download, Trash2, Copy, Check, FileUp } from 'lucide-react';
import { API_BASE } from '../../../config';
import { getAuthToken } from '../../../lib/authStorage';
import { pushToDatabase } from '../../../lib/syncHelper';
import { toast } from '../../../components/Toast';
import ScreenDetailsSheet from '../../../components/screens/ScreenDetailsSheet';
import ConfirmDialog from '../../../components/screens/ConfirmDialog';

/**
 * TV player builds for bluestardigitech.com/app.
 *
 * Upload an APK with a version number and it becomes the latest: /app starts
 * downloading it on any TV that opens the link, and /app/releases lists every
 * version for anyone who needs an older one. Files live in R2 (see
 * server/controllers/appReleases.ts).
 */

type Release = {
  id: string;
  version: string;
  notes: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  created: string;
};

const PUBLIC_SITE = 'https://bluestardigitech.com';
const MAX_APK_BYTES = 200 * 1024 * 1024;

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

function formatSize(bytes: number) {
  if (!bytes) return '—';
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Suggests the next version from the latest one: 1.4 → 1.5, 2.0.9 → 2.0.10. */
function nextVersion(latest?: string) {
  if (!latest) return '1.0';
  const parts = latest.split('.');
  const last = Number(parts[parts.length - 1]);
  if (!Number.isInteger(last)) return '';
  parts[parts.length - 1] = String(last + 1);
  return parts.join('.');
}

function CopyLink({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] text-slate-500">{label}</span>
        <a href={url} target="_blank" rel="noreferrer" className="block text-sm font-medium text-blue-600 truncate">{url.replace(/^https:\/\//, '')}</a>
      </span>
      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export default function AppReleases() {
  const [releases, setReleases] = useState<Release[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const [removeTarget, setRemoveTarget] = useState<Release | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/public/app/releases`, { cache: 'no-store' });
      if (res.ok) setReleases(await res.json());
    } catch { /* keep what we have */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const latest = releases[0];

  const openUpload = () => {
    setFile(null);
    setVersion(nextVersion(latest?.version));
    setNotes('');
    setProgress(null);
    setUploadOpen(true);
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!/\.apk$/i.test(f.name)) { toast.warning('Choose an .apk file'); return; }
    if (f.size > MAX_APK_BYTES) { toast.warning(`That file is ${formatSize(f.size)} — the limit is ${formatSize(MAX_APK_BYTES)}`); return; }
    setFile(f);
  };

  const versionError = version && !/^[0-9A-Za-z][0-9A-Za-z.\-_]{0,30}$/.test(version.trim())
    ? 'Use numbers and dots, like 1.2 or 1.2.3'
    : releases.some(r => r.version === version.trim()) ? `Version ${version.trim()} is already released` : '';

  // XHR rather than fetch: fetch can't report upload progress, and an APK
  // takes long enough that a bar is the only sign it's still going.
  const upload = () => {
    if (!file || !version.trim() || versionError) return;
    const xhr = new XMLHttpRequest();
    const qs = `version=${encodeURIComponent(version.trim())}&notes=${encodeURIComponent(notes.trim())}`;
    xhr.open('POST', `${API_BASE}/app-releases?${qs}`);
    const token = getAuthToken();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Content-Type', 'application/vnd.android.package-archive');
    xhr.withCredentials = true;
    xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      setProgress(null);
      let data: any = {};
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        toast.success(`Version ${data.version || version.trim()} is live — ${PUBLIC_SITE.replace('https://', '')}/app now downloads it`);
        setUploadOpen(false);
        load();
      } else {
        toast.error(data.error || (xhr.status === 413 ? 'The file is too large for the server' : `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => { setProgress(null); toast.error('Upload failed — check your connection and try again'); };
    setProgress(0);
    xhr.send(file);
  };

  const remove = async (r: Release) => {
    const result = await pushToDatabase('app-releases', r.id, null, 'DELETE');
    if (!result.ok) { toast.error('Could not delete this release'); return; }
    setRemoveTarget(null);
    toast.success(`Version ${r.version} removed`);
    load();
  };

  const uploading = progress !== null;

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="display text-2xl sm:text-3xl text-ink-950">App releases</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {latest ? `Latest: version ${latest.version} · ${formatDate(latest.created)}` : 'The TV player app, for download on any screen'}
          </p>
        </div>
        <button onClick={openUpload} className="flex items-center gap-2 h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium">
          <Upload size={16} /> New release
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <CopyLink url={`${PUBLIC_SITE}/app`} label="Download link — open it on a TV and the latest version downloads" />
        <CopyLink url={`${PUBLIC_SITE}/app/releases`} label="All versions" />
      </div>

      {releases.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
          {releases.map((r, i) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${i === 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                <Package size={18} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">Version {r.version}</span>
                  {i === 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">Latest</span>}
                </span>
                <span className="block text-xs text-slate-500">{formatDate(r.created)} · {formatSize(r.fileSize)}</span>
                {r.notes && <span className="block text-xs text-slate-600 mt-1 whitespace-pre-line">{r.notes}</span>}
              </span>
              <a href={r.fileUrl} className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50" aria-label={`Download version ${r.version}`}>
                <Download size={16} />
              </a>
              <button
                type="button"
                onClick={() => setRemoveTarget(r)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50"
                aria-label={`Delete version ${r.version}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && releases.length === 0 && (
        <div className="py-14 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Package size={30} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm font-medium text-gray-700">No releases yet</p>
          <p className="text-xs text-gray-500 mt-1">Upload the player APK and the download link starts working.</p>
          <button onClick={openUpload} className="mt-4 inline-flex items-center gap-2 h-10 px-4 bg-blue-600 text-white rounded-xl text-sm font-medium">
            <Upload size={16} /> Upload the first release
          </button>
        </div>
      )}

      {uploadOpen && (
        <ScreenDetailsSheet
          open
          onClose={() => !uploading && setUploadOpen(false)}
          title={uploading ? `Uploading… ${progress}%` : 'New release'}
          subtitle="Becomes the version /app downloads"
          details={[]}
          groups={[]}
          hero={
            <div className="space-y-4">
              <input ref={fileInput} type="file" accept=".apk,application/vnd.android.package-archive" className="hidden"
                onChange={e => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 border-dashed text-left transition-colors ${file ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 hover:border-blue-300'}`}
              >
                <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><FileUp size={18} /></span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900 truncate">{file ? file.name : 'Choose the APK'}</span>
                  <span className="block text-xs text-slate-500">{file ? formatSize(file.size) : `Up to ${formatSize(MAX_APK_BYTES)}`}</span>
                </span>
              </button>

              <div>
                <label className={labelCls}>Version number</label>
                <input value={version} onChange={e => setVersion(e.target.value)} placeholder="e.g. 1.2" className={inputCls} disabled={uploading} />
                <p className={`text-xs mt-1.5 ${versionError ? 'text-red-600' : 'text-slate-500'}`}>
                  {versionError || 'Shown on the download page. Use the same number as in the app build.'}
                </p>
              </div>

              <div>
                <label className={labelCls}>What's new <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} maxLength={2000} disabled={uploading}
                  placeholder="e.g. Faster playlist sync, fixes black screen after reboot"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none" />
              </div>

              {uploading && (
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              )}
            </div>
          }
          footer={
            <div className="flex gap-2">
              <button type="button" onClick={() => setUploadOpen(false)} disabled={uploading}
                className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={upload} disabled={uploading || !file || !version.trim() || !!versionError}
                className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">
                {uploading ? `Uploading ${progress}%` : 'Publish release'}
              </button>
            </div>
          }
        />
      )}

      {removeTarget && (
        <ConfirmDialog
          title={`Delete version ${removeTarget.version}?`}
          body={<p>The file is deleted and it disappears from the releases page.{releases[0]?.id === removeTarget.id ? ` ${releases[1] ? `/app will download version ${releases[1].version} instead.` : '/app will have nothing to download until you upload a new one.'}` : ''}</p>}
          confirmLabel="Delete release"
          tone="danger"
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => remove(removeTarget)}
        />
      )}
    </div>
  );
}
