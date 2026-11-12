import * as Sentry from '@sentry/node';

/**
 * Crash and error reporting for the API.
 *
 * Off unless SENTRY_DSN is set. No DSN means init() returns immediately and
 * nothing is loaded, instrumented or sent — a deploy that doesn't configure
 * one behaves exactly as it did before.
 *
 * Must be imported and initialised before anything else in server/index.ts:
 * Sentry patches http and the other modules it watches as it starts, and
 * anything already imported by then is missed.
 *
 * What is deliberately NOT sent. Sentry v11 replaced the old `sendDefaultPii`
 * switch with `dataCollection`, whose defaults are permissive: cookies,
 * request and response headers, and all four kinds of HTTP body are collected
 * unless you say otherwise. For this API that would mean auth cookies, Bearer
 * headers and the passwords, reset tokens and billing details in our request
 * bodies — so every one of those is turned off explicitly below. beforeSend
 * then strips the same things again, because a default that changed once can
 * change again. An error's own message and stack still go, which is the point.
 */

const DSN = (process.env.SENTRY_DSN || '').trim();
const ENVIRONMENT = (process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production').trim();
const RELEASE = (process.env.SENTRY_RELEASE || '').trim();

const SECRET_PARAMS = /([?&])(token|auth|access_token|key|password|secret|code|signature)=[^&#]*/gi;

export function initErrorReporting(): void {
  if (!DSN) return;

  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT,
    release: RELEASE || undefined,
    tracesSampleRate: 0,

    dataCollection: {
      // No bodies at all: ours carry passwords, reset tokens and billing data.
      httpBodies: [],
      cookies: false,
      httpHeaders: { request: false, response: false },
      // A query string can carry a token; the scrub in beforeSend covers the
      // ones we know about, and dropping the rest costs nothing to debug with.
      urlQueryParams: false,
      // Don't let instrumentation fill in user.* (which includes IP address)
      // on its own — identifying a report is done explicitly, by account id.
      userInfo: false
    },

    beforeSend(event) {
      if (event.request) {
        // Our request bodies include passwords, reset tokens and billing
        // details. None of it helps debug a stack trace.
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        if (event.request.url) {
          event.request.url = event.request.url.replace(SECRET_PARAMS, '$1$2=[redacted]');
        }
      }
      return event;
    },

    ignoreErrors: [
      // A client that hung up mid-response is normal, not a fault.
      'ECONNRESET',
      'EPIPE',
      'ERR_STREAM_PREMATURE_CLOSE'
    ]
  });

  console.log(`[ErrorReporting] Sentry enabled (${ENVIRONMENT}).`);
}

/** True when reporting is configured, for the health endpoint. */
export const errorReportingEnabled = !!DSN;

/** Report something caught and handled that still shouldn't be happening. */
export function reportError(error: unknown, context?: Record<string, any>): void {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Express error handler. Added after the routes and before our own handler, so
 * a request that throws is reported and still gets the same response it did
 * before. A no-op without a DSN.
 */
export function errorReportingMiddleware(): (err: any, req: any, res: any, next: any) => void {
  if (!DSN) return (err: any, _req: any, _res: any, next: any) => next(err);
  return Sentry.expressErrorHandler() as any;
}
