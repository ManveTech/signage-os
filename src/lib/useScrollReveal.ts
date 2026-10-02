import { RefObject, useEffect } from 'react';

/**
 * Sections and cards arrive as they are scrolled to, instead of popping in
 * fully formed the instant a view switches.
 *
 * Applied once per dashboard page (from SectionTransition.tsx) rather than in
 * every individual view, so it works out what to animate from the page's
 * shape:
 *
 *   - every card in a grid (`.grid > *`) — how these dashboards lay out
 *     stats, screens, media, and plans;
 *   - the page's own top-level sections (`> * > *`) that do not contain a
 *     grid — a header, a chart, a table. A section that does contain a grid
 *     is left still, so its cards are what move rather than the whole block
 *     and then the cards again;
 *   - anything marked [data-reveal].
 *
 * Content that arrives later (a list after its fetch resolves) is picked up
 * by a MutationObserver and treated the same way, so it doesn't pop in fully
 * formed after the page around it has already animated.
 *
 * Each element animates once. Uses element.animate() with fill 'backwards'
 * rather than a CSS class transition, so nothing is left on the element once
 * it settles — a leftover transform would make that element the containing
 * block for any position: fixed descendant inside it (a dropdown, a modal),
 * positioning it against the card instead of the viewport.
 */
const CANDIDATES = ':scope > * > *, :scope .grid > *, :scope [data-reveal]';
const STAGGER_MS = 55;
const MAX_STEPS = 7;
const SETTLED_MS = 700;

export function useScrollReveal(
  containerRef: RefObject<HTMLElement>,
  rootRef: RefObject<HTMLElement>,
  key: string
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === 'undefined') return;
    // A guided tour (lib/tour/runner.ts) scrolls sections into view and
    // spotlights them immediately — it needs them visible now, not hidden to
    // be revealed later when scrolled to.
    if (document.documentElement.classList.contains('sg-touring')) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    // Not on phones/touch screens: content hidden until scrolled to, then
    // faded in, reads as the app lagging behind your finger — and the
    // page-wide MutationObserver/IntersectionObserver work it needs is
    // exactly the cost a phone WebView can least afford mid-scroll.
    if (window.matchMedia?.('(pointer: coarse), (max-width: 767px)').matches) return;

    const seen = new WeakSet<Element>();
    const startedAt = new WeakMap<Element, number>();
    const shown = new Set<string>();
    let queue: HTMLElement[] = [];
    let flushFrame = 0;
    let collectFrame = 0;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(entry.target);
          queue.push(entry.target as HTMLElement);
        }
        if (queue.length && !flushFrame) flushFrame = requestAnimationFrame(flush);
      },
      // Slightly inside the bottom edge, so a card has started to show before
      // it moves rather than animating while still under the mobile dock.
      { root: rootRef.current, rootMargin: '0px 0px -6% 0px', threshold: 0.06 }
    );

    function flush() {
      flushFrame = 0;
      const batch = queue.sort((a, b) =>
        a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
      );
      queue = [];
      batch.forEach((el, i) => {
        startedAt.set(el, performance.now() + Math.min(i, MAX_STEPS) * STAGGER_MS);
        shown.add(signature(el));
        el.animate(
          [
            { opacity: 0, transform: 'translateY(22px) scale(0.98)' },
            { opacity: 1, transform: 'none' }
          ],
          {
            duration: 560,
            delay: Math.min(i, MAX_STEPS) * STAGGER_MS,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'backwards'
          }
        );
        el.classList.remove('sg-reveal-pending');
      });
    }

    function signature(el: HTMLElement): string {
      return `${el.tagName}|${el.className}|${(el.textContent || '').slice(0, 120)}`;
    }

    function insideMoving(el: HTMLElement): boolean {
      const now = performance.now();
      for (let p = el.parentElement; p && p !== container; p = p.parentElement) {
        if (p.classList.contains('sg-reveal-pending')) return true;
        const at = startedAt.get(p);
        if (at !== undefined && now - at < SETTLED_MS) return true;
      }
      return false;
    }

    function insideFixedLayer(el: HTMLElement): boolean {
      for (let p: HTMLElement | null = el; p && p !== container; p = p.parentElement) {
        const position = getComputedStyle(p).position;
        if (position === 'fixed' || position === 'sticky') return true;
      }
      return false;
    }

    function isCandidate(el: HTMLElement): boolean {
      if (seen.has(el) || el.closest('[data-no-reveal]')) return false;
      if (el.parentElement?.parentElement === container && (el.matches('.grid') || el.querySelector('.grid'))) {
        return false;
      }
      // Modals/toasts rendered inside a page already have their own entrance,
      // and so does everything in them — the observer watches the page's own
      // scroll box, which a fixed layer isn't part of, so its contents would
      // otherwise be hidden and never reported as scrolled into view.
      if (insideFixedLayer(el)) return false;
      return el.offsetWidth > 0 || el.offsetHeight > 0;
    }

    function collect() {
      collectFrame = 0;
      container!.querySelectorAll<HTMLElement>(CANDIDATES).forEach((el) => {
        if (!isCandidate(el)) return;
        seen.add(el);
        if (insideMoving(el) || shown.has(signature(el))) return;
        el.classList.add('sg-reveal-pending');
        io.observe(el);
      });
    }

    collect();
    const mo = new MutationObserver(() => {
      if (!collectFrame) collectFrame = requestAnimationFrame(collect);
    });
    mo.observe(container, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      cancelAnimationFrame(flushFrame);
      cancelAnimationFrame(collectFrame);
      container.querySelectorAll('.sg-reveal-pending').forEach((el) => el.classList.remove('sg-reveal-pending'));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
