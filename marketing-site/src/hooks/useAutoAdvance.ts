import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** `prefers-reduced-motion`, kept live so toggling the OS setting takes effect. */
export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
};

interface AutoAdvanceOptions {
  /** Milliseconds between advances. */
  intervalMs: number;
  /** Set false to keep the timer permanently off (e.g. only one slide). */
  enabled?: boolean;
  /**
   * How long to stay still after the visitor presses an arrow or a dot, so the
   * timer never yanks the carousel away from the slide they just chose.
   */
  resumeAfterMs?: number;
}

interface AutoAdvanceResult<T extends HTMLElement> {
  /** Attach to the element that should pause the timer while pointed at or focused. */
  ref: RefObject<T | null>;
  /** Spread onto that same element. */
  pauseProps: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    onFocusCapture: () => void;
    onBlurCapture: () => void;
    onTouchStart: () => void;
  };
  /** True when the timer is currently held — useful for a progress indicator. */
  paused: boolean;
  /** Call from manual controls to hold the timer for `resumeAfterMs`. */
  holdForInteraction: () => void;
}

/**
 * Advances a carousel on a timer without ever fighting the visitor for control.
 *
 * It stops while the pointer is over the carousel, while anything inside it has
 * focus, while the carousel is scrolled off-screen, while the browser tab is in
 * the background, briefly after any manual arrow/dot press, and entirely when
 * the visitor has asked for reduced motion.
 */
export function useAutoAdvance<T extends HTMLElement>(
  advance: () => void,
  { intervalMs, enabled = true, resumeAfterMs = 9000 }: AutoAdvanceOptions
): AutoAdvanceResult<T> {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<T | null>(null);

  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden
  );
  const [heldUntil, setHeldUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  // Keep the callback fresh without restarting the interval on every render.
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  }, [advance]);

  useEffect(() => {
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  /*
   * Whether the carousel is on screen. An IntersectionObserver is the cheap
   * path, but it cannot be the only one: where the observer is unavailable or
   * never delivers, `inView` would stay false forever and the carousel would
   * sit on its first slide with no indication anything was wrong. A rect read
   * on scroll/resize backs it up.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) {
      setInView(true);
      return;
    }

    const check = () => {
      const r = el.getBoundingClientRect();
      const visible = r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      setInView(prev => (prev === visible ? prev : visible));
    };

    let io: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
        threshold: 0.25
      });
      io.observe(el);
    }

    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    return () => {
      io?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, []);

  const holdForInteraction = useCallback(() => {
    setHeldUntil(Date.now() + resumeAfterMs);
  }, [resumeAfterMs]);

  // Re-evaluate once the manual hold is due to expire so the timer restarts.
  useEffect(() => {
    if (heldUntil <= now) return;
    const id = window.setTimeout(() => setNow(Date.now()), heldUntil - now);
    return () => window.clearTimeout(id);
  }, [heldUntil, now]);

  const held = heldUntil > now;
  const paused = hovered || focusWithin || held;
  const running = enabled && !reduced && inView && tabVisible && !paused;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => advanceRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [running, intervalMs]);

  return {
    ref,
    pauseProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocusCapture: () => setFocusWithin(true),
      onBlurCapture: () => setFocusWithin(false),
      onTouchStart: holdForInteraction
    },
    paused: !running,
    holdForInteraction
  };
}
