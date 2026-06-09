import React from 'react';
import { 
  Phone, 
  Mail, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Linkedin, 
  PhoneCall, 
  Shield 
} from 'lucide-react';

interface FooterProps {
  onOpenQuote: () => void;
}

export default function Footer({ onOpenQuote }: FooterProps) {
  const currentYear = 2026;

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
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
    <footer id="footer" className="bg-slate-950 text-white pt-24 pb-12 border-t border-slate-900">
      <div className="container mx-auto px-6 md:px-12 lg:px-24">
        {/* Footer Top Content */}
        <div className="grid lg:grid-cols-12 gap-16 mb-20">
          
          {/* Left Block: Footer Title & Call to Action */}
          <div className="lg:col-span-6 flex flex-col items-start text-left" id="footer-top-brand">
            <span className="text-accent font-semibold tracking-widest uppercase text-xs mb-4 block">
              // LET’S WORK TOGETHER
            </span>
            <h3 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              Let’s Build Smart <br />
              Interactive Solutions <br />
              <span className="text-accent italic font-light">Together</span>
            </h3>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed mb-8 max-w-lg text-left">
              Whether you're planning a digital transformation project, customer engagement system, or custom kiosk deployment, our team is ready to help. Our facility in Bengaluru delivers flawless turn-key hardware on strict timelines.
            </p>
            <button 
              onClick={onOpenQuote}
              className="px-6 py-3.5 bg-accent text-primary font-bold text-xs uppercase tracking-widest rounded-full hover:bg-accent-hover transition-all flex items-center gap-2 hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
              id="footer-action-cta"
            >
              Get Custom Proposal <PhoneCall className="w-4 h-4" />
            </button>
          </div>

          {/* Right Block: Instant Contacts & Social channels */}
          <div className="lg:col-span-6 grid sm:grid-cols-2 gap-12" id="footer-top-contacts">
            {/* Contact Coordinates */}
            <div className="flex flex-col items-start text-left">
              <h4 className="font-bold mb-6 text-accent uppercase tracking-widest text-xs">
                Bengaluru Facility & Office
              </h4>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                SignageOS<br />
                Demo Industrial Park,<br />
                Bengaluru, Karnataka, India
              </p>
              
              <div className="flex items-center gap-2 text-slate-400 text-xs mt-1">
                <MapPin className="w-4 h-4 text-accent shrink-0" />
                <span>CNC Machine Hub — Bengaluru</span>
              </div>
            </div>

            {/* Say Hello Channels */}
            <div className="flex flex-col items-start text-left">
              <h4 className="font-bold mb-6 text-accent uppercase tracking-widest text-xs">
                Instant Communications
              </h4>
              
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-accent" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold leading-none">Mobile</span>
                    <a href="tel:+919999999999" className="text-white hover:text-accent font-bold text-sm leading-normal transition-colors">
                      +91 99999 99999
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-accent" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold leading-none">Landline</span>
                    <a href="tel:08099999999" className="text-white hover:text-accent font-bold text-sm leading-normal transition-colors">
                      080-9999 9999
                    </a>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-accent" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold leading-none">E-mail</span>
                    <a href="mailto:info@demo.com" className="text-white hover:text-accent font-bold text-sm leading-normal transition-colors break-all">
                      info@demo.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Social Stack */}
              <div className="flex gap-3">
                {[
                  { Icon: Facebook, href: "https://facebook.com" },
                  { Icon: Twitter, href: "https://twitter.com" },
                  { Icon: Instagram, href: "https://instagram.com" },
                  { Icon: Linkedin, href: "https://linkedin.com" }
                ].map((social, i) => (
                  <a 
                    key={i} 
                    href={social.href} 
                    target="_blank"
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-full border border-slate-800 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-accent hover:border-accent transition-all"
                  >
                    <social.Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Bottom Metadata & Navigation */}
        <div className="pt-10 border-t border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6 text-xs font-medium text-slate-500">
          <div className="flex gap-8 flex-wrap justify-center">
            <a href="#hero" onClick={(e) => handleSmoothScroll(e, 'hero')} className="hover:text-accent">Home</a>
            <a href="#why-choose-us" onClick={(e) => handleSmoothScroll(e, 'why-choose-us')} className="hover:text-accent">Why Choose Us</a>
            <a href="#services" onClick={(e) => handleSmoothScroll(e, 'services')} className="hover:text-accent">Products & Services</a>
            <a href="#industries" onClick={(e) => handleSmoothScroll(e, 'industries')} className="hover:text-accent">Industries Served</a>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-accent/10 flex items-center justify-center text-accent">
              <Shield className="w-3 h-3 text-accent-hover" />
            </div>
            <p className="text-slate-500 font-semibold select-none">
              Copyright © {currentYear} SignageOS. All Rights Reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
