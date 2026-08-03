import React, { useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface OfflineIndicatorProps {
  onRetry?: () => void;
}

export default function OfflineIndicator({ onRetry }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [showBanner, setShowBanner] = React.useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={`fixed top-16 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 rounded-xl shadow-lg border ${
        isOnline
          ? 'bg-green-50 border-green-200'
          : 'bg-red-50 border-red-200'
      } p-4 flex items-center gap-3 animate-slideDown`}
    >
      <div className={`p-2 rounded-full ${isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
        {isOnline ? (
          <Wifi className="w-5 h-5 text-green-600" />
        ) : (
          <WifiOff className="w-5 h-5 text-red-600" />
        )}
      </div>

      <div className="flex-1">
        <p className={`text-sm font-semibold ${isOnline ? 'text-green-900' : 'text-red-900'}`}>
          {isOnline ? 'Back Online' : 'No Internet Connection'}
        </p>
        <p className={`text-xs ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
          {isOnline
            ? 'Connection restored. Syncing data...'
            : 'Some features may be unavailable'}
        </p>
      </div>

      {!isOnline && onRetry && (
        <button
          onClick={onRetry}
          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-red-600" />
        </button>
      )}
    </div>
  );
}
