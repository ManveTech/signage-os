import { useEffect, useState } from 'react';
import { ArrowLeft, Clock, Lightbulb, Maximize2, X } from 'lucide-react';
import type { HelpGuide as Guide } from '../../lib/helpGuides';
import shots from './helpShots.json';

type Mark = { kind: 'box' | 'arrow'; n?: number; x: number; y: number; w: number; h: number };
type Shot = { src: string; w: number; h: number; marks: Mark[] };

const ACCENT = '#F97316';
const PAD = 7;

/**
 * Draws a guide's highlights over its screenshot. Marks are stored as
 * percentages of the page, so they stay on target at any width.
 *
 * box   — an outline around the control.
 * arrow — the same, plus an arrow pointing in from the emptier side.
 * Both carry the step's number, which the text refers to as (1), (2)…
 */
function Overlay({ shot }: { shot: Shot }) {
  const { w: W, h: H } = shot;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <marker id="help-arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} />
        </marker>
      </defs>
      {shot.marks.map((m, i) => {
        const x = (m.x / 100) * W - PAD, y = (m.y / 100) * H - PAD;
        const w = (m.w / 100) * W + PAD * 2, h = (m.h / 100) * H + PAD * 2;
        const cx = x + w / 2, cy = y + h / 2;

        // The arrow comes from whichever side has more room.
        let arrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
        if (m.kind === 'arrow') {
          const len = 120;
          if (cx > W * 0.55) arrow = { x1: x - len, y1: cy + len * 0.55, x2: x - 6, y2: cy + 4 };
          else if (x + w + len < W) arrow = { x1: x + w + len, y1: cy + len * 0.55, x2: x + w + 6, y2: cy + 4 };
          else arrow = { x1: cx - len * 0.4, y1: y + h + len, x2: cx, y2: y + h + 6 };
        }
        // Number sits at the arrow's tail, or on the box's top-left corner.
        const bx = Math.min(Math.max(arrow ? arrow.x1 : x, 22), W - 22);
        const by = Math.min(Math.max(arrow ? arrow.y1 : y, 22), H - 22);

        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={12} fill="rgba(249,115,22,0.08)" stroke="#fff" strokeWidth={9} />
            <rect x={x} y={y} width={w} height={h} rx={12} fill="none" stroke={ACCENT} strokeWidth={4.5} />
            {arrow && (
              <>
                <line {...arrow} stroke="#fff" strokeWidth={13} strokeLinecap="round" />
                <line {...arrow} stroke={ACCENT} strokeWidth={7} strokeLinecap="round" markerEnd="url(#help-arrowhead)" />
              </>
            )}
            {m.n != null && (
              <g>
                <circle cx={bx} cy={by} r={19} fill={ACCENT} stroke="#fff" strokeWidth={4} />
                <text x={bx} y={by + 7.5} textAnchor="middle" fontSize={21} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">{m.n}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function GuideShot({ id, alt }: { id: string; alt: string }) {
  const shot = (shots as Record<string, Shot>)[id];
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  if (!shot) return null;
  const figure = (
    <span className="relative block">
      <img src={shot.src} alt={alt} width={shot.w} height={shot.h} loading="lazy" className="block w-full h-auto" />
      <Overlay shot={shot} />
    </span>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative block w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-50 text-left"
        aria-label={`Enlarge screenshot: ${alt}`}
      >
        {figure}
        <span className="absolute right-2 bottom-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/70 text-white text-[11px] font-medium opacity-80 group-hover:opacity-100">
          <Maximize2 size={12} /> Enlarge
        </span>
      </button>
      {zoomed && (
        <div className="fixed inset-0 z-[80] bg-slate-950/85 flex items-center justify-center p-3 sm:p-8" onClick={() => setZoomed(false)} role="dialog" aria-label={alt}>
          <button type="button" className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close">
            <X size={20} />
          </button>
          <div className="w-full max-w-6xl rounded-xl overflow-hidden shadow-2xl">{figure}</div>
        </div>
      )}
    </>
  );
}

/** A built-in guide, read in place of the Help Center list. */
export function GuideArticle({ guide, onBack, related }: { guide: Guide; onBack: () => void; related?: { guide: Guide; open: () => void }[] }) {
  useEffect(() => { window.scrollTo?.({ top: 0 }); document.querySelector('main')?.scrollTo?.({ top: 0 }); }, [guide.id]);

  return (
    <article className="max-w-3xl">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-blue-600 mb-4">
        <ArrowLeft size={15} /> All help
      </button>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{guide.category}</p>
      <h2 className="display text-2xl sm:text-3xl text-ink-950 mt-1">{guide.title}</h2>
      <p className="text-sm text-slate-600 mt-1.5">{guide.summary}</p>
      <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-2"><Clock size={12} /> {guide.minutes} min</p>

      <ol className="mt-6 space-y-6">
        {guide.steps.map((step, i) => (
          <li key={i} className="flex gap-3 sm:gap-4">
            <span className="w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-[15px] leading-relaxed text-slate-800">{step.text}</p>
              {step.shot && <GuideShot id={step.shot} alt={`${guide.title} — step ${i + 1}`} />}
            </div>
          </li>
        ))}
      </ol>

      {guide.tips && guide.tips.length > 0 && (
        <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-100 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb size={16} /> Good to know</p>
          <ul className="mt-2 space-y-1.5">
            {guide.tips.map((t, i) => <li key={i} className="text-sm text-amber-900/90 leading-relaxed">• {t}</li>)}
          </ul>
        </div>
      )}

      {related && related.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Related</p>
          <div className="flex flex-wrap gap-2">
            {related.map(r => (
              <button key={r.guide.id} type="button" onClick={r.open} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">
                {r.guide.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
