import { useEffect, useRef, useState } from 'react';
import { Tv, X } from 'lucide-react';

/**
 * Pairs a TV to an existing screen (one whose TV was unlinked, or is being
 * replaced): the user types the code the TV shows on its pairing screen.
 * The screen keeps its name, location, group and playlist.
 */
export default function PairTvDialog({
  screenName,
  onClose,
  onSubmit
}: {
  screenName: string;
  onClose: () => void;
  onSubmit: (code: string) => Promise<void>;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const clean = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);

  const submit = async () => {
    if (clean.length !== 6 || busy) return;
    setBusy(true);
    setError('');
    try {
      await onSubmit(clean);
    } catch (e: any) {
      setError(e?.message || 'Pairing failed. Check the code and try again.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[310] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Pair a TV">
      <div className="absolute inset-0 bg-slate-950/50" onClick={() => !busy && onClose()} />
      <div className="relative w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-3">
          <span className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Tv size={18} /></span>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Pair a TV</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">to “{screenName}”</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X size={17} />
          </button>
        </div>

        <p className="text-sm text-slate-600 mt-4">
          Open the signage app on the TV. Enter the 6-character code it shows.
        </p>

        <input
          ref={inputRef}
          value={clean}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="mt-3 w-full h-14 text-center text-2xl font-mono font-semibold tracking-[0.4em] uppercase border border-slate-200 rounded-2xl outline-none focus:border-blue-500 bg-slate-50"
        />
        {error && <p className="text-xs text-rose-600 mt-2">{error}</p>}
        <p className="text-xs text-slate-400 mt-2">The screen keeps its name, location, group and playlist.</p>

        <button
          type="button"
          onClick={submit}
          disabled={clean.length !== 6 || busy}
          className="mt-4 w-full h-11 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-40"
        >
          {busy ? 'Pairing…' : 'Pair TV'}
        </button>
      </div>
    </div>
  );
}
