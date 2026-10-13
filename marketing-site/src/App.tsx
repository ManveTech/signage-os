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
import { EnquiryModal, EnquiryPrefill } from './components/EnquiryModal';
import { buildQuoteMessage, openWhatsApp, QuoteContext } from './data/enquiry';
import { CheckCircle } from 'lucide-react';

export default function App() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [enquiry, setEnquiry] = useState<{ open: boolean; prefill?: EnquiryPrefill }>({
    open: false
  });

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
  const handleEnquire = (prefill?: EnquiryPrefill) => {
    setEnquiry({ open: true, prefill });
  };

  const handleQuote = (ctx: QuoteContext) => {
    openWhatsApp(buildQuoteMessage(ctx));
    showToast('Opening WhatsApp with your product details…');
  };

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

      {/* The enquiry form every "Enquire" button opens */}
      <EnquiryModal
        open={enquiry.open}
        prefill={enquiry.prefill}
        onClose={() => setEnquiry({ open: false })}
      />

    </div>
  );
}
