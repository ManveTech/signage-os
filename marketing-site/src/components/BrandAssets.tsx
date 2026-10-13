import React from 'react';
import { BLUESTAR_PRODUCTS } from '../data/bluestarProducts';

/**
 * The real Bluestar Digitech lockup, taken from the brand files used by the
 * signage-os player (src/assets/bluestar-logo-on-light.png) rather than redrawn
 * in SVG — the wordmark has a custom star cut into the "A" and a kiosk glyph in
 * the "B" that no font reproduces.
 *
 * The `color` prop is kept from the old SVG version so callers do not change:
 * white means "sitting on a dark panel", which gets the plaque treatment, since
 * the artwork's "DIGITECH" row is dark grey and disappears on navy.
 */
export const BluestarLogo: React.FC<{
  className?: string;
  color?: string;
  variant?: 'hero' | 'compact' | 'footer';
  /** The hero paints this immediately; everything else can wait. */
  priority?: boolean;
}> = ({
  className = 'w-full max-w-[640px]',
  color = '#0b2545',
  variant = 'hero',
  priority = false
}) => {
  const onDark =
    color === '#ffffff' || color.toLowerCase() === '#fff' || color === 'white';

  const img = (
    <img
      src="/brand/bluestar-logo.webp"
      width={1107}
      height={352}
      alt="Bluestar Digitech — digital kiosks, designed and built for tomorrow"
      className={onDark ? 'w-full h-auto' : `${className} select-none`}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
    />
  );

  if (variant === 'compact') {
    return (
      <span className={`inline-flex items-center ${className}`} id="brand-logo-compact">
        {img}
      </span>
    );
  }

  if (onDark) {
    // A white plaque keeps the artwork legible on the footer navy without
    // recolouring somebody else's logo.
    return (
      <span className={`inline-flex bg-white rounded-2xl px-4 py-3 shadow-sm ${className}`}>
        {img}
      </span>
    );
  }

  return img;
};

// Hero showcase: the product range cross-fading in the centre slot.
// Uses the transparent-background renders in /public/products, so it stays sharp
// at any size and sits on the page colour with no visible frame.
// Controlled: the hero owns the active index so the surrounding feature and spec
// columns change in step with the image.
export const ProductShowcaseLoop: React.FC<{
  className?: string;
  index: number;
}> = ({ className = 'w-full max-w-[380px]', index }) => {
  return (
    <div
      className={`relative select-none mx-auto aspect-[3/4] ${className}`}
      id="hero-product-loop"
    >
      {BLUESTAR_PRODUCTS.map((p, i) => (
        <img
          key={p.id}
          src={p.image}
          alt={`${p.name} — ${p.tagline}`}
          // Only the first frame is eager; the rest stream in behind it.
          loading={i === 0 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : 'auto'}
          decoding="async"
          aria-hidden={i !== index}
          className={`absolute inset-0 w-full h-full object-contain transition-opacity duration-700 ease-in-out ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
    </div>
  );
};
