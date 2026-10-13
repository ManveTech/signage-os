export interface CustomerReview {
  id: string;
  author: string;
  location: string;
  verified: boolean;
  rating: number;
  date: string;
  /** Which product the client bought. Was `flavor` in the matcha template. */
  product: string;
  title: string;
  comment: string;
  helpfulCount: number;
  avatarColor: string;
}

export interface FaqItem {
  question: string;
  answer: string;
  /** Trimmed of the template's taste/nutrition/usage/shipping categories. */
  category: 'customization' | 'warranty' | 'installation' | 'lead-time' | 'specs';
}
