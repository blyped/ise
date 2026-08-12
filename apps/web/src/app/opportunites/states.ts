import type {
  LoadMoreApplicationsState,
  LoadMoreOpportunitiesState,
  SaveOpportunityState,
} from './actions';

/**
 * Etats initiaux des ecrans OPPORTUNITES, hors de `actions.ts`
 * (`'use server'`) : un fichier `'use server'` compile tout export
 * non-fonction en reference serveur (proxy), pas en valeur reelle (D-159).
 */
export const initialSaveOpportunityState: SaveOpportunityState = {
  status: 'idle',
  isSaved: false,
  message: null,
};

export const initialLoadMoreOpportunitiesState: LoadMoreOpportunitiesState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};

export const initialLoadMoreApplicationsState: LoadMoreApplicationsState = {
  status: 'idle',
  rows: [],
  nextCursor: null,
  message: null,
  correlationId: null,
};
