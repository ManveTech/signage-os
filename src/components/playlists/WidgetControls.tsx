import { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { CORNERS, cornerLabel, qrCornerWithClock, clockParts, type Corner } from '../../lib/playlistWidgets';
import { qrDataUrl } from '../../lib/qr';

/** Pick a corner on a small screen drawing. */
export function CornerPicker({ value, onChange, label, note }: { value: Corner; onChange: (c: Corner) => void; label: string; note?: string }) {
  return (
    <div>
      <label className="block text-[10px] text-slate-400 uppercase tracking-widest font-bold mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative w-28 h-16 shrink-0 rounded-lg bg-slate-800 border-2 border-slate-700" role="radiogroup" aria-label={label}>
          {CORNERS.map(c => {
            const [v, h] = c.value.split('-');
            const selected = value === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={c.label}
                title={c.label}
                onClick={() => onChange(c.value)}
                className={`absolute ${v === 'top' ? 'top-1' : 'bottom-1'} ${h === 'left' ? 'left-1' : 'right-1'} w-8 h-5 rounded cursor-pointer transition-colors ${selected ? 'bg-blue-500' : 'bg-slate-600 hover:bg-slate-500'}`}
              />
            );
          })}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{cornerLabel(value)}</div>
          {note && <div className="text-[11px] text-slate-500 leading-snug mt-0.5">{note}</div>}
        </div>
      </div>
    </div>
  );
}

function LiveClockParts() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const { time, date } = clockParts(now);
  const [hm, ampm] = time.split(' ');
  return (
    <>
      <div className="text-[15px] font-semibold leading-tight tracking-tight tabular-nums">
        {hm}<span className="text-[9px] font-medium text-white/70 ml-0.5">{ampm}</span>
      </div>
      <div className="text-[8px] text-white/70 leading-tight">{date}</div>
    </>
  );
}

const POS: Record<Corner, string> = {
  'top-left': 'top-3 left-3 items-start text-left',
  'top-right': 'top-3 right-3 items-end text-right',
  'bottom-left': 'left-3 items-start text-left',
  'bottom-right': 'right-3 items-end text-right',
};

/** The clock and QR code over the playlist preview, where the TV will show them. */
export function WidgetPreviewOverlay({ clock, qr, corner, clockLabel, qrLink, tickerOn }: {
  clock: boolean; qr: boolean; corner: Corner; clockLabel: string; qrLink: string; tickerOn: boolean;
}) {
  const clockCorner = corner;
  const qrCorner = clock ? qrCornerWithClock(corner) : corner;
  const bottom = tickerOn ? 'bottom-11' : 'bottom-3';
  const at = (c: Corner) => `absolute z-10 flex flex-col ${POS[c]} ${c.startsWith('bottom') ? bottom : ''}`;
  return (
    <>
      {clock && (
        <div className={at(clockCorner)}>
          <div className="rounded-lg bg-black/45 backdrop-blur-sm text-white px-2.5 py-1.5 flex flex-col">
            {clockLabel.trim() && <div className="text-[7px] font-semibold uppercase tracking-widest text-white/70">{clockLabel}</div>}
            <LiveClockParts />
          </div>
        </div>
      )}
      {qr && (
        <div className={at(qrCorner)}>
          {qrLink.trim() ? (
            <div className="rounded-xl bg-white p-1.5 shadow-md w-12 h-12 flex items-center justify-center">
              <img src={qrDataUrl(qrLink)} alt="QR code" className="w-full h-full object-contain rounded-[3px]" />
            </div>
          ) : (
            // The TV shows nothing until a link is added.
            <div className="rounded-xl border-2 border-dashed border-white/70 bg-black/30 text-white w-12 h-12 flex flex-col items-center justify-center text-center">
              <QrCode size={18} />
              <span className="text-[7px] font-semibold leading-tight mt-0.5">Add a link</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}
