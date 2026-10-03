import { APP_URL } from '../config';

/**
 * Public URL of the dashboard, for links in emails. APP_URL wins when set;
 * otherwise it's taken from the request the admin made (the dashboard's own
 * origin), which is the address clients use too.
 */
export function appBaseUrl(req: any): string {
  let base = APP_URL;
  if (!base) {
    const origin = req?.get?.('origin') || req?.get?.('referer');
    const forwardedHost = req?.get?.('x-forwarded-host');
    if (origin) {
      try { base = new URL(origin).origin; } catch { base = origin; }
    } else if (forwardedHost) {
      base = `${req.get('x-forwarded-proto') || 'https'}://${forwardedHost.split(',')[0].trim()}`;
    } else if (req?.get?.('host')) {
      base = `${req.protocol || 'https'}://${req.get('host')}`;
    }
  }
  return (base || '').replace(/\/+$/, '');
}
