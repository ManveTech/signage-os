import React from 'react';
import { 
  DollarSign, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Wrench, 
  Clock,
  Settings 
} from 'lucide-react';
import performanceImg1 from '../assets/digital2.webp';
import performanceImg2 from '../assets/1-2-Information-Kiosk-1024x1024.jpg';

export default function FeaturesStandOut() {
  const chooseGrid = [
    {
      title: "Affordable Cost",
      icon: DollarSign,
    },
    {
      title: "Certified Engineers",
      icon: ShieldCheck,
    },
    {
      title: "Flat Rate Quotes",
      icon: Layers,
    },
    {
      title: "Precision CNC",
      icon: Cpu,
    },
    {
      title: "Custom Engineering",
      icon: Wrench,
    },
    {
      title: "24/7 Project Support",
      icon: Clock,
    }
  ];

  return (
    <section 
      id="why-our-products-stand-out" 
      className="relative py-24 px-6 md:px-12 lg:px-24 bg-slate-900 border-t border-slate-800/80 overflow-hidden select-none"
    >
      {/* 
        Precise 70% Wide Slanted Backdrop Shape directly recreating the reference layout.
        Main section acts as Slate-900 ("grey colour type"), while the left side is Slate-950 ("left side darker").
      */}
      <div className="absolute inset-0 pointer-events-none z-0" id="choose-us-slanted-grid-bg">
        {/* Desktop dual backdrop panels */}
        <div className="hidden lg:block relative w-full h-full">
          {/* Left panel is darker (72% wide slanting down to 65% width) */}
          <div 
            className="absolute inset-y-0 left-0 bg-slate-950 h-full w-[72%]"
            style={{
              clipPath: "polygon(0 0, 100% 0, 91% 100%, 0 100%)"
            }}
          />
          {/* Subtle accent divider line on the slant matching our brand blue */}
          <div 
            className="absolute inset-y-0 left-0 bg-accent/20 h-full w-[72%]"
            style={{
              clipPath: "polygon(99.6% 0, 100% 0, 91% 100%, 90.6% 100%)"
            }}
          />
        </div>
        {/* Mobile/Tablet fallback backdrop (fully dark) */}
        <div className="absolute inset-0 bg-slate-950 lg:hidden" id="choose-us-mobile-bg" />
      </div>

      {/* Decorative Highly Visible Dot Grid Pattern reproducing the reference image layout precisely */}
      <div className="absolute top-8 left-8 pointer-events-none z-0 opacity-40" id="choose-us-dots-tl">
        <svg width="140" height="140" fill="currentColor" className="text-accent/30">
          <pattern id="dot-grid-tl" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" />
          </pattern>
          <rect width="140" height="140" fill="url(#dot-grid-tl)" />
        </svg>
      </div>

      <div className="absolute top-10 right-10 pointer-events-none z-0 opacity-30" id="choose-us-dots-tr">
        <svg width="140" height="140" fill="currentColor" className="text-slate-500/40">
          <pattern id="dot-grid-tr" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" />
          </pattern>
          <rect width="140" height="140" fill="url(#dot-grid-tr)" />
        </svg>
      </div>

      <div className="absolute bottom-10 right-1/4 pointer-events-none z-0 opacity-45" id="choose-us-dots-br">
        <svg width="180" height="180" fill="currentColor" className="text-accent/40">
          <pattern id="dot-grid-br" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="2" />
          </pattern>
          <rect width="180" height="180" fill="url(#dot-grid-br)" />
        </svg>
      </div>

      <div className="container mx-auto relative z-10">
        <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* LEFT COLUMN: Texts and 6-Grid Matrix (spans 6 of 12 columns) */}
          <div className="lg:col-span-6 flex flex-col items-start text-left text-white" id="choose-us-left-panel">
            <span className="text-accent font-extrabold uppercase tracking-widest text-xs mb-3 block">
              WHY CHOOSE SIGNAGEOS
            </span>
            <h3 className="text-3xl sm:text-[42px] font-black leading-tight text-white tracking-tight mb-6">
              Built for Performance.<br />
              <span className="text-accent">Designed for Impact.</span>
            </h3>
            <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-10 max-w-xl font-medium">
              We focus on qualified precision engineering, custom CNC sheet metal fabrication, and digital integration. Our specialized fabrication roots ensure high manufacturing fidelity, flawless powder finishes, and seamless service.
            </p>

            {/* 6 Grids mimicking the reference blocks perfectly under dark/cyan theme styling */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full" id="choose-us-reasons-matrix">
              {chooseGrid.map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <div 
                    key={index}
                    className="bg-slate-900/50 p-4 sm:p-5 rounded-xl border border-slate-900 hover:border-accent/40 hover:bg-slate-900 transition-all duration-300 flex flex-col items-center justify-center group cursor-pointer"
                    id={`choose-reason-card-${index}`}
                  >
                    {/* Ring Icon Container with dynamic accent border */}
                    <div 
                      className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-slate-950 border border-slate-800 group-hover:bg-accent group-hover:border-accent flex items-center justify-center mb-2.5 sm:mb-3 transition-all duration-300 transform group-hover:scale-105"
                      id={`choose-reason-icon-ring-${index}`}
                    >
                      <IconComponent className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-accent group-hover:text-primary stroke-[2] transition-colors duration-300" />
                    </div>
                    <span className="font-bold text-slate-200 text-[10px] sm:text-xs tracking-tight text-center leading-tight group-hover:text-white transition-colors duration-200">
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT COLUMN: Asymmetrical Double Image Stack (Larger layout, now col-span-6) */}
          <div className="lg:col-span-6 grid grid-cols-12 gap-5 items-center relative" id="choose-us-right-panel">
            
            {/* Background glowing cyan aura wrapper */}
            <div className="absolute inset-0 bg-accent/5 rounded-full blur-[90px] z-0 pointer-events-none" />

            {/* First Image Block (Skewed Clip-Path aligned identically to the reference) */}
            <div className="col-span-6 z-10" id="choose-us-skewed-banner">
              <div 
                className="relative overflow-hidden aspect-[9/17] sm:aspect-[9/16] lg:aspect-[9/17] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] bg-slate-900 border border-slate-800/80 transform hover:scale-[1.02] transition-all duration-500"
                style={{
                  clipPath: "polygon(14% 0%, 100% 0%, 86% 100%, 0% 100%)"
                }}
              >
                <img 
                  src={performanceImg1} 
                  alt="Industrial Precision Digital Kiosk" 
                  className="w-full h-full object-cover select-none filter contrast-[1.04] brightness-95 hover:brightness-100 transition-all duration-300"
                />
              </div>
            </div>

            {/* Second Image Block (Straight vertical frame with overlay ring selector icon) */}
            <div className="col-span-6 relative z-10" id="choose-us-straight-banner">
              <div className="overflow-hidden aspect-[9/17] sm:aspect-[9/16] lg:aspect-[9/17] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.4)] bg-slate-900 border border-slate-800/80 transform hover:scale-[1.02] transition-all duration-500">
                <img 
                  src={performanceImg2} 
                  alt="Information Kiosk Enclosure Setup" 
                  className="w-full h-full object-cover select-none filter contrast-[1.04] brightness-95 hover:brightness-100 transition-all duration-300"
                />
              </div>

              {/* Floating Highlight Center Ring icon matching the reference image's accent outline circle with dark theme glow */}
              <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center justify-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-950 flex items-center justify-center shadow-[0_10px_35px_rgba(56,189,248,0.4)] border-2 border-accent hover:scale-110 active:scale-95 transition-transform duration-300 cursor-pointer">
                  <Settings className="w-6 h-6 text-accent animate-[spin_10s_linear_infinite]" />
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
