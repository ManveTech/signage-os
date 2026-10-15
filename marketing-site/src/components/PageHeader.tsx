import React from 'react';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { ROUTES } from '../data/routes';

interface PageHeaderProps {
  /** Route path, used for the breadcrumb and to find the copy. */
  path: string;
  /** Overrides the routes table's label as the visible heading. */
  heading?: string;
  /** Overrides the routes table's description as the standfirst. */
  intro?: string;
  /** Optional action, e.g. "Request a quote". */
  action?: { label: string; onClick: () => void };
  onNavigate: (path: string) => void;
}

/**
 * The band at the top of every page except the homepage.
 *
 * Without it each inner page opened cold on a single section, which read as an
 * orphaned fragment rather than a page. This gives each one a breadcrumb, an
 * h1 and a sentence of context — and emits BreadcrumbList structured data,
 * which is one of the signals Google uses when deciding whether a site has a
 * structure worth showing sitelinks for.
 *
 * The h1 lives here, so each section's own heading is an h2 beneath it.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  path,
  heading,
  intro,
  action,
  onNavigate
}) => {
  const route = ROUTES.find((r) => r.path === path);
  const label = heading ?? route?.label ?? '';
  const text = intro ?? route?.description ?? '';

  const crumbs = [
    { name: 'Home', item: 'https://bluestardigitech.com/' },
    { name: label, item: `https://bluestardigitech.com${path}` }
  ];

  return (
    <section className="relative overflow-hidden border-b border-white/70">
      {/* Same wash as the hero, so a page opens in the brand rather than on a flat slab. */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[760px] h-[760px] bg-white/35 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-sky-300/20 rounded-full blur-2xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10 sm:pt-8 sm:pb-14">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] sm:text-xs font-bold">
          <a
            href="/"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
              e.preventDefault();
              onNavigate('/');
            }}
            className="text-[#18487d] hover:text-[#0284c7] transition"
          >
            Home
          </a>
          <ChevronRight className="w-3.5 h-3.5 text-[#0b2545]/35" aria-hidden="true" />
          <span className="text-[#0b2545]" aria-current="page">{label}</span>
        </nav>

        <div className="mt-4 sm:mt-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-end">
          <div className="lg:col-span-8">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0b2545] font-condensed tracking-tight uppercase leading-[0.95]">
              {label}
            </h1>
            <p className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg text-[#18487d] leading-relaxed max-w-2xl">
              {text}
            </p>
          </div>

          {action && (
            <div className="lg:col-span-4 lg:text-right">
              <button
                type="button"
                onClick={action.onClick}
                className="group inline-flex items-center gap-2 bg-[#0b2545] hover:bg-[#153b68] text-white px-5 sm:px-6 py-3 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
              >
                {action.label}
                <ArrowUpRight
                  className="w-4 h-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </button>
            </div>
          )}
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: crumbs.map((c, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: c.name,
              item: c.item
            }))
          })
        }}
      />
    </section>
  );
};
