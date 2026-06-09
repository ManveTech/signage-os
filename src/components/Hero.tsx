import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import heroImg1 from '../assets/T2-1024x576.jpg';
import heroImg2 from '../assets/T3-1024x576.jpg';
import heroImg3 from '../assets/T4-1024x576.jpg';

interface HeroProps {
  onOpenQuote: () => void;
}

interface SlideItem {
  tagline: string;
  titlePart1: string;
  highlightText: string;
  titlePart2: string;
  desc: string;
  imageUrl: string;
}

export default function Hero({ onOpenQuote }: HeroProps) {
  const slides: SlideItem[] = [
    {
      tagline: "SIGNAGEOS TECHNOLOGIES — INTERACTIVE SOLUTIONS",
      titlePart1: "Spectacular ",
      highlightText: "Digital Kiosks ",
      titlePart2: "on the market",
      desc: "SignageOS delivers premium, ultra-durable self-service terminals and custom enclosures.",
      imageUrl: heroImg1
    },
    {
      tagline: "CNC PRECISION & LASER CUTTING",
      titlePart1: "High-Performance ",
      highlightText: "Metal Fabrication ",
      titlePart2: "engineered for scale",
      desc: "Precision engineering, custom CNC bending, and robust assembly of state-of-the-art server and kiosk enclosures.",
      imageUrl: heroImg2
    },
    {
      tagline: "ACTIVE DISPLAY SOLUTIONS",
      titlePart1: "Immersive ",
      highlightText: "LED Video Walls ",
      titlePart2: "and visual platforms",
      desc: "High-impact visual communication screens designed for corporate lobbies, hospitals, and command operations.",
      imageUrl: heroImg3
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right

  const handleNext = useCallback(() => {
    setDirection(1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setCurrentSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }, [slides.length]);

  // Autoplay support
  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 6500);
    return () => clearInterval(timer);
  }, [handleNext]);

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0
    })
  };

  const handleScrollToServices = (e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById('services');
    if (element) {
      const offset = 80;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section 
      id="hero"
      className="relative min-h-[85vh] sm:min-h-[75vh] md:min-h-[82vh] lg:min-h-screen flex items-center pt-20 sm:pt-24 pb-14 sm:pb-16 overflow-hidden bg-[#0a1522]"
    >
      {/* Subtle top screen shadow vignette to contrast with the floating nav notch */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0a1522] via-[#0a1522]/45 to-transparent z-10 pointer-events-none" />

      {/* Slide Carousel Background and Content */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.5 }
            }}
            className="absolute inset-0 w-full h-full"
          >
            {/* Background image layer */}
            <div className="absolute inset-0 bg-[#0a1522]">
              <img 
                src={slides[currentSlide].imageUrl} 
                alt="Industrial Metal Fabrication & Kiosk Assembly" 
                className="w-full h-full object-cover select-none filter brightness-[0.70] contrast-[1.05]"
                referrerPolicy="no-referrer"
              />
              {/* Radial gradient overlay with vivid navy/sky-blue translucent overlays */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a1522]/80 via-[#0a1522]/45 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0a1522]/75 via-[#0b1b2d]/20 to-[#0a1522]/25" />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Beautiful ambient blue/sky lighting points to make the background lighter and highly professional */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#38bdf8]/12 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#0ea5e9]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Slide Content Container */}
      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 relative z-10 w-full animate-fadeIn">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.4 }}
            className="max-w-3xl mx-auto flex flex-col items-center sm:items-start text-center sm:text-left"
          >
            {/* Tagline */}
            <span className="text-accent font-black tracking-[0.2em] uppercase text-[9px] sm:text-xs mb-2 sm:mb-3 block text-center sm:text-left" id="hero-tagline">
              // {slides[currentSlide].tagline}
            </span>

            {/* Heading highlighting beautiful corporate colors */}
            <h1 className="text-white text-xl xs:text-2xl sm:text-4xl md:text-5xl lg:text-5.5xl font-black tracking-tight mb-3 sm:mb-4 leading-tight select-none text-center sm:text-left" id="hero-title">
              {slides[currentSlide].titlePart1}
              <span className="text-accent">
                {slides[currentSlide].highlightText}
              </span>
              {slides[currentSlide].titlePart2}
            </h1>

            {/* Description */}
            <p className="text-slate-300 text-[11px] sm:text-sm md:text-regular mb-6 sm:mb-8 max-w-xl leading-relaxed text-center sm:text-left font-medium mx-auto sm:mx-0">
              {slides[currentSlide].desc}
            </p>
            
            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2.5 sm:gap-4 items-center justify-center sm:justify-start" id="hero-actions">
              <button 
                onClick={onOpenQuote}
                className="btn-primary hover:scale-[1.03] active:scale-[0.98] duration-200 cursor-pointer text-[10px] sm:text-sm font-bold tracking-wide bg-accent text-primary hover:bg-accent-hover px-4.5 py-2.5 sm:px-6 sm:py-3"
                id="hero-primary-cta"
              >
                Get Consultation <ArrowUpRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </button>
              <a 
                href="#services" 
                onClick={handleScrollToServices}
                className="btn-outline hover:bg-white/10 hover:border-white hover:scale-[1.03] active:scale-[0.98] duration-200 cursor-pointer text-[10px] sm:text-sm font-bold px-4.5 py-2.5 sm:px-6 sm:py-3 rounded-full border border-white/20 text-white flex items-center gap-1.5"
                id="hero-secondary-cta"
              >
                Explore Solutions <ArrowUpRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
              </a>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Left Navigation Arrow - Smaller on mobile */}
      <button
        onClick={handlePrev}
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-slate-900/30 hover:bg-slate-900/60 border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs select-none active:scale-95 hidden xs:flex"
        id="carousel-prev-btn"
        aria-label="Previous Slide"
      >
        <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Right Navigation Arrow - Smaller on mobile */}
      <button
        onClick={handleNext}
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-30 w-8 h-8 sm:w-11 sm:h-11 rounded-full bg-slate-900/30 hover:bg-slate-900/60 border border-white/10 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs select-none active:scale-95 hidden xs:flex"
        id="carousel-next-btn"
        aria-label="Next Slide"
      >
        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>

      {/* Slide Index Dot Indicators */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex gap-2 sm:gap-2.5" id="carousel-indicator-dots">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => {
              setDirection(idx > currentSlide ? 1 : -1);
              setCurrentSlide(idx);
            }}
            className={`w-2 h-2 rounded-full transition-all duration-300 cursor-pointer ${
              idx === currentSlide 
                ? "bg-accent w-5" 
                : "bg-white/25 hover:bg-white/40"
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
