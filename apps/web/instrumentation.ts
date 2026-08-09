import * as Sentry from '@sentry/nextjs';
import type { Instrumentation } from 'next';

/**
 * Point d'entree unique charge une fois au demarrage du serveur Next.js.
 * Selectionne la configuration Sentry adaptee au runtime courant : le code
 * Node.js et le code edge (middleware) ne partagent pas le meme bundle.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

/**
 * Capture les erreurs survenant pendant le rendu serveur (composants
 * serveur, generation de metadonnees, etc.) qui n'atteignent pas
 * necessairement `global-error.tsx`.
 */
export const onRequestError: Instrumentation.onRequestError = (...args) => {
  Sentry.captureRequestError(...args);
};
