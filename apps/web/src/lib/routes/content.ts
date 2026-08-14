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
  /**
   * Proposition de contenu par un membre (0132). Sous-route de chaque
   * espace, comme `/opportunites/publier` l'est de `/opportunites` : on
   * propose la ou l'on lit.
   */
  proposeNews: '/actualites/proposer',
  proposeEvent: '/evenements/proposer',
  /**
   * Suivi de MES propositions — en attente, publiee, refusee avec motif.
   * Route commune aux deux natures : c'est le meme geste, et l'auteur ne
   * pense pas « actualite » ou « evenement » quand il demande « ou en est
   * ce que j'ai envoye ? ». C'est aussi la cible du lien porte par la
   * notification de decision (`moderate_content_proposal`, 0132).
   */
  myProposals: '/mes-propositions',
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
