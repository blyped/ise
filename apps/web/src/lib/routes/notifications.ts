/**
 * Chemins de la tranche CENTRE DE NOTIFICATIONS (ISE-098).
 *
 * `scope` est une PRIORITE (« Action requise »), `categorie` une
 * categorie : les deux filtres sont distincts et ne se melangent jamais
 * dans l'URL (D-81).
 */
export const NOTIFICATION_ROUTES = {
  /** ISE-098 — Centre de notifications. */
  center: '/notifications',
} as const;

export type NotificationScope = 'all' | 'action_required' | 'unread' | 'archived';

export function notificationsRoute(
  scope: NotificationScope = 'all',
  category: string | null = null,
): string {
  const params = new URLSearchParams();
  if (scope !== 'all') params.set('filtre', scope);
  if (category !== null && category.length > 0) params.set('categorie', category);
  const query = params.toString();
  return query.length > 0 ? `${NOTIFICATION_ROUTES.center}?${query}` : NOTIFICATION_ROUTES.center;
}
