/**
 * Chaines du CENTRE DE NOTIFICATIONS (ISE-098).
 *
 * D-81 : « Action requise » est une PRIORITE. Les 13 categories de
 * `public.notifications.category` sont traduites separement des 5
 * priorites : aucune chaine ne melange les deux axes.
 *
 * MASTER PROMPT §98 : aucun compteur n'est arrondi ni inventé. Le texte
 * dit ce que la base contient, et rien d'autre.
 */
export const frNotifications = {
  title: 'Notifications',
  subtitle: 'Vos demandes, échéances et informations utiles — triées par priorité.',

  tabActionRequired: 'À traiter',
  tabAll: 'Toutes',
  tabUnread: 'Non lues',
  tabArchived: 'Archivées',

  categoryFilterLabel: 'Filtrer par catégorie',
  categoryAll: 'Toutes les catégories',

  markRead: 'Marquer comme lue',
  markUnread: 'Marquer comme non lue',
  markAllRead: 'Tout marquer comme lu',
  archiveRead: 'Archiver les notifications lues',
  open: 'Ouvrir',

  unreadSummary: '{count} élément non lu',
  unreadSummaryPlural: '{count} éléments non lus',
  actionRequiredSummary: '{count} demande une action',
  actionRequiredSummaryPlural: '{count} demandent une action',
  noneUnread: 'Aucune notification non lue.',

  expired: 'Échéance dépassée',
  expiredBody: 'Cette notification ne mène plus à une action possible.',
  unreadDot: 'Non lue',

  loadMore: 'Charger les notifications plus anciennes',
  emptyTitle: 'Aucune notification',
  emptyBody:
    'Vous serez averti lorsqu’une demande, une échéance ou une information vous concernera réellement.',
  emptyActionRequiredTitle: 'Rien à traiter',
  emptyActionRequiredBody: 'Aucune notification n’attend d’action de votre part.',
  emptyArchivedTitle: 'Aucune notification archivée',
  emptyArchivedBody: 'Les notifications lues que vous archivez apparaîtront ici.',
  errorTitle: 'Impossible de charger vos notifications.',

  preferencesLink: 'Gérer mes préférences de notification',

  /**
   * Etat reel de la livraison. Dire la verite vaut mieux que laisser
   * croire (MASTER PROMPT §98) : le catalogue prevoit trois canaux, seul
   * l'in-app fonctionne aujourd'hui.
   */
  channelsTitle: 'Canaux de notification',
  channelsBody:
    'Seules les notifications dans l’application sont émises aujourd’hui. Les envois par e-mail et par notification push ne partent pas encore : aucun service d’envoi n’est déployé. Vos préférences sont enregistrées et seront appliquées dès sa mise en service.',

  /** Les 13 valeurs de `notifications.category`. */
  category: {
    network: 'Réseau',
    introductions: 'Introductions',
    messages: 'Messages',
    network_calls: 'Appels au réseau',
    opportunities: 'Opportunités',
    internships: 'Stages',
    mentorship: 'Mentorat',
    projects: 'Projets',
    promotions: 'Promotions',
    communities: 'Communautés',
    events: 'Événements',
    news: 'Actualités',
    system: 'Système',
  } as Record<string, string>,

  /** Les 5 valeurs de `notifications.priority` (D-81). */
  priority: {
    critical: 'Critique',
    action_required: 'Action requise',
    relevant: 'Pertinent',
    info: 'Information',
    digest: 'Résumé',
  } as Record<string, string>,
} as const;

export function tn(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
