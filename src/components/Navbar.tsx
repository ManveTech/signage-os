import React, { useState, useEffect } from 'react';
import logoImg from '../assets/BS-main-Logo.png';
import { Phone, ArrowUpRight, Menu, X, Landmark, Compass, Hammer, Shield, Home, Layers } from 'lucide-react';
import { cn } from '../lib/utils';

interface NavbarProps {
  onOpenQuote: () => void;
  view?: 'home' | 'products' | 'admin';
  setView?: (v: 'home' | 'products' | 'admin') => void;
}

export default function Navbar({ onOpenQuote, view = 'home', setView }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80; // height of fixed navbar
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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string, isProductsTab = false) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (isProductsTab) {
      if (setView) {
        setView('products');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        handleSmoothScroll(e, targetId);
      }
      return;
    }

    if (setView && view !== 'home') {
      setView('home');
      setTimeout(() => {
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
      }, 100);
    } else {
      handleSmoothScroll(e, targetId);
    }
  };

  return (
    <nav 
      id="navbar"
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 flex justify-center px-4 sm:px-6 md:px-8 pt-2.5 sm:pt-4 pointer-events-none animate-fadeIn"
    >
      <div 
        id="navbar-notch"
        className={cn(
          "pointer-events-auto w-full max-w-7xl bg-slate-950/95 backdrop-blur-md border border-slate-900 hover:border-slate-800/80 shadow-[0_8px_25px_rgba(0,0,0,0.5)] rounded-[16px] md:rounded-[20px] transition-all duration-300 relative flex flex-col items-center",
          scrolled 
            ? "py-1.5 md:py-2 shadow-[0_12px_30px_rgba(0,0,0,0.6)]" 
            : "py-2 md:py-2.5"
        )}
      >
        {/* Main Content Row */}
        <div className="w-full flex items-center justify-between px-3.5 sm:px-6 md:px-8">
          {/* Brand Identity */}
          <a 
            href="#hero" 
            onClick={(e) => handleNavClick(e, 'hero')}
            className="flex items-center gap-1.5 group cursor-pointer"
            id="navbar-brand-link"
          >
            <img src={logoImg} className="w-12 h-12 sm:w-14 sm:h-14 object-contain shrink-0 group-hover:rotate-6 transition-transform duration-300" alt="SignageOS Logo" />
            <div className="flex flex-col">
              <span className="text-white text-base sm:text-lg font-bold tracking-tighter leading-none">SIGNAGEOS</span>
              <span className="text-[8px] sm:text-[9px] text-accent tracking-widest font-black uppercase text-left">TECHNOLOGIES</span>
            </div>
          </a>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center gap-8 text-white/90 font-semibold text-xs tracking-wider uppercase" id="desktop-nav-links">
            <a 
              href="#hero" 
              onClick={(e) => handleNavClick(e, 'hero')}
              className={`hover:text-accent transition-colors duration-200 ${view === 'home' ? 'text-accent border-b-2 border-accent' : ''}`}
            >
              Home
            </a>
            <a 
              href="#why-choose-us" 
              onClick={(e) => handleNavClick(e, 'why-choose-us')}
              className="hover:text-accent transition-colors duration-200"
            >
              Why Choose Us
            </a>
            <a 
              href="#products" 
              onClick={(e) => handleNavClick(e, 'services', true)}
              className={`hover:text-accent transition-colors duration-200 ${view === 'products' ? 'text-accent border-b-2 border-accent' : ''}`}
            >
              Products Catalog
            </a>
            <a 
              href="#footer" 
              onClick={(e) => handleNavClick(e, 'footer')}
              className="hover:text-accent transition-colors duration-200"
            >
              Contact
            </a>
          </div>

          {/* Header Action Controls (Aligned to the Right) */}
          <div className="flex items-center gap-2 sm:gap-3" id="navbar-right-controls">
            {/* CTA Button - Responsive size */}
            <button 
               onClick={onOpenQuote}
              className="btn-primary text-[8px] xs:text-[9px] sm:text-xs px-2.5 xs:px-3 sm:px-4 py-1 xs:py-1.5 sm:py-2 font-bold tracking-wide uppercase hover:scale-105 active:scale-95 duration-200 cursor-pointer flex items-center gap-0.5 xs:gap-1"
              id="navbar-cta-btn"
            >
              Get In Touch <ArrowUpRight className="w-2.5 h-2.5 xs:w-3 xs:h-3 sm:w-3.5 sm:h-3.5" />
            </button>

            {/* Mobile Menu Toggle Button */}
            <div className="flex lg:hidden items-center" id="mobile-menu-wrapper">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className="p-1 sm:p-1.5 text-white hover:text-accent transition-colors cursor-pointer"
                id="mobile-menu-toggle-btn"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Drawer Overlay as a beautiful nested capsule */}
        {mobileMenuOpen && (
          <div 
            className="absolute top-[108%] left-1 right-1 bg-white/98 backdrop-blur-xl border border-slate-200/80 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)] z-50 flex flex-col gap-4 rounded-2xl animate-fadeIn" 
            id="mobile-nav-drawer"
          >
            {/* Nav Items List */}
            <div className="flex flex-col gap-1.5" id="mobile-nav-links-container">
              {/* Home Link */}
              <a 
                href="#hero" 
                onClick={(e) => handleNavClick(e, 'hero')}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-semibold tracking-wide",
                  view === 'home' 
                    ? "bg-accent/10 text-accent border-l-2 border-accent" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Home className={cn("w-4 h-4 shrink-0 transition-colors", view === 'home' ? "text-accent" : "text-slate-500 group-hover:text-slate-800")} />
                <span className="flex-grow text-left">Home</span>
                {view === 'home' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </a>

              {/* Why Choose Us Link */}
              <a 
                href="#why-choose-us" 
                onClick={(e) => handleNavClick(e, 'why-choose-us')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all duration-200 group text-sm font-semibold tracking-wide"
              >
                <Shield className="w-4 h-4 text-slate-500 group-hover:text-slate-800 shrink-0 transition-colors" />
                <span className="flex-grow text-left">Why Choose Us</span>
              </a>

              {/* Products Catalog Link */}
              <a 
                href="#products" 
                onClick={(e) => handleNavClick(e, 'services', true)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-sm font-semibold tracking-wide",
                  view === 'products' 
                    ? "bg-accent/10 text-accent border-l-2 border-accent" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <Layers className={cn("w-4 h-4 shrink-0 transition-colors", view === 'products' ? "text-accent" : "text-slate-500 group-hover:text-slate-800")} />
                <span className="flex-grow text-left">Products</span>
                {view === 'products' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                )}
              </a>

              {/* Contact Link */}
              <a 
                href="#footer" 
                onClick={(e) => handleNavClick(e, 'footer')}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-all duration-200 group text-sm font-semibold tracking-wide"
              >
                <Phone className="w-4 h-4 text-slate-500 group-hover:text-slate-800 shrink-0 transition-colors" />
                <span className="flex-grow text-left">Contact</span>
              </a>
            </div>

            {/* Quick Action Block */}
            <div className="pt-3.5 border-t border-slate-100 flex flex-col gap-3">
              <button 
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenQuote();
                }}
                className="btn-primary w-full justify-center text-xs font-black uppercase py-3 cursor-pointer tracking-wider flex items-center gap-1.5 shadow-md shadow-accent/10"
              >
                Contact Us <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
