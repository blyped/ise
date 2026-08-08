/**
 * Chemins de la tranche COMMUNAUTES (ISE-084 -> ISE-087).
 *
 * Fichier separe de `src/lib/routes.ts`, comme `routes/calls.ts` et
 * `routes/opportunities.ts` : le socle transverse ne grossit pas a
 * chaque tranche.
 */
export const COMMUNITY_ROUTES = {
  /** ISE-084 — Espace Communautes. */
  list: '/communautes',
} as const;

/** ISE-085 — Detail d'une communaute. */
export function communityRoute(communityId: string): string {
  return `${COMMUNITY_ROUTES.list}/${encodeURIComponent(communityId)}`;
}

/** ISE-086 — Publier dans la communaute. */
export function communityPublishRoute(communityId: string): string {
  return `${communityRoute(communityId)}/publier`;
}

/** ISE-087 — Suivi de ma publication. */
export function communityPostRoute(communityId: string, postId: string): string {
  return `${communityRoute(communityId)}/publications/${encodeURIComponent(postId)}`;
}

/** Onglet « Membres » de la page communaute. */
export function communityMembersRoute(communityId: string): string {
  return `${communityRoute(communityId)}?onglet=membres`;
}
