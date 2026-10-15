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
import { PageHeader } from './components/PageHeader';
import { PageNextLinks } from './components/PageNextLinks';
import { ROUTES, routeFor } from './data/routes';
import { buildQuoteMessage, openWhatsApp, QuoteContext } from './data/enquiry';
import { CheckCircle } from 'lucide-react';

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
   * Per-route title, description and canonical, from data/routes.ts.
   *
   * index.html carries the homepage's tags; without this every route would
   * inherit them, and a crawler seeing six URLs all claiming to be the
   * homepage drops five of them as duplicates.
   */
  useEffect(() => {
    const r = routeFor(path);
    const canonical = `https://bluestardigitech.com${r.path === '/' ? '/' : r.path}`;
    document.title = r.title;
    const set = (selector: string, attr: string, value: string) => {
      const el = document.head.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };
    set('meta[name="description"]', 'content', r.description);
    set('link[rel="canonical"]', 'href', canonical);
    set('meta[property="og:title"]', 'content', r.title);
    set('meta[property="og:description"]', 'content', r.description);
    set('meta[property="og:url"]', 'content', canonical);
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

  /*
   * One section per page, rather than every section stacked on "/" behind
   * #fragment links. Fragments are discarded by search engines, so the whole
   * site was a single indexable URL — see SEO.md. Nothing here is duplicated
   * between pages: the homepage carries the hero and a grid linking onward,
   * and each section lives at exactly one address.
   */
  const quoteAction = (label: string, context: string) => ({
    label,
    onClick: () => handleEnquire({ context })
  });

  /*
   * One section per page. Each inner page opens with a PageHeader — breadcrumb,
   * h1 and a sentence of context — and closes with links onward, so arriving
   * from a search result does not feel like landing on an orphaned fragment.
   */
  const page = () => {
    switch (path) {
      case '/products':
        return (
          <>
            <PageHeader
              path="/products"
              intro="Eight lines, 32&quot; to 65&quot;, fabricated in-house in Peenya. Pick a size and a finish and ask us for a price — the configuration comes with the message."
              action={quoteAction('Request a quote', 'Tell us which product and we’ll come back with a price.')}
              onNavigate={goTo}
            />
            <ProductShowcase onRequestQuote={handleQuote} showHeading={false} />
            <PageNextLinks currentPath="/products" onNavigate={goTo} />
          </>
        );

      case '/installations':
        return (
          <>
            <PageHeader
              path="/installations"
              intro="Standees, kiosks, touch tables and LED walls photographed where they ended up — retail floors, hospital lobbies, restaurant entrances, and our own factory before dispatch."
              onNavigate={goTo}
            />
            <InstallationGallery onRequestQuote={handleQuote} />
            <PageNextLinks currentPath="/installations" onNavigate={goTo} />
          </>
        );

      case '/about':
        return (
          <>
            <PageHeader
              path="/about"
              heading="About"
              intro="ISO 9001:2015 certified precision sheet metal works in Peenya, Bangalore. Cutting, bending, coating, assembly and commissioning all happen under one roof — so nothing gets lost between the metal and the screen."
              onNavigate={goTo}
            />
            <WhyChooseUs showHeading={false} />
            <ProcessSection
              onEnquire={() =>
                handleEnquire({
                  context:
                    'Send us a drawing or a screen size — we’ll come back with a quote and a lead time.'
                })
              }
            />
            <PageNextLinks currentPath="/about" onNavigate={goTo} />
          </>
        );

      case '/faq':
        return (
          <>
            <PageHeader
              path="/faq"
              heading="FAQ"
              intro="Lead times, warranty and AMC, panel sizes, custom enclosures and commissioning — the things we are asked before every order."
              action={quoteAction('Ask us something else', 'Ask our engineering team anything — specs, mounting, warranty, AMC.')}
              onNavigate={goTo}
            />
            <FaqSection
              showHeading={false}
              onEnquire={() =>
                handleEnquire({
                  context: 'Ask our engineering team anything — specs, mounting, warranty, AMC.'
                })
              }
            />
            <PageNextLinks currentPath="/faq" onNavigate={goTo} />
          </>
        );

      /*
       * Contact has no section of its own: the footer has always carried the
       * numbers, the address and the map link, and it renders on every page.
       * Writing a second set here would just give them somewhere to drift from.
       */
      case '/contact':
        return (
          <>
            <PageHeader
              path="/contact"
              heading="Contact"
              intro="Send us a drawing, a screen size, or just a rough idea. Everything below reaches the people who actually build the units — no call centre in between."
              action={quoteAction('Send an enquiry', 'Tell us what you need and we’ll come back with a quote.')}
              onNavigate={goTo}
            />
            <PageNextLinks currentPath="/contact" onNavigate={goTo} />
          </>
        );

      /*
       * The homepage carries every section, as it did before the split. The
       * dedicated pages above are the addressable copy of each one — the two
       * coexist deliberately: this page is the scrollable overview, those are
       * what a search result points at.
       */
      default:
        return (
          <>
            <HeroSection
              onEnquire={handleEnquire}
              onRequestQuote={handleQuote}
              onScrollToProducts={() => handleScrollTo('products')}
            />
            <ClientLogos />
            <CapabilityBanner />
            <InstallationGallery onRequestQuote={handleQuote} />
            <ProductShowcase onRequestQuote={handleQuote} />
            <WhyChooseUs />
            <ProcessSection
              onEnquire={() =>
                handleEnquire({
                  context:
                    'Send us a drawing or a screen size — we’ll come back with a quote and a lead time.'
                })
              }
            />
            <FaqSection
              onEnquire={() =>
                handleEnquire({
                  context: 'Ask our engineering team anything — specs, mounting, warranty, AMC.'
                })
              }
            />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#d5e5f7] text-[#0b2545] selection:bg-[#0b2545] selection:text-white flex flex-col justify-between">

      <AnnouncementBar />

      <Navbar
        currentPath={path}
        onNavigate={goTo}
        onEnquireClick={() => handleEnquire({ context: 'Tell us what you need and we’ll come back with a quote.' })}
      />

      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0b2545] text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#1b4373] flex items-center gap-3 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle className="w-5 h-5 text-sky-300 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      <main>{page()}</main>

      <Footer onEnquire={handleEnquire} onNavigate={goTo} />

    </div>
  );
}
