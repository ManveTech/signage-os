import React, { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  /** Stagger a group of siblings by passing 0, 1, 2 … */
  delayStep?: number;
  /** Render as something other than a div when the wrapper sits inside a grid. */
  as?: 'div' | 'section' | 'li';
}

/**
 * Fades a block up as it scrolls into view, once.
 *
 * Deliberately CSS-driven rather than motion/react: these wrappers sit around
 * whole sections, and keeping them off the animation runtime means no layout
 * thrash on a long page. The element is unobserved after its first reveal so
 * nothing re-animates on the way back up.
 *
 * The important part is the belt-and-braces triggering. An IntersectionObserver
 * on its own is not enough: during a fast flick-scroll an element can enter and
 * leave the viewport between two observer ticks and never be reported, which
 * leaves a permanently invisible section behind. So the observer is backed by a
 * rAF-throttled scroll check, and anything already scrolled past is revealed
 * outright. Both are torn down the moment the element shows.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  className = '',
  delayStep = 0,
  as: Tag = 'div'
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // No element to watch: show it rather than hide it forever.
    if (!el) {
      setShown(true);
      return;
    }

    let io: IntersectionObserver | undefined;
    let done = false;

    const cleanup = () => {
      io?.disconnect();
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };

    const reveal = () => {
      if (done) return;
      done = true;
      setShown(true);
      cleanup();
    };

    /*
     * One rect read, called straight from the scroll handler rather than
     * deferred into requestAnimationFrame: rAF is suspended while the document
     * is hidden, and a deferred check would then never run, leaving the section
     * invisible. The listener detaches on the first reveal, so the cost falls to
     * zero as the page is read.
     */
    function check() {
      const r = el!.getBoundingClientRect();
      // In view (with a little lead-in), or already scrolled past entirely.
      if (r.bottom <= 0 || r.top < window.innerHeight * 0.92) reveal();
    }

    if (typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(
        (entries) => {
          if (entries.some(e => e.isIntersecting || e.boundingClientRect.top < 0)) {
            reveal();
          }
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
      );
      io.observe(el);
    }

    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();

    return cleanup;
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`reveal ${shown ? 'is-visible' : ''} ${className}`}
      style={delayStep ? { transitionDelay: `${Math.min(delayStep, 6) * 90}ms` } : undefined}
    >
      {children}
    </Tag>
  );
};
