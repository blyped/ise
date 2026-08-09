/**
 * Suivi des erreurs cote navigateur (@sentry/nextjs).
 *
 * Remplace l'ancien `sentry.client.config.ts` : ce fichier est le point
 * d'entree standard depuis les SDK Sentry recents pour Next.js.
 *
 * `tunnelRoute` fait transiter les evenements par notre propre domaine
 * (`/monitoring`, voir instrumentation.ts cote serveur pour le proxy) au
 * lieu d'appeler directement `*.sentry.io`. Deux effets recherches :
 *  - la CSP stricte du projet (next.config.ts) n'a pas besoin d'un nouveau
 *    domaine dans `connect-src`, `'self'` suffit ;
 *  - les bloqueurs de publicite qui ciblent les domaines Sentry n'empechent
 *    plus la remontee des erreurs.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tunnelRoute: '/monitoring',

  // 100 % des transactions en developpement pour tout voir ; echantillon
  // reduit en production pour rester sous les quotas du plan Developer.
  tracesSampleRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,

  // Pas de replays de session pour l'instant (donnees utilisateur
  // sensibles sur une plateforme de mise en relation professionnelle) ;
  // a revisiter avec un masquage explicite si le besoin se confirme.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  debug: false,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
