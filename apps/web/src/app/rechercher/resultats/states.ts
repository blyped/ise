import type { LoadMoreState } from './actions';

/**
 * Etat initial de la pagination des resultats (ISE-035), hors de
 * `actions.ts` (`'use server'`) : un fichier `'use server'` compile tout
 * export non-fonction en reference serveur (proxy), pas en valeur reelle
 * (D-159).
 */
export const initialLoadMoreState: LoadMoreState = {
  rows: [],
  nextCursor: null,
  status: 'idle',
  message: null,
  correlationId: null,
  addedCount: 0,
};
