import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera, AlertTriangle } from 'lucide-react';

interface QrScannerModalProps {
  onScan: (value: string) => void;
  onClose: () => void;
  title?: string;
  instructions?: string;
}

/**
 * A live-camera QR scanner, built on getUserMedia + jsQR instead of a native
 * Capacitor plugin — this same component works identically in a plain
 * browser tab and inside the Capacitor WebView (which exposes the standard
 * camera APIs once permission is granted), with no native sync step.
 *
 * Pairs with the TV app's pairing screen, which renders its 6-character code
 * as a plain-text QR (see PairingSetupScreen.kt / QrCode.kt) — scanning it
 * here hands that same text straight to onScan, skipping manual entry.
 */
export default function QrScannerModal({ onScan, onClose, title = 'Scan QR Code', instructions }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        if (cancelled) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        scanLoop();
      } catch (err: any) {
        setError(
          err?.name === 'NotAllowedError'
            ? 'Camera access was denied. Allow camera access, or type the code manually.'
            : 'Could not access the camera. Type the code manually instead.'
        );
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    function scanLoop() {
      const video = videoRef.current;
      if (!video || !ctx || scannedRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          scannedRef.current = true;
          onScan(code.data.trim());
          return;
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    start();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative aspect-square bg-slate-950">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle size={28} className="text-amber-400" />
              <p className="text-xs text-slate-300">{error}</p>
            </div>
          ) : (
            <>
              {/* A blank poster: Android's WebView otherwise shows a big grey "play" button until the camera starts. */}
              <video ref={videoRef} className="w-full h-full object-cover bg-slate-900" muted playsInline poster="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==" />
              {/* Viewfinder frame — purely visual, has no effect on decoding */}
              <div className="absolute inset-8 border-2 border-white/70 rounded-2xl pointer-events-none" />
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/50 text-white text-[11px] font-medium px-3 py-1 rounded-full">
                <Camera size={12} /> Point at the TV's QR code
              </div>
            </>
          )}
        </div>

        {instructions && (
          <p className="px-5 py-3 text-xs text-gray-500 text-center">{instructions}</p>
        )}
      </div>
    </div>
  );
}
