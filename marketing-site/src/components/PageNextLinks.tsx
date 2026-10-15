import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { NAV_ROUTES } from '../data/routes';

interface PageNextLinksProps {
  /** The page these links sit on; it is left out of its own list. */
  currentPath: string;
  onNavigate: (path: string) => void;
}

/**
 * "Keep looking" strip at the foot of every inner page.
 *
 * Without it each page was a cul-de-sac: arrive from search, read one section,
 * and the only ways on are the header or the browser's back button. These give
 * every page a route to every other one, which is both kinder to a visitor and
 * the internal linking Google reads as structure.
 */
export const PageNextLinks: React.FC<PageNextLinksProps> = ({ currentPath, onNavigate }) => {
  const others = NAV_ROUTES.filter((r) => r.path !== currentPath);
  if (!others.length) return null;

  return (
    <section
      aria-labelledby="keep-looking"
      className="px-4 sm:px-6 lg:px-8 pb-14 sm:pb-20 max-w-7xl mx-auto"
    >
      <h2
        id="keep-looking"
        className="text-center text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#18487d]/70"
      >
        Keep looking
      </h2>

      <div className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {others.map((route) => (
          <a
            key={route.path}
            href={route.path}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate(route.path);
            }}
            className="group flex items-center justify-between gap-3 bg-white/80 hover:bg-white backdrop-blur-sm border border-white rounded-2xl px-4 py-3.5 transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/40"
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-[#0b2545]">{route.label}</span>
              {route.blurb && (
                <span className="block text-[11px] text-[#18487d] mt-0.5 truncate">{route.blurb}</span>
              )}
            </span>
            <ArrowUpRight
              className="w-4 h-4 text-[#0284c7] flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
        ))}
      </div>
    </section>
  );
};
