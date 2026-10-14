export interface Installation {
  id: string;
  /** Photo of the unit in situ (or on the floor), cropped 9:16. */
  image: string;
  /** What was supplied. */
  product: string;
  /** Where it went — kept generic; confirm before naming a client publicly. */
  site: string;
  location: string;
  note: string;
  /** Small round thumbnail in the modal header — reuses the product render. */
  thumb: string;
}

// Photographs of real Blue Star Metacraft work, from /img.
// Site names are deliberately descriptive rather than branded: several of these
// photos show client marks, so get sign-off before naming any of them on the site.
export const INSTALLATIONS: Installation[] = [
  {
    id: 'led-tower',
    image: '/installations/01-led-tower.webp',
    product: 'Active LED Video Wall',
    site: 'Tech Park Facade Tower',
    location: 'Bangalore',
    note: 'Full-height outdoor LED tower fabricated, clad and commissioned on site.',
    thumb: '/products/led-video-wall.webp'
  },
  {
    id: 'led-outdoor',
    image: '/installations/02-led-outdoor.webp',
    product: 'Outdoor LED Display',
    site: 'Roadside Hoarding',
    location: 'Bangalore',
    note: 'Weather-rated outdoor LED hoarding on a fabricated steel support frame.',
    thumb: '/products/led-video-wall.webp'
  },
  {
    id: 'led-streetside',
    image: '/installations/03-led-streetside.webp',
    product: 'Outdoor LED Display',
    site: 'Hospital Streetside Signage',
    location: 'Bangalore',
    note: 'Round-the-clock streetside display with a powder-coated enclosure.',
    thumb: '/products/led-video-wall.webp'
  },
  {
    id: 'showroom',
    image: '/installations/08-showroom.webp',
    product: 'Floor Standing Digital Standee',
    site: 'Retail Showroom',
    location: 'Bangalore',
    note: 'Row of floor standing standees supplied for a showroom display wall.',
    thumb: '/products/standee.webp'
  },
  {
    id: 'qsr-kiosks',
    image: '/installations/05-qsr-kiosks.webp',
    product: 'Self-Service Kiosk',
    site: 'Quick-Service Restaurant',
    location: 'Multi-site rollout',
    note: 'Order-and-pay kiosks with integrated payment terminals and receipt printers.',
    thumb: '/products/self-service-kiosk.webp'
  },
  {
    id: 'hospital-standees',
    image: '/installations/06-hospital-standees.webp',
    product: 'Floor Standing Digital Standee',
    site: "Women's & Children's Hospital",
    location: 'Bangalore',
    note: 'Wayfinding and information standees for a hospital reception floor.',
    thumb: '/products/standee.webp'
  },
  {
    id: 'lobby-standee',
    image: '/installations/07-lobby-standee.webp',
    product: 'Floor Standing Digital Standee',
    site: 'Corporate Lobby',
    location: 'Bangalore',
    note: 'Single portrait standee handed over at a corporate reception.',
    thumb: '/products/standee.webp'
  },
  {
    id: 'cafe-standee',
    image: '/installations/04-cafe-standee.webp',
    product: 'Floor Standing Digital Standee',
    site: 'Restaurant Entrance',
    location: 'Bangalore',
    note: 'Branded standee with a custom powder-coated base running live content.',
    thumb: '/products/standee.webp'
  },
  {
    // The photo is a standing information kiosk — angled landscape screen on a
    // pedestal. It was captioned as a Multi-Touch Table, which is a different
    // product entirely (a table you stand around, not a kiosk you stand at).
    id: 'kiosk-floor',
    image: '/installations/09-touch-table.webp',
    product: 'Information Kiosk',
    site: 'Peenya Facility',
    location: 'In production',
    note: 'Information kiosk on the floor ahead of final inspection.',
    thumb: '/products/info-kiosk.webp'
  },
  {
    id: 'podium',
    image: '/installations/10-podium.webp',
    product: 'Digital Podium',
    site: 'Peenya Facility',
    location: 'In production',
    note: 'Dual-screen podium with its LED accent base fitted and powered up.',
    thumb: '/products/podium.webp'
  },
  {
    // Also information kiosks, not A-Type standees — an A-Type is a portrait
    // screen on folding A-frame legs (brochure p.8-9), nothing like these.
    id: 'kiosk-batch',
    image: '/installations/11-standee-batch.webp',
    product: 'Information Kiosk',
    site: 'Peenya Facility',
    location: 'In production',
    note: 'Batch of powder-coated kiosk bodies awaiting panel fitment.',
    thumb: '/products/info-kiosk.webp'
  },
  {
    id: 'info-kiosks',
    image: '/installations/12-info-kiosks.webp',
    product: 'Information Kiosk',
    site: 'Peenya Facility',
    location: 'Ready for dispatch',
    note: 'Information kiosks with card and receipt slots, finished and crated.',
    thumb: '/products/info-kiosk.webp'
  }
];

// Grouped into the three tilted cards: outdoor signage, live installs, production floor.
export const CARD_OUTDOOR = INSTALLATIONS.slice(0, 4);
export const CARD_INSTALLED = INSTALLATIONS.slice(4, 8);
export const CARD_PRODUCTION = INSTALLATIONS.slice(8, 12);
