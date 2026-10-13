import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Phone, Mail, MessageCircle, ShieldCheck, Send, Loader2, Check } from 'lucide-react';
import { BLUESTAR_PRODUCTS, PANEL_SIZES } from '../data/bluestarProducts';
import { COMPANY, PHONES } from '../data/company';
import {
  EnquiryDetails,
  buildEnquiryMessage,
  buildEnquiryMailto,
  openWhatsApp
} from '../data/enquiry';
import { submitLead } from '../data/cms';

const SALES_PHONE = PHONES[0];

/** Pre-selections the opening CTA can pass in (e.g. "the product on screen"). */
export interface EnquiryPrefill {
  product?: string;
  size?: string;
  /** Recorded on the lead, so we know which CTA started the conversation. */
  source?: string;
  /** Shown above the form so the visitor knows what we think they're asking about. */
  context?: string;
}

interface EnquiryModalProps {
  open: boolean;
  onClose: () => void;
  prefill?: EnquiryPrefill;
}

const EMPTY: EnquiryDetails = {
  name: '',
  phone: '',
  company: '',
  product: '',
  size: '',
  quantity: '',
  city: '',
  message: '',
  email: '',
  source: '',
  website: ''
};

const fieldClass =
  'w-full rounded-xl border border-[#cfe0f2] bg-white px-3.5 py-2.5 text-sm text-[#0b2545] ' +
  'placeholder-[#8fb0d1] focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/25 transition';

const labelClass = 'block text-[11px] font-black uppercase tracking-wider text-[#18487d] mb-1.5';

/**
 * The enquiry form. "Request a quote" goes straight to WhatsApp because a price
 * request needs no form; "Enquire" lands here, where the longer questions — site,
 * quantity, what the thing is actually for — can be asked once instead of over
 * four messages.
 *
 * It submits by handing the composed message to WhatsApp (or email, for anyone
 * without it). That means the lead is only captured if the visitor presses send
 * in their own app — see the note in data/enquiry.ts. Replacing this with a POST
 * is a drop-in change: the shape is already EnquiryDetails.
 */
