import { Capacitor } from '@capacitor/core';

/**
 * Where the API lives.
 *
 * In a browser this is same-origin by default: the same Node process serves
 * the dashboard and /api/v1 (see the Dockerfile), so cms.bluestardigitech.com
 * answers both. That leaves no host to get wrong per environment and no CORS
 * between the dashboard and its own API.
 *
 * Native builds are the exception — a Capacitor webview loads from
 * https://localhost, so a relative URL would resolve to the device itself.
 * Those builds need an absolute origin, which is what NATIVE_ORIGIN is for;
 * override it at build time with VITE_NODE_SERVER_URL when pointing a build
 * at staging.
 *
 * This used to default to a shared demo host, which meant a production build
 * that forgot the variable talked to the demo database without saying so.
 */
const NATIVE_ORIGIN = 'https://cms.bluestardigitech.com';

const configured = (import.meta.env?.VITE_NODE_SERVER_URL || '').trim().replace(/\/+$/, '');

export const BACKEND_URL =
  configured || (Capacitor.isNativePlatform() ? NATIVE_ORIGIN : '');

/** Same-origin resolves to `/api/v1` when BACKEND_URL is empty. */
export const API_BASE = `${BACKEND_URL}/api/v1`;
