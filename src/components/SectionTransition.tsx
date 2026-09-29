import { ReactNode, RefObject, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { useScrollReveal } from '../lib/useScrollReveal';

/**
 * How a dashboard section arrives and leaves when the sidebar/dock switches
 * `viewKey` — replaces the instant jump-cut `renderView()` produced before.
 *
 * Unlike a router-driven page, `children` here is just whatever the parent's
 * `renderView(activeView, ...)` call currently returns — recomputed on every
 * parent render, already reflecting the *new* view by the time this
 * component's props update. Left alone, the outgoing element would flash the
 * new view's content while still mid exit-animation. `Frozen` below snapshots
 * children the instant this stops being the current view and keeps showing
 * that snapshot for the rest of its exit, ignoring whatever the parent sends
 * after.
 *
 * Sections/cards inside each view reveal on scroll via useScrollReveal,
 * wired to the same content ref and scroll container.
 */
export default function SectionTransition({
  viewKey,
  children,
  className,
  scrollRoot
}: {
  viewKey: string;
  children: ReactNode;
  className?: string;
  /** The scrolling element the section lives in; returned to the top on each change. */
  scrollRoot: RefObject<HTMLElement>;
}) {
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const root = scrollRoot.current;
    if (root) root.scrollTop = 0;
  }, [viewKey, scrollRoot]);

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <Section key={viewKey} className={className} reduce={!!reduce} scrollRoot={scrollRoot} viewKey={viewKey}>
        {children}
      </Section>
    </AnimatePresence>
  );
}

function Section({
  children,
  className,
  reduce,
  scrollRoot,
  viewKey
}: {
  children: ReactNode;
  className?: string;
  reduce: boolean;
  scrollRoot: RefObject<HTMLElement>;
  viewKey: string;
}) {
  const isPresent = useIsPresent();
  const ref = useRef<HTMLDivElement | null>(null);
  useScrollReveal(ref, scrollRoot, viewKey);

  return (
    <motion.div
      ref={ref}
      className={className}
      // Read by lib/tour/runner.ts's isVisible() — a section mid-exit is
      // still in the document for a moment, invisible, carrying the same
      // data-tour anchors as the section replacing it, and ahead of it in
      // document order, so a plain querySelector would find the stale copy.
      data-leaving={isPresent ? undefined : ''}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={
        reduce
          ? { opacity: 0, transition: { duration: 0.08 } }
          : { opacity: 0, y: -6, pointerEvents: 'none', transition: { duration: 0.14, ease: 'easeIn' } }
      }
      transition={
        reduce
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 360, damping: 32, mass: 0.8, opacity: { duration: 0.22 } }
      }
    >
      <Frozen isPresent={isPresent}>{children}</Frozen>
    </motion.div>
  );
}

/**
 * Renders children as normal while this section is current, and keeps the
 * last rendered content once it starts leaving — see the note above on why
 * that matters here.
 */
function Frozen({ isPresent, children }: { isPresent: boolean; children: ReactNode }) {
  const held = useRef(children);
  if (isPresent) held.current = children;
  return <>{held.current}</>;
}
