import { useState } from 'react';
import { Copy, Check, ChevronDown, X } from 'lucide-react';

// The key table. Codes already handed out depend on these exact values —
// don't change them.
const CHAR_MAP: Record<string, number> = {
  A: 37, B: 14, C: 82, D: 53, E: 9,
  F: 64, G: 21, H: 75, I: 48, J: 93,
  K: 30, L: 88, M: 5,  N: 72, O: 19,
  P: 41, Q: 97, R: 26, S: 58, T: 83,
  U: 11, V: 69, W: 46, X: 99, Y: 15,
  Z: 78
};

/** Letters become their number from the table; anything else is kept as is. */
const encode = (text: string) => text.toUpperCase().split('').map(char => ({
  char,
  code: CHAR_MAP[char] !== undefined ? String(CHAR_MAP[char]) : char
}));

/**
 * License code tool: type a word, get its numeric code from the key table.
 * Each letter's number is shown under it so a code can be checked by eye.
 */
export default function LicenseDecoder() {
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTable, setShowTable] = useState(false);

  const parts = encode(text);
  const code = parts.map(p => p.code).join('');

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — the code is still selectable */ }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="display text-2xl sm:text-3xl text-ink-950">License code</h1>
        <p className="text-sm text-gray-500 mt-0.5">Turn a word into its numeric code using the key table</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 space-y-4">
        <label className="block">
          <span className="block text-xs font-semibold text-slate-600 mb-1.5">Word</span>
          <span className="relative block">
            <input
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="e.g. TEST"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full h-12 px-4 pr-10 text-lg font-semibold tracking-widest uppercase border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white"
            />
            {text && (
              <button type="button" onClick={() => setText('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600" aria-label="Clear">
                <X size={16} />
              </button>
            )}
          </span>
        </label>

        {code ? (
          <>
            <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center gap-3">
              <span className="flex-1 min-w-0 font-mono text-2xl font-bold tracking-wider break-all select-all">{code}</span>
              <button
                type="button"
                onClick={copy}
                className="shrink-0 flex items-center gap-1.5 h-9 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium"
              >
                {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Letter by letter">
              {parts.map((p, i) => (
                <span key={i} className={`flex flex-col items-center min-w-[2.5rem] px-2 py-1.5 rounded-lg border ${CHAR_MAP[p.char] !== undefined ? 'bg-slate-50 border-slate-100' : 'bg-amber-50 border-amber-100'}`}>
                  <span className="text-[11px] font-semibold text-slate-500">{p.char}</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{p.code}</span>
                </span>
              ))}
            </div>
            {parts.some(p => CHAR_MAP[p.char] === undefined) && (
              <p className="text-xs text-amber-700">Numbers and symbols aren't in the table, so they're kept as they are.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500">The code appears here as you type.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowTable(v => !v)}
          aria-expanded={showTable}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          Key table
          <ChevronDown size={16} className={`text-slate-400 transition-transform ${showTable ? 'rotate-180' : ''}`} />
        </button>
        {showTable && (
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 px-4 pb-4">
            {Object.entries(CHAR_MAP).map(([char, val]) => (
              <span key={char} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-50 text-xs font-mono">
                <span className="text-slate-500">{char}</span>
                <span className="font-bold text-slate-900">{val}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
