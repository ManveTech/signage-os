import React from 'react';
import { Target, Compass, Cpu, HelpCircle, ArrowRight, ShieldAlert, Wrench, PackageCheck } from 'lucide-react';

interface ProcessProps {
  onOpenQuote: () => void;
}

export default function Process({ onOpenQuote }: ProcessProps) {
  const steps = [
    { 
      step: "01",
      icon: Target, 
      title: "Requirement Analysis", 
      desc: "We understand your operational goals, deployment environment, and technical requirements." 
    },
    { 
      step: "02",
      icon: Compass, 
      title: "Design & Engineering", 
      desc: "Our team creates customized kiosk and fabrication designs optimized for functionality and user experience." 
    },
    { 
      step: "03",
      icon: Cpu, 
      title: "Manufacturing & Integration", 
      desc: "Precision fabrication, hardware integration, and quality testing are performed in-house." 
    },
    { 
      step: "04",
      icon: PackageCheck, 
      title: "Deployment & Support", 
      desc: "We handle installation, deployment assistance, and ongoing technical support." 
    }
  ];

  return (
    <section id="process" className="relative overflow-hidden py-24 bg-white px-6 md:px-12 lg:px-24">
      
      {/* Soft Light Blue Vector Margins (Top-Right and Bottom-Left) */}
      <div className="absolute inset-0 pointer-events-none z-0" id="process-decorations">
        
        {/* Soft cyan/light-blue background blur glow */}
        <div className="absolute top-10 right-10 w-72 h-72 bg-sky-400/5 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 left-10 w-72 h-72 bg-cyan-400/5 rounded-full blur-[80px]" />

        {/* Top-Right Organic Shape (Smaller layout version) */}
        <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 opacity-50 transition-all hover:opacity-75 duration-500" id="process-top-right-shape">
          <svg viewBox="0 0 500 500" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="process-light-grad-tr" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            {/* Organic Filled Blob */}
            <path 
              d="M 180,0 C 150,90 220,100 290,170 C 340,220 250,260 330,330 C 370,360 360,430 500,440 V 0 Z" 
              fill="url(#process-light-grad-tr)" 
            />
            {/* Elegantly aligned outer contour line tracker */}
            <path 
              d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
              stroke="#38bdf8" 
              strokeWidth="5.5" 
              strokeLinecap="round" 
              strokeOpacity="0.5"
            />
            <path 
              d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
              stroke="#0284c7" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeOpacity="0.75"
            />
          </svg>
        </div>

        {/* Bottom-Left Organic Shape (Small layout flipped version) */}
        <div className="absolute bottom-0 left-0 w-48 h-48 sm:w-64 sm:h-64 opacity-50 transition-all hover:opacity-75 duration-500" id="process-bottom-left-shape">
          <svg viewBox="0 0 500 500" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="process-light-grad-bl" x1="100%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.15" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            {/* Same Organic Blob shape flipped 180 deg to frame the bottom-left beautifully */}
            <g transform="rotate(180 250 250)">
              <path 
                d="M 180,0 C 150,90 220,100 290,170 C 340,220 250,260 330,330 C 370,360 360,430 500,440 V 0 Z" 
                fill="url(#process-light-grad-bl)" 
              />
              <path 
                d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
                stroke="#38bdf8" 
                strokeWidth="5.5" 
                strokeLinecap="round" 
                strokeOpacity="0.5"
              />
              <path 
                d="M 130,0 C 100,105 180,120 260,200 C 310,250 220,290 300,360 C 340,400 320,480 500,490" 
                stroke="#0284c7" 
                strokeWidth="1.5" 
                strokeLinecap="round" 
                strokeOpacity="0.75"
              />
            </g>
          </svg>
        </div>

      </div>
      
      <div className="container mx-auto relative z-10">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6" id="process-header">
          <div>
            <span className="text-accent font-semibold tracking-widest uppercase text-xs mb-4 block">
              // HOW WE WORK
            </span>
            <h3 className="heading-md text-slate-900 font-bold tracking-tight">
              Our Professional <br />
              <span className="text-accent">Execution Process</span>
            </h3>
          </div>
          <button 
            onClick={onOpenQuote}
            className="btn-primary hover:scale-105 active:scale-95 duration-200 cursor-pointer font-bold"
            id="process-section-cta"
          >
            Start Your Project <ArrowRight className="w-5 h-5 ml-1" />
          </button>
        </div>

        {/* Steps Pipeline */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative" id="process-pipeline">
          {steps.map((step, i) => {
            const IconComponent = step.icon;
            return (
              <div 
                key={i} 
                className="group relative p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-xl hover:bg-slate-900 hover:border-slate-800 transition-all duration-300"
                id={`process-step-card-${i}`}
              >
                {/* Step Circle Badge */}
                <div className="absolute top-6 right-8 text-4xl font-black text-slate-200 group-hover:text-slate-800 transition-colors select-none leading-none">
                  {step.step}
                </div>

                {/* Icon Wrapper */}
                <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-8 border border-accent/20 group-hover:bg-accent transition-all">
                  <IconComponent className="w-6 h-6 text-accent-hover group-hover:text-primary transition-colors" />
                </div>

                {/* Titles */}
                <h4 className="text-lg font-bold text-slate-900 group-hover:text-white transition-colors mb-3 leading-tight text-left">
                  {step.title}
                </h4>
                <p className="text-slate-500 group-hover:text-slate-400 transition-colors text-sm leading-relaxed text-left">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
