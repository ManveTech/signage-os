import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Factory, MessageCircle } from 'lucide-react';
import {
  CARD_OUTDOOR,
  CARD_INSTALLED,
  CARD_PRODUCTION,
  Installation
} from '../data/installations';
import type { QuoteContext } from '../data/enquiry';

interface InstallationGalleryProps {
  /** Opens WhatsApp. From the lightbox it carries the installation on screen. */
  onRequestQuote: (ctx: QuoteContext) => void;
}

export const InstallationGallery: React.FC<InstallationGalleryProps> = ({ onRequestQuote }) => {
  const [activePhoto, setActivePhoto] = useState<Installation | null>(null);
  const [indexOutdoor, setIndexOutdoor] = useState(0);
  const [indexInstalled, setIndexInstalled] = useState(0);
  const [indexProduction, setIndexProduction] = useState(0);

  // Escape closes the lightbox, and the page behind it stops scrolling while
  // it is open — without this the modal just floats over a moving page.
  useEffect(() => {
    if (!activePhoto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePhoto(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [activePhoto]);

  // Independent image cycle timers for each box (Card 1: every 2.8s, Card 2: every 4.1s, Card 3: every 3.4s)
  useEffect(() => {
    const interval1 = setInterval(() => {
      setIndexOutdoor((prev) => (prev + 1) % CARD_OUTDOOR.length);
    }, 2800);

    const interval2 = setInterval(() => {
      setIndexInstalled((prev) => (prev + 1) % CARD_INSTALLED.length);
    }, 4100);

    const interval3 = setInterval(() => {
      setIndexProduction((prev) => (prev + 1) % CARD_PRODUCTION.length);
    }, 3400);

    return () => {
      clearInterval(interval1);
      clearInterval(interval2);
      clearInterval(interval3);
    };
  }, []);

  return (
    <section
      id="installations"
      aria-labelledby="installations-heading"
      className="relative py-12 sm:py-16 md:py-20 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden scroll-mt-24"
    >
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
        
        {/* LEFT COLUMN: Tilted overlapping photo cards, each cycling its own set */}
        <div className="lg:col-span-6 relative flex items-center justify-center w-full">

          {/*
            A fixed-size stage, centred with mx-auto, that the three cards are
            positioned inside. They used to be absolutely positioned from the
            column's left edge (left-4 / left-6) with the middle card nudged by
            a margin, so the group hugged the left and left a growing gap on the
            right as the column widened. Every card is now offset from the
            stage's centre line, so the composition stays centred at any width.
          */}
          <div className="relative mx-auto w-[330px] h-[400px] sm:w-[470px] sm:h-[520px] lg:w-[430px] lg:h-[480px] xl:w-[520px] xl:h-[560px]">

          {/* Decorative ambient background blur */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Card 1 (left tilt) — outdoor installs */}
          <div 
            className="absolute left-1/2 top-0 -translate-x-[106%] w-[42%] aspect-[9/15] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-2 sm:border-4 border-white bg-slate-900 rotate-[-8deg] hover:rotate-0 hover:z-30 transition-all duration-300 cursor-pointer group"
            onClick={() => setActivePhoto(CARD_OUTDOOR[indexOutdoor])}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              setActivePhoto(CARD_OUTDOOR[indexOutdoor]);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open photo: ${CARD_OUTDOOR[indexOutdoor].product} at ${CARD_OUTDOOR[indexOutdoor].site}`}
          >
            {CARD_OUTDOOR.map((item, idx) => (
              <img
                key={item.id}
                src={item.image}
                alt={`${item.product} — ${item.site}`}
                className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-1000 ease-in-out ${
                  idx === indexOutdoor ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))}
            {/* Dark overlay gradients */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

            {/* Location chip */}
            <div className="hidden sm:block absolute top-3 right-3 bg-black/55 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide z-10">
              {CARD_OUTDOOR[indexOutdoor].location}
            </div>

            {/* Caption removed: cards 2 and 3 overlap this card's lower half,
                so anything pinned here was half-covered. The lightbox carries
                the site and product on tap. */}
          </div>

          {/* Card 2 (centre) — installed and commissioned */}
          <div 
            className="absolute left-1/2 top-[7%] -translate-x-[4%] z-20 w-[49%] aspect-[9/15] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border-2 sm:border-4 border-white bg-slate-900 rotate-[2deg] hover:rotate-0 hover:scale-105 transition-all duration-300 cursor-pointer group"
            onClick={() => setActivePhoto(CARD_INSTALLED[indexInstalled])}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              setActivePhoto(CARD_INSTALLED[indexInstalled]);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open photo: ${CARD_INSTALLED[indexInstalled].product} at ${CARD_INSTALLED[indexInstalled].site}`}
          >
            {CARD_INSTALLED.map((item, idx) => (
              <img
                key={item.id}
                src={item.image}
                alt={`${item.product} — ${item.site}`}
                className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-1000 ease-in-out ${
                  idx === indexInstalled ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/30 pointer-events-none" />

            {/* Top Tag */}
            <div className="hidden sm:block absolute top-3 left-3 bg-white/25 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black tracking-wide z-10">
              ◉ LIVE INSTALL
            </div>

            {/* Location chip */}
            <div className="hidden sm:block absolute top-3 right-3 bg-black/55 backdrop-blur-md text-white px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide z-10">
              {CARD_INSTALLED[indexInstalled].location}
            </div>

            {/* Centre badge: headline install figure */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="text-center">
                <div className="text-[10px] sm:text-sm font-black tracking-widest text-white uppercase drop-shadow">
                  INSTALLED
                </div>
                <div className="text-2xl sm:text-5xl md:text-6xl font-black text-sky-300 uppercase font-condensed tracking-tighter drop-shadow-xl leading-none my-0.5">
                  4K+
                </div>
                <div className="text-[11px] sm:text-base font-black text-white uppercase tracking-wide drop-shadow">
                  NATIONWIDE
                </div>

                {/* Dot indicators for the auto image cycle */}
                <div className="flex justify-center gap-1 sm:gap-1.5 mt-2 sm:mt-2.5">
                  {[0, 1, 2, 3].map((dotIdx) => (
                    <span 
                      key={dotIdx} 
                      className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${dotIdx === indexInstalled ? 'bg-sky-300 w-3 sm:w-4' : 'bg-white/50 w-1 sm:w-1.5'}`} 
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Caption removed: card 3 sits over this card's bottom-left
                corner, which cut the site name in half. */}
          </div>

          {/* Card 3 (lower left tilt) — on the production floor */}
          <div 
            className="absolute left-1/2 bottom-0 -translate-x-[88%] w-[39%] aspect-[9/14] rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl border-2 sm:border-4 border-white bg-slate-900 rotate-[-5deg] hover:rotate-0 z-20 hover:z-30 transition-all duration-300 cursor-pointer group"
            onClick={() => setActivePhoto(CARD_PRODUCTION[indexProduction])}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              setActivePhoto(CARD_PRODUCTION[indexProduction]);
            }}
            role="button"
            tabIndex={0}
            aria-label={`Open photo: ${CARD_PRODUCTION[indexProduction].product} at ${CARD_PRODUCTION[indexProduction].site}`}
          >
            {CARD_PRODUCTION.map((item, idx) => (
              <img
                key={item.id}
                src={item.image}
                alt={`${item.product} — ${item.site}`}
                className={`absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-opacity duration-1000 ease-in-out ${
                  idx === indexProduction ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 pointer-events-none" />

            {/* This is the frontmost card, so nothing covers its lower edge —
                it is the one card that can carry a caption. Kept short. */}
            <div className="hidden sm:block absolute bottom-3 inset-x-3 text-white z-10">
              <div className="text-sm font-black text-white">On the floor</div>
              <div className="text-[11px] text-zinc-200 leading-snug mt-1 line-clamp-2">
                {CARD_PRODUCTION[indexProduction].product}
              </div>
            </div>
          </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Brand Philosophy & CTA matching Screenshot */}
        <div className="lg:col-span-6 flex flex-col justify-center text-left max-w-xl">
          
          {/* Main Statement with exact condensed display font and sizing */}
          <h2
            id="installations-heading"
            className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black text-[#0b2545] tracking-tight leading-[1.1]"
            style={{ fontFamily: "'Barlow Condensed', 'Outfit', sans-serif" }}
          >
            We keep the whole build under one roof — so nothing gets lost between the metal and the screen.
          </h2>

          {/* Subtext Body matching reference */}
          <p className="mt-3.5 sm:mt-5 text-sm sm:text-base text-[#334e68] leading-relaxed font-normal">
            Cut, bent, welded, powder-coated and fitted in Peenya, then installed and commissioned by the same team. No middleman, no finger-pointing.
          </p>

          {/* CTA Button & Client Stats matching user screenshot */}
          <div className="mt-6 sm:mt-8 flex flex-wrap items-center gap-4 sm:gap-6">
            {/* Pill Button: Circular White Arrow Icon + "Request a quote" */}
            <button
              onClick={() => onRequestQuote({ from: 'installation gallery' })}
              className="group inline-flex items-center gap-2.5 sm:gap-3 bg-[#0b3b6d] hover:bg-[#072a4f] text-white pl-1.5 sm:pl-2 pr-5 sm:pr-6 py-1.5 sm:py-2 rounded-full font-bold text-sm sm:text-base tracking-tight shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer"
              id="request-quote-btn"
            >
              {/* Circular White Inset with Top-Right Arrow */}
              <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-[#0b3b6d] flex items-center justify-center shadow-sm flex-shrink-0 transition-transform group-hover:rotate-45 duration-300">
                <ArrowUpRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.8]" />
              </span>
              <span className="font-bold tracking-tight pr-1">Quote on WhatsApp</span>
            </button>

            {/* 4,000+ clients / since 2015 · ISO 9001:2015 */}
            <div className="flex flex-col justify-center">
              <div 
                className="text-xl sm:text-2xl font-extrabold text-[#0b3b6d] tracking-tight leading-none"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                4,000+ clients
              </div>
              <div className="text-[11px] sm:text-xs text-[#486581] font-medium tracking-wide mt-0.5 sm:mt-1">
                since 2015 · ISO 9001:2015
              </div>
            </div>
          </div>

          {/* HANDWRITTEN SCRIPT & CURVED HAND-DRAWN ARROW (matching user screenshot) */}
          <div className="mt-4 sm:mt-5 flex items-center gap-2 sm:gap-3 select-none pl-1">
            <span 
              className="text-xl sm:text-2xl md:text-3xl text-[#0b5394] font-medium tracking-wide"
              style={{ fontFamily: "'Caveat', cursive, sans-serif" }}
            >
              why they keep coming back
            </span>
            
            {/* Hand-drawn curved blue arrow SVG matching reference */}
            <svg className="w-14 sm:w-18 h-7 sm:h-8 text-[#0b5394] -rotate-3 transform translate-y-0.5 overflow-visible" viewBox="0 0 100 50" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M 5 15 Q 55 -8 85 26" />
              <path d="M 70 24 L 85 26 L 82 12" />
            </svg>
          </div>

        </div>

      </div>

      {/* Fullscreen photo lightbox */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activePhoto.product} at ${activePhoto.site}`}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div 
            className="relative w-full max-w-md aspect-[9/16] bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col justify-between p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={activePhoto.image}
              alt={`${activePhoto.product} — ${activePhoto.site}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/60" />

            {/* Modal Header */}
            <div className="relative z-10 flex items-center justify-between text-white">
              <div className="flex items-center gap-3">
                <img
                  src={activePhoto.thumb}
                  alt={activePhoto.product}
                  className="w-10 h-10 rounded-full border-2 border-white object-contain bg-[#d5e5f7] p-1"
                />
                <div>
                  <div className="font-bold text-sm">{activePhoto.site}</div>
                  <div className="text-xs text-zinc-300">{activePhoto.location}</div>
                </div>
              </div>
              <button 
                onClick={() => setActivePhoto(null)}
                className="w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-white hover:text-black transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Bottom Quote & Action */}
            <div className="relative z-10 text-white space-y-3">
              <div className="bg-white/20 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-sm font-medium">
                {activePhoto.note}
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span className="flex items-center gap-1 font-bold text-sky-300">
                  <Factory className="w-4 h-4" aria-hidden="true" /> Fabricated &amp; installed in-house
                </span>
                <span>{activePhoto.product}</span>
              </div>
              {/* Carries the photo's own details across, so the message that
                  opens says which installation prompted the question. */}
              <button
                onClick={() => {
                  const photo = activePhoto;
                  setActivePhoto(null);
                  onRequestQuote({
                    product: photo.product,
                    site: `${photo.site}, ${photo.location}`,
                    from: 'installation gallery'
                  });
                }}
                className="w-full bg-[#128c7e] hover:bg-[#0f7a6d] text-white py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span>Quote this on WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
