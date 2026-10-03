import { ReactNode, useEffect, useRef, useState } from 'react';
import { X, ChevronRight } from 'lucide-react';

export type SheetDetail = {
  label: string;
  value: ReactNode;
};

export type SheetAction = {
  key: string;
  label: string;
  description?: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
};

export type SheetActionGroup = {
  title: string;
  actions: SheetAction[];
};

/**
 * Details + actions for one screen. A bottom sheet on phones (slides up,
 * drag the handle down or tap outside to close) and a centred panel on
 * larger screens. Replaces the row of seven unlabeled icon buttons that
 * every screen card used to carry.
 *
 * Choosing an action closes the sheet first, then runs it — the actions open
 * the pages' existing dialogs, which sit below this sheet's z-index.
 */
export default function ScreenDetailsSheet({
  open,
  onClose,
  title,
  subtitle,
  badge,
  hero,
  details,
  groups,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  badge?: ReactNode;
  hero?: ReactNode;
  details: SheetDetail[];
  groups: SheetActionGroup[];
  /** Pinned below the scrolling content (e.g. a Save button). */
  footer?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStart = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setDragY(0);
    const frame = requestAnimationFrame(() => setVisible(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const run = (action: SheetAction) => {
    if (action.disabled) return;
    onClose();
    // Let the sheet unmount before the next dialog opens.
    setTimeout(action.onClick, 0);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className={`absolute inset-0 bg-slate-950/50 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div
        className={`relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] flex flex-col transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-4 sm:scale-95'
        }`}
        style={dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
      >
        {/* Drag handle (phones) */}
        <div
          className="sm:hidden pt-2.5 pb-1 flex justify-center touch-none"
          onTouchStart={e => { dragStart.current = e.touches[0].clientY; }}
          onTouchMove={e => {
            if (dragStart.current === null) return;
            setDragY(Math.max(0, e.touches[0].clientY - dragStart.current));
          }}
          onTouchEnd={() => {
            if (dragY > 90) onClose();
            else setDragY(0);
            dragStart.current = null;
          }}
        >
          <span className="w-10 h-1.5 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-2 sm:pt-5 pb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900 truncate">{title}</h2>
              {badge}
            </div>
            {subtitle && <div className="text-sm text-slate-500 mt-0.5">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`overflow-y-auto overscroll-contain px-5 ${footer ? 'pb-3' : 'pb-[calc(1.25rem+env(safe-area-inset-bottom))]'}`}>
          {hero && <div className="mb-4">{hero}</div>}

          {details.length > 0 && <dl className="rounded-2xl border border-slate-100 divide-y divide-slate-100 mb-5">
            {details.map(d => (
              <div key={d.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <dt className="text-xs text-slate-500 shrink-0">{d.label}</dt>
                <dd className="text-sm font-medium text-slate-800 text-right min-w-0 truncate">{d.value}</dd>
              </div>
            ))}
          </dl>}

          {groups.filter(g => g.actions.length > 0).map(group => (
            <div key={group.title} className="mb-4 last:mb-0">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5 px-1">{group.title}</p>
              <div className="rounded-2xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                {group.actions.map(action => (
                  <button
                    key={action.key}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => run(action)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      action.tone === 'danger' ? 'hover:bg-rose-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      action.tone === 'danger' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {action.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-sm font-medium ${action.tone === 'danger' ? 'text-rose-600' : 'text-slate-900'}`}>{action.label}</span>
                      {(action.disabled ? action.disabledReason : action.description) && (
                        <span className="block text-xs text-slate-500 mt-0.5">{action.disabled ? action.disabledReason : action.description}</span>
                      )}
                    </span>
                    {!action.disabled && <ChevronRight size={16} className="text-slate-300 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {footer && (
          <div className="px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-slate-100">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
