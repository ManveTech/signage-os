import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import iconLayer from '../assets/splash/icon.png';
import wordmarkLayer from '../assets/splash/wordmark.png';
import digitechLayer from '../assets/splash/digitech.png';
import taglineLayer from '../assets/splash/tagline.png';

/**
 * Code-driven recreation of the BlueStar DigiTech logo reveal (originally a
 * 2.9s video, sped up to ~1s) — built from the real logo cut into four same-size, pre-aligned
 * layers (src/assets/splash), so it stays sharp at any size and needs no
 * video file. Mirrored in the TV app's SplashLogoAnimation.kt; keep the
 * timeline in sync if either changes.
 *
 *   0.0–0.25s icon fades in alone, centred, with a blue glow that settles
 *   0.25–0.5s icon slides left as BLUESTAR wipes in from behind it
 *   0.35–0.8s a light sheen sweeps across icon + wordmark
 *   0.55–0.8s DIGITECH fades up
 *   0.7–0.95s tagline fades up
 */
export const SPLASH_LOGO_DURATION_MS = 1000;

// Icon's own centre sits ~15.5% across the canvas; nudging it by the
// difference puts it dead-centre for the opening "icon alone" beat.
const ICON_CENTRING_OFFSET = '34.5%';
// Wordmark/DIGITECH/tagline all start at x≈377 of the 1217px-wide canvas.
const TEXT_LEFT_INSET = '31%';

const layer = 'absolute inset-0 h-full w-full select-none';
const easeOut = [0.22, 1, 0.36, 1] as const;

const LAYERS = [iconLayer, wordmarkLayer, digitechLayer, taglineLayer];

export default function SplashLogoAnimation({
  className = '',
  onReady,
}: {
  className?: string;
  /** Fires once all layers are decoded and the reveal actually starts. */
  onReady?: () => void;
}) {
  // Hold the reveal until every layer is decoded — on a slow device the
  // timeline would otherwise run while images are still loading, and most of
  // it would play out invisibly.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      LAYERS.map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => undefined);
      })
    ).then(() => {
      if (cancelled) return;
      setReady(true);
      onReady?.();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`relative ${className}`}
      style={{ aspectRatio: '1217 / 399' }}
      role="img"
      aria-label="BlueStar DigiTech"
    >
      {ready && (
      <>
      <motion.img
        src={iconLayer}
        alt=""
        draggable={false}
        className={layer}
        initial={{ opacity: 0, scale: 1.08, x: ICON_CENTRING_OFFSET, filter: 'drop-shadow(0px 0px 22px rgba(47,140,255,0.95))' }}
        animate={{
          opacity: [0, 1, 1],
          scale: [1.08, 1, 1],
          x: [ICON_CENTRING_OFFSET, ICON_CENTRING_OFFSET, '0%'],
          filter: [
            'drop-shadow(0px 0px 22px rgba(47,140,255,0.95))',
            'drop-shadow(0px 0px 4px rgba(47,140,255,0.25))',
            'drop-shadow(0px 0px 0px rgba(47,140,255,0))',
          ],
        }}
        transition={{ duration: 0.5, times: [0, 0.5, 1], ease: easeOut }}
      />

      <motion.img
        src={wordmarkLayer}
        alt=""
        draggable={false}
        className={layer}
        initial={{ clipPath: `inset(0% 100% 0% ${TEXT_LEFT_INSET})` }}
        animate={{ clipPath: `inset(0% 0% 0% ${TEXT_LEFT_INSET})` }}
        transition={{ delay: 0.25, duration: 0.3, ease: easeOut }}
      />

      {/* Sheen: a soft white band masked to the icon + wordmark shapes, so it
          only lights up the logo itself, never the background around it. */}
      <motion.div
        aria-hidden
        className={`${layer} pointer-events-none`}
        style={{
          backgroundImage:
            'linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.75) 50%, transparent 58%)',
          backgroundSize: '300% 100%',
          backgroundRepeat: 'no-repeat',
          WebkitMaskImage: `url(${iconLayer}), url(${wordmarkLayer})`,
          maskImage: `url(${iconLayer}), url(${wordmarkLayer})`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          mixBlendMode: 'screen',
        }}
        initial={{ backgroundPosition: '100% 0%', opacity: 0 }}
        animate={{ backgroundPosition: ['100% 0%', '0% 0%'], opacity: [0, 1, 1, 0] }}
        transition={{ delay: 0.35, duration: 0.45, ease: 'easeInOut' }}
      />

      <motion.img
        src={digitechLayer}
        alt=""
        draggable={false}
        className={layer}
        initial={{ opacity: 0, y: '2%' }}
        animate={{ opacity: 1, y: '0%' }}
        transition={{ delay: 0.55, duration: 0.25, ease: easeOut }}
      />

      <motion.img
        src={taglineLayer}
        alt=""
        draggable={false}
        className={layer}
        initial={{ opacity: 0, y: '2%' }}
        animate={{ opacity: 1, y: '0%' }}
        transition={{ delay: 0.7, duration: 0.25, ease: easeOut }}
      />
      </>
      )}
    </div>
  );
}
