import React from 'react';
import logoAero from '../assets/logos/Aero.png';
import logoAudi from '../assets/logos/Audi.png';
import logoBiocon from '../assets/logos/Biocon.png';
import logoFlipkart from '../assets/logos/Flipkart.png';
import logoHal from '../assets/logos/HAL.png';
import logoIr from '../assets/logos/IR.png';
import logoCognizant from '../assets/logos/congizant.png';

export default function TrustedBy() {
  const clients = [
    { name: "Aero Systems", img: logoAero },
    { name: "Audi", img: logoAudi },
    { name: "Biocon", img: logoBiocon },
    { name: "Flipkart", img: logoFlipkart },
    { name: "HAL", img: logoHal },
    { name: "Indian Railways", img: logoIr },
    { name: "Cognizant", img: logoCognizant }
  ];

  // Quadruple the list to guarantee a seamless, gapless wrap-around under infinite translation
  const scrollingClients = [...clients, ...clients, ...clients, ...clients];

  return (
    <section id="trusted-by" className="py-12 bg-slate-50/80 border-y border-slate-200/80 overflow-hidden select-none">
      <div className="container mx-auto px-6 mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between items-start gap-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-accent rounded-full" />
          <h4 className="text-left font-bold text-xs sm:text-sm tracking-widest text-slate-500 uppercase">
            Trusted by Elite Enterprises
          </h4>
        </div>
        <div className="text-[10px] sm:text-xs text-sky-500 font-extrabold tracking-wide uppercase px-3 py-1 bg-sky-50 rounded-full border border-sky-100">
          Government & Corporate Deployments
        </div>
      </div>
      
      {/* Seamless Horizontal Scrolling Marquee */}
      <div className="relative w-full flex items-center overflow-hidden whitespace-nowrap" id="trusted-marquee-container">
        {/* Left Fade Gradient Mask */}
        <div className="absolute left-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-r from-slate-50/90 to-transparent z-10 pointer-events-none" />
        
        <div className="animate-marquee inline-flex gap-12 md:gap-16 py-4 items-center">
          {scrollingClients.map((client, i) => (
            <div 
              key={i}
              className="flex items-center justify-center shrink-0 h-16 sm:h-20 md:h-24 w-36 sm:w-48 md:w-56 transition-all duration-300 select-none cursor-pointer hover:scale-105"
              id={`marquee-client-item-${i}`}
            >
              <img 
                src={client.img} 
                alt={`${client.name} Logo`} 
                className="max-h-full max-w-full object-contain pointer-events-none"
              />
            </div>
          ))}
        </div>
        
        {/* Right Fade Gradient Mask */}
        <div className="absolute right-0 top-0 bottom-0 w-16 md:w-32 bg-gradient-to-l from-slate-50/90 to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  );
}
