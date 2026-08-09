/**
 * Chemins du back-office Superadmin — lot « données » :
 * imports & qualité (SA-040 → SA-045), analytics (SA-046, SA-047),
 * paramètres plateforme (SA-048), journal d'audit (SA-049, SA-050).
 *
 * Fichier séparé de `src/lib/routes.ts` (même convention que
 * `routes/cms.ts`) : la matrice centrale n'a pas à grandir à chaque lot.
 * Les chemins sont en français (MASTER PROMPT §66), tous sous
 * `/administration`. La garde d'accès est faite PAR PAGE, avec la
 * permission précise de la section (défense en profondeur) — le layout
 * commun, s'il existe, n'est qu'une barrière supplémentaire.
 */
export const ADMIN_DATA_ROUTES = {
  /** Racine du back-office (portée par le lot « cœur »). */
  home: '/administration',

  /** SA-040 — Imports & qualité, tableau de contrôle. */
  imports: '/administration/imports',
  /** SA-040 — Téléverser un nouveau fichier d'annuaire. */
  importNew: '/administration/imports/nouveau',
  /** Onglet anomalies de SA-040. */
  importIssues: '/administration/imports/anomalies',
  /** SA-043 — Profils incomplets, priorisation. */
  incompleteProfiles: '/administration/imports/profils-incomplets',
  /** SA-044 / SA-045 — Campagnes de complétude (non couvert en V1 : l'écran le dit). */
  completenessCampaigns: '/administration/imports/campagnes',

  /** SA-046 — Analytics, valeur du réseau. */
  analytics: '/administration/analytics',
  /** SA-047 — Analytics, segmentation du réseau. */
  analyticsSegmentation: '/administration/analytics/segmentation',

  /** SA-048 — Paramètres plateforme et feature flags. */
  settings: '/administration/parametres',

  /** SA-049 — Journal d'audit. */
  audit: '/administration/audit',
} as const;

/** SA-041 — Détail d'un lot d'import (mapping, anomalies, validation). */
export function importDetailRoute(batchId: string): string {
  return `${ADMIN_DATA_ROUTES.imports}/${encodeURIComponent(batchId)}`;
}

/** SA-042 — Revue des doublons d'un lot. */
export function importDuplicatesRoute(batchId: string): string {
  return `${importDetailRoute(batchId)}/doublons`;
}

/** SA-050 — Détail d'une entrée du journal d'audit. */
export function auditEntryRoute(entryId: number | string): string {
  return `${ADMIN_DATA_ROUTES.audit}/${encodeURIComponent(String(entryId))}`;
}
