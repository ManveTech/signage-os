import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  Loader2,
  Check,
  MapPin,
  Clock,
  Factory
} from 'lucide-react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { BLUESTAR_PRODUCTS, PANEL_SIZES } from '../data/bluestarProducts';
import { COMPANY, PHONES, ADDRESS_ONE_LINE, MAPS_URL } from '../data/company';
import {
  EnquiryDetails,
  buildEnquiryMessage,
  buildEnquiryMailto,
  openWhatsApp,
  WHATSAPP_DISPLAY
} from '../data/enquiry';
import { submitLead } from '../data/cms';
import { BluestarLogo } from './BrandAssets';

const SALES_PHONE = PHONES[0];

/** Pre-selections carried over from whichever CTA sent the visitor here. */
export interface EnquiryPrefill {
  product?: string;
  size?: string;
  source?: string;
  context?: string;
}

interface EnquiryPageProps {
  prefill?: EnquiryPrefill;
  /** Returns to the marketing site. */
  onBack: () => void;
}

const EMPTY: EnquiryDetails = {
  name: '', phone: '', company: '', product: '', size: '',
  quantity: '', city: '', message: '', email: '', source: '', website: ''
};

const fieldClass =
  'w-full rounded-xl border border-[#cfe0f2] bg-white px-4 py-3 text-sm text-[#0b2545] ' +
  'placeholder-[#8fb0d1] focus:outline-none focus:border-[#0284c7] focus:ring-2 focus:ring-[#0284c7]/25 transition';

const labelClass = 'block text-[11px] font-black uppercase tracking-wider text-[#18487d] mb-1.5';

/**
 * The enquiry page — /enquire.
 *
 * This replaced a modal. On a phone that modal opened at 92% of the screen
 * with the submit button below the fold, and on desktop it scrolled inside
 * itself against a fixed backdrop, which is the worst of both: a window inside
 * a window. A page has room to lay the same questions out calmly, and it gives
 * the enquiry a URL that can be linked, bookmarked and sent to someone.
 *
 * Every field is visible here. The modal had to hide four behind a disclosure
 * to fit; on a page there is space for all of them without crowding.
 */
