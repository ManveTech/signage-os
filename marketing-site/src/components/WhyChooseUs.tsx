import React, { useCallback, useState } from 'react';
import { ShieldCheck, Award, Truck, Users } from 'lucide-react';
import { BLUESTAR_PRODUCTS } from '../data/bluestarProducts';
import { BLUESTAR_SERVICES } from '../data/bluestarServices';
import { useAutoAdvance } from '../hooks/useAutoAdvance';
import { Reveal } from './Reveal';

/** How long each product holds the spotlight in the spec comparison. */
const SPEC_ROTATE_MS = 3600;

/** First matching spec label, so products with different spec sheets still fill the column. */
const specValue = (productId: string, labels: string[]) => {
  const p = BLUESTAR_PRODUCTS.find(x => x.id === productId);
  if (!p) return '—';
  for (const label of labels) {
    const hit = p.specs.find(s => s.label === label);
    if (hit) return hit.value;
  }
  return '—';
};

interface WhyChooseUsProps {
  /*
   * The section's own heading block. Shown on the homepage, where this sits in
   * a stack of sections and needs to announce itself. Hidden on its dedicated
   * page, where PageHeader already gives the page a breadcrumb, an h1 and a
   * line of context immediately above — printed twice it read as a stutter.
   */
  showHeading?: boolean;
}

