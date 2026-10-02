import { ReactNode, useEffect, useState } from 'react';

/** Small confirm step for actions that change what's on a physical screen. */
export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  tone = 'default',
  onCancel,
  onConfirm
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/50" onClick={() => !busy && onCancel()} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <div className="text-sm text-slate-600 mt-2 space-y-2">{body}</div>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className={`flex-1 h-11 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${tone === 'danger' ? 'bg-rose-600' : 'bg-blue-600'}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
