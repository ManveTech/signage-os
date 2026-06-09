import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Testimonials() {
  const testimonials = [
    {
      quote: "Through collaboration with SignageOS, we deployed 50+ smart self-service interactive kiosks across our regional hubs with zero hardware failures. The CNC sheet metal design is clean and robust.",
      author: "Doug Arnold",
      role: "Operations Director",
      photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400&h=400"
    },
    {
      quote: "The precision of their laser cutting and bending is world-class. From initial prototyping to bulk fabrication of our terminal enclosures, their standards have been absolutely stellar.",
      author: "Rajesh Mehra",
      role: "Project Director, Aerospace Systems",
      photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400&h=400"
    },
    {
      quote: "Our experience tables and digital podiums look stunning. SignageOS did a fantastic job with fabrication, integrated wiring, and custom multi-touch display mounts. Our interactive gallery is proof of their craftsmanship.",
      author: "Sarah Jenkins",
      role: "Digital Experience Lead",
      photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400&h=400"
    }
  ];

  const [activeIndex, setActiveIndex] = useState(0);

  const handlePrev = () => {
    setActiveIndex((prev) => (prev === 0 ? testimonials.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev === testimonials.length - 1 ? 0 : prev + 1));
  };

  return (
    <section id="testimonials" className="py-24 bg-slate-50 border-b border-slate-200 scroll-mt-24 select-none relative overflow-hidden">
      
      {/* Decorative dynamic wave subtle light path background lines */}
      <div className="absolute inset-x-0 bottom-0 pointer-events-none opacity-20 h-64 z-0">
        <svg viewBox="0 0 1440 200" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,150 C360,70 720,200 1080,120 C1260,80 1360,110 1440,150 L1440,200 L0,200 Z" fill="rgba(249, 115, 22, 0.05)" />
        </svg>
      </div>

      <div className="container mx-auto px-6 max-w-7xl relative z-10">
        
        {/* Header Block mimicking the reference image precisely */}
        <div className="text-center mb-16" id="testimonials-header">
          {/* Subtle Orange top hyphen */}
          <div className="w-[18px] h-[3.5px] bg-[#f97316] rounded-full mx-auto mb-4" />
          <h3 className="text-3xl sm:text-[40px] font-extrabold text-slate-800 tracking-tight leading-none mb-3">
            Testimonials
          </h3>
          <p className="text-slate-400 font-medium text-sm sm:text-base leading-relaxed">
            See what people are saying.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-16" id="testimonial-slider-container">
          
          {/* Slider Left Arrow Button (Hidden on Mobile, Visible on Desktop) */}
          <button 
            onClick={handlePrev}
            className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#f97316]/95 hover:bg-[#ea580c] text-white items-center justify-center shadow-[0_6px_20px_rgba(249,115,22,0.35)] transition-all hover:scale-105 active:scale-95 duration-200 z-20 cursor-pointer"
            id="testimonial-btn-prev"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Slider Right Arrow Button (Hidden on Mobile, Visible on Desktop) */}
          <button 
            onClick={handleNext}
            className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#f97316]/95 hover:bg-[#ea580c] text-white items-center justify-center shadow-[0_6px_20px_rgba(249,115,22,0.35)] transition-all hover:scale-105 active:scale-95 duration-200 z-20 cursor-pointer"
            id="testimonial-btn-next"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Core Content Card */}
          <div 
            className="flex flex-col md:flex-row items-center gap-12 sm:gap-14 lg:gap-20 py-8 min-h-[380px] sm:min-h-[340px] md:min-h-[280px]"
            id="testimonial-active-envelope"
          >
            {/* Visual Portrait Detail Assembly */}
            <div className="relative flex-shrink-0 z-10" id="testimonial-portrait-assembly">
              {/* Back overlapping light orange circle geometries */}
              <div 
                className="absolute inset-0 w-[170px] h-[170px] sm:w-[220px] sm:h-[220px] rounded-full bg-[#fddbc3]/40 -translate-x-6 -translate-y-6 z-0" 
              />
              <div 
                className="absolute inset-0 w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] rounded-full bg-[#f97316]/85 -translate-x-3 -translate-y-2 z-0 shadow-lg" 
              />
              
              {/* Profile Image Portrait wrapped inside clean bordered cutout */}
              <div className="relative w-[150px] h-[150px] sm:w-[180px] sm:h-[180px] rounded-full overflow-hidden border-4 border-white bg-slate-100 z-10 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
                <img 
                  src={testimonials[activeIndex].photo} 
                  alt={testimonials[activeIndex].author} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover select-none"
                  id={`testimonial-active-avatar-${activeIndex}`}
                />
              </div>
            </div>

            {/* Testimonial Quote & Identity Segment */}
            <div className="flex-grow text-center md:text-left flex flex-col justify-center" id="testimonial-text-segment">
              <blockquote className="text-slate-500 italic text-base sm:text-[18px] md:text-[19px] leading-relaxed mb-6 font-medium text-left">
                “{testimonials[activeIndex].quote}”
              </blockquote>
              
              <div className="flex flex-col text-left">
                <h4 className="text-2xl sm:text-[26px] font-extrabold text-[#f97316] leading-none mb-1">
                  {testimonials[activeIndex].author}
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 font-bold uppercase tracking-wider mt-1.5">
                  {testimonials[activeIndex].role}
                </p>
              </div>
            </div>

          </div>

          {/* Mobile navigation controls (Visible on mobile, hidden on desktop) */}
          <div className="flex sm:hidden justify-center items-center gap-4 mt-8 lg:mt-10" id="testimonial-mobile-controls">
            <button 
              onClick={handlePrev}
              className="w-10 h-10 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-md active:scale-95 duration-150 cursor-pointer"
              aria-label="Previous testimonial"
            >
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <div className="flex gap-2 mx-1">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-[4px] rounded-full transition-all duration-300 cursor-pointer ${
                    idx === activeIndex 
                      ? "bg-[#f97316] w-6" 
                      : "bg-slate-200 w-3"
                  }`}
                  aria-label={`Go to testimonial slide ${idx + 1}`}
                />
              ))}
            </div>
            <button 
              onClick={handleNext}
              className="w-10 h-10 rounded-full bg-[#f97316] text-white flex items-center justify-center shadow-md active:scale-95 duration-150 cursor-pointer"
              aria-label="Next testimonial"
            >
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>

          {/* Navigation Indicators Pills (Visible on Desktop only) */}
          <div className="hidden sm:flex justify-center gap-2 mt-8 sm:mt-4" id="testimonial-pills">
            {testimonials.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={`h-[4px] rounded-full transition-all duration-300 cursor-pointer ${
                  idx === activeIndex 
                    ? "bg-[#f97316] w-6" 
                    : "bg-slate-200 w-3 hover:bg-slate-350"
                }`}
                aria-label={`Go to testimonial slide ${idx + 1}`}
              />
            ))}
          </div>

        </div>

      </div>
    </section>
  );
}
