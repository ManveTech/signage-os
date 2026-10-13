import React from 'react';
import { CLIENT_LOGOS } from '../data/clients';
import { Reveal } from './Reveal';

/**
 * A slow logo marquee under the hero. It scrolls itself, so there is nothing to
 * click, and it pauses under the pointer if someone wants to read a mark.
 * Under `prefers-reduced-motion` the CSS collapses the duplicate run and lets
 * the row wrap instead of sliding (see .client-marquee in index.css).
 */
const LogoRun: React.FC<{ ariaHidden?: boolean }> = ({ ariaHidden }) => (
  // display:contents, so the run is a CSS hook without becoming a flex item.
  <div className={`marquee-run${ariaHidden ? ' marquee-run--dupe' : ''}`}>
    {CLIENT_LOGOS.map((client) => (
      <div
        key={client.id}
        className="flex-shrink-0 px-6 sm:px-8 flex flex-col items-center justify-center gap-1.5"
      >
        <img
          src={client.image}
          alt={ariaHidden ? '' : client.name}
          aria-hidden={ariaHidden}
          loading="lazy"
          decoding="async"
          draggable={false}
          /*
            Full colour, not the usual grayscale-until-hover: these sit on a
            pale blue page where desaturated marks all but vanish, and a touch
            device never gets the hover that would bring them back.
          */
          className={`w-auto object-contain opacity-85 transition-opacity duration-300 hover:opacity-100 ${
            client.scale === 'crest'
              ? 'h-12 sm:h-16'
              : 'h-8 sm:h-10 max-w-[140px] sm:max-w-[180px]'
          }`}
        />
        <span className="hidden sm:block text-[10px] font-bold uppercase tracking-wider text-[#18487d]/70 whitespace-nowrap">
          {client.sector}
        </span>
      </div>
    ))}
  </div>
);

export const ClientLogos: React.FC = () => (
  <section
    aria-labelledby="clients-heading"
    className="py-10 sm:py-14 overflow-hidden"
  >
    <Reveal className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h2
        id="clients-heading"
        className="text-center text-[11px] sm:text-xs font-black uppercase tracking-[0.2em] text-[#18487d]/70"
      >
        Supplied &amp; installed for
      </h2>
    </Reveal>

    {/* Feathered edges so the strip reads as continuous rather than cut off */}
    <div
      className="relative mt-6 sm:mt-8"
      style={{
        maskImage:
          'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 8%, black 92%, transparent)'
      }}
    >
      <div className="client-marquee items-center">
        <LogoRun />
        <LogoRun ariaHidden />
      </div>
    </div>
  </section>
);
