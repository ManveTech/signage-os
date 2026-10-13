/**
 * The CMS at cms.bluestardigitech.com.
 *
 * Two public endpoints, both unauthenticated — this site has no account to
 * sign in with. See documentation/api_spec.md § 6 in the repo root.
 *
 * VITE_CMS_API is inlined by Vite at build time (set as a build arg in the
 * Dockerfile), so changing it means rebuilding the image. It falls back to the
 * production origin rather than localhost: a build that forgets the variable
 * should reach the real CMS, not silently drop every lead on the floor.
 */

import type { EnquiryDetails } from './enquiry';

export const CMS_API =
  (import.meta.env?.VITE_CMS_API || 'https://cms.bluestardigitech.com/api/v1')
    .trim()
    .replace(/\/+$/, '');

/** Contact details maintained in the dashboard, not in this repo. */
export interface CmsContact {
  name: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
  /** wa.me format: country code + digits, no '+'. */
  whatsappNumber: string;
}

/*
 * One shape with optional members rather than the obvious discriminated union
 * (`{ok:true} | {ok:false, message:string}`). This project compiles with
 * `strict` off, and TypeScript only narrows a discriminated union when
 * strictNullChecks is on — so `if (result.ok) return;` would not have given
 * the caller a typed `result.message` afterwards. Turn `strict` on in
 * tsconfig.json and this can go back to being a union.
 */
export interface LeadResult {
  ok: boolean;
  /** Set when `ok` is false — what to show the visitor. */
  message?: string;
  /** Per-field messages from the server's validator, so the form can mark them. */
  fields?: Record<string, string>;
}

/** A lead the CMS will accept — publicLeadSchema's shape, not this form's. */
function toLeadPayload(d: EnquiryDetails) {
  return {
    clientName: d.name.trim(),
    phone: d.phone.trim(),
    // The number they gave is the one they want to be reached on; the CMS
    // falls back to `phone` if this is blank, so sending it is just explicit.
    whatsapp: d.phone.trim(),
    email: d.email?.trim() || '',
    company: d.company.trim(),
    product: d.product.trim(),
    displaySize: d.size.trim(),
    quantity: d.quantity.trim(),
    city: d.city.trim(),
    message: d.message.trim(),
    source: d.source?.trim() || 'website',
    // The honeypot. A real visitor never sees the input that fills this, so
    // the server treats a non-empty value as a bot and quietly discards it.
    website: d.website || ''
  };
}

/**
 * Posts an enquiry. Never throws — the caller is a form submit handler, and a
 * network error there has to become a message, not an unhandled rejection.
 */
export async function submitLead(details: EnquiryDetails): Promise<LeadResult> {
  let res: Response;
  try {
    res = await fetch(`${CMS_API}/public/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toLeadPayload(details))
    });
  } catch {
    // Offline, DNS, CORS — indistinguishable from here by design.
    return {
      ok: false,
      message: 'We could not reach our server. Send it on WhatsApp instead, or give us a ring.'
    };
  }

  if (res.ok) return { ok: true };

  if (res.status === 400) {
    // { error, details: [{ field, message }] } from validateBody().
    const body = await res.json().catch(() => null);
    const fields: Record<string, string> = {};
    for (const d of body?.details ?? []) {
      if (d?.field && d?.message) fields[d.field] = d.message;
    }
    return {
      ok: false,
      message: 'Please check the details below.',
      fields: Object.keys(fields).length ? fields : undefined
    };
  }

  if (res.status === 429) {
    return {
      ok: false,
      message: 'That is a few enquiries in a short time. Please ring us instead — we would rather talk anyway.'
    };
  }

  return {
    ok: false,
    message: 'Something went wrong at our end. Send it on WhatsApp instead, or give us a ring.'
  };
}

/**
 * Contact details from the dashboard. Returns null on any failure so callers
 * fall back to the values compiled into data/company.ts — the footer must
 * still show a phone number when the CMS is unreachable.
 */
export async function fetchContact(): Promise<CmsContact | null> {
  try {
    const res = await fetch(`${CMS_API}/public/contact`);
    if (!res.ok) return null;
    const c = await res.json();
    return {
      name: c?.name || '',
      address: c?.address || '',
      contactEmail: c?.contactEmail || '',
      contactPhone: c?.contactPhone || '',
      whatsappNumber: c?.whatsappNumber || ''
    };
  } catch {
    return null;
  }
}
