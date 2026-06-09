import React, { useState, useEffect } from 'react';
import { 
  Info, 
  CreditCard, 
  Monitor, 
  LayoutGrid, 
  Tv, 
  Mic, 
  Coffee, 
  Smartphone, 
  Settings, 
  ArrowUpRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface ServicesProps {
  onOpenQuote: (serviceTitle?: string) => void;
}

export default function Services({ onOpenQuote }: ServicesProps) {
  const servicesData = [
    { 
      title: "Interactive Information Kiosks", 
      icon: Info, 
      desc: "Smart touchscreen kiosk systems designed for customer interaction, navigation, information delivery, and automated assistance." 
    },
    { 
      title: "Self-Service Kiosks", 
      icon: CreditCard, 
      desc: "Enable customers to perform transactions, bookings, registrations, and payments with ease using fully customized self-service systems." 
    },
    { 
      title: "Digital Standee Displays", 
      icon: Monitor, 
      desc: "Modern digital advertising and promotional standees designed for retail stores, showrooms, events, and corporate environments." 
    },
    { 
      title: "Multi-Touch Interactive Tables", 
      icon: LayoutGrid, 
      desc: "Collaborative touch-enabled display tables ideal for presentations, educational institutions, exhibitions, and experience centers." 
    },
    { 
      title: "Active LED Video Walls", 
      icon: Tv, 
      desc: "High-impact LED display walls engineered for immersive advertising, command centers, conferences, and large-scale visual communication." 
    },
    { 
      title: "Digital Podiums", 
      icon: Mic, 
      desc: "Professional smart podium systems with integrated displays, microphones, and presentation support for auditoriums and conference halls." 
    },
    { 
      title: "Digital Coffee Tables", 
      icon: Coffee, 
      desc: "Interactive smart tables designed for luxury waiting areas, lobbies, hospitality spaces, and modern collaborative environments." 
    },
    { 
      title: "Tablet & Tab Kiosks", 
      icon: Smartphone, 
      desc: "Compact and cost-effective tablet kiosk solutions for visitor management, registrations, feedback collection, and information systems." 
    },
    { 
      title: "Custom Metal Fabrication", 
      icon: Settings, 
      desc: "Precision-engineered fabrication services including CNC laser cutting, CNC bending, metal finishing, structural fabrication, and customized enclosures." 
    }
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  // Responsive items visible logic
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getVisibleCount = () => {
    if (windowWidth >= 1024) return 3; // Desktop
    if (windowWidth >= 768) return 2;  // Tablet
    return 1;                          // Mobile
  };

  const visibleCount = getVisibleCount();
  const maxIndex = servicesData.length - visibleCount;

  const handleNext = () => {
    if (currentIndex < maxIndex) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setCurrentIndex(0); // Wrap around
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      setCurrentIndex(maxIndex); // Wrap back to end
    }
  };

  return (
    <section id="services" className="relative overflow-hidden py-20 bg-slate-950 text-white border-b border-slate-900 scroll-mt-24 select-none">
      
      {/* Decorative Wave Background inspired directly by the reference image */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" id="services-bg-decorations">
        {/* Top-Right Organic Overlapping Shapes reproducing the user-provided reference image */}
        <div className="absolute top-0 right-0 w-72 h-72 sm:w-[500px] sm:h-[500px] opacity-75 z-10" id="services-top-right-organic-shape">
          <svg viewBox="0 0 500 500" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="steel-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#517c96" stopOpacity="0.30" />
                <stop offset="50%" stopColor="#3d6075" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#223947" stopOpacity="0.60" />
              </linearGradient>
            </defs>
            {/* Filled organic overlapping blob on the top-right corner */}
            <path 
              d="M 180,0 C 150,90 220,100 290,170 C 340,220 250,260 330,330 C 370,360 360,430 500,440 V 0 Z" 
              fill="url(#steel-blue-grad)" 
            />
            {/* Sleek outer outline curve tracker exactly mimicking the style in the image */}
            <path 
              d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
              stroke="#517c96" 
              strokeWidth="5" 
              strokeLinecap="round" 
              strokeOpacity="0.7"
            />
            <path 
              d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
              stroke="#2e4d5e" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeOpacity="0.9"
            />
          </svg>
        </div>

        {/* Subtle background engineering grid to maintain tech context */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.04]" width="100%" height="100%">
          <defs>
            <pattern id="tech-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#tech-grid)" />
        </svg>

        {/* Dynamic Wave Shapes matching reference image (transparent curves, layered colors, gradients, and lines) */}
        <div className="absolute bottom-0 left-0 right-0 w-full h-96 opacity-60">
          <svg viewBox="0 0 1440 400" className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="wave-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.25" />
                <stop offset="40%" stopColor="#2563eb" stopOpacity="0.15" />
                <stop offset="80%" stopColor="#06b6d4" stopOpacity="0.05" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="wave-grad-2" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.1" />
                <stop offset="30%" stopColor="#0ea5e9" stopOpacity="0.6" />
                <stop offset="70%" stopColor="#06b6d4" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.1" />
              </linearGradient>
            </defs>

            {/* Solid Wave Layer 1 */}
            <path 
              d="M0,280 C360,180 720,380 1080,240 C1260,170 1360,220 1440,280 L1440,400 L0,400 Z" 
              fill="url(#wave-grad-1)" 
            />

            {/* Overlapping Translucent Wave Layer 2 */}
            <path 
              d="M0,320 C240,240 540,160 840,300 C1140,440 1320,320 1440,260 L1440,400 L0,400 Z" 
              fill="url(#wave-grad-2)" 
            />

            {/* Fine Wireframe Ribbon Lines matching the thin overlapping curves in the image */}
            <path 
              d="M0,300 C300,180 600,320 900,220 C1200,120 1320,290 1440,240" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="2" 
            />
            <path 
              d="M0,310 C300,195 600,335 900,235 C1200,135 1320,305 1440,255" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="1.2" 
              strokeOpacity="0.75"
            />
            <path 
              d="M0,320 C300,210 600,350 900,250 C1200,150 1320,320 1440,270" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="0.8" 
              strokeOpacity="0.5"
            />
            <path 
              d="M0,290 C300,165 600,305 900,205 C1200,105 1320,275 1440,225" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="0.8" 
              strokeOpacity="0.4"
            />

            {/* Additional cross wave for the dynamic overlay look */}
            <path 
              d="M0,240 C400,330 800,190 1200,310 C1320,346 1380,310 1440,280" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="1.5" 
              strokeOpacity="0.8"
            />
            <path 
              d="M0,246 C400,336 800,196 1200,316 C1320,352 1380,316 1440,286" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="1" 
              strokeOpacity="0.6"
            />
            <path 
              d="M0,252 C400,342 800,202 1200,322 C1320,358 1380,322 1440,292" 
              fill="none" 
              stroke="url(#line-grad)" 
              strokeWidth="0.6" 
              strokeOpacity="0.4"
            />
          </svg>
        </div>

        {/* Glowing floating light cyan/blue dust particles */}
        <div className="absolute top-1/3 left-1/4 w-2 h-2 rounded-full bg-cyan-400/40 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute top-2/3 left-1/2 w-1.5 h-1.5 rounded-full bg-sky-400/30 animate-pulse" style={{ animationDuration: '3s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-3 h-3 rounded-full bg-cyan-500/20 animate-pulse" style={{ animationDuration: '5s' }} />
        <div className="absolute top-1/4 right-1/3 w-2 h-2 rounded-full bg-sky-400/40 animate-ping" style={{ animationDuration: '6s' }} />
      </div>

      <div className="container mx-auto px-6 md:px-12 lg:px-24 relative z-10">
        
        {/* Compact Layout: Flex header containing text on the left, buttons on the right */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-12 gap-6" id="services-header">
          <div className="max-w-xl">
            <span className="text-accent font-semibold tracking-widest uppercase text-xs mb-3 block">
              // PRODUCTS & SERVICES
            </span>
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4 tracking-tight">
              Our Products & <br className="hidden sm:inline" />
              <span className="text-accent italic font-light">Services</span>
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed text-left">
              SignageOS delivers robust interactive display systems and high-precision sheet metal enclosures. All components are assembled, wired, and tested in under absolute rigorous standards.
            </p>
          </div>
          
          <div className="flex items-center gap-4 shrink-0 mt-2 lg:mt-0">
            <button 
              onClick={() => onOpenQuote()}
              className="px-6 py-2.5 bg-accent text-primary text-xs font-bold uppercase tracking-wider rounded-full hover:bg-accent-hover transition-all flex items-center gap-2 hover:scale-105 active:scale-95 duration-200 cursor-pointer"
              id="services-header-cta"
            >
              Request Custom Quotation <ArrowUpRight className="w-4 h-4" />
            </button>
            
            {/* Carousel navigation buttons in header to save vertical space */}
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrev}
                className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                id="btn-services-prev"
                aria-label="Previous service slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={handleNext}
                className="w-10 h-10 rounded-full border border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                id="btn-services-next"
                aria-label="Next service slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Viewport Container */}
        <div className="relative overflow-hidden w-full pb-4" id="services-carousel-viewport">
          <div 
            className="flex gap-6 transition-transform duration-500 ease-out"
            style={{ 
              transform: `translateX(-${currentIndex * (100 / visibleCount + (6 * (visibleCount - 1)) / (visibleCount * 100)) }%)`
            }}
          >
            {servicesData.map((service, i) => {
              const IconComponent = service.icon;
              return (
                <div 
                  key={i} 
                  className="group p-6 rounded-2xl bg-slate-900/50 border border-slate-900 hover:border-accent/40 hover:bg-slate-900 transition-all duration-300 flex flex-col justify-between shrink-0"
                  style={{ 
                    width: `calc(${100 / visibleCount}% - ${(24 * (visibleCount - 1)) / visibleCount}px)` 
                  }}
                  id={`service-card-${i}`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center mb-5 border border-accent/10 group-hover:bg-accent group-hover:text-primary transition-colors duration-300">
                      <IconComponent className="w-5 h-5 text-accent group-hover:text-primary" />
                    </div>
                    <h4 className="text-base sm:text-lg font-bold text-white mb-2.5 group-hover:text-accent transition-colors leading-tight text-left">
                      {service.title}
                    </h4>
                    <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-4 text-left line-clamp-3">
                      {service.desc}
                    </p>
                  </div>

                  <button 
                    onClick={() => onOpenQuote(service.title)}
                    className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-accent uppercase tracking-widest group-hover:text-white transition-colors cursor-pointer text-left self-start mt-3"
                    id={`service-card-cta-${i}`}
                  >
                    Configure Hardware <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Dynamic Navigation Indicator Dots */}
        <div className="flex justify-center gap-2 mt-4" id="services-carousel-indicators">
          {Array.from({ length: servicesData.length - visibleCount + 1 }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
                idx === currentIndex 
                  ? "bg-accent w-6" 
                  : "bg-slate-800 hover:bg-slate-700"
              }`}
              aria-label={`Go to service slide ${idx + 1}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
