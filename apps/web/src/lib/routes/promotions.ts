/**
 * Chemins de la tranche PROMOTIONS (ISE-067 -> ISE-071).
 *
 * Fichier separe de `src/lib/routes.ts`, comme `routes/calls.ts` et
 * `routes/opportunities.ts` : les tranches ajoutent leurs chemins sans
 * toucher au module central.
 */
export const PROMOTION_ROUTES = {
  /** Hub « Collaborer » : promotion, stages, mentorat (MASTER PROMPT §89). */
  hub: '/collaborer',
  /** ISE-067 — Ma promotion, sans identifiant : celle du membre connecte. */
  mine: '/promotions',
} as const;

/** ISE-067 — Ma promotion. */
export function promotionRoute(promotionId: number | string): string {
  return `${PROMOTION_ROUTES.mine}/${encodeURIComponent(String(promotionId))}`;
}

/** ISE-068 — Membres de la promotion. */
export function promotionMembersRoute(promotionId: number | string): string {
  return `${promotionRoute(promotionId)}/membres`;
}

/** ISE-069 — Profil reference : aider a retrouver un camarade. */
export function promotionReferencedMemberRoute(
  promotionId: number | string,
  profileId: string,
): string {
  return `${promotionMembersRoute(promotionId)}/${encodeURIComponent(profileId)}`;
}

/** ISE-070 — Inviter un camarade a reclamer son profil. */
export function promotionInviteRoute(promotionId: number | string, profileId: string): string {
  return `${promotionReferencedMemberRoute(promotionId, profileId)}/inviter`;
}

/** ISE-071 — Suivi des invitations de la promotion. */
export function promotionInvitationsRoute(promotionId: number | string): string {
  return `${promotionRoute(promotionId)}/invitations`;
}
