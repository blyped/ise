/**
 * Chemins de la tranche MESSAGERIE (ISE-097).
 *
 * Fichier separe de `src/lib/routes.ts`, sur le modele de
 * `src/lib/routes/network.ts` : chaque tranche apporte sa table de routes.
 * Aucune de ces routes n'est publique : `src/middleware.ts` les protege.
 */
export const MESSAGING_ROUTES = {
  /** ISE-097 — Boite de reception. */
  inbox: '/messages',
  /** ISE-097 — Ouvrir une conversation avec un membre precis. */
  compose: '/messages/nouveau',
} as const;

/** ISE-097 — Fil d'une conversation. */
export function conversationRoute(conversationId: string): string {
  return `${MESSAGING_ROUTES.inbox}/${encodeURIComponent(conversationId)}`;
}

/** ISE-097 — Ecrire a un membre depuis son profil. */
export function composeRoute(profileId: string): string {
  return `${MESSAGING_ROUTES.compose}?profil=${encodeURIComponent(profileId)}`;
}
