import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpRight, ShieldCheck, Mail, MapPin } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { BluestarLogo, ProductShowcaseLoop } from './BrandAssets';
import { BLUESTAR_PRODUCTS } from '../data/bluestarProducts';
import type { EnquiryPrefill } from './EnquiryPage';
import type { QuoteContext } from '../data/enquiry';

interface HeroSectionProps {
  /** Opens the enquiry form. */
  onEnquire: (prefill?: EnquiryPrefill) => void;
  /** Opens WhatsApp, prefilled with the product currently on screen. */
  onRequestQuote: (ctx: QuoteContext) => void;
  onScrollToProducts: () => void;
}

const ROTATE_MS = 4200;

export const HeroSection: React.FC<HeroSectionProps> = ({
  onEnquire,
  onRequestQuote,
  onScrollToProducts
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLElement>(null);

  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Single source of truth: the stat circles, the render and the headline all
  // read from this index, so the whole hero describes one product at a time.
  useEffect(() => {
    if (prefersReduced || paused) return;
    const id = window.setInterval(
      () => setIndex(i => (i + 1) % BLUESTAR_PRODUCTS.length),
      ROTATE_MS
    );
    return () => window.clearInterval(id);
  }, [prefersReduced, paused]);

  // Smooth mouse parallax movement
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20; // -10 to +10 deg
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  const active = BLUESTAR_PRODUCTS[index];
  // Three spec columns inside a 340px bar means ~100px each, which forced 8px
  // type on a phone. Two columns there, three once there is room.
  const [specCount, setSpecCount] = useState(3);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const sync = () => setSpecCount(mq.matches ? 3 : 2);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  /*
   * White measured 1.28:1 against the hero's #d5e5f7 background — WCAG AA
   * wants 3:1 for text this size, so the first word of every headline was
   * effectively invisible and only legible at all because of a drop-shadow
   * propping it up. #18487d is the same mid-navy used for body copy here and
   * measures 7.24:1, keeping the three-tone ramp: medium, darkest, accent.
   */
  const headlineColors = ['text-[#18487d]', 'text-[#0b2545]', 'text-[#2563eb]'];

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      /*
       * On a laptop the hero is sized to land inside one screen: the sticky
       * header and announcement bar come to roughly 90px, so the hero takes the
       * rest and centres its content. `svh` rather than `vh` so a phone's
       * collapsing address bar does not push the bottom off screen.
       */
      className="hero-section relative pt-1 sm:pt-3 pb-4 sm:pb-6 px-3 sm:px-6 lg:px-8 overflow-hidden flex flex-col lg:justify-center lg:min-h-[calc(100svh-112px)]"
    >

      {/* Background Subtle Gradient & Light Radial Highlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/30 rounded-full blur-3xl transition-transform duration-700 ease-out"
          style={{
            transform: `translate(calc(-50% + ${mousePos.x * 1.5}px), calc(-50% + ${mousePos.y * 1.5}px))`
          }}
        />
        <div className="absolute bottom-10 left-10 w-96 h-96 bg-sky-900/10 rounded-full blur-2xl" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-blue-400/10 rounded-full blur-2xl" />
      </div>

      {/* Top Header: Brand Logo & CTA */}
      <div className="relative z-10 flex flex-col items-center text-center mt-1">

        {/*
          The "Digital Signage • Kiosks • LED Video Walls • ISO 9001:2015" pill
          that sat here is gone: the announcement bar already carries ISO
          9001:2015 two rows above it, and the product categories are spelled out
          by the headline and the carousel below. Removing it also buys the hero
          back ~30px of height on a short screen.
        */}

        {/* The Exact "Bluestar Digitech" Brand Mark with Wireframe Star & Mesh */}
        {/* Sized down from 640px: at full width the lockup alone was 204px tall
            and pushed the bottom of the hero past the fold on a 900px screen. */}
        <div className="hero-logo w-full max-w-[250px] sm:max-w-[330px] md:max-w-[390px] lg:max-w-[430px] xl:max-w-[470px] transition-transform duration-300 hover:scale-[1.01]">
          <BluestarLogo className="w-full h-auto drop-shadow-sm" color="#0b2545" priority />
        </div>

        {/*
          CTA row. `flex-nowrap` plus a shorter label on phones: at 360px the
          two pills used to wrap onto separate lines, which left the hero opening
          with a stack of three centred blocks and no clear primary action.
        */}
        {/*
          Hidden on phones. The installs figure moved up into the announcement
          bar, and "Enquire" is already a sticky button in the header two rows
          above — so on a small screen this row was a third call to action
          competing with itself. The product title takes the space instead.
        */}
        <div className="hidden sm:flex mt-2.5 sm:mt-3.5 flex-nowrap items-center justify-center gap-2">
          <button
            onClick={() =>
              onEnquire({
                product: active.name,
                context: `Enquiring about the ${active.name} — tell us the site and quantity and we’ll quote it.`
              })
            }
            className="group inline-flex flex-shrink-0 items-center gap-1.5 sm:gap-2 bg-[#0b2545] text-white hover:bg-[#153b68] px-4 sm:px-7 py-2.5 sm:py-3 rounded-full font-bold text-xs sm:text-sm tracking-tight shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            id="hero-enquire-btn"
          >
            <Mail className="w-3.5 h-3.5 text-sky-300 transition-transform group-hover:scale-110" aria-hidden="true" />
            <span>Enquire Now</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
          </button>

          <button
            onClick={onScrollToProducts}
            className="inline-flex flex-shrink-0 items-center gap-1 px-2.5 sm:px-3 py-2 rounded-full bg-white/70 backdrop-blur-md text-[10px] sm:text-[11px] font-bold text-[#0b2545] border border-white/60 hover:bg-white transition cursor-pointer"
          >
            <MapPin className="w-3 h-3 text-[#0284c7] flex-shrink-0" aria-hidden="true" />
            <span>4K+ installations across India</span>
          </button>
        </div>

        {/*
          The product title, on phones only — it takes the space the CTA row
          gave up, so the headline sits directly under the logo and names the
          product before you scroll to its render. From sm up the title lives
          in the hero grid's right column instead (further down this file);
          only one of the two is ever rendered, so only one h1 exists at a time.
        */}
        {/*
          The words flow and wrap here rather than taking a line each. Forced
          one-per-line, a three-word name ("SELF / SERVICE / KIOSK") became
          three stacked bands that ate the screen before the product render.
          Inline, the same name settles into one or two lines. Desktop keeps
          the stacked treatment, where there is height to spend on it.
        */}
        <h1
          key={`${active.id}-m`}
          className="sm:hidden hero-headline font-condensed uppercase leading-[0.95] tracking-tight select-none mt-3 px-2 text-balance animate-in fade-in duration-500"
        >
          {active.headline.map((word, i) => (
            <span
              key={word}
              className={`text-[34px] xs:text-[38px] font-black ${headlineColors[i % headlineColors.length]}`}
            >
              {word}
              {i < active.headline.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>

      </div>

      {/* Main Interactive Hero Grid (Orbit Circles, Product & Big Stacked Headline) */}
      <div
        className="hero-grid relative z-20 max-w-7xl mx-auto w-full mt-3 sm:mt-4 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-4 items-center"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >

        {/* LEFT COLUMN: Handwritten Scribble + Circular Stat Badges on Orbit */}
        <div className="lg:col-span-4 relative order-2 lg:order-1 flex flex-col items-center lg:items-start pl-0 lg:pl-2">

          {/* Handwritten Annotation with Curvy Arrow */}
          <div className="relative mb-2 sm:mb-4 self-center lg:self-start pl-2 sm:pl-4">
            <div className="font-script text-xl sm:text-2xl font-bold text-[#0b2545] rotate-[-6deg] tracking-wide select-none">
              Designed &amp; Built,<br />
              <span className="text-2xl sm:text-3xl text-[#18487d]">In Bangalore</span>
            </div>

            {/* Hand-drawn SVG Curvy Arrow */}
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 text-[#0b2545] absolute -bottom-6 left-6 sm:left-8 rotate-12 opacity-85"
              viewBox="0 0 60 60"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M 15 5 C 10 25, 25 35, 45 42" />
              <path d="M 38 46 L 47 43 L 42 34" />
            </svg>
          </div>

          {/* Stat Badges Orbit Grid - Slim & Balanced */}
          <div className="relative w-full max-w-[340px] pt-1 sm:pt-2 flex flex-row lg:flex-col justify-center lg:justify-start gap-2 sm:gap-3 flex-nowrap">
            {active.stats.map((stat, i) => {
              const offset = ['lg:ml-12', 'lg:ml-4', 'lg:ml-0'][i];
              const key = `${active.id}-${i}`;
              return (
                <div
                  key={key}
                  className="relative group cursor-pointer animate-in fade-in duration-500 flex-1 min-w-0 max-w-[104px] lg:flex-none lg:max-w-none"
                  onClick={() => setActiveTooltip(activeTooltip === key ? null : key)}
                >
                  <div className={`hero-stat w-full aspect-square lg:w-26 lg:h-26 lg:aspect-auto rounded-full bg-white/90 backdrop-blur-md shadow-md border border-white/80 flex flex-col items-center justify-center p-1.5 text-center transition-all duration-300 group-hover:scale-105 group-hover:bg-white group-hover:shadow-lg ${offset}`}>
                    <div className="hero-stat-value text-lg sm:text-2xl font-black text-[#0b2545] tracking-tight leading-none">
                      {stat.value}
                      {stat.unit && (
                        <span className="text-sm sm:text-base">{stat.unit}</span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-[#1e4e82] mt-1 px-1 leading-tight">
                      {stat.label}
                    </div>
                    {/* The third tier sat at 7px inside a 96px circle — legible
                        only on a desktop, so it waits for one. It also drops
                        back out on a short desktop screen, where the circle
                        shrinks to 74px but this text does not: see
                        .hero-stat-sub in index.css. */}
                    <div className="hero-stat-sub hidden sm:block text-[9px] font-semibold text-sky-900/80 uppercase tracking-wider mt-0.5 px-1 leading-tight">
                      {stat.sub}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Spec Breakdown Bar */}
          <div
            key={active.id}
            className="mt-4 bg-white/80 backdrop-blur-sm rounded-xl p-2.5 border border-white/70 text-[10px] font-bold text-[#0b2545] flex items-stretch justify-between gap-2 shadow-sm w-full max-w-[340px] animate-in fade-in duration-500"
          >
            {active.specs.slice(0, specCount).map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <div className="w-px bg-zinc-200 flex-shrink-0 self-stretch" />}
                <div className="text-center min-w-0 flex-1 flex flex-col justify-center">
                  <span className="block text-[#18487d] text-[10px] uppercase leading-tight">
                    {s.label}
                  </span>
                  <span className="font-black text-[11px] leading-tight block break-words mt-0.5">{s.value}</span>
                </div>
              </React.Fragment>
            ))}
          </div>

        </div>

        {/* CENTER COLUMN: PRODUCT RENDER VERTICAL & CENTERED */}
        <div className="lg:col-span-4 relative order-1 lg:order-2 flex flex-col items-center justify-center my-0 lg:my-0 overflow-visible">

          {/* Circular Orbit Guide Ring Behind Product - Centered */}
          <div className="absolute w-[250px] h-[250px] sm:w-[340px] sm:h-[340px] rounded-full border-2 border-white/60 pointer-events-none -z-0 scale-95" />
          <div className="absolute w-[310px] h-[310px] sm:w-[415px] sm:h-[415px] rounded-full border border-white/40 pointer-events-none -z-0" />

          {/*
            Product Render. The render is the thing people came to look at, so
            it gets the room: it used to cap at 160px on a phone — 42% of a
            390px screen, floating inside a 230px ring — and 270px on desktop.
            Still capped against viewport height so the hero fits one screen on
            a short laptop; that cap, not the width, is what keeps it in check.
          */}
          <div className="relative z-10 w-full max-w-[230px] sm:max-w-[300px] lg:max-w-[290px] xl:max-w-[330px] lg:max-h-[46svh] mx-auto flex flex-col items-center animate-float">
            <ProductShowcaseLoop index={index} />
          </div>

        </div>

        {/* RIGHT COLUMN: Condensed Typography + Explanatory Text + Certification */}
        <div className="lg:col-span-4 relative order-3 lg:order-3 text-center lg:text-left flex flex-col justify-center items-center lg:items-start">

          {/*
            From sm up; phones get the copy above. This one is a heading-role
            div rather than a second <h1>: both renderings carry the same text,
            and two h1 elements in the markup is untidy. Google indexes mobile
            first, so the real element stays on the phone copy and this keeps
            the same semantics for assistive tech.
          */}
          <div
            role="heading"
            aria-level={1}
            key={active.id}
            className="hidden sm:block hero-headline font-condensed uppercase leading-[0.9] tracking-tight select-none w-full animate-in fade-in duration-500"
          >
            {active.headline.map((line, i) => (
              <span
                key={line}
                className={`block text-[28px] xs:text-4xl sm:text-5xl md:text-6xl lg:text-[clamp(28px,4vw,56px)] font-black break-words ${headlineColors[i % headlineColors.length]}`}
              >
                {line}
              </span>
            ))}
          </div>

          {/* Subtitle Body Copy */}
          <p
            key={`${active.id}-tagline`}
            className="mt-3 sm:mt-4 text-xs sm:text-sm lg:text-base font-medium text-[#12365e] leading-relaxed max-w-md animate-in fade-in duration-500"
          >
            {active.tagline} Fabricated in-house at our Peenya facility and installed across India.
          </p>

          {/*
            The three feature pills that sat here are gone. The hero already
            carries the stat circles, the spec bar and the tagline for the same
            product; a fourth block of claims pushed the fold down without
            adding anything the product card below does not say better.
            `features` is still on the data and read by nothing — it is there
            for whatever uses it next.
          */}

          {/* Enquiry Link & Certification Row */}
          <div className="mt-3 sm:mt-4 pt-3 border-t border-[#0b2545]/15 flex flex-wrap items-center justify-center lg:justify-start gap-3 w-full">
            {/* A price question for the product on screen — straight to WhatsApp
                with the model already named, rather than a scroll to the footer. */}
            <button
              onClick={() =>
                onRequestQuote({ product: active.name, from: 'hero' })
              }
              className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[#0b2545] hover:underline cursor-pointer bg-white/70 px-2.5 py-1 rounded-full shadow-sm"
            >
              <WhatsAppIcon className="w-3.5 h-3.5 text-[#128c7e]" aria-hidden="true" />
              <span>Quote on WhatsApp</span>
            </button>

            <span className="text-[11px] sm:text-xs font-bold text-[#18487d] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" /> ISO 9001:2015 Certified
            </span>
          </div>

        </div>

      </div>

    </section>
  );
};
