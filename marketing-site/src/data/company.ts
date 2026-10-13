/**
 * Company contact details, transcribed from the back page of the 2024
 * Blue Star Metacraft brochure (img/Edit-2024-Bluestarmetacraft (1).pdf, p.12).
 *
 * These replaced placeholder values that had been carried over from the
 * template — in particular the address was missing the estate and had the wrong
 * PIN (560058 vs 560091), and the enquiry address was a made-up
 * info@bluestardigitech.com.
 *
 * NOTE ON THE DOMAIN: the brochure lists bluestarmetacraft.com, while this site
 * is being built for bluestardigitech.com. The brochure address is used because
 * it is the one that is actually confirmed to exist. If the Digitech mailbox is
 * live, change EMAIL below and the whole site follows — it is referenced
 * nowhere else.
 */

export const COMPANY = {
  /** Trading name used across the site. */
  brand: 'Bluestar Digitech',
  /** Registered entity, as printed on the brochure. */
  legalName: 'Blue Star Metacraft',
  tagline: 'Precision Sheet Metal Works',
  since: 2015,

  email: 'info@bluestarmetacraft.com',

  address: {
    line1: 'Plot No. 23, 13th Cross',
    line2: 'Doddanna Industrial Area',
    line3: 'Peenya 2nd Stage',
    city: 'Bangalore',
    state: 'Karnataka',
    postalCode: '560091',
    country: 'India'
  }
} as const;

export interface PhoneNumber {
  /** As printed on the brochure, for display. */
  display: string;
  /** E.164, for the tel: link. */
  dial: string;
  kind: 'mobile' | 'landline';
  label: string;
}

export const PHONES: PhoneNumber[] = [
  { display: '+91 80958 51597', dial: '+918095851597', kind: 'mobile', label: 'Sales' },
  { display: '080 2836 9267', dial: '+918028369267', kind: 'landline', label: 'Office' },
  { display: '+91 97435 78783', dial: '+919743578783', kind: 'mobile', label: 'Enquiries' },
  { display: '+91 97432 29267', dial: '+919743229267', kind: 'mobile', label: 'Works' }
];

/** Single-line address, for schema.org and the maps link. */
export const ADDRESS_ONE_LINE = [
  COMPANY.address.line1,
  COMPANY.address.line2,
  COMPANY.address.line3,
  COMPANY.address.city,
  COMPANY.address.state,
  COMPANY.address.postalCode
].join(', ');

/**
 * A plain Maps search for the address rather than an embed: an embed needs an
 * API key and a confirmed place ID, and guessing a pin for a real factory would
 * send people to the wrong gate.
 */
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${COMPANY.legalName}, ${ADDRESS_ONE_LINE}`
)}`;
