import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Reveal } from './Reveal';

export const CapabilityBanner: React.FC = () => {
  const [offsetPercent, setOffsetPercent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // The ribbon text tracks scroll position. Reading it straight out of the
    // scroll handler re-rendered this SVG on every scroll event; coalescing to
    // one read per frame, and skipping no-op updates, keeps the whole page
    // scrolling smoothly.
    const update = () => {
      rafRef.current = null;
      const next = -(window.scrollY * 0.05);
      setOffsetPercent(prev => (Math.abs(prev - next) < 0.05 ? prev : next));
    };

    const handleScroll = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Longer unit than the phrase it replaced, so fewer repeats fill the same arc.
  const phraseUnit = "PRECISION SHEET METAL WORKS • ";
  const repeatPhrase = phraseUnit.repeat(10);

  return (
    <div className="relative w-full overflow-hidden bg-transparent -mt-4 sm:-mt-8 md:-mt-12 lg:-mt-14 pt-0 pb-14 sm:pb-20 z-10">
      
      {/* Full-Width SVG Arched Dome Ribbon with text perfectly centered inside curve */}
      <div className="w-full relative overflow-hidden select-none">
        <svg
          viewBox="0 0 2000 380"
          className="w-full h-auto min-h-[160px] sm:min-h-[220px] md:min-h-[280px] drop-shadow-xl block"
          preserveAspectRatio="none"
        >
          <defs>
            {/* Arched Text Path - EXACT geometric centerline between top and bottom curve */}
            <path
              id="arcTextCenterPath"
              d="M -400,340 Q 1000,-30 2400,340"
              fill="none"
            />
          </defs>

          {/* Solid Arched Ribbon Background Body */}
          <path
            d="M -400,265 Q 1000,-105 2400,265 L 2400,415 Q 1000,45 -400,415 Z"
            fill="#0b2545"
          />

          {/* Top & Bottom Accent Border Lines */}
          <path
            d="M -400,265 Q 1000,-105 2400,265"
            fill="none"
            stroke="#1d4d82"
            strokeWidth="7"
          />
          <path
            d="M -400,415 Q 1000,45 2400,415"
            fill="none"
            stroke="#1d4d82"
            strokeWidth="7"
          />

          {/* Animated Marquee Text Flowing Precisely Centered in the Arc */}
          <text
            className="font-condensed font-black uppercase tracking-wider"
            dominantBaseline="central"
            alignmentBaseline="central"
            style={{
              fontSize: '70px',
              fill: '#dff0fd',
              letterSpacing: '0.05em',
              fontWeight: 900,
            }}
          >
            <textPath
              href="#arcTextCenterPath"
              startOffset={`${offsetPercent % 100}%`}
              dominantBaseline="central"
              alignmentBaseline="central"
            >
              {repeatPhrase}
            </textPath>
          </text>
        </svg>
      </div>

      {/* Manifesto Headline Section Below the Arched Banner */}
      <Reveal className="max-w-4xl mx-auto px-4 sm:px-6 text-center mt-6 sm:mt-10">
        
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-sm border border-[#0b2545]/15 text-xs font-bold text-[#0b2545] mb-4 shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
          <span>Established 2015 • ISO 9001:2015 Certified</span>
        </div>

        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-[#0b2545] font-condensed leading-[1.05] select-none">
          Your trusted partner<br />
          for quality metal<br />
          <span className="text-[#0284c7] sm:text-[#2563eb]">
            Fabrication.
          </span>
        </h2>

        <p className="mt-5 text-sm sm:text-base md:text-lg text-[#18487d] max-w-2xl mx-auto font-medium leading-relaxed">
          From concept to completion: CNC laser cutting, precision bending, turning and powder-coated finishing — all under one roof at our Peenya facility in Bangalore.
        </p>

        {/* Headline figures from the brochure's capability page */}
        <div className="mt-7 sm:mt-9 grid grid-cols-3 gap-3 sm:gap-6 max-w-lg mx-auto">
          {[
            { value: '10+', label: 'Years of Experience' },
            { value: '4K+', label: 'Happy Clients' },
            { value: '98%', label: 'Satisfaction' }
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-white/70 backdrop-blur-sm rounded-2xl border border-white/70 shadow-sm px-2 py-4 sm:py-5"
            >
              <div className="text-2xl sm:text-3xl md:text-4xl font-black text-[#0b2545] font-condensed leading-none">
                {stat.value}
              </div>
              <div className="mt-1.5 text-[11px] font-bold text-[#18487d] uppercase tracking-wide leading-tight">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </Reveal>

    </div>
  );
};

