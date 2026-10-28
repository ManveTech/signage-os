import proxyAddr from 'proxy-addr';

/**
 * The visitor's real address when the request came through Cloudflare.
 *
 * bluestardigitech.com (api, cms and the site) is proxied by Cloudflare, so
 * the connection reaching Coolify's proxy is from a Cloudflare edge server,
 * and that is what `req.ip` resolved to. Every rate limiter keys on req.ip,
 * so all visitors reaching the same Cloudflare location shared one bucket:
 * five mistyped passwords from anyone locked sign-in for everyone on that
 * edge for 15 minutes, and all dashboards shared 100 requests a minute.
 *
 * Cloudflare puts the visitor's address in CF-Connecting-IP. It is only
 * believed when the request really arrived from a Cloudflare address —
 * otherwise anyone reaching the server directly could set the header and
 * pick their own rate-limit bucket.
 *
 * Ranges from https://www.cloudflare.com/ips/ (they change rarely; refresh
 * them if Cloudflare announces new ones).
 */
const CLOUDFLARE_RANGES = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];
const isCloudflare = proxyAddr.compile(CLOUDFLARE_RANGES);

const IP_LIKE = /^[0-9a-fA-F:.]{2,45}$/;

export function realClientIp(req: any, _res: any, next: () => void) {
  const viaIp: string = req.ip || '';
  const header = req.headers['cf-connecting-ip'];
  const claimed = typeof header === 'string' ? header.trim() : '';
  if (claimed && IP_LIKE.test(claimed) && viaIp && isCloudflare(viaIp.replace(/^::ffff:/, ''), 0)) {
    // req.ip is a getter on Express's request prototype; shadow it for this request.
    Object.defineProperty(req, 'ip', { value: claimed, configurable: true, enumerable: true });
  }
  next();
}
