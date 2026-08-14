/**
 * Chemins du back-office CMS (CMS-001 -> CMS-010).
 *
 * Fichier separe de `src/lib/routes.ts`, comme `routes/opportunities.ts` :
 * la matrice de routes centrale n'a pas a grandir a chaque tranche.
 *
 * Les chemins sont en francais (MASTER PROMPT §66) et tous sous `/cms`, ce
 * qui permet une garde unique dans `src/app/cms/layout.tsx` : un membre
 * sans permission CMS n'atteint AUCUNE de ces routes (ADDENDUM §29).
 */
export const CMS_ROUTES = {
  /** CMS-001 — Tableau de bord CMS. */
  dashboard: '/cms',
  /** CMS-002 — Carrousel. */
  carousel: '/cms/carrousel',
  carouselNew: '/cms/carrousel/nouveau',
  /** CMS-003 — Sections d'accueil. */
  sections: '/cms/sections',
  /** CMS-011 (0114) — Piliers « Un reseau concu pour etre utile ». */
  pillars: '/cms/piliers',
  /** CMS-004 — Actualites. */
  news: '/cms/actualites',
  /** CMS-005 — Evenements. */
  events: '/cms/evenements',
  /** CMS-006 — ISE du jour. */
  featuredProfile: '/cms/ise-du-jour',
  /** CMS-006bis (0113) — Opportunites : exposition landing + visuel. */
  opportunities: '/cms/opportunites',
  /** CMS-007 — Partenaires. */
  partners: '/cms/partenaires',
  partnersNew: '/cms/partenaires/nouveau',
  /** CMS-013 (0133) — Organisations affichees sur la page d'accueil (logos). */
  landingOrganizations: '/cms/organisations',
  /** CMS-008 — Mediatheque. */
  media: '/cms/mediatheque',
  /** CMS-009 — Programmation globale. */
  schedule: '/cms/programmation',
  /** CMS-012 (0121) — File de passage des encarts « A la une du reseau ». */
  landingQueue: '/cms/programmation/a-la-une',
  /** CMS-010 — Apercu de la landing. */
  preview: '/cms/apercu',
} as const;

/** CMS-002 — Fiche d'une slide de carrousel. */
export function carouselItemRoute(itemId: string): string {
  return `${CMS_ROUTES.carousel}/${encodeURIComponent(itemId)}`;
}

/** CMS-007 — Fiche d'une campagne partenaire. */
export function partnerCampaignRoute(campaignId: string): string {
  return `${CMS_ROUTES.partners}/${encodeURIComponent(campaignId)}`;
}

/** CMS-003 — Fiche d'une section d'accueil. */
export function sectionRoute(sectionKey: string): string {
  return `${CMS_ROUTES.sections}/${encodeURIComponent(sectionKey)}`;
}

/**
 * Prefixe unique du back-office. Sert au middleware et a la garde de
 * `layout.tsx` : une seule chaine a maintenir.
 */
export const CMS_ROUTE_PREFIX = '/cms';
