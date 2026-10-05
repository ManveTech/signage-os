/**
 * Playlist widget overlays: news ticker (rss), QR code and clock.
 *
 * Stored on the playlist as widgetType ("clock,qrcode,rss"), widgetPlacement
 * (the corner) and widgetLink. widgetLink is the plain value when only one
 * widget is on (the QR address, the clock's label, or the ticker JSON), and a
 * JSON object { qrcode, clock, rss } when more than one is on. The TV apps
 * read both forms.
 *
 * The corner is the clock's when the clock is on (otherwise the QR code's).
 * With both on, the QR code takes the other corner on the same side —
 * top-right clock → bottom-right QR — on the dashboard preview and the TVs.
 */

export type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export const CORNERS: { value: Corner; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-right', label: 'Top right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-right', label: 'Bottom right' },
];

export function cornerLabel(c: string): string {
  return CORNERS.find(x => x.value === c)?.label || 'Top right';
}

/** Where the QR code goes when the clock is also on. */
export function qrCornerWithClock(clockCorner: Corner): Corner {
  const [v, h] = clockCorner.split('-');
  return `${v === 'top' ? 'bottom' : 'top'}-${h}` as Corner;
}

/** Weather was removed; old playlists may still list it. */
export function withoutWeather(widgetType?: string | null): string | undefined {
  const list = String(widgetType || '').split(',').map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'weather');
  return list.length ? list.join(',') : undefined;
}

function parseLink(link: any): Record<string, any> | null {
  if (link && typeof link === 'object') return link;
  const s = typeof link === 'string' ? link.trim() : '';
  if (!s.startsWith('{')) return null;
  try {
    const p = JSON.parse(s);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

const has = (widgetType: string | undefined | null, w: string) =>
  String(widgetType || '').split(',').map(s => s.trim().toLowerCase()).includes(w);

/** The clock's label from a stored playlist ('' = no label). */
export function clockLabelFrom(link: any, widgetType?: string | null): string {
  const p = parseLink(link);
  if (p) return typeof p.clock === 'string' ? p.clock : '';
  // A plain value belongs to the clock only when the clock is the one widget.
  if (typeof link === 'string' && has(widgetType, 'clock') && !has(widgetType, 'qrcode') && !has(widgetType, 'rss')) {
    return link;
  }
  return '';
}

/** The QR code's address from a stored playlist. */
export function qrLinkFrom(link: any, widgetType?: string | null): string {
  const p = parseLink(link);
  if (p) return typeof p.qrcode === 'string' ? p.qrcode : '';
  if (typeof link === 'string' && has(widgetType, 'qrcode') && !has(widgetType, 'rss')) return link;
  return '';
}

/** widgetLink to save for the widgets that are on. */
export function buildWidgetLink(opts: {
  widgetType?: string;
  qrLink: string;
  clockLabel: string;
  rss: Record<string, any>;
}): string {
  const hasRss = has(opts.widgetType, 'rss');
  const hasQr = has(opts.widgetType, 'qrcode');
  const hasClock = has(opts.widgetType, 'clock');
  const count = [hasRss, hasQr, hasClock].filter(Boolean).length;
  if (count > 1) {
    return JSON.stringify({
      ...(hasQr ? { qrcode: opts.qrLink } : {}),
      ...(hasClock ? { clock: opts.clockLabel } : {}),
      ...(hasRss ? { rss: opts.rss } : {}),
    });
  }
  if (hasRss) return JSON.stringify(opts.rss);
  if (hasQr) return opts.qrLink;
  if (hasClock) return opts.clockLabel;
  return '';
}

/** "10:45 PM" and "Tue, 6 Oct" in India time — what the TVs show. */
export function clockParts(now = new Date()): { time: string; date: string } {
  const tz = 'Asia/Kolkata';
  return {
    time: now.toLocaleTimeString('en-IN', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).toUpperCase(),
    date: now.toLocaleDateString('en-IN', { timeZone: tz, weekday: 'short', day: 'numeric', month: 'short' }),
  };
}
