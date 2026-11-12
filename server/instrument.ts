/**
 * Starts error reporting before anything else loads.
 *
 * Sentry patches http, express and the other modules it watches as it
 * initialises, and anything already imported by then is missed. ES module
 * imports are hoisted and run in order, so this has to be the FIRST import in
 * server/index.ts — calling initErrorReporting() as a statement there would
 * run after every other import had already been evaluated, which is too late.
 *
 * Does nothing unless SENTRY_DSN is set.
 */
import { initErrorReporting } from './errorReporting';

initErrorReporting();