export const EnquiryPage: React.FC<EnquiryPageProps> = ({ prefill, onBack }) => {
  const [details, setDetails] = useState<EnquiryDetails>({
    ...EMPTY,
    product: prefill?.product ?? '',
    size: prefill?.size ?? '',
    source: prefill?.source ?? 'enquiry page'
  });
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Arriving here is a navigation, so start at the top and put the cursor in
  // the first field — the visitor already chose to be here.
  useEffect(() => {
    window.scrollTo(0, 0);
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 150);
    return () => window.clearTimeout(id);
  }, []);

  const set = (key: keyof EnquiryDetails) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setDetails((d) => ({ ...d, [key]: e.target.value }));

  /* A chosen product narrows the size list to what that model is offered in. */
  const sizeOptions = useMemo(() => {
    const match = BLUESTAR_PRODUCTS.find((p) => p.name === details.product);
    return match ? match.displaySizes : PANEL_SIZES;
  }, [details.product]);

  const nameOk = details.name.trim().length > 1;
  /* Loose on format — +91, spaces and landline STDs all arrive in practice. */
  const phoneOk = details.phone.replace(/\D/g, '').length >= 10;
  const valid = nameOk && phoneOk;

  const nameError = (touched && !nameOk && 'Please tell us who to reply to.') || fieldErrors.clientName;
  const phoneError = (touched && !phoneOk && 'A 10-digit number, so we can call you back.') || fieldErrors.phone;

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setError(result.message || 'Something went wrong. Please try again.');
    if (result.fields) setFieldErrors(result.fields);
  };

  return (
    <div className="min-h-screen bg-[#d5e5f7] text-[#0b2545]">

      {/* Slim header — this is a page, so it gets a way back rather than an X. */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm font-bold text-[#0b2545] hover:text-[#0284c7] transition cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0284c7]/30"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span className="hidden xs:inline">Back to site</span>
            <span className="xs:hidden">Back</span>
          </button>
          <button type="button" onClick={onBack} className="cursor-pointer" aria-label="Bluestar Digitech home">
            <BluestarLogo className="h-7 sm:h-8 w-auto" color="#0b2545" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">

        {sent ? (
          /* Confirmation takes the whole page — nothing else competes with it. */
          <div className="max-w-xl mx-auto text-center py-10 sm:py-16">
            <div className="mx-auto w-16 h-16 rounded-full bg-[#dcf5ea] text-[#0f7a6d] flex items-center justify-center">
              <Check className="w-8 h-8" strokeWidth={3} aria-hidden="true" />
            </div>
            <h1 className="mt-5 text-3xl sm:text-4xl font-black font-condensed uppercase tracking-tight">
              Enquiry sent
            </h1>
            <p className="mt-3 text-base text-[#18487d] leading-relaxed">
              Thanks {details.name.trim().split(' ')[0] || 'for getting in touch'} — it is with our
              sales team now. We usually reply the same working day.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => openWhatsApp(buildEnquiryMessage(details))}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#128c7e] hover:bg-[#0f7a6d] text-white py-3.5 px-6 rounded-full font-bold text-sm transition cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                Talk to us now on WhatsApp
              </button>
              <button
                type="button"
                onClick={onBack}
                className="w-full sm:w-auto py-3.5 px-6 rounded-full font-bold text-sm text-[#0b2545] hover:bg-white transition cursor-pointer"
              >
                Back to site
              </button>
            </div>
            <p className="mt-8 inline-flex items-center gap-1.5 text-xs font-bold text-[#18487d]">
              <Phone className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
              In a hurry? Call {SALES_PHONE.display}
            </p>
          </div>
        ) : (
          <>
            <div className="max-w-2xl">
              <h1 className="text-3xl sm:text-5xl font-black font-condensed uppercase tracking-tight">
                Tell us what you need
              </h1>
              <p className="mt-3 text-base sm:text-lg text-[#18487d] leading-relaxed">
                {prefill?.context
                  ? prefill.context
                  : 'A screen size, a drawing, or a rough idea is enough to start. We usually come back the same working day.'}
              </p>
            </div>

            <div className="mt-8 sm:mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-start">

              {/* The form */}
              <form
                onSubmit={submit}
                noValidate
                className="lg:col-span-7 bg-white rounded-3xl border border-white shadow-sm p-5 sm:p-8"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  <div>
                    <label className={labelClass} htmlFor="enq-name">
                      Your name <span className="text-[#c2410c]">*</span>
                    </label>
                    <input
                      ref={firstFieldRef}
                      id="enq-name" name="name" autoComplete="name"
                      value={details.name} onChange={set('name')}
                      placeholder="e.g. Ravi Kumar"
                      aria-invalid={!!nameError}
                      aria-describedby={nameError ? 'enq-name-err' : undefined}
                      className={fieldClass}
                    />
                    {nameError && (
                      <p id="enq-name-err" className="mt-1.5 text-[11px] font-bold text-[#c2410c]">{nameError}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="enq-phone">
                      Phone / WhatsApp <span className="text-[#c2410c]">*</span>
                    </label>
                    <input
                      id="enq-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel"
                      value={details.phone} onChange={set('phone')}
                      placeholder="e.g. +91 98450 00000"
                      aria-invalid={!!phoneError}
                      aria-describedby={phoneError ? 'enq-phone-err' : undefined}
                      className={fieldClass}
                    />
                    {phoneError && (
                      <p id="enq-phone-err" className="mt-1.5 text-[11px] font-bold text-[#c2410c]">{phoneError}</p>
                    )}
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="enq-email">Email</label>
                    <input
                      id="enq-email" name="email" type="email" autoComplete="email"
                      value={details.email} onChange={set('email')}
                      placeholder="Optional" className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="enq-company">Company</label>
                    <input
                      id="enq-company" name="company" autoComplete="organization"
                      value={details.company} onChange={set('company')}
                      placeholder="Optional" className={fieldClass}
                    />
                  </div>

                  <div className="sm:col-span-2 pt-1 border-t border-[#eaf3fd]" />

                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="enq-product">Which product?</label>
                    <select
                      id="enq-product" name="product" value={details.product}
                      onChange={(e) => {
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
                      <option value="">Not sure yet — help me choose</option>
                      {BLUESTAR_PRODUCTS.map((p) => (
                        <option key={p.id} value={p.name}>{p.name}</option>
                      ))}
                      <option value="Custom sheet metal enclosure">Custom sheet metal enclosure</option>
                    </select>
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="enq-size">Screen size</label>
                    <select
                      id="enq-size" name="size" value={details.size} onChange={set('size')}
                      className={`${fieldClass} cursor-pointer`}
                    >
                      <option value="">Any</option>
                      {sizeOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className={labelClass} htmlFor="enq-qty">Quantity</label>
                    <input
                      id="enq-qty" name="quantity" inputMode="numeric"
                      value={details.quantity} onChange={set('quantity')}
                      placeholder="e.g. 10, or 10–15" className={fieldClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="enq-city">Where is it going?</label>
                    <input
                      id="enq-city" name="city" autoComplete="address-level2"
                      value={details.city} onChange={set('city')}
                      placeholder="e.g. Bangalore — site or city" className={fieldClass}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="enq-message">Anything else?</label>
                    <textarea
                      id="enq-message" name="message" rows={4}
                      value={details.message} onChange={set('message')}
                      placeholder="Branding, mounting, indoor or outdoor, a drawing you can send over — anything that helps us quote accurately."
                      className={`${fieldClass} resize-y min-h-[110px]`}
                    />
                  </div>

                  {/* Honeypot — hidden from people, from screen readers and from tabbing. */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="enq-website">Website</label>
                    <input id="enq-website" name="website" type="text" tabIndex={-1}
                      autoComplete="off" value={details.website} onChange={set('website')} />
                  </div>

                </div>

                {error && (
                  <p role="alert" className="mt-5 rounded-xl border border-[#f3cdb6] bg-[#fdf3ec] px-4 py-3 text-xs font-bold text-[#9a3412]">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 bg-[#0b2545] hover:bg-[#153b68] disabled:bg-[#5b7fa6] disabled:cursor-wait text-white py-4 px-6 rounded-full font-black text-base shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-95 disabled:hover:scale-100 cursor-pointer"
                >
                  {sending ? (
                    <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Sending…</>
                  ) : (
                    <><Send className="w-5 h-5 text-sky-300" aria-hidden="true" /> Send enquiry</>
                  )}
                </button>

                <p className="mt-3 text-xs text-[#5b7fa6] text-center">
                  Goes straight to our sales team. We usually reply the same working day.
                </p>
              </form>

              {/* Reassurance column — the reasons to trust the form, beside it
                  rather than stacked underneath where nobody scrolls. */}
              <aside className="lg:col-span-5 space-y-4">

                <div className="bg-white rounded-3xl border border-white shadow-sm p-5 sm:p-6">
                  <h2 className="text-base font-black text-[#0b2545]">Rather talk now?</h2>
                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => openWhatsApp(buildEnquiryMessage(details))}
                      className="w-full inline-flex items-center gap-3 bg-[#128c7e] hover:bg-[#0f7a6d] text-white px-4 py-3 rounded-2xl font-bold text-sm transition cursor-pointer"
                    >
                      <WhatsAppIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-left">WhatsApp {WHATSAPP_DISPLAY}</span>
                    </button>
                    <a
                      href={`tel:${SALES_PHONE.dial}`}
                      className="w-full inline-flex items-center gap-3 bg-[#eaf3fd] hover:bg-[#dbeafe] text-[#0b2545] px-4 py-3 rounded-2xl font-bold text-sm transition"
                    >
                      <Phone className="w-4 h-4 text-[#0284c7] flex-shrink-0" aria-hidden="true" />
                      Call {SALES_PHONE.display}
                    </a>
                    <a
                      href={buildEnquiryMailto(details, COMPANY.email)}
                      className="w-full inline-flex items-center gap-3 bg-[#eaf3fd] hover:bg-[#dbeafe] text-[#0b2545] px-4 py-3 rounded-2xl font-bold text-sm transition break-all"
                    >
                      <Mail className="w-4 h-4 text-[#0284c7] flex-shrink-0" aria-hidden="true" />
                      {COMPANY.email}
                    </a>
                  </div>
                  <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#18487d]">
                    <Clock className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
                    Mon–Sat, working hours IST
                  </p>
                </div>

                <div className="bg-white rounded-3xl border border-white shadow-sm p-5 sm:p-6">
                  <h2 className="text-base font-black text-[#0b2545]">What happens next</h2>
                  <ol className="mt-4 space-y-3 text-sm text-[#18487d]">
                    {[
                      'We read it and come back with questions or a quote.',
                      'Drawings and finishes are agreed before anything is cut.',
                      'Fabricated in Peenya, then installed and commissioned by us.'
                    ].map((step, i) => (
                      <li key={step} className="flex gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#0b2545] text-white text-[11px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="bg-white rounded-3xl border border-white shadow-sm p-5 sm:p-6">
                  <h2 className="inline-flex items-center gap-1.5 text-base font-black text-[#0b2545]">
                    <Factory className="w-4 h-4 text-[#0284c7]" aria-hidden="true" /> Visit the works
                  </h2>
                  <address className="mt-3 not-italic text-sm text-[#18487d] leading-relaxed">
                    {COMPANY.legalName}, {ADDRESS_ONE_LINE}
                  </address>
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-[#0284c7] hover:text-[#0b2545] transition"
                  >
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" /> Get directions
                  </a>
                  <p className="mt-4 pt-4 border-t border-[#eaf3fd] inline-flex items-center gap-1.5 text-[11px] font-bold text-[#18487d]">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0284c7]" aria-hidden="true" />
                    ISO 9001:2015 certified · Since {COMPANY.since}
                  </p>
                </div>

              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
};
