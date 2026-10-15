import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SECTION_ROUTES } from '../data/routes';
import { Reveal } from './Reveal';

/** Cover image per page, reusing art the site already ships. */
const COVER: Record<string, string> = {
  '/products': '/products/standee.webp',
  '/installations': '/installations/01-led-tower.webp',
  '/about': '/services/cnc-laser-cutting.webp',
  '/faq': '/products/info-kiosk.webp',
  '/contact': '/installations/10-podium.webp'
};

interface SectionGridProps {
  onNavigate: (path: string) => void;
}

/**
 * The homepage's map of the site.
 *
 * These are real `<a href>` elements, not buttons, and that is the point: they
 * are the internal links Google follows to find the other pages, and the
 * structure it builds sitelinks from. The click handler is a progressive
 * enhancement that avoids a full reload — middle-click, right-click and
 * "open in new tab" all still behave like links.
 */
export const SectionGrid: React.FC<SectionGridProps> = ({ onNavigate }) => (
  <section
    aria-labelledby="explore-heading"
    className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
  >
    <Reveal className="text-center max-w-3xl mx-auto mb-8 sm:mb-12">
      <h2
        id="explore-heading"
        className="text-3xl sm:text-5xl font-black text-[#0b2545] font-condensed tracking-tight uppercase"
      >
        Explore the site
      </h2>
      <p className="mt-3 text-base sm:text-lg text-[#18487d]">
        The range, the work we have delivered, and how to reach the people who build it.
      </p>
    </Reveal>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {SECTION_ROUTES.map((route, i) => (
        <Reveal key={route.path} delayStep={i % 3}>
          <a
            href={route.path}
            onClick={(e) => {
              // Let the browser handle anything that is not a plain left click.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate(route.path);
            }}
            className="group block h-full bg-white rounded-3xl border border-white shadow-sm overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/40"
          >
            <div className="relative h-36 sm:h-44 bg-gradient-to-b from-[#e3f0fd] to-[#c1defa] overflow-hidden">
              <img
                src={COVER[route.path]}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                draggable={false}
                className="w-full h-full object-contain p-5 drop-shadow-lg transition-transform duration-500 group-hover:scale-[1.04]"
              />
            </div>

            <div className="p-5 sm:p-6">
              <h3 className="text-lg font-black text-[#0b2545] tracking-tight flex items-center gap-1.5">
                {route.label}
                <ArrowUpRight
                  className="w-4 h-4 text-[#0284c7] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </h3>
              <p className="mt-1.5 text-sm text-[#18487d] leading-relaxed">{route.blurb}</p>
            </div>
          </a>
        </Reveal>
      ))}
    </div>
  </section>
);
