import React from 'react';
import { 
  ShoppingBag, 
  Plane, 
  GraduationCap, 
  Activity, 
  Building2, 
  Briefcase, 
  Globe, 
  Bed, 
  Factory, 
  Calendar,
  Check,
  Settings,
  Cpu,
  Wrench,
  Shield,
  Zap,
  Gauge,
  Layers,
  Hammer
} from 'lucide-react';

interface IndustriesProps {
  onOpenQuote: () => void;
}

export default function Industries({ onOpenQuote }: IndustriesProps) {
  const industriesList = [
    { name: "Retail & Shopping Malls", icon: ShoppingBag },
    { name: "Airports & Transit Hubs", icon: Plane },
    { name: "Educational Institutions", icon: GraduationCap },
    { name: "Healthcare & Hospitals", icon: Activity },
    { name: "Corporate & Government", icon: Briefcase },
    { name: "Smart Cities & Venues", icon: Globe }
  ];

  return (
    <section id="industries" className="relative overflow-hidden py-14 sm:py-24 bg-white">
      
      {/* Decorative Cascading Manufacturing Shape Flow on the Right Face */}
      <div className="absolute inset-y-0 right-0 w-1/3 pointer-events-none z-0 hidden lg:block" id="industries-bg-decorations">
        {/* Curved Path of Light Blue Icons and Elements resembling the reference image layout */}
        <div className="absolute top-[8%] right-[8%] text-sky-400/20 rotate-12 transition-all hover:scale-110 duration-300">
          <Settings className="w-16 h-16 stroke-[1.25]" />
        </div>
        
        {/* Floating washer / circle shapes */}
        <div className="absolute top-[14%] right-[18%] w-4 h-4 rounded-full border-2 border-sky-300/30 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-300/30" />
        </div>

        <div className="absolute top-[20%] right-[6%] text-cyan-400/25 -rotate-12">
          <Cpu className="w-20 h-20 stroke-[1]" />
        </div>

        <div className="absolute top-[28%] right-[16%] text-sky-300/35">
          <Shield className="w-12 h-12 stroke-[1.5]" />
        </div>

        <div className="absolute top-[35%] right-[7%] text-sky-400/20 rotate-45">
          <Wrench className="w-14 h-14 stroke-[1.25]" />
        </div>

        <div className="absolute top-[38%] right-[22%] w-5 h-5 rounded-full border-2 border-cyan-300/25 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-cyan-300/25" strokeDasharray="1 1" />
        </div>

        <div className="absolute top-[46%] right-[12%] text-cyan-400/30 rotate-12">
          <Layers className="w-24 h-24 stroke-[1]" />
        </div>

        <div className="absolute top-[55%] right-[5%] text-sky-400/25 -rotate-45">
          <Zap className="w-16 h-16 stroke-[1.5]" />
        </div>

        <div className="absolute top-[58%] right-[20%] w-6 h-6 rounded-full bg-sky-300/15 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white" />
        </div>

        <div className="absolute top-[66%] right-[14%] text-sky-400/20">
          <Gauge className="w-14 h-14 stroke-[1.25]" />
        </div>

        <div className="absolute top-[75%] right-[8%] text-cyan-300/30 rotate-12">
          <Hammer className="w-16 h-16 stroke-[1.25]" />
        </div>

        <div className="absolute top-[78%] right-[24%] w-4.5 h-4.5 rounded-full border-2 border-sky-300/25 flex items-center justify-center">
          <div className="w-1 h-1 bg-sky-300/25 rounded-full" />
        </div>

        <div className="absolute top-[85%] right-[16%] text-sky-400/20 -rotate-12 animate-pulse" style={{ animationDuration: '4s' }}>
          <Settings className="w-12 h-12 stroke-[1.5]" />
        </div>

        {/* Small floating dots / particles completing the visual cascade curve */}
        <div className="absolute top-[10%] right-[25%] w-3 h-3 rounded-full bg-sky-300/20" />
        <div className="absolute top-[24%] right-[11%] w-2.5 h-2.5 rounded-full bg-cyan-300/35" />
        <div className="absolute top-[32%] right-[2%] w-3.5 h-3.5 rounded-full bg-sky-300/15" />
        <div className="absolute top-[42%] right-[19%] w-2 h-2 rounded-full bg-cyan-300/30" />
        <div className="absolute top-[50%] right-[3%] w-3 h-3 rounded-full bg-sky-400/20" />
        <div className="absolute top-[62%] right-[11%] w-3 w-3 rounded-full bg-cyan-300/25" />
        <div className="absolute top-[70%] right-[23%] w-2 h-2 rounded-full bg-sky-300/30" />
        <div className="absolute top-[82%] right-[5%] w-3 h-3 rounded-full bg-cyan-400/20" />
        <div className="absolute top-[90%] right-[12%] w-4 h-4 rounded-full bg-sky-300/15" />
      </div>

      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-24 relative z-10">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Block: Description & Core features */}
          <div className="lg:col-span-5 flex flex-col items-start text-left" id="industries-info">
            <span className="text-accent font-semibold tracking-widest uppercase text-[10px] sm:text-xs mb-2 sm:mb-4 block">
              // EXPERT DEPLOYMENT
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4 sm:mb-6 tracking-tight leading-tight">
              Built for <br />
              <span className="text-accent">Diverse Industries</span>
            </h3>
            <p className="text-slate-600 text-xs sm:text-base mb-5 sm:mb-8 leading-relaxed text-left">
              Our digital kiosk systems and smart display technologies are custom-engineered to meet the exact environmental and security demands of corporate, state, and commercial sectors.
            </p>
            
            {/* Quick Benefits Checklist */}
            <ul className="space-y-2.5 sm:space-y-4 mb-6 sm:mb-10 w-full" id="industries-benefits-list">
              {[
                "High-Traffic Public Durability",
                "Advanced Security Hardware Integration",
                "ADA Compliant Accessible Designs",
                "Thermal Management for 24/7 Operations"
              ].map((benefit, i) => (
                <li key={i} className="flex items-center gap-2 sm:gap-3 font-semibold text-slate-800 text-[11px] sm:text-sm">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-accent/25 flex items-center justify-center text-primary shrink-0">
                    <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-accent-hover font-black" />
                  </div>
                  {benefit}
                </li>
              ))}
            </ul>

            <button 
              onClick={onOpenQuote}
              className="btn-primary text-xs sm:text-sm px-4.5 py-2.5 sm:px-6 sm:py-3 hover:scale-105 active:scale-95 duration-200 cursor-pointer"
              id="industries-cta"
            >
              Discuss Industry Solutions
            </button>
          </div>

          {/* Right Block: Industries Grid */}
          <div className="lg:col-span-7" id="industries-grid-container">
            <h4 className="text-xs sm:text-sm font-extrabold tracking-widest uppercase text-slate-400 mb-4 sm:mb-6 text-left">
              Key Sectors Deployed:
            </h4>
            
            <div className="grid grid-cols-2 gap-2.5 sm:gap-4" id="industries-grid">
              {industriesList.map((ind, i) => {
                const IconComponent = ind.icon;
                return (
                  <div 
                    key={i} 
                    className="p-3 sm:p-5 bg-slate-50 border border-slate-100 rounded-xl flex items-center gap-2 sm:gap-4 hover:bg-slate-950 hover:border-slate-900 hover:text-white transition-all duration-300 group"
                    id={`industry-card-${i}`}
                  >
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0 group-hover:bg-accent group-hover:text-primary transition-colors">
                      <IconComponent className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="font-bold text-[11px] sm:text-sm text-slate-800 group-hover:text-white transition-colors text-left leading-tight">
                      {ind.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
