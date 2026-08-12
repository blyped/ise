import type { SaveSearchState } from './actions';

/**
 * Etat initial de « Enregistrer la recherche » (ISE-036), hors de
 * `actions.ts` (`'use server'`) : un fichier `'use server'` compile tout
 * export non-fonction en reference serveur (proxy), pas en valeur reelle
 * (D-159).
 */
export const initialSaveSearchState: SaveSearchState = {
  status: 'idle',
  message: null,
  correlationId: null,
  fieldErrors: {},
  alertPersisted: false,
};
