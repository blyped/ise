/**
 * Suivi des erreurs cote edge (middleware.ts). Charge par
 * `instrumentation.ts` uniquement quand `NEXT_RUNTIME === 'edge'`.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  debug: false,
});
