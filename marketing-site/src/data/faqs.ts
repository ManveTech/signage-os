import type { FaqItem } from '../types';

// Answers also feed the FAQPage structured data — see FaqSection.tsx.
export const FAQS: FaqItem[] = [
  {
    category: 'customization',
    question: 'Can kiosks and standees be custom-branded with our corporate colours and logo?',
    answer: 'Yes! All kiosk enclosures, digital standees, and metal housings are fabricated in-house at our Peenya unit in Bangalore. We offer custom powder-coating in any RAL shade, laser-etched branding, vinyl wraps, and custom cutouts for POS terminals, scanners, or cameras.'
  },
  {
    category: 'warranty',
    question: 'What warranty and quality certifications do Bluestar products come with?',
    answer: 'All Bluestar Digitech products are built under ISO 9001:2015 quality procedures and come with CE and ROHS certification. We provide a comprehensive 1-year commercial warranty, with optional extended AMC service contracts.'
  },
  {
    category: 'installation',
    question: 'Do you provide PAN-India delivery and on-site installation?',
    answer: 'Yes, we have deployed over 4,000 digital kiosks, standees, and LED video walls across India. Our field engineering team manages end-to-end delivery, structural mounting, wiring, and software configuration on site.'
  },
  {
    category: 'lead-time',
    question: 'What is the typical manufacturing lead time for orders?',
    answer: 'Standard digital standees and kiosks are typically dispatched within 5 to 7 business days. Custom sheet metal enclosures or large-scale active LED video wall projects are delivered within 2 to 3 weeks depending on quantity.'
  },
  {
    category: 'specs',
    question: 'What commercial display panels and processors do you use?',
    answer: 'We integrate commercial 24/7-rated Full HD and 4K displays with high brightness (up to 600 nits) and anti-reflective toughened glass. Driven by high-performance quad-core Android (Cortex A8) or Windows media players with Wi-Fi, Ethernet, and 4G options.'
  }
];
