import type { LoadMoreConnectionsState } from './actions';

/**
 * Etat initial de « Mes relations », hors de `actions.ts` (`'use server'`) :
 * un fichier `'use server'` compile tout export non-fonction en reference
 * serveur (proxy), pas en valeur reelle (D-159).
 */
export const initialLoadMoreConnectionsState: LoadMoreConnectionsState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};
