import React, { useCallback, useState } from 'react';
import {
  ArrowUpRight,
  Clock,
  Factory,
  PencilRuler,
  Truck
} from 'lucide-react';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { Reveal } from './Reveal';

interface ProcessSectionProps {
  onEnquire: () => void;
}

const STEP_MS = 4000;

const STEPS = [
  {
    step: 1,
    title: 'CAD Design & 3D Engineering',
    desc: 'Custom 3D enclosure modelling around your display, worked out for thermal airflow, mounting and cable management before a single sheet is cut.',
    badge: 'Design Stage',
    phase: 'Phase 1',
    Icon: PencilRuler
  },
  {
    step: 2,
    title: 'CNC Laser Cutting & Fabrication',
    desc: 'Laser cutting, press-brake bending, welding and powder coating — all of it on our own floor in Peenya, so tolerances stay ours to control.',
    badge: 'Manufacturing',
    phase: 'Phase 2',
    Icon: Factory
  },
  {
    step: 3,
    title: 'Assembly & On-Site Commissioning',
    desc: 'Display integration, quality inspection against the drawing, then delivery, mounting and commissioning by our own field engineers.',
    badge: 'Commissioned',
    phase: 'Final Phase',
    Icon: Truck
  }
];

export const ProcessSection: React.FC<ProcessSectionProps> = ({ onEnquire }) => {
  const [activeStep, setActiveStep] = useState(1);

  // Walks through the three stages on its own; stops the moment anyone points
  // at it, focuses a card, or taps one.
  const advance = useCallback(
    () => setActiveStep(s => (s % STEPS.length) + 1),
    []
  );

  // The ref lands on the <ol> below, not a div — typing it as a div made this
  // compile only because React was untyped here before the move.
  const { ref, pauseProps, holdForInteraction } = useAutoAdvance<HTMLOListElement>(
    advance,
    { intervalMs: STEP_MS, resumeAfterMs: 12000 }
  );

  return (
    <section
      id="process"
      className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24"
    >
      <Reveal className="bg-white/90 backdrop-blur-xl rounded-[28px] sm:rounded-[36px] border border-white shadow-xl p-5 sm:p-10 lg:p-12">

        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-sky-100 text-sky-900 text-xs font-bold uppercase tracking-wider mb-2">
            <Factory className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> IN-HOUSE FABRICATION WORKFLOW
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0b2545] font-condensed tracking-tight">
            FROM DRAWING TO COMMISSIONED UNIT
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#18487d]">
            Three stages, one roof. Here is what happens between your brief and a working display on site.
          </p>
        </div>

        {/*
          Every card already shows its full copy, so the highlight is emphasis,
          not disclosure — there is nothing to click to reveal. It walks itself
          through the three stages and follows the pointer when there is one,
          which is why these are plain containers rather than tabs or buttons.
        */}
        <ol
          ref={ref}
          {...pauseProps}
          className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6 list-none"
        >
          {STEPS.map((s) => {
            const isActive = activeStep === s.step;
            return (
              <li
                key={s.step}
                onMouseEnter={() => {
                  holdForInteraction();
                  setActiveStep(s.step);
                }}
                className={`text-left p-5 sm:p-6 rounded-3xl border transition-all duration-500 ease-out flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#0b2545] text-white shadow-xl md:scale-[1.03] border-[#153b68]'
                    : 'bg-white/70 text-[#0b2545] border-zinc-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm transition-colors ${
                        isActive ? 'bg-sky-400 text-[#0b2545]' : 'bg-[#0b2545]/10 text-[#0b2545]'
                      }`}
                    >
                      0{s.step}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full transition-colors ${
                        isActive ? 'bg-white/20 text-sky-300' : 'bg-sky-100 text-sky-900'
                      }`}
                    >
                      {s.badge}
                    </span>
                  </div>

                  <s.Icon
                    className={`w-7 h-7 mb-3 transition-colors ${
                      isActive ? 'text-sky-300' : 'text-[#0284c7]'
                    }`}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />

                  <h3 className="text-lg font-bold mb-2 leading-snug">{s.title}</h3>
                  <p
                    className={`text-xs leading-relaxed ${
                      isActive ? 'text-[#d0e3f8]' : 'text-[#18487d]'
                    }`}
                  >
                    {s.desc}
                  </p>
                </div>

                <div
                  className={`mt-4 sm:mt-6 pt-3 border-t flex items-center justify-between text-xs font-semibold ${
                    isActive ? 'border-white/15' : 'border-[#0b2545]/10'
                  }`}
                >
                  <span>{s.phase}</span>
                  {/* Progress rail doubles as the "which stage am I on" cue. */}
                  <span
                    className={`h-1 w-10 rounded-full overflow-hidden ${
                      isActive ? 'bg-white/20' : 'bg-[#0b2545]/10'
                    }`}
                    aria-hidden="true"
                  >
                    <span
                      className={`block h-full rounded-full transition-all duration-500 ${
                        isActive ? 'w-full bg-sky-300' : 'w-0'
                      }`}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Lead times + a way to actually start one */}
        <div className="mt-6 sm:mt-10 bg-[#e6f2fd] rounded-3xl p-5 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#0b2545] text-sky-300 flex items-center justify-center flex-shrink-0 shadow-md">
              <Clock className="w-6 h-6" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-bold text-[#0b2545] text-base">Typical lead times</h3>
              <p className="text-xs sm:text-sm text-[#18487d] leading-relaxed mt-0.5">
                Standard standees and kiosks dispatch in <strong className="font-bold text-[#0b2545]">5–7 working days</strong>.
                Custom enclosures and LED video wall projects run <strong className="font-bold text-[#0b2545]">2–3 weeks</strong>, depending on quantity.
              </p>
            </div>
          </div>

          <button
            onClick={onEnquire}
            className="group w-full lg:w-auto flex-shrink-0 inline-flex items-center justify-center gap-2 bg-[#0b2545] hover:bg-[#153b68] text-white px-6 py-3.5 rounded-full text-xs sm:text-sm font-bold shadow transition-all hover:shadow-lg hover:scale-[1.02] active:scale-95 cursor-pointer"
          >
            <span>Send us your drawing</span>
            <ArrowUpRight className="w-4 h-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>

      </Reveal>
    </section>
  );
};
