import { driver, type Driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../styles/tour.css';
import { isTourRunning, setActiveTour, stopActiveTour } from './active';

/**
 * A guided tour that can walk across routes.
 *
 * driver.js highlights elements on the page it's looking at. A tour that
 * explains what each section of the product does has to *visit* those
 * sections, which means the tour has to drive the router as well as the
 * spotlight.
 *
 * Each step may carry a `route`. Before the step is shown, if that route
 * isn't the one on screen, the tour navigates and waits for the element to
 * appear — driver's own `waitForElement` does the waiting, via a
 * MutationObserver, so there's no polling or arbitrary sleep here. A step may
 * also carry `before`, for the case where the thing to point at is inside
 * something that has to be opened first (a modal, a tab).
 *
 * Steps whose element never turns up are skipped rather than shown floating
 * in the middle of the screen — plenty of what a tour points at is
 * conditional (a fresh account has no screens yet, no playlists yet), and a
 * step that stops to say nothing about an empty space is worse than one that
 * quietly moves on.
 */

export type TourStep = Omit<DriveStep, 'element'> & {
  /*
   * Widened from driver's own `() => Element`.
   *
   * Half the steps here resolve their element at the moment they run and may
   * find nothing — that's the whole point of `firstVisible` below, and of the
   * runner skipping steps whose element is missing. driver copes with it (an
   * absent element is shown centred against a hidden dummy node), but its
   * type says the resolver always succeeds, which every conditional step
   * here contradicts.
   */
  element?: string | Element | (() => Element | undefined);
  /** Route that must be on screen before this step runs. */
  route?: string;
  /** Opens whatever the step points into — a modal, a tab — before it's shown. */
  before?: () => void | Promise<void>;
};

/**
 * Is this element actually on screen, rather than merely in the document?
 *
 * The sidebar collapses to zero width on mobile (the dock stands in for it
 * instead), so every nav anchor inside it is a 0x0 box at the top-left
 * corner. driver will happily spotlight that — a pinprick of light in the
 * corner with a popover beside it. Present isn't the same as visible.
 */
function isVisible(el: Element | null | undefined): el is Element {
  if (!el) return false;
  // A section on its way out (components/SectionTransition.tsx) is still in
  // the document for a moment, invisible, carrying the same anchors as the
  // section replacing it — and ahead of it in document order.
  if (el.closest('[data-leaving]')) return false;
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  // On phones the sidebar is an off-canvas drawer: full-size, but slid off
  // the left edge (x ≈ -272). It passed the size check, so the tour
  // spotlighted invisible sidebar items off-screen instead of falling back
  // to the dock tabs. Horizontally outside the window means not visible.
  // (Vertical position isn't checked — driver scrolls to the element.)
  if (rect.right <= 0 || rect.left >= window.innerWidth) return false;
  const style = window.getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/**
 * The first element matching `selector` that's visible — not simply the
 * first in the document, which during a section transition is the copy in
 * the section that's leaving.
 */
function queryVisible(selector: string): Element | undefined {
  for (const el of document.querySelectorAll(selector)) {
    if (isVisible(el)) return el;
  }
  return undefined;
}

/**
 * Waits for an element to stop moving.
 *
 * Sections slide in and cards lift into place (SectionTransition,
 * useScrollReveal), and driver measures its target once, when the step
 * opens. Measured mid-slide, the spotlight would sit off to one side of the
 * thing it describes and stay there. Two readings a frame or two apart that
 * agree mean it's landed; the cap keeps something that never settles from
 * holding the tour up.
 */
async function stillPosition(el: Element, capMs = 900): Promise<void> {
  const deadline = Date.now() + capMs;
  let last = el.getBoundingClientRect();
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 60));
    const now = el.getBoundingClientRect();
    const moved =
      Math.abs(now.left - last.left) > 0.5 ||
      Math.abs(now.top - last.top) > 0.5 ||
      Math.abs(now.width - last.width) > 0.5 ||
      Math.abs(now.height - last.height) > 0.5;
    if (!moved) return;
    last = now;
  }
}

/**
 * The first of these selectors that's actually on screen.
 *
 * Used for steps that describe a section of the product: on desktop that's
 * the sidebar item, and on a phone the sidebar doesn't exist, so it's the
 * dock tab that stands in for it. Resolved at the moment the step runs
 * rather than when the tour is built, since the viewport can change between
 * one step and the next.
 */
export function firstVisible(...selectors: string[]): () => Element | undefined {
  return () => {
    for (const selector of selectors) {
      const el = queryVisible(selector);
      if (el) return el;
    }
    return undefined;
  };
}

export type TourHandle = {
  /** Ends the tour early. Safe to call when it's already finished. */
  stop: () => void;
};

/** Long enough for React to have committed the new route. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

/**
 * The driver instance on screen, so code scrolling the page can redraw the
 * spotlight straight away rather than waiting on a scroll event.
 */
