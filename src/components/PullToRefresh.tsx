import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, X } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  enabled?: boolean;
}

export default function PullToRefresh({ onRefresh, children, enabled = true }: PullToRefreshProps) {
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const threshold = 80;
  const pullDistance = currentY - startY;
  const shouldRefresh = pullDistance > threshold;

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0 && !isRefreshing) {
        setStartY(e.touches[0].clientY);
        setIsPulling(true);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling || isRefreshing) return;

      const touchY = e.touches[0].clientY;
      setCurrentY(touchY);

      if (touchY > startY && window.scrollY === 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = async () => {
      if (!isPulling || isRefreshing) return;

      setIsPulling(false);

      if (shouldRefresh) {
        setIsRefreshing(true);
        try {
          await onRefresh();
          setIsComplete(true);
          setTimeout(() => {
            setIsComplete(false);
            setIsRefreshing(false);
          }, 1000);
        } catch (error) {
          setIsRefreshing(false);
        }
      }

      setStartY(0);
      setCurrentY(0);
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [enabled, isPulling, isRefreshing, startY, currentY, shouldRefresh, onRefresh]);

  const indicatorScale = Math.min(pullDistance / threshold, 1);
  const rotation = pullDistance * 2;

  return (
    <>
      {(isPulling || isRefreshing) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center"
          style={{
            height: Math.min(pullDistance, 100),
            transition: isPulling ? 'none' : 'height 0.3s ease',
          }}
        >
          <div
            className={`flex items-center justify-center rounded-full transition-all ${
              isComplete
                ? 'bg-green-500'
                : shouldRefresh
                ? 'bg-blue-500'
                : 'bg-slate-300'
            }`}
            style={{
              width: 40 * indicatorScale,
              height: 40 * indicatorScale,
              opacity: indicatorScale,
            }}
          >
            {isComplete ? (
              <CheckCircle className="w-5 h-5 text-white" />
            ) : isRefreshing ? (
              <RefreshCw className="w-5 h-5 text-white animate-spin" />
            ) : (
              <RefreshCw
                className="w-5 h-5 text-white"
                style={{ transform: `rotate(${rotation}deg)` }}
              />
            )}
          </div>
        </div>
      )}
      {children}
    </>
  );
}
