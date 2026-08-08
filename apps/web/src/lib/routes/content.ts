/**
 * Chemins de la tranche ACTUALITES & EVENEMENTS (ISE-092 -> ISE-096).
 *
 * Deux entrees de navigation distinctes — « Actualites » et
 * « Evenements » — comme le MASTER PROMPT §89 les distingue, alors que
 * l'ecran ISE-092 presente un fil mixte des deux.
 */
export const CONTENT_ROUTES = {
  /** ISE-092 — Actualites & evenements du reseau. */
  news: '/actualites',
  /** ISE-094 — Espace Evenements. */
  events: '/evenements',
} as const;

/** ISE-093 — Detail d'une actualite. */
export function newsRoute(newsId: string): string {
  return `${CONTENT_ROUTES.news}/${encodeURIComponent(newsId)}`;
}

/** ISE-095 — Detail d'un evenement. */
export function eventRoute(eventId: string): string {
  return `${CONTENT_ROUTES.events}/${encodeURIComponent(eventId)}`;
}

/** ISE-096 — Apres l'evenement : suivi et impact reel. */
export function eventFollowupRoute(eventId: string): string {
  return `${eventRoute(eventId)}/apres`;
}
