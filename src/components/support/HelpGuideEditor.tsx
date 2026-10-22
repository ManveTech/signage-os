import { useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, ImagePlus, Loader2, Square, MoveUpRight, X } from 'lucide-react';
import { supportStore, HELP_CATEGORIES, GuideMark, GuideStep, SupportDoc } from '../../lib/supportStore';
import { MarksOverlay } from './HelpGuide';
import { toast } from '../Toast';

const inputCls = 'w-full h-11 px-3 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 bg-white';
const areaCls = 'w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-400 resize-none leading-relaxed bg-white';
const labelCls = 'block text-xs font-medium text-slate-600 mb-1.5';

export type GuideDraft = Pick<SupportDoc, 'title' | 'category' | 'content' | 'youtubeUrl' | 'steps' | 'tips' | 'sortOrder'>;

function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 1280, h: 800 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** The screenshot with its highlights; drag on it to draw a new one. */
function MarkCanvas({ step, kind, onAdd }: { step: GuideStep; kind: GuideMark['kind']; onAdd: (m: GuideMark) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<GuideMark | null>(null);
  const w = step.imageW || 1280, h = step.imageH || 800;

  const pct = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100)) };
  };
  const box = (a: { x: number; y: number }, b: { x: number; y: number }): GuideMark =>
    ({ kind, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 select-none">
      <img src={step.image} alt="" className="block w-full h-auto" draggable={false} />
      <MarksOverlay marks={step.marks || []} w={w} h={h} draft={draft} />
      <div
        ref={ref}
        className="absolute inset-0 cursor-crosshair touch-none"
        onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); const p = pct(e); setStart(p); setDraft(box(p, p)); }}
        onPointerMove={e => { if (start) setDraft(box(start, pct(e))); }}
        onPointerUp={e => {
          if (start) {
            const m = box(start, pct(e));
            // A click, not a drag — ignore rather than add a dot.
            if (m.w > 0.8 && m.h > 0.8) onAdd({ ...m, x: +m.x.toFixed(2), y: +m.y.toFixed(2), w: +m.w.toFixed(2), h: +m.h.toFixed(2) });
          }
          setStart(null); setDraft(null);
        }}
      />
    </div>
  );
}

function StepEditor({ step, index, count, onChange, onMove, onRemove }: {
  step: GuideStep; index: number; count: number;
  onChange: (s: GuideStep) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void;
}) {
  const [kind, setKind] = useState<GuideMark['kind']>('box');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const marks = step.marks || [];

  const pick = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.warning('Choose an image'); return; }
    setUploading(true);
    try {
      const [url, size] = await Promise.all([supportStore.uploadHelpImage(file), imageSize(file)]);
      onChange({ ...step, image: url, imageW: size.w, imageH: size.h, marks: [] });
    } catch (e: any) {
      toast.error(e.message || 'Could not upload the screenshot');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-semibold flex items-center justify-center">{index + 1}</span>
        <span className="text-sm font-semibold text-slate-800 flex-1">Step {index + 1}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move step up"><ArrowUp size={15} /></button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move step down"><ArrowDown size={15} /></button>
        <button type="button" onClick={onRemove} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete step"><Trash2 size={15} /></button>
      </div>

      <textarea rows={3} value={step.text} onChange={e => onChange({ ...step, text: e.target.value })}
        placeholder="What to do in this step. Refer to highlights on the screenshot as (1), (2)…" className={areaCls} />

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />

      {step.image ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">Drag on the screenshot to add a</span>
            <div className="flex gap-1 p-0.5 bg-slate-100 rounded-lg">
              {([['box', 'Box', <Square size={13} />], ['arrow', 'Arrow', <MoveUpRight size={13} />]] as const).map(([k, label, icon]) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={`flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium ${kind === k ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          </div>
          <MarkCanvas step={step} kind={kind} onAdd={m => onChange({ ...step, marks: [...marks, m] })} />
          <div className="flex items-center gap-1.5 flex-wrap">
            {marks.map((m, i) => (
              <span key={i} className="flex items-center gap-1 h-7 pl-1 pr-1 rounded-full border border-orange-200 bg-orange-50 text-xs text-orange-800">
                <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
                <button type="button" onClick={() => onChange({ ...step, marks: marks.map((x, j) => (j === i ? { ...x, kind: x.kind === 'box' ? 'arrow' : 'box' } : x)) })}
                  className="px-1 font-medium hover:underline" title="Switch between box and arrow">
                  {m.kind === 'arrow' ? 'Arrow' : 'Box'}
                </button>
                <button type="button" onClick={() => onChange({ ...step, marks: marks.filter((_, j) => j !== i) })} className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-orange-100" aria-label={`Remove highlight ${i + 1}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <span className="flex-1" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs font-medium text-blue-600 px-2 py-1">{uploading ? 'Uploading…' : 'Replace'}</button>
            <button type="button" onClick={() => onChange({ text: step.text })} className="text-xs font-medium text-slate-500 px-2 py-1">Remove screenshot</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="w-full h-11 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-600 flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-700">
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />} {uploading ? 'Uploading…' : 'Add a screenshot (optional)'}
        </button>
      )}
    </div>
  );
}

