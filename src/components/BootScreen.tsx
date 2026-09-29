import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { setNativeBarColor } from '../lib/nativeWindow';

/**
 * Bridges the gap between the native Android splash (which Android 12+
 * restricts to a solid color + small centered icon — it silently ignores any
 * top-anchored gradient baked into a drawable) and the app's real content.
 * Rendered synchronously on first paint so there's no flash of bare content
 * between the native splash disappearing and this taking over.
 */
export default function BootScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // The bars are white the rest of the time (useCapacitor.ts), which would
    // sit as a mismatched pale strip over this screen's black — flip them to
    // match for as long as this is on screen, then hand back right as the
    // fade-out (revealing the white screen underneath) begins, not after it
    // finishes, so the two don't visibly race each other.
    const restore = () => setNativeBarColor('#ffffff', 'LIGHT');
    setNativeBarColor('#000000', 'DARK'); // light icons for the black bar

    const timer = setTimeout(() => {
      restore();
      setVisible(false);
    }, 900);
    return () => {
      clearTimeout(timer);
      restore();
    };
  }, []);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="boot-screen"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_140%_70%_at_50%_-10%,rgba(47,107,255,0.35),transparent_60%)]" />
          <div className="relative flex flex-col items-center">
            <p className="text-[34px] font-bold tracking-tight">
              <span className="text-[#E7EBF5]">Blue</span>
              <span className="text-[#2F6BFF]">Star</span>
            </p>
            <p className="mt-2 text-[11px] font-semibold tracking-[0.35em] text-[#8A8A8E]">
              DIGITECH
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
