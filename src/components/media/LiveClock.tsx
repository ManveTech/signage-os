import { useEffect, useState } from 'react';

/**
 * A clock that re-renders only itself once a second. The playlist editors
 * used to keep this time in their own top-level state, which re-rendered the
 * entire editor (media grid, timeline, every thumbnail) every second — the
 * main reason scrolling there felt sluggish.
 */
export default function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <span className={className}>
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
    </span>
  );
}
