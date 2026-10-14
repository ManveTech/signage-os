/**
 * Where the API lives.
 *
 * The dashboard (cms.bluestardigitech.com) and the API (api.bluestardigitech.com) are
 * separate services in separate containers, so this is always an absolute origin — there
 * is no same-origin shortcut to take.
 *
 * Vite inlines VITE_NODE_SERVER_URL at build time; it is passed as a build arg from
 * docker-compose.yml. The fallback below is the production API rather than a demo host,
 * because a build that forgets the variable should reach the real thing instead of quietly
 * talking to someone else's database — which is what the old `https://dem1.manve.co`
 * default did.
 *
 * Native (Capacitor) builds use the same value: a TV in the field should point at the
 * stable api.* name, not at whatever the dashboard happens to be called.
 */
const DEFAULT_API_ORIGIN = 'https://api.bluestardigitech.com';

const configured = (import.meta.env?.VITE_NODE_SERVER_URL || '').trim().replace(/\/+$/, '');

export const BACKEND_URL = configured || DEFAULT_API_ORIGIN;

export const API_BASE = `${BACKEND_URL}/api/v1`;
