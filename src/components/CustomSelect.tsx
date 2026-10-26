import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/** Tallest the list ever gets, and the least room worth opening into. */
const MAX_DROPDOWN_HEIGHT = 208;
const MIN_DROPDOWN_HEIGHT = 120;
const GAP = 8;

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Where the list opens and how tall it may be. A select near the bottom of
  // a modal used to open downwards regardless, so with more than a handful of
  // options the list ran off the modal — and off the screen — with no way to
  // reach the ones underneath.
  const [drop, setDrop] = useState<{ up: boolean; maxHeight: number }>({ up: false, maxHeight: MAX_DROPDOWN_HEIGHT });
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const place = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const below = window.innerHeight - rect.bottom - GAP;
      const above = rect.top - GAP;
      // Prefer downwards; flip only when there genuinely isn't room and
      // there's more space the other way.
      const up = below < Math.min(MAX_DROPDOWN_HEIGHT, MIN_DROPDOWN_HEIGHT) && above > below;
      setDrop({ up, maxHeight: Math.max(MIN_DROPDOWN_HEIGHT, Math.min(MAX_DROPDOWN_HEIGHT, up ? above : below)) });
    };
    place();
    window.addEventListener('resize', place);
    // Capture phase: the scroll happens on the modal body, not the window.
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, options.length]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative inline-block w-full ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-xs transition-all ${
          isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${buttonClassName}`}
      >
        <span className="truncate text-left">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
      </button>

      {isOpen && (
        <div
          style={{ maxHeight: drop.maxHeight }}
          className={`absolute left-0 right-0 ${drop.up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-[100] bg-white/98 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-[0_12px_30px_rgba(15,23,42,0.15)] overflow-y-auto p-1 text-xs font-semibold text-slate-800 animate-fadeIn space-y-0.5 ${dropdownClassName}`}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between transition-all cursor-pointer ${
                  isSelected ? 'bg-blue-50/90 text-blue-600 font-bold' : 'hover:bg-slate-100/80 text-slate-700 hover:text-slate-900'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={13} className="text-blue-600 shrink-0 ml-2" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
