/**
 * Chemins de la tranche APPELS AU RESEAU (ISE-047 -> ISE-054).
 *
 * Fichier separe de `src/lib/routes.ts`, sur le modele de
 * `src/lib/routes/network.ts` : chaque tranche apporte sa table de
 * routes et les ecrans l'importent explicitement.
 *
 * Aucune de ces routes ne figure dans `PUBLIC_ROUTES` ni dans
 * `SYSTEM_ROUTES` : elles sont donc protegees par `src/middleware.ts`.
 */
export const CALL_ROUTES = {
  /** ISE-047 — Appels au reseau. Point d'entree de la section. */
  list: '/appels',
  /** Mes appels (onglets actifs / resolus / brouillons / expires). */
  mine: '/appels/mes-appels',
  /** ISE-049 — Etape 1 de l'assistant, sur un nouvel appel. */
  create: '/appels/nouveau',
} as const;

/** ISE-048 — Detail d'un appel. */
export function callRoute(callId: string): string {
  return `${CALL_ROUTES.list}/${encodeURIComponent(callId)}`;
}

/** ISE-049 — Etape 1 : le besoin (appel existant). */
export function callNeedRoute(callId: string): string {
  return `${callRoute(callId)}/besoin`;
}

/** ISE-050 — Etape 2 : profil recherche. */
export function callWantedProfileRoute(callId: string): string {
  return `${callRoute(callId)}/profil-recherche`;
}

/** ISE-051 — Etape 3 : ciblage d'audience. */
export function callAudienceRoute(callId: string): string {
  return `${callRoute(callId)}/ciblage`;
}

/** ISE-052 — Etape 4 : apercu avant publication. */
export function callPreviewRoute(callId: string): string {
  return `${callRoute(callId)}/apercu`;
}

/** ISE-053 — Suivi de l'appel et reponses recues. */
export function callTrackingRoute(callId: string): string {
  return `${callRoute(callId)}/suivi`;
}

/** ISE-054 — Cloture avec resultat ternaire (D-52). */
export function callClosureRoute(callId: string): string {
  return `${callRoute(callId)}/cloturer`;
}

/** Reponse a un appel — cible du bouton « Je peux aider » (ISE-051). */
export function callRespondRoute(callId: string, kind?: string): string {
  const base = `${callRoute(callId)}/repondre`;
  return kind ? `${base}?type=${encodeURIComponent(kind)}` : base;
}
