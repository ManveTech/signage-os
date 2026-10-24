/**
 * Every page on the site, in one table.
 *
 * The site used to be a single URL with `#fragment` nav. Search engines
 * discard fragments, so Google saw one page and had nothing to build sitelinks
 * from — see SEO.md. These are real paths instead.
 *
 * Three things have to agree whenever this table changes, and nothing enforces
 * it automatically:
 *
 *   1. `nginx.conf.template` needs a `location` block per path, or a direct
 *      visit or refresh on that URL 301s to the homepage.
 *   2. `public/sitemap.xml` needs a `<url>` entry, or Google may never find it.
 *   3. `npm run build` — the title/description below are applied at runtime by
 *      App.tsx, so nothing fails loudly if one is missing.
 */

export interface SiteRoute {
  path: string;
  /** Short label for the header and footer nav. */
  label: string;
  /** Full <title>. Keep under ~60 characters so it is not truncated. */
  title: string;
  /** Meta description. ~150–160 characters. */
  description: string;
  /** Shown on the homepage's section grid. Omit to keep it out of there. */
  blurb?: string;
}

const BRAND = 'Bluestar Digitech';

export const ROUTES: SiteRoute[] = [
  {
    path: '/',
    label: 'Home',
    title: `${BRAND} | Digital Signage, Touch Kiosks & LED Video Walls`,
    description:
      'ISO 9001:2015 certified manufacturer of digital standees, interactive touch kiosks, touch tables, digital podiums and LED video walls, fabricated in-house in Peenya, Bangalore.'
  },
  {
    path: '/products',
    label: 'Products',
    title: `Products | Digital Standees & Touch Kiosks — ${BRAND}`,
    description:
      'Floor standing standees, A-type standees, self-service and information kiosks, digital podiums, multi-touch tables and LED video walls — 16.5" to 65", powder-coated and built to specification.',
    blurb: 'Eight product lines, 16.5" to 65", each built to your specification.'
  },
  {
    path: '/installations',
    label: 'Installations',
    title: `Installations | Digital Signage Across India — ${BRAND}`,
    description:
      'Digital standees, self-service kiosks, touch tables and LED video walls supplied, installed and commissioned across India — photographed on site and on our Peenya factory floor.',
    blurb: 'Photographs of real units, on site and on the factory floor.'
  },
  {
    path: '/about',
    label: 'About',
    title: `About | Sheet Metal & Kiosk Manufacturer in Bangalore — ${BRAND}`,
    description:
      'ISO 9001:2015 certified precision sheet metal works in Peenya, Bangalore. CNC laser cutting, press-brake bending, powder coating, assembly and on-site commissioning — all under one roof since 2015.',
    blurb: 'Who we are, how we build, and why it is all under one roof.'
  },
  {
    path: '/faq',
    label: 'FAQ',
    title: `FAQ, Warranty & Lead Times — ${BRAND}`,
    description:
      'Lead times, warranty and AMC, panel sizes, custom enclosures, installation and commissioning — the questions we are asked most, answered by our engineering team.',
    blurb: 'Lead times, warranty, AMC and what we can customise.'
  },
  {
    path: '/contact',
    label: 'Contact',
    title: `Contact | Peenya, Bangalore — ${BRAND}`,
    description:
      'Call, WhatsApp or email Bluestar Digitech, or visit the works at Doddanna Industrial Area, Peenya 2nd Stage, Bangalore 560091.',
    blurb: 'Call, WhatsApp, email, or come and see the works.'
  },
  {
    path: '/enquire',
    label: 'Enquire',
    title: `Request a Quote | ${BRAND} — Digital Signage & Kiosks`,
    description:
      'Tell us the product, screen size and site and we will come back with a quote. ISO 9001:2015 certified digital standee, touch kiosk and LED video wall manufacturer in Peenya, Bangalore.'
  }
];

export const HOME = ROUTES[0];

/**
 * Paths in the header and footer nav, in order.
 *
 * Home is included. Once the site stopped being one page there was no way to
 * get back to it from the nav, and the logo only scrolled to the top of
 * whatever page you were already on. Enquire is excluded — it has its own
 * button in the bar.
 */
export const NAV_ROUTES = ROUTES.filter((r) => r.path !== '/enquire');

/** Cards on the homepage. Same set as the nav, plus their blurbs. */
export const SECTION_ROUTES = NAV_ROUTES.filter((r) => r.blurb);

export function routeFor(pathname: string): SiteRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((r) => r.path === clean) ?? HOME;
}

export function isKnownPath(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.some((r) => r.path === clean);
}
