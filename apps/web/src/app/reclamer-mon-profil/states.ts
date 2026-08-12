import type { ClaimSearchState } from './actions';

/**
 * Etat initial de l'ecran ISE-005, VOLONTAIREMENT hors de `actions.ts`.
 *
 * Un fichier `'use server'` ne doit exporter que des fonctions async : tout
 * autre export (objet, constante) y est compile en *reference serveur* — un
 * proxy appelable, pas la valeur reelle. C'est exactement ce qui s'est
 * produit ici : `initialClaimSearchState` importe depuis `actions.ts`
 * arrivait dans `useActionState` sous forme de proxy sans `fieldErrors`,
 * et `Object.keys(state.fieldErrors)` levait « Cannot convert undefined or
 * null to object » (500 intermittent en production, digests 1724077822 /
 * 3088685757). Voir D-131.
 */
export const initialClaimSearchState: ClaimSearchState = {
  status: 'idle',
  message: null,
  correlationId: null,
  fieldErrors: {},
  results: null,
};