export const EnquiryModal: React.FC<EnquiryModalProps> = ({ open, onClose, prefill }) => {
  const [details, setDetails] = useState<EnquiryDetails>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Per-field messages the server returned, keyed by its field names. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const titleId = 'enquiry-modal-title';

  // Reset to the prefill each time it opens, so a stale half-filled form from a
  // previous visit to the modal never shows up against a different product.
  useEffect(() => {
    if (!open) return;
    setDetails({
      ...EMPTY,
      product: prefill?.product ?? '',
      size: prefill?.size ?? '',
      source: prefill?.source ?? 'enquiry form'
    });
    setTouched(false);
    setSending(false);
    setSent(false);
    setError(null);
    setFieldErrors({});
    // Focus the first field, but only after the entry animation has started, or
    // the scroll-into-view fights the transform.
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 120);
    return () => window.clearTimeout(id);
  }, [open, prefill?.product, prefill?.size, prefill?.source]);

  // Escape closes; the page behind stays put rather than scrolling under the sheet.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  const set = (key: keyof EnquiryDetails) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setDetails((d) => ({ ...d, [key]: e.target.value }));

  /* A chosen product narrows the size list to what that model is offered in. */
  const sizeOptions = useMemo(() => {
    const match = BLUESTAR_PRODUCTS.find((p) => p.name === details.product);
    return match ? match.displaySizes : PANEL_SIZES;
  }, [details.product]);

  const nameOk = details.name.trim().length > 1;
  /* Deliberately loose: 10 digits covers an Indian mobile, and anything stricter
     starts rejecting real numbers written with +91, spaces or a landline STD. */
  const phoneOk = details.phone.replace(/\D/g, '').length >= 10;
  const valid = nameOk && phoneOk;

  /* Our own check first, then whatever the server said about that field — the
     two validate independently, and the server's message is the specific one. */
  const nameError = (touched && !nameOk && 'Please tell us who to reply to.') || fieldErrors.clientName;
  const phoneError = (touched && !phoneOk && 'A 10-digit number, so we can call you back.') || fieldErrors.phone;

  /*
   * Submitting posts the enquiry to the CMS, which records it and emails the
   * sales mailbox. This used to hand the message to the visitor's own WhatsApp
   * and call it done — which meant a lead only existed if they went on to
   * press send in another app, and we never knew about the ones who didn't.
   *
   * WhatsApp is still here, below, as the second button for anyone who would
   * rather talk immediately.
   */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || sending) return;

    setSending(true);
    setError(null);
    setFieldErrors({});

    const result = await submitLead(details);
    setSending(false);

    if (result.ok) {
      setSent(true);
      return;
    }

    setError(result.message || 'Something went wrong. Please try again.');
    // The server validates independently of this form; if it rejected a field
    // we accepted, say which one rather than showing a generic failure.
    if (result.fields) setFieldErrors(result.fields);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-[#06182c]/70 backdrop-blur-sm"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            /* Centred on a laptop, a bottom sheet on a phone — a centred modal
               on a short screen puts the first field under the keyboard. */
            className="fixed inset-x-0 bottom-0 sm:inset-0 z-[61] sm:m-auto w-full sm:w-[min(640px,calc(100vw-2rem))] sm:h-fit sm:max-h-[calc(100svh-3rem)] max-h-[92svh] overflow-y-auto overscroll-contain bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl border border-white"
          >
            {/* Header — sticky so "close" is always reachable while scrolling */}
            <div className="sticky top-0 z-10 bg-[#0b2545] text-white px-5 sm:px-7 pt-5 pb-4 rounded-t-[28px] sm:rounded-t-[28px]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id={titleId} className="text-xl sm:text-2xl font-black font-condensed tracking-tight uppercase">
                    Send us an enquiry
                  </h2>
                  <p className="mt-1 text-xs sm:text-[13px] text-[#93bfe8] leading-relaxed">
                    {prefill?.context
                      ? prefill.context
                      : 'Tell us what you need and we’ll come back with a quote.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close enquiry form"
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>

            {/*
              Once it is sent the form is gone rather than cleared — a form
              that empties itself leaves people wondering whether it went.
            */}
            {sent ? (
              <div className="px-5 sm:px-7 py-8 sm:py-10 text-center">
                <div className="mx-auto w-14 h-14 rounded-full bg-[#dcf5ea] text-[#0f7a6d] flex items-center justify-center">
                  <Check className="w-7 h-7" strokeWidth={3} aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-xl font-black text-[#0b2545] font-condensed uppercase tracking-tight">
                  Enquiry sent
                </h3>
                <p className="mt-2 text-sm text-[#18487d] leading-relaxed max-w-sm mx-auto">
                  Thanks {details.name.trim().split(' ')[0] || 'for getting in touch'} — it is with our
                  sales team now. We usually reply the same working day.
                </p>

                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => openWhatsApp(buildEnquiryMessage(details))}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white py-3 px-5 rounded-full font-bold text-sm transition cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                    <span>Talk to us now on WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full sm:w-auto py-3 px-5 rounded-full font-bold text-sm text-[#0b2545] hover:bg-[#eaf3fd] transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>

                <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#18487d]">
                  <Phone className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
                  <span>In a hurry? Call {SALES_PHONE.display}</span>
                </p>
              </div>
            ) : (
            <form onSubmit={submit} className="px-5 sm:px-7 py-5 sm:py-6" noValidate>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <div>
                  <label className={labelClass} htmlFor="enq-name">
                    Your name <span className="text-[#c2410c]">*</span>
                  </label>
                  <input
                    ref={firstFieldRef}
                    id="enq-name"
                    name="name"
                    autoComplete="name"
                    value={details.name}
                    onChange={set('name')}
                    placeholder="e.g. Ravi Kumar"
                    aria-invalid={touched && !nameOk}
                    aria-describedby={nameError ? 'enq-name-err' : undefined}
                    className={fieldClass}
                  />
                  {nameError && (
                    <p id="enq-name-err" className="mt-1 text-[11px] font-bold text-[#c2410c]">
                      {nameError}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="enq-phone">
                    Phone / WhatsApp <span className="text-[#c2410c]">*</span>
                  </label>
                  <input
                    id="enq-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={details.phone}
                    onChange={set('phone')}
                    placeholder="e.g. +91 98450 00000"
                    aria-invalid={touched && !phoneOk}
                    aria-describedby={phoneError ? 'enq-phone-err' : undefined}
                    className={fieldClass}
                  />
                  {phoneError && (
                    <p id="enq-phone-err" className="mt-1 text-[11px] font-bold text-[#c2410c]">
                      {phoneError}
                    </p>
                  )}
                </div>

                <div>
                  <label className={labelClass} htmlFor="enq-company">Company</label>
                  <input
                    id="enq-company"
                    name="company"
                    autoComplete="organization"
                    value={details.company}
                    onChange={set('company')}
                    placeholder="Optional"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="enq-city">Site / city</label>
                  <input
                    id="enq-city"
                    name="city"
                    autoComplete="address-level2"
                    value={details.city}
                    onChange={set('city')}
                    placeholder="e.g. Bangalore"
                    className={fieldClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="enq-product">Product</label>
                  <select
                    id="enq-product"
                    name="product"
                    value={details.product}
                    onChange={(e) => {
                      /* Clear a size the newly-chosen product isn't offered in. */
                      const product = e.target.value;
                      const match = BLUESTAR_PRODUCTS.find((p) => p.name === product);
                      setDetails((d) => ({
                        ...d,
                        product,
                        size: match && !match.displaySizes.includes(d.size) ? '' : d.size
                      }));
                    }}
                    className={`${fieldClass} cursor-pointer`}
                  >
                    <option value="">Not sure yet</option>
                    {BLUESTAR_PRODUCTS.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                    <option value="Custom sheet metal enclosure">Custom sheet metal enclosure</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="enq-size">Screen size</label>
                    <select
                      id="enq-size"
                      name="size"
                      value={details.size}
                      onChange={set('size')}
                      className={`${fieldClass} cursor-pointer`}
                    >
                      <option value="">Any</option>
                      {sizeOptions.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="enq-qty">Quantity</label>
                    <input
                      id="enq-qty"
                      name="quantity"
                      inputMode="numeric"
                      value={details.quantity}
                      onChange={set('quantity')}
                      placeholder="e.g. 10"
                      className={fieldClass}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className={labelClass} htmlFor="enq-message">What do you need?</label>
                  <textarea
                    id="enq-message"
                    name="message"
                    rows={3}
                    value={details.message}
                    onChange={set('message')}
                    placeholder="Branding, mounting, indoor or outdoor, a drawing you can send over — anything that helps us quote accurately."
                    className={`${fieldClass} resize-y min-h-[84px]`}
                  />
                </div>

                {/*
                  Honeypot. Hidden from people and from screen readers, and
                  skipped by tabbing — only something filling in every input it
                  can find will put anything here, which is exactly what the
                  CMS discards.
                */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="enq-website">Website</label>
                  <input
                    id="enq-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={details.website}
                    onChange={set('website')}
                  />
                </div>

              </div>

              {/* Anything the server rejected that this form let through */}
              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-[#f3cdb6] bg-[#fdf3ec] px-3.5 py-2.5 text-xs font-bold text-[#9a3412]"
                >
                  {error}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={sending}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-[#0b2545] hover:bg-[#153b68] disabled:bg-[#5b7fa6] disabled:cursor-wait text-white py-3.5 px-6 rounded-full font-black text-sm sm:text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-95 disabled:hover:scale-100 cursor-pointer"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" aria-hidden="true" />
                    <span>Sending…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 flex-shrink-0 text-sky-300" aria-hidden="true" />
                    <span>Send enquiry</span>
                  </>
                )}
              </button>

              <p className="mt-2.5 text-[11px] text-[#5b7fa6] text-center leading-relaxed">
                Goes straight to our sales team. We usually reply the same working day.
              </p>

              {/* Alternatives, for anyone who would rather talk now */}
              <div className="mt-4 pt-4 border-t border-[#e3eef9] flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => openWhatsApp(buildEnquiryMessage(details))}
                  className="inline-flex items-center gap-1.5 text-[#0b2545] hover:text-[#0284c7] transition py-1 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4 text-[#128c7e]" aria-hidden="true" />
                  <span>Send on WhatsApp</span>
                </button>
                <a
                  href={buildEnquiryMailto(details, COMPANY.email)}
                  className="inline-flex items-center gap-1.5 text-[#0b2545] hover:text-[#0284c7] transition py-1"
                >
                  <Mail className="w-4 h-4 text-[#0284c7]" aria-hidden="true" />
                  <span>Email instead</span>
                </a>
                <a
                  href={`tel:${SALES_PHONE.dial}`}
                  className="inline-flex items-center gap-1.5 text-[#0b2545] hover:text-[#0284c7] transition py-1"
                >
                  <Phone className="w-4 h-4 text-[#0284c7]" aria-hidden="true" />
                  <span>Call {SALES_PHONE.display}</span>
                </a>
              </div>

              {/* The number is already on the "Call" link directly above — this
                  line only carries what that one doesn't. */}
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#18487d]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
                <span>ISO 9001:2015 certified · Peenya, Bangalore</span>
              </p>
            </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
