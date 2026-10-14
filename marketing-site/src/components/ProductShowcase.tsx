import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  LayoutGrid,
  Wrench,
  ShieldCheck,
  Factory,
  Ruler,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Check
} from 'lucide-react';
import {
  BLUESTAR_PRODUCTS,
  FINISH_OPTIONS,
  BluestarProduct
} from '../data/bluestarProducts';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { Reveal } from './Reveal';
import type { QuoteContext } from '../data/enquiry';

/** How long each product stays on screen before the carousel moves itself on. */
const AUTOPLAY_MS = 6500;

interface ProductShowcaseProps {
  /**
   * Opens WhatsApp carrying the configuration on the card — product, panel size
   * and finish — so the visitor never retypes what they just picked.
   */
  onRequestQuote: (ctx: QuoteContext) => void;
}

/**
 * One slide of the carousel. Each card owns its own size/finish choice so that
 * swiping between products never carries a selection across to a product that
 * does not offer it.
 */
const ProductCard: React.FC<{
  product: BluestarProduct;
  onRequestQuote: (ctx: QuoteContext) => void;
}> = React.memo(({ product, onRequestQuote }) => {
  const [selectedSize, setSelectedSize] = useState(product.displaySizes[0]);
  const [selectedFinish, setSelectedFinish] = useState(FINISH_OPTIONS[0]);
  const [sent, setSent] = useState(false);

  const handleQuote = () => {
    onRequestQuote({
      product: product.name,
      size: selectedSize,
      finish: selectedFinish,
      from: 'product range'
    });
    setSent(true);
    setTimeout(() => setSent(false), 1600);
  };

  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-[28px] sm:rounded-[36px] shadow-xl border border-white p-4 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8 lg:gap-10 items-center h-full">

      {/* LEFT: Product Render */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center relative min-h-[230px] sm:min-h-[380px] bg-gradient-to-b from-[#e3f0fd] to-[#c1defa] rounded-2xl sm:rounded-3xl p-4 sm:p-8 overflow-hidden">

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,white_0%,transparent_70%)] opacity-60" />

        <div className="absolute top-4 left-4 z-20">
          <span className="bg-[#0b2545] text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow">
            {product.category}
          </span>
        </div>

        <div className="relative z-10 w-full max-w-[150px] sm:max-w-[280px] aspect-[3/4]">
          <img
            src={product.image}
            alt={`${product.name} — ${product.category.toLowerCase()} in a ${product.material.toLowerCase()} body, manufactured by Bluestar Digitech`}
            className="w-full h-full object-contain drop-shadow-xl"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>

        {/* The material/sizes strip that floated over the render is gone — the
            size buttons below offer the same list as a choice rather than as a
            caption, and the material is already in the spec row. */}

      </div>

      {/* RIGHT: Specification & Enquiry */}
      <div className="lg:col-span-7 flex flex-col justify-between">

        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0b2545]">
            <ShieldCheck className="w-4 h-4 text-[#0284c7]" />
            <span>ISO 9001:2015 · CE · ROHS</span>
          </div>
        </div>

        <h3 className="text-2xl sm:text-3xl font-black text-[#0b2545] tracking-tight">
          {product.name}
        </h3>
        <p className="text-xs sm:text-sm font-medium text-[#18487d] mt-1">
          {product.tagline}
        </p>

        {/* Headline Specs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {product.stats.map((stat) => (
            <div key={stat.label} className="bg-[#e6f2fd] rounded-2xl px-2 py-3 text-center">
              <div className="text-lg sm:text-xl font-black text-[#0b2545] leading-none">
                {stat.value}
                {stat.unit && <span className="text-xs">{stat.unit}</span>}
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold text-[#18487d] mt-1.5 leading-tight">
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Display Size Selector */}
        <div className="mt-6">
          {/* The selected size used to be echoed on the right of this label.
              The chosen button below is already filled navy, so it said the
              same thing twice. */}
          <div className="flex items-center text-xs font-bold text-[#0b2545] mb-2">
            <span className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-[#0284c7]" /> DISPLAY SIZE
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {product.displaySizes.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  selectedSize === size
                    ? 'border-[#0b2545] bg-[#0b2545] text-white shadow-md'
                    : 'border-zinc-200 bg-white/70 text-[#0b2545] hover:bg-white'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Finish Selector */}
        <div className="mt-5">
          <div className="text-xs font-bold text-[#0b2545] mb-2">FINISH</div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {FINISH_OPTIONS.map((finish) => (
              /*
                Compact on phones. These were full-height cards with a title
                and a line of description each, and "Custom colour (per MOQ)"
                wrapped to two lines inside its box — so two tiles ate the
                height of the quote button below them. On a phone the
                qualifier and the description drop away and the options read
                as pills, matching the size buttons above. The detail comes
                back from sm up, where there is width for it.
              */
              <button
                key={finish}
                type="button"
                onClick={() => setSelectedFinish(finish)}
                className={`px-3 py-2 sm:p-3 rounded-xl sm:rounded-2xl border text-center sm:text-left cursor-pointer transition ${
                  selectedFinish === finish
                    ? 'border-[#0b2545] bg-[#0b2545]/5 ring-2 ring-[#0b2545]'
                    : 'border-zinc-200 bg-white'
                }`}
              >
                <span className="text-[11px] sm:text-xs font-bold text-[#0b2545]">
                  {finish.split(' (')[0]}
                  {finish.includes(' (') && (
                    <span className="hidden sm:inline"> ({finish.split(' (')[1]}</span>
                  )}
                </span>
                <p className="hidden sm:block text-[10px] text-zinc-500 mt-0.5">
                  {finish === FINISH_OPTIONS[0]
                    ? 'Standard powder-coated finish'
                    : 'Any RAL shade, subject to order quantity'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/*
          Enquiry Action. This used to scroll to the footer and leave the visitor
          to retype the size and finish they had just chosen; it now opens
          WhatsApp with all three already written out.
        */}
        <div className="mt-6">
          <button
            onClick={handleQuote}
            className={`w-full py-3 sm:py-4 px-5 sm:px-6 rounded-full font-black text-sm sm:text-base tracking-tight flex items-center justify-center gap-2 shadow-lg transition-all duration-300 cursor-pointer ${
              sent
                ? 'bg-[#0f7a6d] text-white scale-[0.99]'
                : 'bg-[#128c7e] text-white hover:bg-[#0f7a6d] hover:shadow-xl hover:scale-[1.01]'
            }`}
          >
            {sent
              ? <Check className="w-5 h-5 flex-shrink-0" strokeWidth={3} aria-hidden="true" />
              : <MessageCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />}
            {/* Short label on phones — the full sentence pushed the pill wide
                enough to shrink its own type. */}
            <span className="sm:hidden">{sent ? 'Opening WhatsApp' : 'Quote on WhatsApp'}</span>
            <span className="hidden sm:inline">{sent ? 'Opening WhatsApp' : 'Request a quote on WhatsApp'}</span>
          </button>
        </div>

        {/* Capability Row */}
        <div className="mt-5 pt-3 border-t border-zinc-100 grid grid-cols-3 gap-2 text-center text-[10px] sm:text-[11px] font-bold text-[#18487d]">
          <div className="flex items-center justify-center gap-1">
            <Factory className="w-3.5 h-3.5 text-[#0284c7]" /> Fabricated in Peenya
          </div>
          <div className="flex items-center justify-center gap-1">
            <Wrench className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> Installed &amp; commissioned
          </div>
          <div className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" /> 10+ years, 4K+ clients
          </div>
        </div>

      </div>

    </div>
  );
});
ProductCard.displayName = 'ProductCard';

export const ProductShowcase: React.FC<ProductShowcaseProps> = ({ onRequestQuote }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  // Derive the active card from scroll position, so swiping and the arrows /
  // dots all stay in agreement without fighting each other.
  const rafRef = useRef<number | null>(null);

  /** Index of the slide nearest the track's centre, read straight from the DOM. */
  const nearestIndex = useCallback(() => {
    const el = trackRef.current;
    if (!el) return 0;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let closest = 0;
    let best = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
      if (d < best) {
        best = d;
        closest = i;
      }
    });
    return closest;
  }, []);

  const syncIndex = useCallback(() => {
    // onScroll fires on every frame of a swipe; coalesce to one read per frame
    // or the parent re-render stalls the scroll animation itself.
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const closest = nearestIndex();
      setIndex(prev => (prev === closest ? prev : closest));
    });
  }, [nearestIndex]);

  useEffect(() => {
    window.addEventListener('resize', syncIndex);
    return () => {
      window.removeEventListener('resize', syncIndex);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [syncIndex]);

  const goTo = useCallback((i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const target = el.children[i] as HTMLElement | undefined;
    if (!target) return;
    el.scrollTo({ left: target.offsetLeft, behavior: 'smooth' });
  }, []);

  // Step from where the track actually is, not from possibly-stale state.
  const step = useCallback(
    (dir: -1 | 1) => {
      const from = nearestIndex();
      goTo(Math.min(BLUESTAR_PRODUCTS.length - 1, Math.max(0, from + dir)));
    },
    [goTo, nearestIndex]
  );

  /*
   * The carousel walks itself through the range so nobody has to click to see
   * what we make. It ping-pongs rather than wrapping: jumping eight card widths
   * back to the start reads as a glitch, whereas reversing at the end just looks
   * like the carousel browsing back through the range.
   */
  const directionRef = useRef<1 | -1>(1);
  const autoAdvance = useCallback(() => {
    const last = BLUESTAR_PRODUCTS.length - 1;
    const from = nearestIndex();
    if (from >= last) directionRef.current = -1;
    else if (from <= 0) directionRef.current = 1;
    goTo(Math.min(last, Math.max(0, from + directionRef.current)));
  }, [goTo, nearestIndex]);

  const { ref: viewportRef, pauseProps, paused, holdForInteraction } =
    useAutoAdvance<HTMLDivElement>(autoAdvance, {
      intervalMs: AUTOPLAY_MS,
      enabled: BLUESTAR_PRODUCTS.length > 1
    });

  /** Manual controls hand control back to the visitor and hold the timer. */
  const manual = (fn: () => void) => () => {
    holdForInteraction();
    fn();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    holdForInteraction();
    step(e.key === 'ArrowRight' ? 1 : -1);
  };

  const atStart = index === 0;
  const atEnd = index === BLUESTAR_PRODUCTS.length - 1;

  return (
    <section id="products" className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">

      {/* Section Header */}
      <Reveal className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
        <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#0b2545]/15 text-[#0b2545] text-xs font-black uppercase tracking-widest mb-3">
          <LayoutGrid className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> PRODUCTS &amp; SERVICES
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-[#0b2545] font-condensed tracking-tight">
          EXPLORE THE PRODUCT RANGE
        </h2>
        <p className="mt-3 text-base sm:text-lg text-[#18487d]">
          Digital standees, interactive kiosks, touch tables and LED video walls — fabricated to your specification.
        </p>
      </Reveal>

      {/* Swipeable card carousel */}
      <div
        ref={viewportRef}
        {...pauseProps}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="carousel"
        aria-label="Bluestar Digitech product range"
        tabIndex={0}
        className="relative rounded-[36px] outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/40"
      >

        {/* Prev / Next arrows — sit just outside the card on wide screens */}
        <button
          onClick={manual(() => step(-1))}
          aria-label="Previous product"
          aria-controls="product-carousel-track"
          disabled={atStart}
          className={`hidden sm:flex absolute left-1 xl:-left-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0b2545] text-white shadow-xl border-2 border-white items-center justify-center transition-all duration-200 ${
            atStart
              ? 'opacity-25 cursor-default'
              : 'opacity-100 cursor-pointer hover:bg-[#153b68] hover:scale-105 active:scale-95'
          }`}
        >
          <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
        </button>

        <button
          onClick={manual(() => step(1))}
          aria-label="Next product"
          aria-controls="product-carousel-track"
          disabled={atEnd}
          className={`hidden sm:flex absolute right-1 xl:-right-5 top-1/2 -translate-y-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#0b2545] text-white shadow-xl border-2 border-white items-center justify-center transition-all duration-200 ${
            atEnd
              ? 'opacity-25 cursor-default'
              : 'opacity-100 cursor-pointer hover:bg-[#153b68] hover:scale-105 active:scale-95'
          }`}
        >
          <ChevronRight className="w-5 h-5 stroke-[2.5]" />
        </button>

        {/* The track: one full-width card per slide, native swipe + snap */}
        <div
          id="product-carousel-track"
          ref={trackRef}
          onScroll={syncIndex}
          aria-live="polite"
          className="flex gap-4 sm:gap-6 overflow-x-auto no-scrollbar snap-x snap-mandatory overscroll-x-contain"
        >
          {BLUESTAR_PRODUCTS.map((prod, i) => (
            <div
              key={prod.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${BLUESTAR_PRODUCTS.length}: ${prod.name}`}
              aria-hidden={i !== index}
              className="snap-center flex-shrink-0 w-full"
            >
              <ProductCard product={prod} onRequestQuote={onRequestQuote} />
            </div>
          ))}
        </div>

      </div>

      {/* Position indicator + autoplay progress */}
      <div className="mt-6 flex flex-col items-center gap-3">
        {/*
          The dots read as 6px pills, but each one carries a 24px-tall
          transparent hit area so they are actually tappable on a phone.
        */}
        <div className="flex items-center justify-center">
          {BLUESTAR_PRODUCTS.map((prod, i) => (
            <button
              key={prod.id}
              onClick={manual(() => goTo(i))}
              aria-label={`Show ${prod.name}`}
              aria-current={i === index}
              title={prod.name}
              className="group px-[9px] py-2.5 cursor-pointer focus-visible:outline-none"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === index
                    ? 'bg-[#0b2545] w-6'
                    : 'bg-[#0b2545]/25 w-1.5 group-hover:bg-[#0b2545]/50 group-focus-visible:bg-[#0284c7] group-focus-visible:w-4'
                }`}
              />
            </button>
          ))}
        </div>

        {/*
          The bar drains over one autoplay interval so the movement is announced
          before it happens, and visibly freezes whenever the timer is held.
          `key` restarts the animation on each slide change.
        */}
        <div className="w-28 h-[3px] rounded-full bg-[#0b2545]/15 overflow-hidden" aria-hidden="true">
          <div
            key={`${index}-${paused}`}
            className="h-full bg-[#0284c7] rounded-full origin-left"
            style={{
              animation: paused ? 'none' : `carouselProgress ${AUTOPLAY_MS}ms linear forwards`,
              opacity: paused ? 0.3 : 1
            }}
          />
        </div>

        <p className="text-[11px] font-bold text-[#18487d]">
          <span className="tabular-nums">{index + 1} / {BLUESTAR_PRODUCTS.length}</span>
          <span className="mx-1.5 text-[#0b2545]/30">|</span>
          <span className="font-semibold">{BLUESTAR_PRODUCTS[index]?.name}</span>
          <span className="hidden sm:inline text-[#0b2545]/50 font-semibold"> — swipe or use ← → to browse</span>
        </p>
      </div>

    </section>
  );
};
