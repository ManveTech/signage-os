import { getTurnConfig } from '../integrationsStore';

/**
 * ICE servers for video calls.
 *
 * STUN alone only works when the caller and the TV can reach each other
 * directly. On mobile data (carrier NAT), many office and government networks
 * and some home routers they cannot, and the call connects with no picture or
 * sound — or not at all. A TURN relay carries the media in those cases.
 *
 * The relay is Cloudflare Realtime TURN: its key lives in Integrations →
 * Video-call relay, and Cloudflare hands out short-lived username/password
 * pairs per request. Both the dashboard (GET /video-conference/ice-servers)
 * and the TV (inside conference:initiated) get them from here, so the
 * credentials never ship inside an app build. With no key saved, calls use
 * STUN only, exactly as before.
 */
export interface IceServer { urls: string | string[]; username?: string; credential?: string }

const STUN_ONLY: IceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

// Credentials are issued for 24 hours and reused for 12, so a call that
// starts just before a refresh still has hours left on its credentials.
const TTL_SECONDS = 24 * 60 * 60;
const REUSE_MS = 12 * 60 * 60 * 1000;
let cached: { servers: IceServer[]; until: number; expires: number; keyId: string } | null = null;

/**
 * Cloudflare's own docs: browsers wait a long time on the port-53 URLs, which
 * are only there for networks that block everything else — drop them.
 */
function withoutPort53(urls: string | string[]): string[] {
  return (Array.isArray(urls) ? urls : [urls]).filter(u => !/:53(\?|$)/.test(u));
}

export async function fetchCloudflareIceServers(keyId: string, apiToken: string): Promise<IceServer[]> {
  const base = `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials`;
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };
  const body = JSON.stringify({ ttl: TTL_SECONDS });

  let res = await fetch(`${base}/generate-ice-servers`, { method: 'POST', headers, body });
  // Older keys/accounts only have the original endpoint, which returns one
  // server object instead of a list.
  if (res.status === 404) res = await fetch(`${base}/generate`, { method: 'POST', headers, body });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Cloudflare TURN answered ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  const data: any = await res.json();
  const list: any[] = Array.isArray(data?.iceServers) ? data.iceServers : data?.iceServers ? [data.iceServers] : [];
  const servers: IceServer[] = list
    .map(s => ({ ...s, urls: withoutPort53(s.urls || []) }))
    .filter(s => s.urls.length > 0);
  if (!servers.some(s => (s.urls as string[]).some(u => u.startsWith('turn')))) {
    throw new Error('Cloudflare returned no TURN servers.');
  }
  return servers;
}

/**
 * 'relay' forces every call through the TURN relay — for checking that the
 * relay really works (a direct connection would otherwise hide a broken one).
 * Set ICE_TRANSPORT_POLICY=relay on the api to try it; leave unset normally.
 */
export function getIceTransportPolicy(): 'all' | 'relay' {
  return (process.env.ICE_TRANSPORT_POLICY || '').trim() === 'relay' ? 'relay' : 'all';
}

/** ICE servers for a call: Cloudflare's relay when set up, STUN only otherwise. */
export async function getIceServers(): Promise<IceServer[]> {
  // A fixed list, e.g. another TURN provider or a test relay:
  // ICE_SERVERS_JSON='[{"urls":["turn:host:3478"],"username":"u","credential":"p"}]'
  const fixed = (process.env.ICE_SERVERS_JSON || '').trim();
  if (fixed) {
    try {
      const list = JSON.parse(fixed);
      if (Array.isArray(list) && list.length) return list;
    } catch {
      console.error('[ICE] ICE_SERVERS_JSON is not valid JSON — ignoring it.');
    }
  }
  const cfg = await getTurnConfig();
  if (!cfg.enabled) return STUN_ONLY;
  if (cached && cached.keyId === cfg.keyId && cached.until > Date.now()) return cached.servers;
  try {
    const servers = await fetchCloudflareIceServers(cfg.keyId, cfg.apiToken);
    // Google's STUN stays in the list as well — cheap, and a second path.
    const all = [...servers, ...STUN_ONLY];
    cached = { servers: all, until: Date.now() + REUSE_MS, expires: Date.now() + TTL_SECONDS * 1000, keyId: cfg.keyId };
    return all;
  } catch (err: any) {
    // A relay hiccup must not stop a call that would have worked directly.
    console.error('[ICE] Could not get TURN credentials, using STUN only:', err.message);
    // Older credentials are still good until they expire.
    return cached && cached.keyId === cfg.keyId && cached.expires > Date.now() + 60_000 ? cached.servers : STUN_ONLY;
  }
}

export function clearIceServerCache(): void {
  cached = null;
}
