import React, { useState, useEffect } from 'react';
import { AnnouncementBar, Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ClientLogos } from './components/ClientLogos';
import { CapabilityBanner } from './components/CapabilityBanner';
import { InstallationGallery } from './components/InstallationGallery';
import { ProductShowcase } from './components/ProductShowcase';
import { WhyChooseUs } from './components/WhyChooseUs';
import { ProcessSection } from './components/ProcessSection';
// import { ReviewsSection } from './components/ReviewsSection'; // see note below
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { EnquiryPage, EnquiryPrefill } from './components/EnquiryPage';
import { buildQuoteMessage, openWhatsApp, QuoteContext } from './data/enquiry';
import { CheckCircle } from 'lucide-react';

/**
 * Where the enquiry form lives. A real path rather than a hash, so it can be
 * linked and shared; nginx.conf.template serves index.html for it.
 */
const ENQUIRE_PATH = '/enquire';

export default function App() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  /*
   * Two routes is not worth a router dependency, so this is the whole of it:
   * the current path in state, pushState to navigate, and popstate to follow
   * the back button. Anything that is not /enquire is the marketing site.
   */
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/');
  const [prefill, setPrefill] = useState<EnquiryPrefill | undefined>();

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /*
   * Per-route title, description and canonical.
   *
   * index.html carries the homepage's tags, and /enquire was inheriting them
   * wholesale — same title, same description, same canonical pointing at "/".
   * A crawler reading that sees two URLs claiming to be the homepage, which is
   * how a page gets dropped as a duplicate. There is only one other route, so
   * this is a lookup rather than a helmet library.
   */
  useEffect(() => {
    const meta: Record<string, { title: string; description: string; canonical: string }> = {
      [ENQUIRE_PATH]: {
        title: 'Request a Quote | Bluestar Digitech — Digital Signage & Kiosks',
        description:
          'Tell us the product, screen size and site and we will come back with a quote. ISO 9001:2015 certified digital standee, touch kiosk and LED video wall manufacturer in Peenya, Bangalore.',
        canonical: 'https://bluestardigitech.com/enquire'
      },
      '/': {
        title: 'Bluestar Digitech | Digital Signage, Touch Kiosks & LED Video Walls',
        description:
          'Bluestar Digitech is an ISO 9001:2015 certified manufacturer of digital standees, interactive touch kiosks, touch tables, digital podiums and LED video walls, fabricated in-house in Peenya, Bangalore.',
        canonical: 'https://bluestardigitech.com/'
      }
    };
    const m = meta[path] ?? meta['/'];
    document.title = m.title;
    const setTag = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    setTag('meta[name="description"]', 'content', m.description);
    setTag('link[rel="canonical"]', 'href', m.canonical);
    setTag('meta[property="og:title"]', 'content', m.title);
    setTag('meta[property="og:description"]', 'content', m.description);
    setTag('meta[property="og:url"]', 'content', m.canonical);
  }, [path]);

  const goTo = (next: string) => {
    if (window.location.pathname !== next) window.history.pushState({}, '', next);
    setPath(next.replace(/\/+$/, '') || '/');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleScrollTo = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  /*
   * Two routes out of the page, instead of every button scrolling to the footer:
   *
   *   "Enquire"         → the form, where we can ask for site, quantity and
   *                       drawings in one go.
   *   "Request a quote" → straight to WhatsApp, already describing the product
   *                       that was on screen. Someone asking a price should not
   *                       have to fill in a form to ask it.
   */
  const handleEnquire = (next?: EnquiryPrefill) => {
    setPrefill(next);
    goTo(ENQUIRE_PATH);
  };

  const handleQuote = (ctx: QuoteContext) => {
    openWhatsApp(buildQuoteMessage(ctx));
    showToast('Opening WhatsApp with your product details…');
  };

  if (path === ENQUIRE_PATH) {
    return <EnquiryPage prefill={prefill} onBack={() => goTo('/')} />;
  }

  return (
    <div className="min-h-screen bg-[#d5e5f7] text-[#0b2545] selection:bg-[#0b2545] selection:text-white flex flex-col justify-between">
      
      {/* Top Notification Announcement Bar */}
      <AnnouncementBar />

      {/* Top Navbar */}
      <Navbar
        onScrollToSection={handleScrollTo}
        onEnquireClick={() => handleEnquire({ context: 'Tell us what you need and we’ll come back with a quote.' })}
      />

      {/* Floating Quick Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b2545] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#1b4373] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5 text-sky-300 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Hero */}
      <main>
        <HeroSection
          onEnquire={handleEnquire}
          onRequestQuote={handleQuote}
          onScrollToProducts={() => handleScrollTo('products')}
        />

        {/* Who we have supplied — real client marks, pending written sign-off */}
        <ClientLogos />

        {/* Arched ribbon marquee + capability headline */}
        <CapabilityBanner />

        {/* Installation gallery */}
        <InstallationGallery onRequestQuote={handleQuote} />

        {/* Product range + quote enquiry */}
        <ProductShowcase onRequestQuote={handleQuote} />

        {/* Why choose us + spec comparison across the range */}
        <WhyChooseUs />

        {/* Design → fabrication → commissioning, walked through on a timer */}
        <ProcessSection
          onEnquire={() =>
            handleEnquire({
              context:
                'Send us a drawing or a screen size — we’ll come back with a quote and a lead time.'
            })
          }
        />

        {/*
          Testimonials stay off until the client supplies real, attributable
          quotes — the ones in data/testimonials.ts were written for the template.
          Re-enabling means uncommenting the import above, this line, the nav
          item in Navbar.tsx and the footer link.
        */}
        {/* <ReviewsSection onEnquire={handleEnquire} /> */}

        {/* Frequently Asked Questions */}
        <FaqSection
          onEnquire={() =>
            handleEnquire({
              context: 'Ask our engineering team anything — specs, mounting, warranty, AMC.'
            })
          }
        />
      </main>

      {/* Footer */}
      <Footer onEnquire={handleEnquire} />

    </div>
  );
}
