import React, { useState, useEffect } from 'react';
import {
  ArrowUpRight,
  ChevronRight,
  HelpCircle,
  Mail,
  MapPin,
  Menu,
  Monitor,
  Phone,
  RotateCw,
  ShieldCheck,
  Truck,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PHONES } from '../data/company';
import { NAV_ROUTES } from '../data/routes';

interface NavbarProps {
  /** Current pathname, so the active page can be marked. */
  currentPath: string;
  onNavigate: (path: string) => void;
  onEnquireClick: () => void;
}

/**
 * The strip above the nav. Everything here is picked so that nothing is ever
 * clipped: the long facility line and the extra facts only appear once there is
 * room for them, rather than being truncated or pushed off the right edge.
 */
export const AnnouncementBar: React.FC = () => {
  return (
    <div className="bg-[#0b2545] text-[#e0f2fe] text-[11px] sm:text-xs font-semibold py-2 px-3 sm:px-4 relative z-50 border-b border-[#163f70]">
      {/* justify-between at every width: one item hard left, one hard right.
          Centred, the two read as a single clump floating in the middle. */}
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">

        {/*
          Two items, not five. This used to also carry the facility
          description, "Made in India" and the installation count — and the
          hero directly below already states the ISO certification, Peenya,
          Bangalore and "4K+ installations across India", so the strip was
          mostly repeating the thing it sits on top of.

          What is left is the credential, which reads as a badge rather than as
          a sentence, and the one commercial fact stated nowhere else on the
          page. Dispatch time was previously hidden below 1024px, so the only
          genuinely new information here was invisible to phones and tablets.
        */}
        {/* On a phone the hero no longer carries the installs figure, so it
            takes this slot; the certification still appears in the hero's own
            footer row and in the page footer. From sm up, both have room. */}
        <span className="sm:hidden inline-flex items-center gap-1 bg-[#0284c7] text-white px-1.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider shadow-sm flex-shrink-0">
          <MapPin className="w-2.5 h-2.5 text-sky-200" aria-hidden="true" /> 4K+ installs
        </span>

        <span className="hidden sm:inline-flex items-center gap-1 bg-[#0284c7] text-white px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider shadow-sm flex-shrink-0">
          <ShieldCheck className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-sky-200" aria-hidden="true" /> ISO 9001:2015
        </span>

        <span className="text-[#bae6fd] flex-shrink-0 inline-flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5" aria-hidden="true" />
          5–7 day dispatch
        </span>

      </div>
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({
  currentPath,
  onNavigate,
  onEnquireClick
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll while the menu is open, and let Escape close it — the
  // backdrop tap was the only way out before.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', onKey);
    };
  }, [mobileMenuOpen]);

  /*
   * A phone menu is a list of destinations, nothing more. Each row used to
   * carry an icon, an all-caps title, a coloured badge ("8 Models",
   * "Under One Roof"…) and a two-line description — five things per row, six
   * rows, which read as a wall rather than a menu. Names and icons only now.
   *
   * The destinations themselves come from the routes table; this just pairs
   * each path with an icon, so a new route cannot silently miss the menu.
   */
  const NAV_ICON: Record<string, typeof Monitor> = {
    '/products': Monitor,
    '/installations': MapPin,
    '/about': ShieldCheck,
    '/faq': HelpCircle,
    '/contact': Mail
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-[#d5e5f7]/95 backdrop-blur-md py-1.5 sm:py-2 shadow-sm border-b border-[#0b2545]/10'
          : 'bg-transparent py-2 sm:py-3'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
        
        {/*
          Left: the brand mark, always visible. It used to fade in only once the
          hero had scrolled away, which left the whole left half of the bar empty
          on first paint — on a phone that reads as a broken header rather than a
          restrained one. A mark in the sticky bar and a lockup in the hero is
          the normal arrangement.
        */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Bluestar Digitech — back to top"
          className="flex-shrink-0 flex items-center py-1.5 pr-2 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/30"
          id="nav-brand-home"
        >
          <img
            src="/brand/bluestar-logo.webp"
            alt="Bluestar Digitech"
            width={686}
            height={219}
            /* Was h-5 (20px) on a phone, which left the brand mark unreadable
               and 46% of the header empty beside it. */
            className="h-7 sm:h-8 md:h-9 w-auto"
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </button>

        {/* Center: Nav Pills (Desktop)
            Real <a href> elements, not buttons — these are the internal links
            a crawler follows to find the other pages. The click handler only
            upgrades a plain left click into a pushState navigation; modified
            clicks fall through to the browser. */}
        <nav className="hidden md:flex items-center gap-1 bg-[#bddcf8]/60 backdrop-blur-md p-1 rounded-full border border-white/50 shadow-inner">
          {NAV_ROUTES.map((route) => {
            const active = currentPath === route.path;
            return (
              <a
                key={route.path}
                href={route.path}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  onNavigate(route.path);
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  active ? 'bg-white text-[#0b2545] shadow-sm' : 'text-[#0b2545] hover:bg-white'
                }`}
              >
                {route.label}
              </a>
            );
          })}
        </nav>

        {/* Right: Enquiry CTA & Mobile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Enquiry Pill Button */}
          <button
            onClick={onEnquireClick}
            className="group flex items-center gap-1 bg-[#0b2545] text-white hover:bg-[#153b68] px-3 sm:px-4 py-1.5 rounded-full font-bold text-xs transition-all duration-200 shadow-sm hover:shadow cursor-pointer"
            id="nav-btn-enquire"
          >
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span>Enquire</span>
          </button>

          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              mobileMenuOpen 
                ? 'bg-[#0b2545] text-white rotate-90 shadow-md' 
                : 'bg-white/85 text-[#0b2545] hover:bg-white shadow-sm border border-white/80'
            }`}
            id="nav-mobile-toggle"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Responsive Animated Dropdown Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-[#07162c]/50 backdrop-blur-sm z-40 md:hidden"
            />

            {/* Floating Dropdown Card */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-full inset-x-3 sm:inset-x-6 z-50 mt-2 md:hidden"
            >
              <div className="bg-[#e4effc]/97 backdrop-blur-xl border border-white/90 rounded-3xl shadow-2xl p-4 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">

                {/* Header — a label, not a second brand lockup. */}
                <div className="flex items-center justify-between pb-3 border-b border-[#0b2545]/10">
                  <span className="text-xs font-black tracking-[0.18em] text-[#18487d] uppercase">
                    Menu
                  </span>
                  <a
                    href={`tel:${PHONES[0].dial}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0284c7] hover:underline py-1"
                  >
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    {PHONES[0].display}
                  </a>
                </div>

                {/* Destinations. Name + icon + chevron, nothing else. */}
                <nav className="flex flex-col">
                  {NAV_ROUTES.map((route) => {
                    const IconComponent = NAV_ICON[route.path] ?? Monitor;
                    return (
                      <a
                        key={route.path}
                        href={route.path}
                        aria-current={currentPath === route.path ? 'page' : undefined}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                          e.preventDefault();
                          onNavigate(route.path);
                          setMobileMenuOpen(false);
                        }}
                        className="group w-full flex items-center gap-3.5 py-3.5 border-b border-[#0b2545]/8 last:border-0 text-left cursor-pointer"
                      >
                        <IconComponent
                          className="w-5 h-5 text-[#0284c7] flex-shrink-0"
                          strokeWidth={1.8}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-base font-bold text-[#0b2545] group-hover:text-[#0284c7] transition-colors">
                          {route.label}
                        </span>
                        <ChevronRight
                          className="w-4 h-4 text-[#0b2545]/30 group-hover:text-[#0284c7] transition-colors flex-shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    );
                  })}
                </nav>

                <button
                  onClick={() => {
                    onEnquireClick();
                    setMobileMenuOpen(false);
                  }}
                  className="group w-full inline-flex items-center justify-center gap-2 bg-[#0b2545] hover:bg-[#153b68] text-white px-4 py-3.5 rounded-2xl font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <span>Enquire Now</span>
                  <ArrowUpRight className="w-4 h-4 text-sky-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </button>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
};