/** Create or edit a guide. Simple guides are just text; add steps for a step-by-step one. */
export default function HelpGuideEditor({ initial, onCancel, onSave }: {
  initial?: SupportDoc | null;
  onCancel: () => void;
  onSave: (draft: GuideDraft) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title || '');
  const [category, setCategory] = useState(initial?.category || HELP_CATEGORIES[0]);
  const [content, setContent] = useState(initial?.content || '');
  const [steps, setSteps] = useState<GuideStep[]>(initial?.steps || []);
  const [tips, setTips] = useState((initial?.tips || []).join('\n'));
  const [youtubeUrl, setYoutubeUrl] = useState(initial?.youtubeUrl || '');
  const [position, setPosition] = useState(initial?.sortOrder != null ? String(initial.sortOrder) : '');
  const [saving, setSaving] = useState(false);
  const categories = HELP_CATEGORIES.includes(category) ? HELP_CATEGORIES : [...HELP_CATEGORIES, category];

  const setStep = (i: number, s: GuideStep) => setSteps(list => list.map((x, j) => (j === i ? s : x)));
  const move = (i: number, dir: -1 | 1) => setSteps(list => {
    const next = [...list];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    return next;
  });

  const save = async () => {
    if (!title.trim()) { toast.warning('Give the guide a title'); return; }
    const cleanSteps = steps.filter(s => s.text.trim() || s.image).map(s => ({ ...s, text: s.text.trim() }));
    if (!content.trim() && cleanSteps.length === 0) { toast.warning('Add a summary or at least one step'); return; }
    setSaving(true);
    const ok = await onSave({
      title: title.trim(),
      category,
      content: content.trim(),
      steps: cleanSteps,
      tips: tips.split('\n').map(t => t.trim()).filter(Boolean),
      youtubeUrl: youtubeUrl.trim(),
      sortOrder: position.trim() === '' ? undefined : Number(position),
    });
    setSaving(false);
    if (ok) onCancel();
  };

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-2xl text-ink-950">{initial ? 'Edit guide' : 'New guide'}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="h-10 px-4 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
            {saving ? 'Saving…' : initial ? 'Save' : 'Publish'}
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-[1fr_200px_110px] gap-3">
        <div>
          <label className={labelCls}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Add a screen and connect the TV" className={inputCls} autoFocus={!initial} />
        </div>
        <div>
          <label className={labelCls}>Section</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inputCls}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Position</label>
          <input type="number" inputMode="numeric" value={position} onChange={e => setPosition(e.target.value)} placeholder="Last" className={inputCls} />
        </div>
      </div>
      <p className="-mt-2 text-xs text-slate-500">Lower positions show first within a section. Leave empty to add it at the end.</p>

      <div>
        <label className={labelCls}>{steps.length ? 'Summary' : 'Text'}</label>
        <textarea rows={steps.length ? 2 : 8} value={content} onChange={e => setContent(e.target.value)}
          placeholder={steps.length ? 'One line on what this guide helps with — shown on its card.' : 'The guide. Add steps below to make it step-by-step with screenshots.'} className={areaCls} />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-slate-600">Steps</p>
        {steps.map((s, i) => (
          <StepEditor key={i} step={s} index={i} count={steps.length}
            onChange={x => setStep(i, x)} onMove={d => move(i, d)} onRemove={() => setSteps(list => list.filter((_, j) => j !== i))} />
        ))}
        <button type="button" onClick={() => setSteps(list => [...list, { text: '' }])}
          className="w-full h-11 rounded-xl border border-dashed border-slate-300 text-sm font-medium text-slate-700 flex items-center justify-center gap-2 hover:border-blue-300 hover:text-blue-700">
          <Plus size={15} /> Add a step
        </button>
      </div>

      <div>
        <label className={labelCls}>Good to know <span className="font-normal text-slate-400">(optional — one tip per line)</span></label>
        <textarea rows={3} value={tips} onChange={e => setTips(e.target.value)} className={areaCls} />
      </div>

      <div>
        <label className={labelCls}>YouTube video <span className="font-normal text-slate-400">(optional)</span></label>
        <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtu.be/…" className={inputCls} />
      </div>
    </div>
  );
}
