import { Capacitor } from '@capacitor/core';

/**
 * Where the API lives.
 *
 * One container answers on two domains: cms.bluestardigitech.com (the
 * dashboard) and api.bluestardigitech.com (what TVs and the marketing site
 * call). In a browser this is therefore same-origin by default — the dashboard
 * served from cms.* talks to /api/v1 on cms.* — which leaves no host to get
 * wrong per environment and no CORS between the dashboard and its own API.
 *
 * Native builds are the exception — a Capacitor webview loads from
 * https://localhost, so a relative URL would resolve to the device itself.
 * Those builds need an absolute origin, and they use the api.* name because it
 * is the stable public one: a TV in the field should not care what the
 * dashboard is called. Override with VITE_NODE_SERVER_URL for staging builds.
 *
 * This used to default to a shared demo host, which meant a production build
 * that forgot the variable talked to the demo database without saying so.
 */
const NATIVE_ORIGIN = 'https://api.bluestardigitech.com';

const configured = (import.meta.env?.VITE_NODE_SERVER_URL || '').trim().replace(/\/+$/, '');

export const BACKEND_URL =
  configured || (Capacitor.isNativePlatform() ? NATIVE_ORIGIN : '');

/** Same-origin resolves to `/api/v1` when BACKEND_URL is empty. */
export const API_BASE = `${BACKEND_URL}/api/v1`;
