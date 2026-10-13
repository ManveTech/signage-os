export interface BluestarService {
  id: string;
  name: string;
  blurb: string;
  /** Web-optimised WebP, ~100-145KB. */
  image: string;
  /**
   * Full-resolution master, kept in the repo at this path but deliberately
   * outside /public: nothing on the page renders it, and shipping all eight
   * added ~40 MB to every deploy. Use it for print and for re-exporting webp.
   */
  master: string;
}

// Capabilities grid as listed on page 3 of the 2024 Blue Star Metacraft brochure.
// Imagery is illustrative of the process, not photographs of the Peenya facility.
export const BLUESTAR_SERVICES: BluestarService[] = [
  {
    id: 'cnc-turning',
    name: 'CNC Turning',
    blurb:
      'Precision turned components machined to tight tolerances on CNC lathes.',
    image: '/services/cnc-turning.webp',
    master: 'assets/masters/services/cnc-turning.png'
  },
  {
    id: 'metal-fabrication',
    name: 'Precision Metal Fabrication',
    blurb:
      'End-to-end sheet metal fabrication, from raw sheet to finished powder-coated assembly.',
    image: '/services/metal-fabrication.webp',
    master: 'assets/masters/services/metal-fabrication.png'
  },
  {
    id: 'cnc-laser-cutting',
    name: 'CNC Laser Cutting',
    blurb:
      'Fibre laser cutting for clean, burr-free profiles in mild steel, stainless and aluminium.',
    image: '/services/cnc-laser-cutting.webp',
    master: 'assets/masters/services/cnc-laser-cutting.png'
  },
  {
    id: 'cnc-bending',
    name: 'CNC Bending',
    blurb:
      'Press brake forming with repeatable bend angles across high-volume production runs.',
    image: '/services/cnc-bending.webp',
    master: 'assets/masters/services/cnc-bending.png'
  },
  {
    id: 'quality-control',
    name: 'Quality Control',
    blurb:
      'ISO 9001:2015 inspection process, with every part measured against drawing before dispatch.',
    image: '/services/quality-control.webp',
    master: 'assets/masters/services/quality-control.png'
  },
  {
    id: 'expert-team',
    name: 'Experienced Team',
    blurb:
      'Engineers with deep experience across every stage of metal fabrication.',
    image: '/services/expert-team.webp',
    master: 'assets/masters/services/expert-team.png'
  }
];
