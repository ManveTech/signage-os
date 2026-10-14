export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductStat {
  value: string;
  unit: string;
  label: string;
  sub: string;
}

export interface BluestarProduct {
  id: string;
  name: string;
  category: string;
  tagline: string;
  /** Big stacked hero headline, one word per line. */
  headline: string[];
  /** Three orbit stat circles in the hero's left column. */
  stats: ProductStat[];
  /**
   * Panel sizes offered for this model. The two standee lines carry the exact
   * ladder from their brochure spec sheets; the rest carry PANEL_SIZES, the
   * range Bluestar fits across the digital products. The LED wall is the one
   * exception — it is built to the wall, so it has no panel size.
   */
  displaySizes: string[];
  /** Body material, per the brochure's spec sheets. */
  material: string;
  /** Short selling points — rendered in the hero's left column. */
  features: string[];
  /** Technical detail — rendered in the hero's right column. */
  specs: ProductSpec[];
  /** Transparent-background render, sits on any section colour. */
  image: string;
  /** Full-resolution master, for print or detail views. */
  /**
   * Full-resolution master, kept in the repo at this path but deliberately
   * outside /public: nothing on the page renders it, and shipping all eight
   * added ~40 MB to every deploy. Use it for print and for re-exporting webp.
   */
  master: string;
  orientation: 'portrait' | 'landscape';
  /**
   * 'brochure'  — spec sheet printed in the 2024 brochure (pages 7 and 9).
   * 'platform'  — the shared controller/panel specs the brochure states for both
   *               standee lines, applied to the rest of the digital range.
   *               Confirm per-model figures before publishing.
   */
  specsSource: 'brochure' | 'platform';
}

/**
 * Panel sizes Bluestar fits across the digital range. The brochure prints this
 * ladder on the Floor Standing Standee spec sheet (page 7); the same commercial
 * panels go into the kiosks, podium and tables, so the range is stated for them
 * rather than fobbing the visitor off with "On request".
 *
 * If a model is actually offered in a narrower subset, narrow its displaySizes
 * here — this is the range, not a per-model spec sheet.
 */
export const PANEL_SIZES = ['32"', '43"', '50"', '55"', '65"'];

// The brochure prints full spec sheets for only two products; everything else
// uses the shared controller/panel platform below.
const PLATFORM_SPECS: ProductSpec[] = [
  { label: 'Resolution', value: '1920 × 1080 Full HD' },
  { label: 'Processor', value: 'Cortex A8 Quad Core 1.5 GHz' },
  { label: 'Connectivity', value: 'Ethernet, Wi-Fi, optional 4G' },
  { label: 'Power', value: 'AC 100–240 V, 50/60 Hz' },
  { label: 'Finish', value: 'Powder-coated, colour to spec' },
  { label: 'Screen sizes', value: '32" – 65"' }
];

// Brochure: "Silver (standard), customizable based on MOQ" + powder-coated/spray finish.
export const FINISH_OPTIONS = ['Silver (standard)', 'Custom colour (per MOQ)'];

