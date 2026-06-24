import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toast: ToastItem) => void;
const listeners = new Set<ToastListener>();

export const toast = {
  show(message: string, type: ToastType = 'info', duration = 4000) {
    const id = Math.random().toString(36).substring(2, 9);
    listeners.forEach(l => l({ id, message, type, duration }));
  },
  success(message: string, duration = 4000) {
    this.show(message, 'success', duration);
  },
  error(message: string, duration = 4000) {
    this.show(message, 'error', duration);
  },
  warning(message: string, duration = 4000) {
    this.show(message, 'warning', duration);
  },
  info(message: string, duration = 4000) {
    this.show(message, 'info', duration);
  }
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handleToast = (newToast: ToastItem) => {
      setToasts(prev => [...prev, newToast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, newToast.duration || 4000);
    };

    listeners.add(handleToast);
    return () => {
      listeners.delete(handleToast);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map(t => {
        let bgColor = 'bg-slate-900/95 backdrop-blur-md border-slate-800 text-slate-100';
        let icon = <Info className="text-sky-400 shrink-0" size={16} />;
        
        if (t.type === 'success') {
          bgColor = 'bg-emerald-950/95 backdrop-blur-md border-emerald-800 text-emerald-100';
          icon = <CheckCircle2 className="text-emerald-400 shrink-0" size={16} />;
        } else if (t.type === 'error') {
          bgColor = 'bg-red-950/95 backdrop-blur-md border-red-900/80 text-red-100';
          icon = <AlertCircle className="text-red-400 shrink-0" size={16} />;
        } else if (t.type === 'warning') {
          bgColor = 'bg-amber-950/95 backdrop-blur-md border-amber-800 text-amber-100';
          icon = <AlertTriangle className="text-amber-400 shrink-0" size={16} />;
        }

        return (
          <div
            key={t.id}
            className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border shadow-lg ${bgColor} pointer-events-auto animate-slideInRight transition-all`}
          >
            <div className="flex gap-2.5 items-start">
              <span className="mt-0.5">{icon}</span>
              <p className="text-xs font-bold leading-normal">{t.message}</p>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 mt-0.5"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
