import { useEffect, useRef, useState } from 'react';
import { Film, ImageOff } from 'lucide-react';
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
 * tile actually needs. Videos show a poster frame the server extracts once
 * and caches; only if that fails does the tile load the video itself (and
 * only once it scrolls into view). Anything that still can't load shows a
 * neutral placeholder rather than the browser's broken-media icon.
 */
export function thumbnailUrl(src: string | undefined, width: number): string {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  if (!/^https?:\/\//i.test(src)) return src;
  return `${API_BASE}/public/proxy-media?url=${encodeURIComponent(src)}&w=${width}`;
}

/** A still frame for a video, generated (and cached) by the server. */
export function posterUrl(src: string, width: number): string {
  if (!/^https?:\/\//i.test(src)) return '';
  return `${API_BASE}/public/video-poster?url=${encodeURIComponent(src)}&w=${width}`;
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

type Stage = 'thumb' | 'original' | 'video' | 'failed';

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
  // Local (data:/blob:) videos have no server copy to take a poster from.
  const local = !!src && !/^https?:\/\//i.test(src);
  const { ref, inView } = useInView<HTMLDivElement>();
  // Images: resized thumbnail → original file → placeholder.
  // Videos: server poster frame → the video itself → placeholder.
  const initial: Stage = video && local ? 'video' : 'thumb';
  const [stage, setStage] = useState<Stage>(initial);
  const [loaded, setLoaded] = useState(false);

  // Tiles get reused when lists re-sort or filter; start over for a new
  // file. This resets during render rather than in an effect: an effect runs
  // after mount, by which time a cached image has often already fired onLoad,
  // and resetting then left the tile invisible.
  const [shownSrc, setShownSrc] = useState(src);
  if (src !== shownSrc) {
    setShownSrc(src);
    setStage(initial);
    setLoaded(false);
  }

  if (!src) return <div className={`${className} bg-slate-200`} />;

  const fail = () => {
    setLoaded(false);
    setStage(s => (s === 'thumb' ? (video ? 'video' : 'original') : 'failed'));
  };

  let content: React.ReactNode = null;
  if (stage === 'failed') {
    content = (
      <div className="absolute inset-0 flex items-center justify-center text-slate-400">
        {video ? <Film size={20} /> : <ImageOff size={20} />}
      </div>
    );
  } else if (stage === 'video') {
    content = inView ? (
      // #t=0.1 makes browsers paint a real frame instead of a black box.
      <video
        key={src}
        src={`${src}#t=0.1`}
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        muted
        playsInline
        preload="metadata"
        onLoadedData={() => setLoaded(true)}
        onError={fail}
      />
    ) : null;
  } else {
    const url = stage === 'original' ? src : video ? posterUrl(src, width) : thumbnailUrl(src, width);
    content = (
      <img
        key={url}
        src={url}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={fail}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`relative w-full h-full overflow-hidden ${video ? 'bg-slate-800' : 'bg-slate-100'} ${!loaded && stage !== 'failed' ? 'animate-pulse' : ''}`}
    >
      {content}
    </div>
  );
}

/**
 * Full-size slide preview (playlist preview player). Images come through the
 * resizing proxy at screen-preview size instead of the multi-MB original;
 * videos play with a poster shown while they buffer, and anything that
 * can't load shows a placeholder instead of a broken-media icon.
 */
export function PreviewMedia({ src, type, alt = '' }: { src?: string; type?: string; alt?: string }) {
  const video = isVideoMedia(type, src);
  const [stage, setStage] = useState<Stage>('thumb');
  const [shownSrc, setShownSrc] = useState(src);
  if (src !== shownSrc) {
    setShownSrc(src);
    setStage('thumb');
  }

  if (!src || stage === 'failed') {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
        {video ? <Film size={24} /> : <ImageOff size={24} />}
      </div>
    );
  }

  if (video) {
    return (
      <video
        key={src}
        src={src}
        poster={posterUrl(src, 960) || undefined}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover bg-slate-800"
        onError={() => setStage('failed')}
      />
    );
  }

  return (
    <img
      key={stage}
      src={stage === 'original' ? src : thumbnailUrl(src, 1280)}
      alt={alt}
      decoding="async"
      className="w-full h-full object-cover"
      onError={() => setStage(s => (s === 'thumb' ? 'original' : 'failed'))}
    />
  );
}