export const BLUESTAR_PRODUCTS: BluestarProduct[] = [
  {
    id: 'floor-standing-standee',
    name: 'Floor Standing Digital Standee',
    category: 'Digital Signage',
    tagline: 'Indoor floor standing kiosk for high-traffic environments.',
    headline: ['FLOOR', 'STANDING', 'STANDEE'],
    stats: [
      { value: '65', unit: '"', label: 'Max Display', sub: 'From 32"' },
      { value: '600', unit: '', label: 'Nits', sub: 'Brightness' },
      { value: '10.5', unit: 'KG', label: 'Unit Weight', sub: '910×510×180' }
    ],
    displaySizes: ['32"', '43"', '50"', '55"', '65"'],
    material: 'Powder-coated steel, glass front',
    features: ['Plug & Play', 'Anti-reflective toughened glass', 'Vandal proof'],
    specs: [
      { label: 'Display', value: '1920 × 1080, 600 nits' },
      { label: 'Screen sizes', value: '32" · 43" · 50" · 55" · 65"' },
      { label: 'Processor', value: 'Cortex A8 Quad Core 1.5 GHz' },
      { label: 'Power', value: 'AC 100–240 V, max 40 W' },
      { label: 'Dimensions', value: '910 × 510 × 180 mm, 10.5 kg' },
      { label: 'Certification', value: 'CE, ROHS' }
    ],
    image: '/products/standee.webp',
    master: 'assets/masters/products/standee.png',
    orientation: 'portrait',
    specsSource: 'brochure'
  },
  {
    id: 'a-type-standee',
    name: 'A-Type Standee',
    category: 'Digital Signage',
    tagline: 'Slim-frame digital signage standee in aluminium or mild steel.',
    headline: ['A-TYPE', 'DIGITAL', 'STANDEE'],
    stats: [
      { value: '43', unit: '"', label: 'Max Display', sub: 'From 32"' },
      { value: '500', unit: '', label: 'Nits', sub: 'Brightness' },
      { value: '178', unit: '°', label: 'Viewing Angle', sub: 'Horiz & Vert' }
    ],
    displaySizes: ['32"', '43"'],
    material: 'Aluminium / mild steel',
    features: ['Sleek frame', 'Highly durable', 'Sturdy stands'],
    specs: [
      { label: 'Display', value: '1920 × 1080, 500 nits' },
      { label: 'Viewing angle', value: '178° / 178°' },
      { label: 'Screen sizes', value: '32" · 43"' },
      { label: 'Body', value: 'Aluminium / mild steel' },
      { label: 'Power', value: 'AC 100–240 V, max 40 W' },
      { label: 'Finish', value: 'Powder-coated, colour per MOQ' }
    ],
    image: '/products/a-type-standee.webp',
    master: 'assets/masters/products/a-type-standee.webp',
    orientation: 'portrait',
    specsSource: 'brochure'
  },
  {
    id: 'self-service-kiosk',
    name: 'Self-Service Kiosk',
    category: 'Interactive Kiosks',
    tagline: 'Order-and-pay terminal for QSR, retail and healthcare.',
    headline: ['SELF', 'SERVICE', 'KIOSK'],
    stats: [
      { value: '1080', unit: 'P', label: 'Full HD', sub: 'Resolution' },
      { value: '40', unit: 'W', label: 'Max Power', sub: 'Consumption' },
      { value: '5', unit: 'W×2', label: 'Built-in Audio', sub: '8 Ohm Speakers' }
    ],
    displaySizes: PANEL_SIZES,
    material: 'Powder-coated steel',
    features: ['Integrated payment terminal', 'Receipt printer bay', 'Powder-coated steel body'],
    specs: PLATFORM_SPECS,
    image: '/products/self-service-kiosk.webp',
    master: 'assets/masters/products/self-service-kiosk.png',
    orientation: 'portrait',
    specsSource: 'platform'
  },
  {
    id: 'information-kiosk',
    name: 'Information Kiosk',
    category: 'Interactive Kiosks',
    tagline: 'Compact wayfinding and enquiry terminal.',
    headline: ['INFORMATION', 'KIOSK'],
    stats: [
      { value: '1080', unit: 'P', label: 'Full HD', sub: 'Resolution' },
      { value: '40', unit: 'W', label: 'Max Power', sub: 'Consumption' },
      { value: '5', unit: 'W×2', label: 'Built-in Audio', sub: '8 Ohm Speakers' }
    ],
    displaySizes: PANEL_SIZES,
    material: 'Powder-coated steel',
    features: ['Compact footprint', 'Card and receipt slot', 'Floor or wall mount'],
    specs: PLATFORM_SPECS,
    image: '/products/info-kiosk.webp',
    master: 'assets/masters/products/info-kiosk.png',
    orientation: 'portrait',
    specsSource: 'platform'
  },
  {
    id: 'digital-podium',
    name: 'Digital Podium',
    category: 'Interactive Kiosks',
    tagline: 'Dual-screen lectern for auditoriums and boardrooms.',
    headline: ['DIGITAL', 'PODIUM'],
    stats: [
      { value: '1080', unit: 'P', label: 'Full HD', sub: 'Resolution' },
      { value: '40', unit: 'W', label: 'Max Power', sub: 'Consumption' },
      { value: '5', unit: 'W×2', label: 'Built-in Audio', sub: '8 Ohm Speakers' }
    ],
    displaySizes: PANEL_SIZES,
    material: 'Powder-coated steel',
    features: ['Dual-screen lectern', 'LED accent base', 'Cable-managed column'],
    specs: PLATFORM_SPECS,
    image: '/products/podium.webp',
    master: 'assets/masters/products/podium.png',
    orientation: 'portrait',
    specsSource: 'platform'
  },
  {
    id: 'multi-touch-table',
    name: 'Multi-Touch Table',
    category: 'Touch Solutions',
    // "curved steel pedestal" described the render that used to sit here, which
    // was a standing kiosk and not a table at all.
    tagline: 'Large-format interactive table in a powder-coated steel body.',
    headline: ['MULTI', 'TOUCH', 'TABLE'],
    stats: [
      { value: '1080', unit: 'P', label: 'Full HD', sub: 'Resolution' },
      { value: '40', unit: 'W', label: 'Max Power', sub: 'Consumption' },
      { value: '5', unit: 'W×2', label: 'Built-in Audio', sub: '8 Ohm Speakers' }
    ],
    displaySizes: PANEL_SIZES,
    material: 'Powder-coated steel',
    features: ['Multi-touch landscape display', 'Screen set flush into the table top', 'Commercial-grade panel'],
    specs: PLATFORM_SPECS,
    image: '/products/touch-table.webp',
    master: 'assets/masters/products/touch-table.webp',
    orientation: 'landscape',
    specsSource: 'platform'
  },
  {
    id: 'digital-coffee-table',
    name: 'Digital Coffee Table',
    category: 'Touch Solutions',
    tagline: 'Low-height touch surface for lounges and waiting areas.',
    headline: ['DIGITAL', 'COFFEE', 'TABLE'],
    stats: [
      { value: '1080', unit: 'P', label: 'Full HD', sub: 'Resolution' },
      { value: '40', unit: 'W', label: 'Max Power', sub: 'Consumption' },
      { value: '5', unit: 'W×2', label: 'Built-in Audio', sub: '8 Ohm Speakers' }
    ],
    displaySizes: PANEL_SIZES,
    material: 'Powder-coated steel, toughened glass',
    features: ['Low-height touch surface', 'Lounge and waiting-area format', 'Toughened glass top'],
    specs: PLATFORM_SPECS,
    image: '/products/coffee-table.webp',
    master: 'assets/masters/products/coffee-table.png',
    orientation: 'landscape',
    specsSource: 'platform'
  },
  {
    id: 'led-video-wall',
    name: 'Active LED Video Wall',
    category: 'LED Displays',
    tagline: 'Seamless tiled LED display, built to your wall dimensions.',
    headline: ['ACTIVE', 'LED VIDEO', 'WALL'],
    stats: [
      { value: 'ANY', unit: '', label: 'Custom Size', sub: 'Built To Spec' },
      { value: 'IN', unit: '/OUT', label: 'Door Rated', sub: 'Both Environments' },
      { value: '0', unit: 'MM', label: 'Seamless', sub: 'Tiled Panels' }
    ],
    displaySizes: ['Built to wall size'],
    material: 'Tiled LED panels, steel frame',
    features: ['Seamless tiled panels', 'Indoor and outdoor rated', 'Custom size to spec'],
    specs: [
      { label: 'Configuration', value: 'Tiled panel array' },
      { label: 'Pixel pitch', value: 'To suit viewing distance' },
      { label: 'Size', value: 'Built to wall dimensions' },
      { label: 'Mounting', value: 'Wall, floor stand or hoarding' },
      { label: 'Power', value: 'AC 100–240 V, 50/60 Hz' },
      { label: 'Environment', value: 'Indoor / outdoor rated' }
    ],
    image: '/products/led-video-wall.webp',
    master: 'assets/masters/products/led-video-wall.webp',
    orientation: 'landscape',
    specsSource: 'platform'
  }
];
