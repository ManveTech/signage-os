import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

/**
 * Crash and error reporting for the dashboard and the phone app.
 *
 * Separate from the activity log: that records what people *did* on purpose
 * (see components/logs/ActivityView.tsx), this records what broke. The phone
 * app especially needs it — it ships its own bundled copy of the dashboard, so
 * when something throws on someone else's handset there is otherwise no way to
 * find out, and "it crashed" is all anyone can tell us.
 *
 * Off unless VITE_SENTRY_DSN is set at build time. No DSN means init() returns
 * without loading anything or opening a connection, so a build that doesn't
 * configure one behaves exactly as it did before and sends nothing anywhere.
 *
 * What is deliberately NOT sent. Sentry v11 replaced the old `sendDefaultPii`
 * switch with `dataCollection`, and its defaults are permissive — cookies,
 * headers and request bodies are collected unless you say otherwise. All of
 * those are turned off explicitly below, auth tokens are stripped from URLs,
 * and there is no session replay and no profiling. Breadcrumbs can still pick
 * up a URL, which is why the scrub runs over breadcrumbs too.
 */

const DSN = (import.meta.env?.VITE_SENTRY_DSN || '').trim();
const RELEASE = (import.meta.env?.VITE_SENTRY_RELEASE || '').trim();
const ENVIRONMENT = (import.meta.env?.VITE_SENTRY_ENVIRONMENT || (import.meta.env?.DEV ? 'development' : 'production')).trim();

/** Query parameters that carry a credential and must never reach Sentry. */
const SECRET_PARAMS = /([?&])(token|auth|access_token|key|password|secret|code|signature)=[^&#]*/gi;

function scrubUrl(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(SECRET_PARAMS, '$1$2=[redacted]');
}

export function initErrorReporting(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    release: RELEASE || undefined,
    environment: ENVIRONMENT,

    // Errors only. Tracing and replay are what make Sentry expensive and
    // chatty, and neither answers "what broke on their phone".
    tracesSampleRate: 0,

    dataCollection: {
      httpBodies: [],
      cookies: false,
      httpHeaders: { request: false, response: false },
      urlQueryParams: false,
      // No automatic user.* (which includes IP) — identifying a report is
      // done explicitly, by account id, in identifyForErrorReporting below.
      userInfo: false
    },

    beforeSend(event) {
      if (event.request?.url) event.request.url = scrubUrl(event.request.url);
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(crumb => {
          if (crumb.data?.url) crumb.data.url = scrubUrl(String(crumb.data.url));
          return crumb;
        });
      }
      return event;
    },

    ignoreErrors: [
      // A failed fetch on a flaky connection is the normal state of a phone on
      // mobile data, not a defect — and the app already handles it.
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed',
      'AbortError',
      // Benign: fires when a layout changes size during an observer callback.
      'ResizeObserver loop completed with undelivered notifications',
      'ResizeObserver loop limit exceeded'
    ]
  });

  // Which build this came from, so a report can be matched to a release —
  // the phone app's bundled copy is the whole reason this matters.
  Sentry.setTag('platform', Capacitor.isNativePlatform() ? Capacitor.getPlatform() : 'web');
  Sentry.setTag('native', String(Capacitor.isNativePlatform()));
}

/**
 * Ties reports to the signed-in account, so a report can be followed up with
 * the person who hit it. Only the account id and role — never their email,
 * which would put a real address in a third-party service for every crash.
 */
export function identifyForErrorReporting(userId?: string, role?: string): void {
  if (!DSN) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: userId });
  if (role) Sentry.setTag('role', role);
}

/** Report something caught and handled, that still shouldn't be happening. */
export function reportError(error: unknown, context?: Record<string, any>): void {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