let liveDriver: Driver | null = null;

/** Gap between the popover and the element it describes. */
const GAP = 12;
/** Gap between the popover and the edge of the window. */
const MARGIN = 10;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function intersects(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Whatever actually scrolls when this element is scrolled into view — not
 * the window, here: the dashboards put the page inside a scrolling <main>
 * beside a fixed sidebar, so window.scrollBy does nothing.
 */
function scrollParent(el: Element): Element | null {
  let node = el.parentElement;
  while (node) {
    const overflowY = getComputedStyle(node).overflowY;
    if (/(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return null;
}

/** Scrolls `by` pixels down, wherever this element happens to live. */
function scrollDownBy(el: Element, by: number): void {
  const target = { top: by, behavior: 'instant' as ScrollBehavior };
  const parent = scrollParent(el);
  if (parent) parent.scrollBy(target);
  else window.scrollBy(target);
}

/**
 * The band of the window the page actually shows through. On mobile the
 * header floats over the top and the dock over the bottom, so "scrolled to
 * the top" can put a section under the header.
 */
function clearBand(): { top: number; bottom: number } {
  let top = 0;
  const header = document.querySelector('header');
  if (header && getComputedStyle(header).position === 'fixed') {
    top = Math.max(0, header.getBoundingClientRect().bottom);
  }
  const dockTab = queryVisible('[data-tour^="dock-"]');
  const bottom = dockTab ? dockTab.getBoundingClientRect().top : window.innerHeight;
  return { top: top + 8, bottom: bottom - 8 };
}

/** Brings a section's top into the clear band when driver hasn't. */
function bringIntoView(target: HTMLElement): boolean {
  if (!target.closest('main')) return false;
  const band = clearBand();
  const t = target.getBoundingClientRect();
  const height = band.bottom - band.top;
  const topHidden = t.top < band.top - 2;
  const cutOff = t.bottom > band.bottom + 2 && t.top > band.top + height * 0.4;
  if (!topHidden && !cutOff) return false;
  const before = t.top;
  scrollDownBy(target, t.top - band.top);
  return Math.abs(target.getBoundingClientRect().top - before) > 1;
}

/**
 * Moves the popover off the thing it's pointing at.
 *
 * driver positions the popover on the side the step asks for, falling back
 * through the other three, and gives up to bottom-centre-over-the-element
 * when none fit — which for a whole-section highlight (a grid of cards, a
 * settings panel) is most of the time. So the four sides are measured again
 * against the actual free space, and the popover goes in the roomiest; where
 * even that's too small, the element is scrolled to the top of its
 * container, then scrolled on by the shortfall, then the gaps are closed to
 * nothing as a last resort.
 */
function keepPopoverClear(pass = 0): void {
  const wrapper = document.querySelector<HTMLElement>('.driver-popover');
  const target = document.querySelector<HTMLElement>('.driver-active-element');
  const arrow = wrapper?.querySelector<HTMLElement>('.driver-popover-arrow');
  if (!wrapper || !target) return;

  const p = wrapper.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  if (!intersects(p, t)) return;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const sides = [
    { side: 'bottom', space: vh - t.bottom, need: p.height + GAP + MARGIN },
    { side: 'top', space: t.top, need: p.height + GAP + MARGIN },
    { side: 'right', space: vw - t.right, need: p.width + GAP + MARGIN },
    { side: 'left', space: t.left, need: p.width + GAP + MARGIN },
  ] as const;

  const roomiest = [...sides].sort((a, b) => b.space - b.need - (a.space - a.need))[0];
  const fits = roomiest.space >= roomiest.need;

  const band = clearBand();
  if (!fits && pass === 0 && t.top > band.top + 4) {
    const before = t.top;
    scrollDownBy(target, t.top - band.top);
    if (Math.abs(target.getBoundingClientRect().top - before) > 4) {
      liveDriver?.refresh();
      keepPopoverClear(1);
      return;
    }
  }
  if (!fits && pass <= 1 && roomiest.side === 'bottom') {
    const shortfall = Math.ceil(roomiest.need - roomiest.space);
    if (shortfall > 0 && shortfall <= t.height / 5) {
      const before = t.top;
      scrollDownBy(target, shortfall);
      if (Math.abs(target.getBoundingClientRect().top - before) > 1) {
        liveDriver?.refresh();
        keepPopoverClear(2);
        return;
      }
    }
  }

  const extent = roomiest.side === 'top' || roomiest.side === 'bottom' ? p.height : p.width;
  const tight = !fits && roomiest.space >= extent + 4;
  const gap = tight ? 2 : GAP;
  const margin = tight ? 2 : MARGIN;

  const maxLeft = Math.max(margin, vw - p.width - margin);
  const maxTop = Math.max(margin, vh - p.height - margin);
  let left: number;
  let top: number;

  if (roomiest.side === 'bottom' || roomiest.side === 'top') {
    left = clamp(t.left + t.width / 2 - p.width / 2, margin, maxLeft);
    top =
      roomiest.side === 'bottom'
        ? clamp(t.bottom + gap, margin, maxTop)
        : clamp(t.top - gap - p.height, margin, maxTop);
  } else {
    top = clamp(t.top + t.height / 2 - p.height / 2, margin, maxTop);
    left =
      roomiest.side === 'right'
        ? clamp(t.right + gap, margin, maxLeft)
        : clamp(t.left - gap - p.width, margin, maxLeft);
  }

  wrapper.style.left = `${left}px`;
  wrapper.style.top = `${top}px`;
  wrapper.style.right = 'auto';
  wrapper.style.bottom = 'auto';

  if (!arrow) return;

  arrow.className = 'driver-popover-arrow';
  arrow.style.top = '';
  arrow.style.left = '';
  arrow.style.right = '';
  arrow.style.bottom = '';
  if (!fits && !tight) {
    arrow.classList.add('driver-popover-arrow-none');
    return;
  }

  const arrowSize = 10;
  if (roomiest.side === 'bottom' || roomiest.side === 'top') {
    arrow.classList.add(`driver-popover-arrow-side-${roomiest.side}`);
    const centre = t.left + t.width / 2 - left - arrowSize;
    arrow.style.left = `${clamp(centre, 15, Math.max(15, p.width - 15 - arrowSize))}px`;
  } else {
    arrow.classList.add(`driver-popover-arrow-side-${roomiest.side}`);
    const centre = t.top + t.height / 2 - top - arrowSize;
    arrow.style.top = `${clamp(centre, 15, Math.max(15, p.height - 15 - arrowSize))}px`;
  }
}

/**
 * One tour at a time, enforced here rather than trusted to the call sites.
 * Starting one ends whatever was already running, so two triggers firing
 * close together never leave two popovers arguing on screen at once.
 */
let activeTourId = 0;
let tourSeq = 0;

export { isTourRunning, stopActiveTour };

export function runTour(opts: {
  steps: TourStep[];
  navigate: (to: string) => void;
  /** Called exactly once, whether the person finished or closed it early. */
  onFinish?: () => void;
}): TourHandle {
  const { steps, navigate, onFinish } = opts;

  stopActiveTour();

  const tourId = ++tourSeq;
  const releaseActive = () => {
    if (activeTourId === tourId) {
      activeTourId = 0;
      setActiveTour(null);
    }
  };

  // Tells the dashboards' scroll-reveal to hold still — no cards hidden to
  // be revealed on scroll (lib/useScrollReveal.ts), since the spotlight
  // needs what it points at to be there and visible immediately.
  document.documentElement.classList.add('sg-touring');
  const endTouringMode = () => {
    document.documentElement.classList.remove('sg-touring');
  };

  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    onFinish?.();
  };

  let tornDown = false;

  /**
   * One move at a time. Advancing is asynchronous (it can navigate, wait for
   * a route to mount) but the popover's buttons aren't disabled while that
   * happens — an impatient second click would start a second advance racing
   * the first. This dims the popover for as long as the move takes.
   */
  let moving = false;
  const move = async (fn: () => Promise<void>) => {
    if (moving) return;
    moving = true;
    document.querySelector('.driver-popover')?.classList.add('sg-tour-busy');
    try {
      await fn();
    } finally {
      moving = false;
      document.querySelector('.driver-popover')?.classList.remove('sg-tour-busy');
    }
  };

  const prepare = async (step: TourStep | undefined): Promise<boolean> => {
    if (!step) return false;

    // driver takes the active class off the element it believes was
    // previous, which isn't always the element that still has it — React
    // unmounts/remounts nodes as the tour changes route, and the class
    // survives on whatever it was left on.
    document.querySelectorAll('.driver-active-element').forEach((el) => {
      el.classList.remove('driver-active-element', 'driver-no-interaction');
    });

    let navigated = false;
    if (step.route && window.location.pathname !== step.route) {
      navigate(step.route);
      navigated = true;
      await settle();
    }
    if (step.before) {
      await step.before();
      await settle();
    }
    return navigated;
  };

  /**
   * How long to keep looking for a step's element before giving up on it. A
   * step on the page that's already open has had its chance (React has
   * committed); a step that just navigated is given longer, since a cold
   * route may need to mount first.
   */
  const presenceTimeout = (navigated: boolean) => (navigated ? 2500 : 500);

  const elementPresent = async (step: TourStep, timeoutMs: number): Promise<boolean> => {
    if (!step.element) return true;
    const resolve = (): Element | null | undefined => {
      if (typeof step.element === 'string') return queryVisible(step.element);
      if (typeof step.element === 'function') return step.element();
      return step.element;
    };
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const el = resolve();
      if (isVisible(el)) {
        await stillPosition(el);
        return true;
      }
      if (tornDown) return false;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  };

  /**
   * Waits for the popover to actually be showing the step it was moved to,
   * rather than the one it just left — driver rewrites the card's contents
   * at the end of its transition, not the start.
   */
  const popoverShows = async (index: number): Promise<void> => {
    const want = `${index + 1} of ${steps.length}`;
    const deadline = Date.now() + 1200;
    while (Date.now() < deadline) {
      if (tornDown) return;
      const shown = document.querySelector('.driver-popover-progress-text')?.textContent?.trim();
      if (shown === want) return;
      await new Promise((r) => setTimeout(r, 16));
    }
  };

  /**
   * Moves to the next step that actually exists, in the given direction —
   * this is what makes the Back button work symmetrically with Next, and
   * what skips conditional steps whose element never turns up.
   */
  const advance = async (d: Driver, from: number, dir: 1 | -1): Promise<void> => {
    let i = from;
    while (i >= 0 && i < steps.length) {
      if (tornDown) return;
      const step = steps[i];
      const navigated = await prepare(step);
      if (tornDown) return;
      if (await elementPresent(step, presenceTimeout(navigated))) {
        d.moveTo(i);
        await popoverShows(i);
        return;
      }
      i += dir;
    }
    if (!tornDown) d.destroy();
  };

  // driver resolves a string selector with querySelector, which during a
  // section transition finds the leaving copy. Every selector goes through
  // queryVisible instead.
  const driverSteps = steps.map((step) =>
    typeof step.element === 'string'
      ? { ...step, element: ((sel: string) => () => queryVisible(sel))(step.element) }
      : step
  );

  const instance = driver({
    steps: driverSteps as DriveStep[],
    animate: true,
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    popoverClass: 'sg-tour',
    stagePadding: 6,
    stageRadius: 10,
    overlayColor: '#0B0D14',
    overlayOpacity: 0.6,
    // Off: driver's own smooth scroll would still be under way when
    // onHighlighted brings the section into the clear band, and would carry
    // on past it. SectionTransition/useScrollReveal already give each move
    // its own motion.
    smoothScroll: false,
    waitForElement: 5000,
    // Off, deliberately — driver decides whether to skip a step by looking
    // for its element the moment Next is pressed, which for a step on
    // another route is before the navigation that would create it. Skipping
    // is decided in `advance` above instead, after the route is on screen.
    disableActiveInteraction: true,
    overlayClickBehavior: () => {},
    allowClose: true,

    onNextClick: async (_el, _step, { driver: d }) => {
      await move(() => advance(d, (d.getActiveIndex() ?? 0) + 1, 1));
    },
    onPrevClick: async (_el, _step, { driver: d }) => {
      await move(() => advance(d, (d.getActiveIndex() ?? 0) - 1, -1));
    },
    onHighlighted: (el, _step, { driver: d }) => {
      if (el instanceof HTMLElement && bringIntoView(el)) d.refresh();
      keepPopoverClear();
    },
    onDestroyed: () => {
      if (liveDriver === instance) liveDriver = null;
      endTouringMode();
      releaseListeners();
      releaseActive();
      if (!tornDown) finishOnce();
    },
  });

  liveDriver = instance;
  let repositionPending = false;
  const reposition = () => {
    if (repositionPending) return;
    repositionPending = true;
    setTimeout(() => {
      repositionPending = false;
      if (!instance.isActive()) return;
      instance.refresh();
      keepPopoverClear();
    }, 0);
  };
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  // Leaving the page another way (browser Back, search) closes the tour —
  // otherwise its card stayed up, pointing at whatever was now in that spot.
  const onRouteChange = () => {
    if (!moving && instance.isActive()) instance.destroy();
  };
  window.addEventListener('hashchange', onRouteChange);
  const releaseListeners = () => {
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('hashchange', onRouteChange);
  };

  void move(async () => {
    // Not drive() followed by advance(): driving first would paint step one
    // against whatever page is currently on screen, then jump. Find the
    // first usable step, put its route on screen, and only then open.
    let i = 0;
    while (i < steps.length) {
      if (tornDown) return;
      const navigated = await prepare(steps[i]);
      if (tornDown) return;
      if (await elementPresent(steps[i], presenceTimeout(navigated))) break;
      i += 1;
    }
    if (tornDown || i >= steps.length) return;
    instance.drive(i);
  });

  const handle: TourHandle = {
    stop: () => {
      tornDown = true;
      if (instance.isActive()) instance.destroy();
      endTouringMode();
      releaseListeners();
      releaseActive();
    },
  };

  activeTourId = tourId;
  setActiveTour(handle.stop);
  return handle;
}
