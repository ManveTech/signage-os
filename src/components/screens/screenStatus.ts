/** Label + colours for a screen status, shared by the screen list pages. */
export function screenStatusStyle(status: string): { label: string; text: string; dot: string } {
  switch (status) {
    case 'online': return { label: 'Online', text: 'text-emerald-700', dot: '#10B981' };
    case 'active': return { label: 'Active', text: 'text-emerald-700', dot: '#10B981' };
    case 'offline': return { label: 'Offline', text: 'text-rose-700', dot: '#F43F5E' };
    case 'warning': return { label: 'Warning', text: 'text-amber-700', dot: '#F59E0B' };
    case 'pairing': return { label: 'Pairing', text: 'text-blue-700', dot: '#3B82F6' };
    case 'unlinked': return { label: 'Not linked', text: 'text-slate-500', dot: '#94A3B8' };
    case 'suspended': return { label: 'Suspended', text: 'text-slate-700', dot: '#64748B' };
    default: return { label: status, text: 'text-slate-700', dot: '#64748B' };
  }
}

export function lastSeenText(lastHeartbeat?: string): string {
  const t = lastHeartbeat ? new Date(lastHeartbeat).getTime() : NaN;
  if (!Number.isFinite(t)) return lastHeartbeat || '—';
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
