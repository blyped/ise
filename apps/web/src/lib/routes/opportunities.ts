/**
 * Chemins de la tranche OPPORTUNITES (ISE-055 -> ISE-066).
 *
 * Fichier separe de `src/lib/routes.ts` (voir `routes/calls.ts`).
 */
export const OPPORTUNITY_ROUTES = {
  /** ISE-055 — Hub Opportunites. */
  list: '/opportunites',
  /** ISE-062 — Opportunites enregistrees. */
  saved: '/opportunites/enregistrees',
  /** Mes offres publiees. */
  mine: '/opportunites/mes-offres',
  /** ISE-057 — Etape 1 de l'assistant, sur une nouvelle offre. */
  create: '/opportunites/publier',
  /** ISE-063 — Mes candidatures. */
  applications: '/candidatures',
} as const;

/** ISE-056 — Detail d'une opportunite. */
export function opportunityRoute(opportunityId: string): string {
  return `${OPPORTUNITY_ROUTES.list}/${encodeURIComponent(opportunityId)}`;
}

/** ISE-057 — Etape 1 : l'offre (offre existante). */
export function opportunityEditRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/offre`;
}

/** ISE-058 — Etape 2 : ciblage et matching. */
export function opportunityAudienceRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/ciblage`;
}

/** ISE-059 — Etape 3 : apercu avant publication. */
export function opportunityPreviewRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/apercu`;
}

/** ISE-060 — Suivi de l'offre et candidatures recues. */
export function opportunityTrackingRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/suivi`;
}

/** ISE-061 — Fermeture de l'offre et resultat. */
export function opportunityClosureRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/cloturer`;
}

/**
 * Cible du CTA d'ISE-056. Le nom est volontairement « comment postuler »
 * et non « postuler » : pour une offre externe, la plateforme ne depose
 * aucune candidature (MASTER PROMPT §27, D-55).
 */
export function opportunityApplyRoute(opportunityId: string): string {
  return `${opportunityRoute(opportunityId)}/postuler`;
}

/** ISE-064 — Detail d'une candidature. */
export function applicationRoute(applicationId: string): string {
  return `${OPPORTUNITY_ROUTES.applications}/${encodeURIComponent(applicationId)}`;
}

/** ISE-065 — Mise a jour d'une candidature (declaration du membre, D-55). */
export function applicationUpdateRoute(applicationId: string): string {
  return `${applicationRoute(applicationId)}/mise-a-jour`;
}

/** ISE-066 — Resultat final d'une candidature et impact. */
export function applicationOutcomeRoute(applicationId: string): string {
  return `${applicationRoute(applicationId)}/resultat`;
}
