import React, { useState } from 'react';
import { BluestarLogo } from './BrandAssets';
import { Check, Mail, Phone, MapPin, ArrowUpRight, Clock, Factory, ShieldCheck } from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { COMPANY, PHONES, ADDRESS_ONE_LINE, MAPS_URL } from '../data/company';
import { whatsappUrl, buildQuoteMessage, WHATSAPP_DISPLAY } from '../data/enquiry';
import { Reveal } from './Reveal';
import type { EnquiryPrefill } from './EnquiryPage';

const PRIMARY_PHONE = PHONES[0];

interface FooterProps {
  /** Opens the enquiry form, so the footer's own CTA is a form and not a scroll. */
  onEnquire: (prefill?: EnquiryPrefill) => void;
  /** Navigates without a reload. The hrefs stay real for crawlers. */
  onNavigate: (path: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onEnquire, onNavigate }) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  /*
   * There is no backend on this site yet. This used to flip a "thank you"
   * message and drop the address on the floor, which loses the lead outright —
   * so the submit now opens the visitor's mail client with the request already
   * written. Replace this with a real POST (form service or API route) as soon
   * as there is somewhere to send it; the address lives in data/company.ts.
   */

  /*
   * Footer links were #fragments of a single page. They are real paths now, and
   * they stay real <a href> values — that is what a crawler follows. The
   * handler only upgrades a plain left click; modified clicks fall through so
   * "open in new tab" still works.
   */
  const link = (path: string) => ({
    href: path,
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || (e as React.MouseEvent).button !== 0) return;
      e.preventDefault();
      onNavigate(path);
    }
  });

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;
    const subject = encodeURIComponent('Product catalogue & technical quote request');
    const body = encodeURIComponent(
      `Please send the product catalogue and spec sheets to ${email}.\n\n` +
        `Product(s) of interest:\nScreen size:\nQuantity:\nSite / location:\n`
    );
    window.location.href = `mailto:${COMPANY.email}?subject=${subject}&body=${body}`;
    setSubscribed(true);
  };

  return (
    <footer
      id="contact"
      className="bg-[#06182c] text-[#d5e5f7] pt-12 sm:pt-16 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8 border-t border-[#0b2545] scroll-mt-20"
    >
      <div className="max-w-7xl mx-auto">

        {/*
          The nav's "Contact" used to land on a column of links. These three
          cards give the visitor the three things they actually came for — a
          number to ring, an address to send a drawing to, and a gate to drive
          to — all of them real, from the brochure's back page.
        */}
        <Reveal className="text-center max-w-2xl mx-auto mb-7 sm:mb-10">
          <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-white/10 text-sky-300 text-xs font-black uppercase tracking-widest mb-3">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> TALK TO THE FACTORY
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-white font-condensed tracking-tight">
            GET IN TOUCH
          </h2>
          <p className="mt-2 text-sm sm:text-base text-[#93bfe8]">
            Send us a drawing, a screen size, or just a rough idea — we&apos;ll come back with a quote.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-5 mb-10 sm:mb-12">

          {/* Call */}
          <Reveal className="bg-[#0b2545] rounded-3xl border border-[#153b68] p-5 sm:p-6 flex flex-col">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-400/15 text-sky-300 flex items-center justify-center mb-3 sm:mb-4">
              <Phone className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Call us</h3>
            <a
              href={`tel:${PRIMARY_PHONE.dial}`}
              className="text-lg sm:text-xl font-black text-sky-300 hover:text-white transition tracking-tight"
            >
              {PRIMARY_PHONE.display}
            </a>

            {/* py-1.5 on the row keeps each number a 24px+ target on a phone. */}
            <ul className="mt-3 text-[11px] text-[#93bfe8]">
              {PHONES.slice(1).map((p) => (
                <li key={p.dial}>
                  <a
                    href={`tel:${p.dial}`}
                    className="flex items-center justify-between gap-3 py-1.5 hover:text-white transition"
                  >
                    <span className="text-[#7da9d8]">{p.label}</span>
                    <span className="font-bold">{p.display}</span>
                  </a>
                </li>
              ))}
            </ul>

            {/* Same number on WhatsApp — the route most enquiries actually
                arrive by, so it gets its own target rather than a mention. */}
            <a
              href={whatsappUrl(buildQuoteMessage({ from: 'footer' }))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center justify-center gap-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white py-2.5 px-4 rounded-xl font-bold text-xs transition"
            >
              <WhatsAppIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Message us on WhatsApp</span>
            </a>

            <div className="mt-auto pt-4 flex items-center gap-1.5 text-[11px] font-bold text-[#7da9d8]">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              {/* Hours are not printed in the brochure — stated generically on
                  purpose. Replace once the client confirms them. */}
              <span>Mon–Sat, working hours IST</span>
            </div>
          </Reveal>

          {/* Email */}
          <Reveal delayStep={1} className="bg-[#0b2545] rounded-3xl border border-[#153b68] p-5 sm:p-6 flex flex-col">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-400/15 text-sky-300 flex items-center justify-center mb-3 sm:mb-4">
              <Mail className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Email us</h3>
            <a
              href={`mailto:${COMPANY.email}`}
              className="inline-block py-1 text-sm sm:text-base font-black text-sky-300 hover:text-white transition break-all"
            >
              {COMPANY.email}
            </a>
            <p className="mt-3 text-[11px] text-[#93bfe8] leading-relaxed">
              Attach a drawing or a photo of the site. Tell us the screen size and quantity and
              we can usually quote the same week.
            </p>
            {/* Opens the enquiry form rather than a blank mail window, so the
                questions we need answered get asked before the message is sent. */}
            <button
              type="button"
              onClick={() =>
                onEnquire({
                  context: 'Tell us what you need and we’ll come back with a quote.'
                })
              }
              className="group mt-auto pt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-300 hover:text-white transition cursor-pointer self-start"
            >
              <span>Start an enquiry</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </Reveal>

          {/* Visit */}
          <Reveal delayStep={2} className="bg-[#0b2545] rounded-3xl border border-[#153b68] p-5 sm:p-6 flex flex-col">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-sky-400/15 text-sky-300 flex items-center justify-center mb-3 sm:mb-4">
              <MapPin className="w-5 h-5" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Visit the works</h3>
            <address className="not-italic text-[11px] sm:text-xs text-[#93bfe8] leading-relaxed">
              {COMPANY.legalName},<br />
              {COMPANY.address.line1},<br />
              {COMPANY.address.line2},<br />
              {COMPANY.address.line3},<br />
              {COMPANY.address.city}, {COMPANY.address.state} – {COMPANY.address.postalCode},<br />
              {COMPANY.address.country}
            </address>
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group mt-auto pt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-300 hover:text-white transition"
            >
              <span>Get directions</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </Reveal>

        </div>

        {/* Brand blurb + catalogue request */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 lg:gap-10 pb-10 sm:pb-12 border-b border-[#0b2545]">

          <div className="lg:col-span-6">
            <div className="mb-5">
              <BluestarLogo color="#ffffff" className="w-56 sm:w-64" />
            </div>
            <p className="text-sm text-[#93bfe8] max-w-md leading-relaxed">
              ISO 9001:2015 certified manufacturer of digital standees, interactive touch kiosks,
              active LED video walls, and precision sheet metal enclosures in Bangalore.
            </p>
            {/* No literal bullet separators — they orphan onto their own line
                when this wraps on a phone. */}
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-bold text-sky-300">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Made in India
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Factory className="w-3.5 h-3.5" aria-hidden="true" /> Peenya 2nd Stage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> ISO 9001:2015
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 bg-[#0b2545] p-5 sm:p-8 rounded-3xl border border-[#153b68]">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
              Request the product catalogue
            </h3>
            <p className="text-xs text-[#93bfe8] mb-4">
              Leave your work email and we&apos;ll send the spec sheets for the range.
            </p>

            {subscribed ? (
              <div className="bg-sky-950/60 border border-sky-500/40 p-3.5 rounded-2xl text-xs font-bold text-sky-200 flex items-start gap-2">
                <Check className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span>
                  We&apos;ve opened a message to our team with your details. If nothing
                  appeared, write to{' '}
                  <a href={`mailto:${COMPANY.email}`} className="underline hover:text-white break-all">
                    {COMPANY.email}
                  </a>{' '}
                  or ring{' '}
                  <a href={`tel:${PRIMARY_PHONE.dial}`} className="underline hover:text-white">
                    {PRIMARY_PHONE.display}
                  </a>
                  .
                </span>
              </div>
            ) : (
              /* Stacks on phones — the field was down to about twelve characters
                 beside the button at 375px. */
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <label htmlFor="footer-email" className="sr-only">
                    Your work email address
                  </label>
                  <Mail
                    className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id="footer-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    placeholder="Enter your work email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#071d36] border border-[#153b68] rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-zinc-400 focus:outline-none focus:border-sky-400"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-sky-400 hover:bg-sky-300 text-[#0b2545] px-5 py-3 rounded-xl font-bold text-xs transition cursor-pointer shadow flex-shrink-0"
                >
                  Send specs
                </button>
              </form>
            )}
          </div>

        </div>

        {/* Footer Navigation Columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-7 py-8 sm:py-10 text-xs [&>div]:min-w-0">
          <div>
            <h3 className="font-extrabold text-white uppercase tracking-wider mb-3">Products</h3>
            <ul className="space-y-0.5 text-[#93bfe8]">
              <li><a {...link('/products')} className="block py-1.5 hover:text-white transition">Floor Standing Standees</a></li>
              <li><a {...link('/products')} className="block py-1.5 hover:text-white transition">Self-Service Touch Kiosks</a></li>
              <li><a {...link('/products')} className="block py-1.5 hover:text-white transition">Active LED Video Walls</a></li>
              <li><a {...link('/products')} className="block py-1.5 hover:text-white transition">Digital Coffee &amp; Touch Tables</a></li>
              <li><a {...link('/products')} className="block py-1.5 hover:text-white transition">A-Type Digital Signage</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-extrabold text-white uppercase tracking-wider mb-3">Fabrication</h3>
            <ul className="space-y-0.5 text-[#93bfe8]">
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">CNC Laser Sheet Cutting</a></li>
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">CNC Press-Brake Bending</a></li>
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">Powder-Coated Finishing</a></li>
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">Custom Enclosure Design</a></li>
              <li><a {...link('/faq')} className="block py-1.5 hover:text-white transition">ISO 9001:2015 Standards</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-extrabold text-white uppercase tracking-wider mb-3">Company</h3>
            <ul className="space-y-0.5 text-[#93bfe8]">
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">Why Choose Us</a></li>
              <li><a {...link('/about')} className="block py-1.5 hover:text-white transition">How We Build</a></li>
              <li><a {...link('/installations')} className="block py-1.5 hover:text-white transition">Installation Gallery</a></li>
              <li><a {...link('/faq')} className="block py-1.5 hover:text-white transition">Warranty &amp; AMC</a></li>
              <li><a {...link('/faq')} className="block py-1.5 hover:text-white transition">Lead Times</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-extrabold text-white uppercase tracking-wider mb-3">Reach Us</h3>
            <ul className="space-y-0.5 text-[#93bfe8]">
              {PHONES.slice(0, 2).map((p) => (
                <li key={p.dial}>
                  <a href={`tel:${p.dial}`} className="block py-1.5 hover:text-white transition">
                    {p.display}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href={whatsappUrl(buildQuoteMessage({ from: 'footer' }))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 hover:text-white transition"
                >
                  WhatsApp {WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${COMPANY.email}`}
                  className="block py-1.5 break-all hover:text-white transition"
                >
                  {COMPANY.email}
                </a>
              </li>
              <li>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block py-1.5 hover:text-white transition"
                >
                  Peenya 2nd Stage, Bangalore
                </a>
              </li>
            </ul>

            {/*
              Social icons removed rather than left pointing at instagram.com and
              youtube.com, which were the template's placeholders — a footer icon
              that drops a visitor on a social network's home page reads as a
              broken site. Put the block back once the real handles are known.
            */}
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-[#0b2545] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#7da9d8] gap-3 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} {COMPANY.legalName}. All rights reserved.
          </div>
          <div>
            {COMPANY.brand} · {COMPANY.tagline} · Since {COMPANY.since}
          </div>
          <div>
            {/* A real page (privacy/index.html), served on its own like /app. */}
            <a href="/privacy" className="hover:underline">Privacy Policy</a>
          </div>
        </div>

      </div>
    </footer>
  );
};
