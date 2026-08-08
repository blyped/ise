/**
 * Chemins de la tranche RECHERCHE & DECOUVERTE (ISE-034 -> ISE-037).
 *
 * Fichier separe de `src/lib/routes.ts` : la tranche est developpee en
 * parallele d'une autre. Les deux tables de routes sont importees
 * explicitement par les ecrans qui en ont besoin ; elles n'ont pas
 * vocation a fusionner tant que les deux lots ne sont pas termines.
 *
 * Ces routes ne figurent ni dans `PUBLIC_ROUTES` ni dans `SYSTEM_ROUTES` :
 * elles sont donc protegees par `src/middleware.ts`, ce qui est voulu.
 */
export const SEARCH_ROUTES = {
  /** ISE-034 — Trouver un ISE. */
  find: '/rechercher',
  /** ISE-035 — Resultats de recherche. */
  results: '/rechercher/resultats',
  /** ISE-036 — Enregistrer la recherche et son alerte. */
  save: '/rechercher/enregistrer',
} as const;

/** ISE-037 — Profil d'un autre ISE. */
export function memberProfileRoute(profileId: string): string {
  return `/profil/${encodeURIComponent(profileId)}`;
}

/** ISE-035 — Resultats pour une chaine de criteres deja serialisee. */
export function searchResultsRoute(queryString: string): string {
  return queryString.length > 0 ? `${SEARCH_ROUTES.results}?${queryString}` : SEARCH_ROUTES.results;
}

/** ISE-036 — Enregistrement, en conservant les criteres courants. */
export function saveSearchRoute(queryString: string): string {
  return queryString.length > 0 ? `${SEARCH_ROUTES.save}?${queryString}` : SEARCH_ROUTES.save;
}

/** ISE-034 — Retour au formulaire, criteres pre-remplis. */
export function findRouteWithCriteria(queryString: string): string {
  return queryString.length > 0 ? `${SEARCH_ROUTES.find}?${queryString}` : SEARCH_ROUTES.find;
}
