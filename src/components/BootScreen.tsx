import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { holdBarsForBoot } from '../lib/nativeWindow';
import SplashLogoAnimation, { SPLASH_LOGO_DURATION_MS } from './SplashLogoAnimation';

// Let the logo reveal finish and sit for a beat before fading out.
const BOOT_SCREEN_MS = SPLASH_LOGO_DURATION_MS + 150;

/**
 * Bridges the gap between the native Android splash (which Android 12+
 * restricts to a solid color + small centered icon — it silently ignores any
 * top-anchored gradient baked into a drawable) and the app's real content.
 * Rendered synchronously on first paint so there's no flash of bare content
 * between the native splash disappearing and this taking over.
 */
export default function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const releaseBars = useRef<() => void>(() => {});

  // Starts when the logo reveal actually begins (its images decoded), not on
  // mount — with a cap so a stuck decode can never trap the app on this screen.
  const [logoStarted, setLogoStarted] = useState(false);
  useEffect(() => {
    const cap = setTimeout(() => setLogoStarted(true), 400);
    return () => clearTimeout(cap);
  }, []);

  useEffect(() => {
    // Black page background held by index.html (html.native-boot) until now.
    return () => document.documentElement.classList.remove('native-boot');
  }, []);

  useEffect(() => {
    // The bars are white the rest of the time (useCapacitor.ts), which would
    // sit as a mismatched pale strip over this screen's black — hold them
    // black for as long as this is on screen (even against the dashboard
    // mounting underneath and asking for white), then hand back right as the
    // fade-out (revealing the white screen underneath) begins, not after it
    // finishes, so the two don't visibly race each other.
    const release = holdBarsForBoot();
    releaseBars.current = release;
    return release;
  }, []);

  useEffect(() => {
    if (!logoStarted) return;
    const timer = setTimeout(() => {
      releaseBars.current();
      document.documentElement.classList.remove('native-boot');
      setVisible(false);
    }, BOOT_SCREEN_MS);
    return () => clearTimeout(timer);
  }, [logoStarted]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="boot-screen"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_140%_70%_at_50%_-10%,rgba(47,107,255,0.35),transparent_60%)]" />
          <SplashLogoAnimation className="relative w-[min(78vw,420px)]" onReady={() => setLogoStarted(true)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
