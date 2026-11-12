import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The small motion primitives the Business Overview is built on: charts that
 * draw themselves in as you reach them, and figures that count up to their
 * value rather than appearing at it.
 *
 * All three obey prefers-reduced-motion. That setting is not a preference
 * about taste — people set it because movement makes them ill — so when it is
 * on, every hook here skips straight to the final state. Nothing animates, and
 * nothing is lost: the end state is identical either way.
 */

/** True when the viewer has asked their system for less animation. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * Tells you once an element has been scrolled into view, and stays true after.
 *
 * One-way on purpose: a card that re-animated every time it passed the fold
 * would be restless to scroll through, and would replay the count-ups on the
 * way back up.
 */
export function useInView<T extends HTMLElement>(rootMargin = '-40px'): [(node: T | null) => void, boolean] {
  const [seen, setSeen] = useState(false);
  const observer = useRef<IntersectionObserver | null>(null);

  // A callback ref, not useRef + useEffect: these cards render only once the
  // data has loaded, so an effect keyed on mount would run while the element
  // did not exist yet, find nothing to observe, and never look again. This
  // starts observing at the moment the node actually attaches.
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (seen || !node) return;

    // No observer support: show everything rather than leaving the page
    // stuck at its start state.
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }

    observer.current = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        setSeen(true);
        observer.current?.disconnect();
        observer.current = null;
      }
    }, { rootMargin });
    observer.current.observe(node);
  }, [seen, rootMargin]);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, seen];
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from zero to `target` once `run` is true, easing out so it decelerates
 * into the final figure instead of stopping dead.
 *
 * Returns the number, not a string — the caller formats each frame, so a value
 * that renders as "69K hrs" or "2.5 GB" counts up in its own units.
 */
export function useCountUp(target: number, run: boolean, durationMs = 900): number {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(run && !reduced ? 0 : target);
  const frame = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!run || reduced || !Number.isFinite(target)) { setValue(target); return; }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      setValue(target * easeOutCubic(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);

    return () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); };
  }, [target, run, reduced, durationMs]);

  return value;
}
