import React from 'react';
import { motion } from 'motion/react';
import { Star, CheckCircle, Flame, Trophy, Award } from 'lucide-react';
import whyImg1 from '../assets/HM-Digital-Standee.jpg';
import whyImg2 from '../assets/digital2.webp';
import whyImg3 from '../assets/T2-1024x576.jpg';

interface WhyChooseUsProps {
  onOpenQuote: () => void;
}

export default function WhyChooseUs({ onOpenQuote }: WhyChooseUsProps) {
  return (
    <section id="why-choose-us" className="py-24 px-6 md:px-12 lg:px-24 bg-slate-50 border-y border-slate-100">
      <div className="container mx-auto grid lg:grid-cols-12 gap-16 items-center">
        {/* Left Side: Images Grid illustrating premium kiosks & custom fabrication */}
        <div className="lg:col-span-5 relative" id="why-choose-us-visuals">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <img 
                src={whyImg1} 
                alt="CNC laser cutting sheet metal" 
                className="rounded-2xl w-full h-[180px] xs:h-[250px] sm:h-[320px] md:h-[380px] object-cover shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
              <div className="bg-slate-950 p-4 sm:p-6 rounded-2xl text-white border border-slate-900 shadow-xl">
                <span className="text-3xl sm:text-4xl font-extrabold text-accent leading-none block mb-1">10+</span>
                <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Years Industry Experience</p>
              </div>
            </div>
            <div className="pt-6 sm:pt-12 space-y-4">
              <img 
                src={whyImg2} 
                alt="Active interactive kiosk display standee" 
                className="rounded-2xl w-full h-[140px] xs:h-[190px] sm:h-[240px] md:h-[280px] object-cover shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
              <img 
                src={whyImg3} 
                alt="Custom structural enclosure metal fabrication" 
                className="rounded-2xl w-full h-[110px] xs:h-[150px] sm:h-[180px] md:h-[220px] object-cover shadow-md hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
          </div>
          <div className="absolute -left-12 top-1/2 -rotate-90 origin-left hidden xl:block">
            <span className="text-slate-300 font-extrabold tracking-[0.5em] text-xs uppercase select-none">BENGALURU PRECISION FABRICATION</span>
          </div>
        </div>

        {/* Right Side: Copy & Stats Highlights */}
        <div className="lg:col-span-7 flex flex-col items-start text-left" id="why-choose-us-content">
          <span className="text-accent font-semibold tracking-widest uppercase text-xs mb-4 block">
            // WHY CHOOSE US
          </span>
          <h3 className="heading-md text-slate-900 mb-6 font-bold tracking-tight">
            Why Businesses Trust <br />
            <span className="text-accent">SignageOS</span>
          </h3>
          <p className="text-slate-600 text-base mb-8 leading-relaxed max-w-2xl text-left">
            At SignageOS, we combine precision engineering, modern manufacturing technologies, and innovative digital integration to deliver reliable kiosk and display solutions for businesses across multiple industries.
          </p>
          <p className="text-slate-600 text-base mb-10 leading-relaxed max-w-2xl text-left">
            Whether you require a single customized kiosk or enterprise-scale deployment, our team ensures quality, durability, and seamless execution from concept to installation.
          </p>
          
          {/* Detailed Stat Pillars Grid */}
          <div className="grid md:grid-cols-3 gap-6 w-full mb-10" id="why-choose-us-stats-grid">
            {[
              { val: "10+", desc: "Years Experience", detail: "Industry-leading skill in custom kiosk fabrication." },
              { val: "4000+", desc: "Successful Installs", detail: "Durable self-service & display kiosks deployed." },
              { val: "98%", desc: "Client Satisfaction", detail: "Exceptional build quality and lifecycle support." }
            ].map((stat, i) => (
              <div key={i} className="p-5 bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <h4 className="text-3xl font-extrabold text-accent mb-1">{stat.val}</h4>
                <p className="font-bold text-sm text-slate-900 mb-1">{stat.desc}</p>
                <p className="text-xs text-slate-400 leading-normal">{stat.detail}</p>
              </div>
            ))}
          </div>

          {/* Highlights Indicators */}
          <div className="flex flex-wrap items-center gap-x-12 gap-y-4 mb-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <Trophy className="w-5 h-5 text-accent-hover" />
              </div>
              <div>
                <h4 className="font-bold text-xs md:text-sm text-slate-900">Award-winning Fabrication</h4>
                <p className="text-[11px] text-slate-400">Approved by state corporations</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent">
                <Award className="w-5 h-5 text-accent-hover" />
              </div>
              <div>
                <h4 className="font-bold text-xs md:text-sm text-slate-900">Custom B2B Engineering</h4>
                <p className="text-[11px] text-slate-400">Tailored size, branding & configurations</p>
              </div>
            </div>
          </div>

          <button 
            onClick={onOpenQuote}
            className="btn-primary hover:scale-105 active:scale-95 duration-200 cursor-pointer"
            id="why-choose-us-cta"
          >
            Get a Free Consultation
          </button>
        </div>
      </div>
    </section>
  );
}
