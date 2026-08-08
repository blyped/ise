/**
 * Chemins de la tranche AIDE & SUPPORT (ISE-100).
 *
 * `/aide/demandes/{id}` est aussi le chemin pose dans
 * `notifications.action_path` par `public.create_support_ticket()` :
 * les deux doivent rester alignes.
 */
export const SUPPORT_ROUTES = {
  /** ISE-100 — Centre d'aide. */
  help: '/aide',
  /** ISE-100 — Mes demandes. */
  tickets: '/aide/demandes',
  /** ISE-100 — Nouvelle demande. */
  newTicket: '/aide/demandes/nouvelle',
  /** ISE-100 — Signaler un profil ou un contenu. */
  report: '/aide/signaler',
} as const;

export function ticketRoute(ticketId: string): string {
  return `${SUPPORT_ROUTES.tickets}/${encodeURIComponent(ticketId)}`;
}

/** ISE-100 — Formulaire de signalement pre-cible. */
export function reportRoute(targetType: string, targetId: string): string {
  return `${SUPPORT_ROUTES.report}?type=${encodeURIComponent(targetType)}&objet=${encodeURIComponent(targetId)}`;
}
