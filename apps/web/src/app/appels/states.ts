import type { LoadMoreCallsState, SaveState } from './actions';

/**
 * Etats initiaux des ecrans APPELS, hors de `actions.ts` (`'use server'`) :
 * un fichier `'use server'` compile tout export non-fonction en reference
 * serveur (proxy), pas en valeur reelle (D-159).
 */
export const initialSaveState: SaveState = { status: 'idle', isSaved: false, message: null };

export const initialLoadMoreCallsState: LoadMoreCallsState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};
