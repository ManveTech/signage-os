import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import ScreenDetailsSheet from '../screens/ScreenDetailsSheet';

const VIEW = 280;   // on-screen crop area (px)
const OUTPUT = 512; // exported avatar size (px)

/**
 * Crop a picked photo to a square avatar: drag to position, slider or pinch
 * to zoom, previewed in a circle. Exports a 512×512 JPEG so phone photos
 * (often 4–8 MB) upload as ~50 KB instead.
 */
export default function AvatarCropper({ file, onCancel, onSave, saving }: {
  file: File;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving?: boolean;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { setImg(image); setZoom(1); setPos({ x: 0, y: 0 }); };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Scale at zoom 1: the image just covers the crop area.
  const baseScale = img ? Math.max(VIEW / img.width, VIEW / img.height) : 1;
  const scale = baseScale * zoom;
  const w = img ? img.width * scale : 0;
  const h = img ? img.height * scale : 0;

  // Keep the image covering the circle — no empty edges.
  const clamp = (p: { x: number; y: number }, s = scale) => {
    if (!img) return p;
    const maxX = Math.max(0, (img.width * s - VIEW) / 2);
    const maxY = Math.max(0, (img.height * s - VIEW) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, p.x)), y: Math.min(maxY, Math.max(-maxY, p.y)) };
  };

  const setZoomClamped = (z: number) => {
    const next = Math.min(4, Math.max(1, z));
    setZoom(next);
    setPos(p => clamp(p, baseScale * next));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || pinch.current) return;
    setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y }));
  };
  const onPointerUp = () => { drag.current = null; };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2) return;
    const [a, b] = [e.touches[0], e.touches[1]];
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (!pinch.current) pinch.current = { dist, zoom };
    else setZoomClamped(pinch.current.zoom * (dist / pinch.current.dist));
  };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Map the visible crop square back to source-image pixels.
    const srcSize = VIEW / scale;
    const sx = img.width / 2 - (VIEW / 2 + pos.x) / scale;
    const sy = img.height / 2 - (VIEW / 2 + pos.y) / scale;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(blob => blob && onSave(blob), 'image/jpeg', 0.88);
  };

  return (
    <ScreenDetailsSheet
      open
      onClose={onCancel}
      title="Position your photo"
      subtitle="Drag to move · pinch or use the slider to zoom"
      details={[]}
      groups={[]}
      hero={
        <div className="flex flex-col items-center gap-4">
          <div
            className="relative rounded-2xl overflow-hidden bg-slate-900 touch-none select-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onTouchMove={onTouchMove}
            onTouchEnd={() => { pinch.current = null; }}
            onWheel={e => setZoomClamped(zoom - e.deltaY * 0.002)}
          >
            {img ? (
              <img
                src={img.src}
                alt=""
                draggable={false}
                className="absolute max-w-none pointer-events-none"
                style={{ width: w, height: h, left: (VIEW - w) / 2 + pos.x, top: (VIEW - h) / 2 + pos.y }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">Loading…</div>
            )}
            {/* Circle guide: darkens everything outside the avatar */}
            <div className="absolute inset-0 pointer-events-none rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(15,23,42,0.55)' }} />
            <div className="absolute inset-0 pointer-events-none rounded-full ring-2 ring-white/80" />
          </div>
          <div className="flex items-center gap-3 w-full max-w-[280px]">
            <button type="button" onClick={() => setZoomClamped(zoom - 0.25)} className="text-slate-500" aria-label="Zoom out"><ZoomOut size={18} /></button>
            <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={e => setZoomClamped(Number(e.target.value))} className="flex-1 accent-blue-600" aria-label="Zoom" />
            <button type="button" onClick={() => setZoomClamped(zoom + 0.25)} className="text-slate-500" aria-label="Zoom in"><ZoomIn size={18} /></button>
          </div>
        </div>
      }
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 h-11 rounded-xl border border-slate-200 text-sm font-medium text-slate-700">Cancel</button>
          <button type="button" onClick={save} disabled={!img || saving} className="flex-[2] h-11 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold">
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      }
    />
  );
}