export const WhyChooseUs: React.FC<WhyChooseUsProps> = ({ showHeading = true }) => {
  // Spec comparison across the range, read from the product data so it cannot
  // drift out of sync with the cards above.
  const comparisonData = BLUESTAR_PRODUCTS.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    // LED walls quote a panel configuration rather than a fixed resolution.
    resolution: specValue(p.id, ['Resolution', 'Display', 'Configuration']),
    sizes: p.displaySizes.join(' · '),
    material: p.material,
    confirmed: p.specsSource === 'brochure'
  }));

  const [active, setActive] = useState(0);
  const activeRow = comparisonData[active];

  const advance = useCallback(
    () => setActive(i => (i + 1) % BLUESTAR_PRODUCTS.length),
    []
  );

  const {
    ref: rotatorRef,
    pauseProps,
    holdForInteraction
  } = useAutoAdvance<HTMLDivElement>(advance, {
    intervalMs: SPEC_ROTATE_MS,
    resumeAfterMs: 12000
  });

  return (
    <section
      id="why-us"
      className="py-12 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24"
    >

      {/* Section Title */}
      {showHeading && (
  <Reveal className="text-center max-w-3xl mx-auto mb-8 sm:mb-14">
          <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-[#0b2545]/15 text-[#0b2545] text-xs font-black uppercase tracking-widest mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" /> ISO 9001:2015 CERTIFIED
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-[#0b2545] font-condensed tracking-tight">
            WHY CHOOSE BLUE STAR
          </h2>
          <p className="mt-3 text-base sm:text-lg text-[#18487d]">
            Cutting-edge technology, stringent quality control and a team that has been doing this since 2015.
          </p>
        </Reveal>
      )}

      {/* 3 Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-10 sm:mb-16">

        {/* Pillar 1: Unmatched Quality */}
        <Reveal className="bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-8 border border-white shadow-md hover:shadow-xl transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-100 text-sky-900 flex items-center justify-center mb-4 sm:mb-6">
              <Award className="w-6 h-6 text-[#0284c7]" />
            </div>
            <h3 className="text-xl font-bold text-[#0b2545] mb-2">
              Unmatched Quality
            </h3>
            <p className="text-xs sm:text-sm text-[#18487d] leading-relaxed">
              We use cutting-edge technology and stringent quality control procedures to ensure every product meets your exact specifications — inspected against drawing before it leaves the floor.
            </p>
          </div>
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#0b2545]/10 flex items-center justify-between text-xs font-bold text-[#0b2545]">
            <span>ISO 9001:2015</span>
            <span className="text-[#0284c7]">CE &amp; ROHS</span>
          </div>
        </Reveal>

        {/* Pillar 2: Experienced Team */}
        <Reveal delayStep={1} className="bg-[#0b2545] text-white rounded-3xl p-5 sm:p-8 border border-[#153b68] shadow-xl hover:shadow-2xl transition flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-sky-400/20 text-sky-300 flex items-center justify-center mb-4 sm:mb-6">
              <Users className="w-6 h-6 text-sky-300" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Experienced Team
            </h3>
            <p className="text-xs sm:text-sm text-[#d0e3f8] leading-relaxed">
              Our team has extensive experience across every aspect of metal fabrication — from CNC programming and press-brake forming through to powder-coating, assembly and on-site commissioning.
            </p>
          </div>
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-white/15 flex items-center justify-between text-xs font-bold text-sky-300">
            <span>10+ Years</span>
            <span>4,000+ Clients</span>
          </div>
        </Reveal>

        {/* Pillar 3: Reliable Delivery */}
        <Reveal delayStep={2} className="bg-white/90 backdrop-blur-md rounded-3xl p-5 sm:p-8 border border-white shadow-md hover:shadow-xl transition flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center mb-4 sm:mb-6">
              <Truck className="w-6 h-6 text-[#2563eb]" />
            </div>
            <h3 className="text-xl font-bold text-[#0b2545] mb-2">
              Reliable Delivery
            </h3>
            <p className="text-xs sm:text-sm text-[#18487d] leading-relaxed">
              We understand the importance of on-time delivery, and have a proven track record of meeting deadlines — keeping your rollout on schedule at competitive rates, without compromising on quality.
            </p>
          </div>
          <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-[#0b2545]/10 flex items-center justify-between text-xs font-bold text-[#0b2545]">
            <span>98% Satisfaction</span>
            <span className="text-[#0284c7]">Competitive Rates</span>
          </div>
        </Reveal>

      </div>

      {/* Specification Comparison */}
      <Reveal className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-xl border border-white overflow-hidden p-5 sm:p-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-[#0b2545] font-condensed">
              SPECIFICATION COMPARISON
            </h3>
            <p className="text-xs sm:text-sm text-[#18487d]">
              The full range side by side. Anything not listed is built to your drawing.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-[#e3effc] p-1.5 rounded-full text-xs font-bold text-[#0b2545]">
            <span className="px-3 py-1 bg-[#0b2545] text-white rounded-full">Standard build</span>
          </div>
        </div>

        {/*
          One index drives both views: the highlighted table row on a desktop
          and the single card on a phone. It walks the range on a timer so the
          section reads itself to the visitor, and stops under the pointer, on
          focus, off-screen, in a background tab and for reduced motion.
        */}
        <div ref={rotatorRef} {...pauseProps}>

          {/* Table on tablet and up */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-[#0b2545]/15 text-xs uppercase tracking-wider font-extrabold text-[#0b2545]">
                  <th className="py-4 px-4">Product</th>
                  <th className="py-4 px-4 bg-sky-50/80 rounded-t-xl font-black">Display</th>
                  <th className="py-4 px-4 text-zinc-500">Screen sizes</th>
                  <th className="py-4 px-4 text-zinc-500">Body</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs sm:text-sm font-medium text-[#0b2545]">
                {comparisonData.map((row, i) => {
                  const isActive = i === active;
                  return (
                    <tr
                      key={row.id}
                      onMouseEnter={() => {
                        holdForInteraction();
                        setActive(i);
                      }}
                      className={`transition-colors duration-500 ${
                        isActive ? 'bg-[#0b2545]/[0.06]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-[#0b2545] relative">
                        {/* Rail marks the row the rotation is on. */}
                        <span
                          className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full bg-[#0284c7] transition-all duration-500 ${
                            isActive ? 'h-8 opacity-100' : 'h-0 opacity-0'
                          }`}
                          aria-hidden="true"
                        />
                        {row.name}
                        <span className="block text-[10px] font-semibold text-[#18487d] uppercase tracking-wide">
                          {row.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 bg-sky-50/80 font-black text-[#0b2545]">
                        {row.resolution}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-600">{row.sizes}</td>
                      <td className="py-3.5 px-4 text-zinc-600">{row.material}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* One card at a time on phones — a 4-column table is unreadable at
              375px, and eight stacked cards was a wall of text to scroll past. */}
          <div className="md:hidden">
            <div
              key={activeRow.id}
              className="rounded-2xl border border-zinc-200 bg-white overflow-hidden animate-in fade-in duration-500"
            >
              <div className="bg-sky-50/80 px-4 py-2.5">
                <div className="text-sm font-black text-[#0b2545] leading-tight">
                  {activeRow.name}
                </div>
                <div className="text-[10px] font-bold text-[#18487d] uppercase tracking-wide">
                  {activeRow.category}
                </div>
              </div>
              <dl className="px-4 py-2 text-xs">
                {[
                  ['Display', activeRow.resolution],
                  ['Screen sizes', activeRow.sizes],
                  ['Body', activeRow.material]
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-3 py-1.5 border-b border-zinc-100 last:border-0"
                  >
                    <dt className="font-semibold text-[#18487d] flex-shrink-0">{k}</dt>
                    <dd className="font-bold text-[#0b2545] text-right">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Dots carry a 24px hit area behind a 6px pill. */}
            <div className="mt-4 flex items-center justify-center">
              {comparisonData.map((row, i) => (
                <button
                  key={row.id}
                  onClick={() => {
                    holdForInteraction();
                    setActive(i);
                  }}
                  aria-label={`Show ${row.name} specification`}
                  aria-current={i === active}
                  className="group px-[9px] py-2.5 cursor-pointer focus-visible:outline-none"
                >
                  <span
                    className={`block h-1.5 rounded-full transition-all duration-300 ${
                      i === active
                        ? 'bg-[#0b2545] w-6'
                        : 'bg-[#0b2545]/25 w-1.5 group-hover:bg-[#0b2545]/50'
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="text-center text-[11px] font-bold text-[#18487d]">
              <span className="tabular-nums">{active + 1} / {comparisonData.length}</span>
              <span className="mx-1.5 text-[#0b2545]/30">|</span>
              <span className="font-semibold">tap a dot to hold a model</span>
            </p>
          </div>

        </div>

        <p className="mt-5 text-[11px] text-[#18487d] leading-relaxed">
          Panels are offered from 32&quot; to 65&quot; across the digital range; LED walls are
          built to your wall. Figures for the Floor Standing and A-Type standees are from our
          published spec sheets — everything else is built to order, so ask us for the exact
          specification of your configuration.
        </p>

      </Reveal>

      {/* In-house capability */}
      <Reveal className="mt-8 sm:mt-12 bg-gradient-to-br from-[#0b2545] to-[#07172b] rounded-3xl p-5 sm:p-8 text-white shadow-2xl grid grid-cols-1 lg:grid-cols-2 items-center gap-6 sm:gap-8">

        <div className="w-full">
          <span className="text-[11px] sm:text-xs font-bold text-sky-300 uppercase tracking-widest">
            EVERY STAGE UNDER ONE ROOF
          </span>
          <h4 className="text-2xl sm:text-3xl font-black mt-1 font-condensed">
            FROM RAW SHEET TO COMMISSIONED UNIT
          </h4>
          <p className="text-xs sm:text-sm text-[#d0e3f8] mt-2 leading-relaxed">
            Cutting, forming, turning, finishing and quality control all happen at our Peenya facility —
            so there is no middleman between your drawing and the finished product, and no
            finger-pointing when a deadline is tight.
          </p>

          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-sky-300">
            <ShieldCheck className="w-4 h-4" aria-hidden="true" />
            <span>ISO 9001:2015 certified process</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 w-full">
          {BLUESTAR_SERVICES.map((service) => (
            <div
              key={service.id}
              className="relative rounded-2xl overflow-hidden border border-white/10 aspect-[4/3] group"
            >
              <img
                src={service.image}
                alt={`${service.name} at the Bluestar Digitech facility in Peenya, Bangalore`}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07172b]/95 via-[#07172b]/20 to-transparent" />
              <div className="absolute bottom-0 inset-x-0 p-2">
                <div className="text-[10px] sm:text-[11px] font-black leading-tight text-white">
                  {service.name}
                </div>
              </div>
            </div>
          ))}
        </div>

      </Reveal>

    </section>
  );
};
