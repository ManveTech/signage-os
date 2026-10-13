/**
 * Client marks, taken from the brand folder of the signage-os project
 * (src/assets/logos). These are third-party trademarks shown to indicate who
 * Bluestar has supplied — get written sign-off from the client before this goes
 * live, and drop any name they cannot evidence.
 */
export interface ClientLogo {
  id: string;
  /** Full legal/brand name, used as the image alt text. */
  name: string;
  /** Short label under the mark. */
  sector: string;
  image: string;
  /** Rendered height in px at desktop; crests need more than wordmarks. */
  scale: 'crest' | 'wordmark';
}

export const CLIENT_LOGOS: ClientLogo[] = [
  {
    id: 'hal',
    name: 'Hindustan Aeronautics Limited',
    sector: 'Aerospace & Defence',
    image: '/clients/hal.webp',
    scale: 'wordmark'
  },
  {
    id: 'indian-railways',
    name: 'Indian Railways',
    sector: 'Public Transport',
    image: '/clients/indian-railways.webp',
    scale: 'crest'
  },
  {
    id: 'ada',
    name: 'Aeronautical Development Agency, Ministry of Defence',
    sector: 'Government R&D',
    image: '/clients/ada.webp',
    scale: 'crest'
  },
  {
    id: 'cognizant',
    name: 'Cognizant',
    sector: 'IT Services',
    image: '/clients/cognizant.webp',
    scale: 'wordmark'
  },
  {
    id: 'flipkart',
    name: 'Flipkart',
    sector: 'E-commerce',
    image: '/clients/flipkart.webp',
    scale: 'wordmark'
  },
  {
    id: 'biocon',
    name: 'Biocon',
    sector: 'Biopharmaceuticals',
    image: '/clients/biocon.webp',
    scale: 'wordmark'
  },
  {
    id: 'audi',
    name: 'Audi',
    sector: 'Automotive Retail',
    image: '/clients/audi.webp',
    scale: 'wordmark'
  }
];
