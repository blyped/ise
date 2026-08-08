/**
 * Chemins de la tranche RELATIONS & INTRODUCTIONS (ISE-038 -> ISE-046).
 *
 * Fichier separe de `src/lib/routes.ts`, sur le modele de
 * `src/lib/routes/search.ts` : chaque tranche apporte sa table de routes
 * et les ecrans l'importent explicitement.
 *
 * Aucune de ces routes ne figure dans `PUBLIC_ROUTES` ni dans
 * `SYSTEM_ROUTES` : elles sont donc protegees par `src/middleware.ts`.
 */
export const NETWORK_ROUTES = {
  /** ISE-040 — Mes relations. Point d'entree de la section « Réseau ». */
  connections: '/reseau/relations',
  /** ISE-041 — Invitations recues. */
  invitations: '/reseau/invitations',
  /** ISE-045 — Mes demandes d'introduction. */
  introductions: '/reseau/introductions',
} as const;

/** ISE-038 — Se connecter a cet ISE, depuis son profil. */
export function connectRoute(profileId: string): string {
  return `/profil/${encodeURIComponent(profileId)}/se-connecter`;
}

/** ISE-039 — Demande de connexion envoyee (suivi d'une demande precise). */
export function sentRequestRoute(requestId: string): string {
  return `/reseau/demandes/${encodeURIComponent(requestId)}`;
}

/** ISE-042 — Detail d'une invitation recue. */
export function invitationRoute(requestId: string): string {
  return `${NETWORK_ROUTES.invitations}/${encodeURIComponent(requestId)}`;
}

/** ISE-043 — Chemin d'introduction vers un profil cible. */
export function introductionPathRoute(profileId: string): string {
  return `/profil/${encodeURIComponent(profileId)}/introduction`;
}

/** ISE-044 — Demander une introduction via un intermediaire donne. */
export function requestIntroductionRoute(profileId: string, intermediaryId: string): string {
  return `${introductionPathRoute(profileId)}/demander?intermediaire=${encodeURIComponent(intermediaryId)}`;
}

/** ISE-045 — Suivi d'une demande d'introduction. */
export function introductionRoute(introductionId: string): string {
  return `${NETWORK_ROUTES.introductions}/${encodeURIComponent(introductionId)}`;
}

/** ISE-046 — Bilan d'une introduction. */
export function introductionOutcomeRoute(introductionId: string): string {
  return `${introductionRoute(introductionId)}/bilan`;
}
