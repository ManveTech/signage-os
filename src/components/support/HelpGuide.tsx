import { ReactNode, useEffect, useState } from 'react';
import { ArrowLeft, Clock, Lightbulb, Maximize2, X } from 'lucide-react';
import type { GuideMark, GuideStep, SupportDoc } from '../../lib/supportStore';
import { youtubeId } from './supportUi';

const ACCENT = '#F97316';

/** Rough reading time: a short intro plus about 40 seconds a step. */
export function guideMinutes(doc: SupportDoc) {
  return Math.max(1, Math.round(0.5 + (doc.steps?.length || 0) * 0.7));
}

/**
 * Draws a step's highlights over its screenshot. Marks are stored as
 * percentages of the image, so they stay on target at any width, and are
 * numbered by position — the step's text refers to them as (1), (2)…
 *
 * box   — an outline around the control.
 * arrow — the same, plus an arrow pointing in from the emptier side.
 */
export function MarksOverlay({ marks, w, h, draft }: { marks: GuideMark[]; w: number; h: number; draft?: GuideMark | null }) {
  // Sizes are in image pixels; scale them so they read the same on any image.
  const u = w / 1280;
  const pad = 7 * u;
  const all = draft ? [...marks, draft] : marks;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
      <defs>
        <marker id="help-arrowhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={ACCENT} />
        </marker>
      </defs>
      {all.map((m, i) => {
        const x = (m.x / 100) * w - pad, y = (m.y / 100) * h - pad;
        const bw = (m.w / 100) * w + pad * 2, bh = (m.h / 100) * h + pad * 2;
        const cx = x + bw / 2, cy = y + bh / 2;

        let arrow: { x1: number; y1: number; x2: number; y2: number } | null = null;
        if (m.kind === 'arrow') {
          const len = 120 * u;
          if (cx > w * 0.55) arrow = { x1: x - len, y1: cy + len * 0.55, x2: x - 6 * u, y2: cy + 4 * u };
          else if (x + bw + len < w) arrow = { x1: x + bw + len, y1: cy + len * 0.55, x2: x + bw + 6 * u, y2: cy + 4 * u };
          else arrow = { x1: cx - len * 0.4, y1: y + bh + len, x2: cx, y2: y + bh + 6 * u };
        }
        const r = 19 * u;
        const bx = Math.min(Math.max(arrow ? arrow.x1 : x, r + 3), w - r - 3);
        const by = Math.min(Math.max(arrow ? arrow.y1 : y, r + 3), h - r - 3);
        const isDraft = draft && i === all.length - 1;

        return (
          <g key={i} opacity={isDraft ? 0.7 : 1}>
            <rect x={x} y={y} width={bw} height={bh} rx={12 * u} fill="rgba(249,115,22,0.08)" stroke="#fff" strokeWidth={9 * u} />
            <rect x={x} y={y} width={bw} height={bh} rx={12 * u} fill="none" stroke={ACCENT} strokeWidth={4.5 * u} />
            {arrow && (
              <>
                <line {...arrow} stroke="#fff" strokeWidth={13 * u} strokeLinecap="round" />
                <line {...arrow} stroke={ACCENT} strokeWidth={7 * u} strokeLinecap="round" markerEnd="url(#help-arrowhead)" />
              </>
            )}
            {!isDraft && (
              <g>
                <circle cx={bx} cy={by} r={r} fill={ACCENT} stroke="#fff" strokeWidth={4 * u} />
                <text x={bx} y={by + 7.5 * u} textAnchor="middle" fontSize={21 * u} fontWeight={700} fill="#fff" fontFamily="system-ui, sans-serif">{i + 1}</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Image size: stored with the step, or read from the image once it loads. */
function useImageSize(step: GuideStep) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(step.imageW && step.imageH ? { w: step.imageW, h: step.imageH } : null);
  useEffect(() => { setSize(step.imageW && step.imageH ? { w: step.imageW, h: step.imageH } : null); }, [step.image, step.imageW, step.imageH]);
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!size) setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
  };
  return { size, onLoad };
}

export function GuideShot({ step, alt }: { step: GuideStep; alt: string }) {
  const { size, onLoad } = useImageSize(step);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoomed(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomed]);

  if (!step.image) return null;
  const figure = (
    <span className="relative block">
      <img src={step.image} alt={alt} width={size?.w} height={size?.h} loading="lazy" onLoad={onLoad} className="block w-full h-auto" />
      {size && step.marks && step.marks.length > 0 && <MarksOverlay marks={step.marks} w={size.w} h={size.h} />}
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

/** A step-by-step guide, read in place of the Help Center list. */
export function GuideArticle({ doc, onBack, related, actions }: {
  doc: SupportDoc;
  onBack: () => void;
  related?: { doc: SupportDoc; open: () => void }[];
  /** Admin's Edit / Delete buttons. */
  actions?: ReactNode;
}) {
  useEffect(() => { document.querySelector('main')?.scrollTo?.({ top: 0 }); }, [doc.id]);
  const steps = doc.steps || [];

  return (
    <article className="max-w-3xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-blue-600">
          <ArrowLeft size={15} /> All help
        </button>
        {actions}
      </div>
      {doc.category && <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{doc.category}</p>}
      <h2 className="display text-2xl sm:text-3xl text-ink-950 mt-1">{doc.title}</h2>
      {doc.content && <p className="text-sm text-slate-600 mt-1.5 whitespace-pre-line">{doc.content}</p>}
      <p className="flex items-center gap-1.5 text-xs text-slate-400 mt-2"><Clock size={12} /> {guideMinutes(doc)} min</p>

      <ol className="mt-6 space-y-6">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 sm:gap-4">
            <span className="w-7 h-7 shrink-0 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
            <div className="flex-1 min-w-0 space-y-3">
              <p className="text-[15px] leading-relaxed text-slate-800 whitespace-pre-line">{step.text}</p>
              {step.image && <GuideShot step={step} alt={`${doc.title} — step ${i + 1}`} />}
            </div>
          </li>
        ))}
      </ol>

      {youtubeId(doc.youtubeUrl) && (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-900 mt-8">
          <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${youtubeId(doc.youtubeUrl)}`} title={doc.title}
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}

      {doc.tips && doc.tips.length > 0 && (
        <div className="mt-8 rounded-2xl bg-amber-50 border border-amber-100 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Lightbulb size={16} /> Good to know</p>
          <ul className="mt-2 space-y-1.5">
            {doc.tips.map((t, i) => <li key={i} className="text-sm text-amber-900/90 leading-relaxed">• {t}</li>)}
          </ul>
        </div>
      )}

      {related && related.length > 0 && (
        <div className="mt-8">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Related</p>
          <div className="flex flex-wrap gap-2">
            {related.map(r => (
              <button key={r.doc.id} type="button" onClick={r.open} className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700">
                {r.doc.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
