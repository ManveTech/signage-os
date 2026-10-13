/**
 * Client testimonials.
 *
 * NOT LIVE. These were written for the template and are not attributable to a
 * real client, so <ReviewsSection> is commented out in App.tsx. Replace every
 * entry with a quote the client can stand behind before re-enabling it — and
 * the 4.9/5 summary and rating breakdown inside ReviewsSection.tsx with it.
 */
import type { CustomerReview } from '../types';

export const REVIEWS: CustomerReview[] = [
  {
    id: 'rev-1',
    author: 'Rajesh K.',
    location: 'Bangalore, Karnataka',
    verified: true,
    rating: 5,
    date: '3 days ago',
    product: 'Floor Standing Digital Standee',
    title: 'Outstanding build quality for our IT park lobby',
    comment: 'We ordered 12 units of the 55" Floor Standing Digital Standees for our Tech Park concourse. The steel housing, powder-coat finish, and anti-reflective glass exceeded expectations. Bluestar delivered on schedule and handled installation effortlessly.',
    helpfulCount: 42,
    avatarColor: 'bg-emerald-800 text-white'
  },
  {
    id: 'rev-2',
    author: 'Ananya S.',
    location: 'Mumbai, Maharashtra',
    verified: true,
    rating: 5,
    date: '1 week ago',
    product: 'Self-Service Kiosk',
    title: 'Perfect order-and-pay kiosk integration',
    comment: 'Customized 8 self-service ordering kiosks for our QSR chain with POS terminal cutouts and receipt printers. The internal cable routing and thermal design make maintenance super easy. Outstanding Peenya craftsmanship!',
    helpfulCount: 38,
    avatarColor: 'bg-sky-800 text-white'
  },
  {
    id: 'rev-3',
    author: 'Vikram R.',
    location: 'Hyderabad, Telangana',
    verified: true,
    rating: 5,
    date: '2 weeks ago',
    product: 'Active LED Video Wall',
    title: 'Seamless LED wall display for our command centre',
    comment: 'The active LED video wall installed by Bluestar Digitech in our operations centre has crisp 4K visual clarity and zero bezel gaps. Their engineering team worked overnight to complete the commissioning on deadline.',
    helpfulCount: 29,
    avatarColor: 'bg-blue-800 text-white'
  },
  {
    id: 'rev-4',
    author: 'Priya M.',
    location: 'Delhi NCR',
    verified: true,
    rating: 5,
    date: '3 weeks ago',
    product: 'Digital Coffee Table',
    title: 'Interactive touch table added a huge wow factor',
    comment: 'Installed the Digital Coffee Table in our executive lounge. Toughened top glass, zero lag multi-touch response, and sleek powder-coated pedestal. Guests constantly compliment the setup.',
    helpfulCount: 54,
    avatarColor: 'bg-[#0b2545] text-white'
  },
  {
    id: 'rev-5',
    author: 'Siddharth N.',
    location: 'Chennai, Tamil Nadu',
    verified: true,
    rating: 5,
    date: '1 month ago',
    product: 'A-Type Standee',
    title: 'Robust aluminium frame for high-footfall retail',
    comment: 'Bought 20 units of 43" A-Type standees for retail showrooms across South India. High brightness 500-nit displays cut through store glare, and sturdy base prevents accidental tipping.',
    helpfulCount: 19,
    avatarColor: 'bg-indigo-800 text-white'
  }
];
