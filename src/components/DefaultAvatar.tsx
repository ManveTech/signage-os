import { UserRound } from 'lucide-react';

/** Shown in place of a profile photo until one is added. */
export default function DefaultAvatar({ className = 'w-8 h-8', iconSize = 18 }: { className?: string; iconSize?: number }) {
  return (
    <span className={`${className} rounded-full bg-slate-200 text-slate-500 flex items-center justify-center overflow-hidden`} aria-hidden="true">
      <UserRound size={iconSize} strokeWidth={1.75} />
    </span>
  );
}
