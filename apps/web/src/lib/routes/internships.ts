/**
 * Chemins de la tranche STAGES (ISE-072 -> ISE-077).
 *
 * Le nom des ecrans suit les MAQUETTES (D-01, regle de preseance n° 2) :
 * ISE-073 est le detail d'une offre, ISE-074 la preparation du dossier,
 * ISE-075 la demande de relecture, ISE-076 le suivi, ISE-077 le resultat.
 */
export const INTERNSHIP_ROUTES = {
  /** ISE-072 — Espace stages (eleve). */
  home: '/stages',
  /** Point d'entree des anciens : proposer, relayer, faciliter. */
  alumni: '/stages/aider',
  /** Preferences de recherche de l'eleve, depuis ISE-072. */
  preferences: '/stages/ma-recherche',
  /** Mes candidatures de stage. */
  applications: '/stages/candidatures',
} as const;

/** ISE-073 — Detail d'une offre de stage. */
export function internshipOfferRoute(offerId: string): string {
  return `${INTERNSHIP_ROUTES.home}/${encodeURIComponent(offerId)}`;
}

/** ISE-074 — Preparer ma candidature. */
export function internshipApplyRoute(offerId: string): string {
  return `${internshipOfferRoute(offerId)}/candidature`;
}

/** ISE-075 — Demander une relecture ou un conseil au reseau. */
export function internshipHelpRoute(offerId: string): string {
  return `${internshipOfferRoute(offerId)}/relecture`;
}

/** ISE-076 — Suivi d'une candidature de stage. */
export function internshipApplicationRoute(applicationId: string): string {
  return `${INTERNSHIP_ROUTES.applications}/${encodeURIComponent(applicationId)}`;
}

/** ISE-077 — Enregistrer le resultat du stage. */
export function internshipResultRoute(applicationId: string): string {
  return `${internshipApplicationRoute(applicationId)}/resultat`;
}
