import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../../config';

/**
 * Small, lazily-loaded preview for a media item in a grid or list.
 *
 * Media grids used to render every item at full size: the original image
 * file (often several MB, straight from R2) and a <video> element per video
 * that started fetching as soon as the page opened. On a phone that meant
 * downloading and decoding the whole library just to show a grid of tiles.
 *
 * Images are requested through the server's resizing proxy at the size the
 * tile actually needs; videos only load once their tile scrolls into view.
 */
export function thumbnailUrl(src: string | undefined, width: number): string {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  return `${API_BASE}/public/proxy-media?url=${encodeURIComponent(src)}&w=${width}`;
}

export function isVideoMedia(type?: string, src?: string): boolean {
  if (type === 'video') return true;
  const s = (src || '').toLowerCase();
  return s.includes('.mp4') || s.includes('.webm') || s.includes('.mov') || s.includes('video/');
}

function useInView<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setInView(true);
        io.disconnect();
      }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);
  return { ref, inView };
}

export default function MediaThumb({
  src,
  type,
  alt = '',
  width = 320,
  className = 'w-full h-full object-cover',
}: {
  src?: string;
  type?: string;
  alt?: string;
  /** Pixel width to request — about 2x the tile's CSS width. */
  width?: number;
  className?: string;
}) {
  const video = isVideoMedia(type, src);
  const { ref, inView } = useInView<HTMLDivElement>();
  const [useOriginal, setUseOriginal] = useState(false);

  if (!src) return <div className={`${className} bg-gray-200`} />;

  if (video) {
    return (
      <div ref={ref} className="w-full h-full bg-slate-800">
        {inView && (
          // #t=0.1 makes browsers paint a real frame instead of a black box.
          <video src={`${src}#t=0.1`} className={className} muted playsInline preload="metadata" />
        )}
      </div>
    );
  }

  return (
    <img
      src={useOriginal ? src : thumbnailUrl(src, width)}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={className}
      // If the resizing proxy can't serve it (e.g. a host it doesn't allow),
      // fall back to the original file rather than showing a broken tile.
      onError={() => { if (!useOriginal) setUseOriginal(true); }}
    />
  );
}
