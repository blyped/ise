/**
 * Suivi des erreurs cote serveur (Node.js — server actions, routes API,
 * composants serveur). Charge par `instrumentation.ts` uniquement quand
 * `NEXT_RUNTIME === 'nodejs'`.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
  debug: false,
});
