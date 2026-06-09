import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, ShieldCheck } from 'lucide-react';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialService?: string;
}

export default function QuoteModal({ isOpen, onClose, initialService = '' }: QuoteModalProps) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [service, setService] = useState(initialService);
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API request delay
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1200);
  };

  const handleReset = () => {
    setName('');
    setCompany('');
    setEmail('');
    setPhone('');
    setService('');
    setMessage('');
    setIsSubmitted(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="quote-modal-overlay">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-primary/80 backdrop-blur-sm"
            id="quote-modal-backdrop"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-10 max-h-[90vh] sm:max-h-[85vh] md:max-h-[90vh] flex flex-col"
            id="quote-modal-card"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-accent-hover" />
                </div>
                <h3 className="font-bold text-base sm:text-lg text-primary tracking-tight">Request Project Consultation</h3>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-200 text-slate-400 hover:text-primary transition-all"
                id="close-modal-btn"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1">
              {!isSubmitted ? (
                <form onSubmit={handleSubmit} className="space-y-4" id="quote-form">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modal-name" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                        Contact Name *
                      </label>
                      <input
                        type="text"
                        id="modal-name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-company" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                        Company Name *
                      </label>
                      <input
                        type="text"
                        id="modal-company"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Enterprise Inc."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modal-email" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                        Work Email *
                      </label>
                      <input
                        type="email"
                        id="modal-email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="email@company.com"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-phone" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        id="modal-phone"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 XXXXX XXXXX"
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="modal-service" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                      Required Solution *
                    </label>
                    <select
                      id="modal-service"
                      required
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all appearance-none"
                    >
                      <option value="">Select a solution...</option>
                      <option value="kiosk-info">Interactive Information Kiosks</option>
                      <option value="kiosk-self">Self-Service Kiosks</option>
                      <option value="digital-standee">Digital Standee Displays</option>
                      <option value="multitouch-table">Multi-Touch Interactive Tables</option>
                      <option value="led-walls">Active LED Video Walls</option>
                      <option value="podiums">Digital Podiums</option>
                      <option value="coffee-tables">Digital Coffee Tables</option>
                      <option value="tablet-kiosks">Tablet & Tab Kiosks</option>
                      <option value="metal-fab">Custom Metal Fabrication</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="modal-message" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">
                      Project Specifications & Details *
                    </label>
                    <textarea
                      id="modal-message"
                      required
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Please share requirements such as size, environment (indoor/outdoor), software, quantity, or branding requirements."
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-accent text-primary bg-slate-50 focus:bg-white transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full btn-primary justify-center font-bold text-sm tracking-wide py-3 bg-accent text-primary hover:bg-accent-hover rounded-xl cursor-pointer disabled:opacity-50 transition-all flex items-center gap-2 mt-2"
                    id="submit-modal-btn"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing Specifications...
                      </span>
                    ) : (
                      <>
                        Submit Specifications <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center text-center py-6 space-y-4" id="submission-success-container">
                  <CheckCircle2 className="w-16 h-16 text-emerald-500 animate-bounce" />
                  <h4 className="font-bold text-xl text-primary tracking-tight">Requirement Received Successfully!</h4>
                  <p className="text-slate-500 text-sm max-w-sm">
                    Thank you, <strong className="text-primary">{name}</strong>. Your specifications for <strong className="text-slate-700 capitalize">{service.replace('-', ' ')}</strong> have been submitted. Our engineering team at <strong className="text-primary">SignageOS</strong> will review and call you shortly.
                  </p>
                  <p className="text-xs text-slate-400">
                    A copies confirmation will be sent to <strong>{email}</strong>
                  </p>
                  <button
                    onClick={handleReset}
                    className="btn-primary mt-4 w-full bg-slate-900 text-white hover:bg-slate-800 rounded-xl justify-center font-semibold text-sm transition-all py-3 cursor-pointer"
                    id="done-success-btn"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
