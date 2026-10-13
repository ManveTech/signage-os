/**
 * Where enquiries go.
 *
 * Every CTA on the site used to scroll to the footer, which is the one thing a
 * visitor who wants a price does not want. There are now two routes:
 *
 *   "Request a quote"  → WhatsApp, prefilled with whatever the visitor had on
 *                        screen (product, screen size, finish). One tap, no
 *                        typing, and the salesperson opens a message that
 *                        already says what is being asked about.
 *   "Enquire"          → the enquiry form (components/EnquiryModal.tsx), for
 *                        the longer conversation — site, quantity, drawings.
 *
 * NOTE ON THE NUMBER: WHATSAPP_DIAL is the brochure's Sales mobile. It is the
 * number a human answers, but whether WhatsApp Business is actually registered
 * against it is not something the brochure says — confirm with the client
 * before launch. If they use a different WhatsApp line, change it here and the
 * whole site follows.
 */

import { PHONES } from './company';

/** Sales mobile, digits only — wa.me takes no '+' and no spaces. */
export const WHATSAPP_DIAL = '918095851597';

/** Same number, formatted, for anything that shows it on screen. */
export const WHATSAPP_DISPLAY =
  PHONES.find((p) => p.dial === `+${WHATSAPP_DIAL}`)?.display ?? '+91 80958 51597';

/**
 * wa.me rather than api.whatsapp.com: it opens the installed app on a phone and
 * WhatsApp Web on a desktop, without the interstitial the api.* host shows.
 */
export function whatsappUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_DIAL}?text=${encodeURIComponent(message)}`;
}

/** Opens WhatsApp in a new tab, so the site stays where it was behind it. */
export function openWhatsApp(message: string): void {
  window.open(whatsappUrl(message), '_blank', 'noopener,noreferrer');
}

/** What the visitor was looking at when they asked. All of it optional. */
export interface QuoteContext {
  product?: string;
  /** Panel size, e.g. '55"'. */
  size?: string;
  finish?: string;
  quantity?: string;
  /** Where it is going — city, or the site description from the gallery. */
  site?: string;
  /** Which part of the page the request came from, for our own context. */
  from?: string;
}

/**
 * The message that lands in the salesperson's WhatsApp. Written in the
 * visitor's voice — they are the one sending it — and only the lines that are
 * actually known are included, so nobody has to send a message full of blanks.
 */
export function buildQuoteMessage(ctx: QuoteContext = {}): string {
  const lines = ['Hi Bluestar Digitech — I\'d like a quote.'];

  const detail: string[] = [];
  if (ctx.product) detail.push(`Product: ${ctx.product}`);
  if (ctx.size) detail.push(`Screen size: ${ctx.size}`);
  if (ctx.finish) detail.push(`Finish: ${ctx.finish}`);
  if (ctx.quantity) detail.push(`Quantity: ${ctx.quantity}`);
  if (ctx.site) detail.push(`Site: ${ctx.site}`);

  if (detail.length) lines.push('', ...detail);
  if (ctx.from) lines.push('', `(Sent from the ${ctx.from} on bluestardigitech.com)`);

  return lines.join('\n');
}

/** Fields the enquiry form collects. */
export interface EnquiryDetails {
  name: string;
  phone: string;
  company: string;
  product: string;
  size: string;
  quantity: string;
  city: string;
  message: string;
  /** Optional — the CMS records it, the WhatsApp message does not use it. */
  email?: string;
  /** Which part of the page the enquiry started from. */
  source?: string;
  /**
   * Honeypot. Filled only by bots that complete every input they find; the
   * CMS discards anything that arrives with this set. Never shown to a person,
   * so it stays empty for every real submission.
   */
  website?: string;
}

/** The form's answers, as a WhatsApp message. */
export function buildEnquiryMessage(d: EnquiryDetails): string {
  const lines = [`Hi Bluestar Digitech — enquiry from ${d.name || 'your website'}.`, ''];

  const add = (label: string, value: string) => {
    if (value.trim()) lines.push(`${label}: ${value.trim()}`);
  };

  add('Name', d.name);
  add('Company', d.company);
  add('Phone', d.phone);
  add('Product', d.product);
  add('Screen size', d.size);
  add('Quantity', d.quantity);
  add('Site / city', d.city);

  if (d.message.trim()) lines.push('', d.message.trim());

  return lines.join('\n');
}

/**
 * The same answers as a mailto, for anyone without WhatsApp. Not a substitute
 * for a real backend — both of these hand the lead to the visitor's own app, so
 * a lead is only captured if they press send. Wire the form to a POST endpoint
 * when there is one.
 */
export function buildEnquiryMailto(d: EnquiryDetails, email: string): string {
  const subject = d.product
    ? `Enquiry — ${d.product}${d.size ? ` (${d.size})` : ''}`
    : 'Project enquiry';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    buildEnquiryMessage(d)
  )}`;
}
