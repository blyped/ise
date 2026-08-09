/**
 * Chemins du back-office Superadmin — lot « données » :
 * profils incomplets (SA-043), analytics (SA-046, SA-047),
 * paramètres plateforme (SA-048), journal d'audit (SA-049, SA-050).
 *
 * Fichier séparé de `src/lib/routes.ts` (même convention que
 * `routes/cms.ts`) : la matrice centrale n'a pas à grandir à chaque lot.
 * Les chemins sont en français (MASTER PROMPT §66), tous sous
 * `/administration`. La garde d'accès est faite PAR PAGE, avec la
 * permission précise de la section (défense en profondeur) — le layout
 * commun, s'il existe, n'est qu'une barrière supplémentaire.
 *
 * L'import en masse (SA-040, SA-041, SA-042, SA-044, SA-045) est
 * abandonné (décision C-06, docs/decisions.md) : ces chemins n'existent
 * plus. SA-043 (profils incomplets) est conservé, déplacé hors de
 * `/administration/imports` — utile indépendamment de l'origine du profil.
 */
export const ADMIN_DATA_ROUTES = {
  /** Racine du back-office (portée par le lot « cœur »). */
  home: '/administration',

  /** SA-043 — Profils incomplets, priorisation. */
  incompleteProfiles: '/administration/profils-incomplets',

  /** SA-046 — Analytics, valeur du réseau. */
  analytics: '/administration/analytics',
  /** SA-047 — Analytics, segmentation du réseau. */
  analyticsSegmentation: '/administration/analytics/segmentation',

  /** SA-048 — Paramètres plateforme et feature flags. */
  settings: '/administration/parametres',

  /** SA-049 — Journal d'audit. */
  audit: '/administration/audit',
} as const;

/** SA-050 — Détail d'une entrée du journal d'audit. */
export function auditEntryRoute(entryId: number | string): string {
  return `${ADMIN_DATA_ROUTES.audit}/${encodeURIComponent(String(entryId))}`;
}
