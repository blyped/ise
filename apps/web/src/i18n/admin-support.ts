/**
 * Chaines du COCKPIT DES REMONTEES (SA-038 / SA-039), volet
 * « Remonter une information » du module Communication.
 *
 * POURQUOI UN FICHIER DEDIE plutot qu'une section de `i18n/admin.ts` :
 * le cockpit des remontees a desormais son propre vocabulaire — six
 * statuts, quatre priorites, huit natures, cinq compteurs, sept filtres.
 * Le sortir de `admin.ts` evite de faire enfler un fichier partage par
 * une vingtaine d'ecrans, et rend ce vocabulaire modifiable sans toucher
 * au reste du back-office.
 *
 * D-85 : aucun delai cible, aucune echeance, aucune promesse de
 * traitement n'apparait ici. Les compteurs sont des FAITS comptes en
 * base, jamais des estimations (MASTER PROMPT §98).
 */
export const frAdminSupport = {
  title: 'Remontées des ISE',
  subtitle:
    'Bugs, suggestions, idées, demandes d’aide et observations remontés par les membres. Aucun délai cible n’est affiché (D-85).',
  empty: 'Aucune remontée dans cette file.',
  emptyBody: 'Les remontées déposées par les membres apparaîtront ici.',
  unassigned: 'Non assigné',
  unanswered: 'Sans réponse',

  /** Compteurs de tete. Chaque chiffre est compte en base. */
  counters: {
    title: 'Vue d’ensemble',
    new: 'Nouvelles remontées',
    inProgress: 'En cours de traitement',
    unanswered: 'Sans réponse',
    critical: 'Critiques ouvertes',
    resolved: 'Résolues et fermées',
    hint: 'Chiffres comptés en base au chargement de l’écran. Aucun délai de traitement n’est engagé.',
  },

  filters: {
    title: 'Filtrer la file',
    status: 'Statut',
    category: 'Nature',
    urgency: 'Priorité',
    promotion: 'Promotion',
    assignee: 'Administrateur en charge',
    unanswered: 'Sans réponse uniquement',
    from: 'Déposée à partir du',
    to: 'Déposée jusqu’au',
    apply: 'Filtrer',
    reset: 'Réinitialiser',
    noPromotion: 'Aucune promotion renseignée sur les remontées existantes.',
    noAssignee: 'Aucune remontée assignée pour l’instant.',
  },

  /** `support_tickets.status` — six etats (migration 0131). */
  status: {
    open: 'Nouveau',
    acknowledged: 'Pris en charge',
    in_progress: 'En cours',
    waiting_user: 'Répondu',
    resolved: 'Résolu',
    closed: 'Fermé',
  } as Record<string, string>,

  /** `support_tickets.urgency` — quatre niveaux (migration 0131). */
  urgency: {
    low: 'Faible',
    standard: 'Normale',
    high: 'Haute',
    critical: 'Critique',
  } as Record<string, string>,

  urgencySource: {
    system: 'posée par la plateforme',
    agent: 'ajustée par l’administration',
  } as Record<string, string>,

  columns: {
    ticket: 'Remontée',
    requester: 'Demandeur',
    promotion: 'Promotion',
    urgency: 'Priorité',
    status: 'Statut',
    assignee: 'En charge',
    created: 'Déposée le',
  },

  detail: {
    title: 'Remontée',
    requester: 'Demandeur',
    promotion: 'Promotion',
    category: 'Nature',
    reopened: (count: number) => `Rouverte ${count} fois`,
    correlation: 'Identifiant de corrélation',
    threadTitle: 'Fil de la demande',
    internalNote: 'Note interne — invisible du demandeur',
    authorMember: 'Membre',
    authorAgent: 'Administration',
    authorSystem: 'Système',
    replyTitle: 'Répondre au membre',
    replyLabel: 'Message',
    replyPlaceholder: 'Votre réponse au demandeur…',
    internalLabel: 'Note interne (invisible du demandeur)',
    send: 'Envoyer',
    sent: 'Message envoyé.',
    assignToMe: 'Me l’assigner',
    assigned: 'Remontée assignée.',
    acknowledge: 'Prendre en charge',
    acknowledgeBody:
      'La remontée passe « Prise en charge » et vous est assignée si elle ne l’est pas déjà. Le membre est informé.',
    take: 'Passer en cours',
    waitUser: 'Marquer comme répondu',
    waitUserBody:
      'La remontée passe « Répondu » : le membre est informé que la main lui revient. Répondez-lui dans le fil avant de basculer ce statut.',
    resolve: 'Marquer résolu',
    resolveBody: 'Le demandeur est notifié de la résolution. Il peut rouvrir la remontée.',
    transitionDone: 'Statut de la remontée mis à jour.',
    transitionInvalid: 'Ce changement de statut n’est pas possible depuis l’état actuel.',
    closedInfo: 'Remontée fermée : plus aucune réponse possible.',

    urgencyTitle: 'Priorité',
    urgencyIntro:
      'La priorité n’est jamais choisie par le demandeur (D-85). Elle est posée par la plateforme d’après la nature de la remontée, et vous seul pouvez l’ajuster. Votre nom est enregistré avec le changement.',
    urgencyLabel: 'Nouvelle priorité',
    urgencyReasonLabel: 'Motif (facultatif, conservé au journal)',
    urgencyReasonPlaceholder: 'Pourquoi cette priorité ?',
    urgencySubmit: 'Appliquer la priorité',
    urgencyDone: 'Priorité mise à jour.',
    urgencyInvalid: 'Choisissez une priorité parmi Faible, Normale, Haute ou Critique.',
    urgencySetBy: 'Ajustée par {name}',

    technicalTitle: 'Contexte technique',
    technicalIntro:
      'Collecté automatiquement au dépôt de la remontée et filtré par liste blanche. Visible de l’administration uniquement : le demandeur ne voit jamais ce bloc.',
    technicalEmpty: 'Aucun contexte technique n’a été transmis avec cette remontée.',
    technicalKeys: {
      page: 'Écran d’origine',
      surface: 'Environnement',
      environment: 'Déploiement',
      browser: 'Navigateur',
      browser_version: 'Version du navigateur',
      os: 'Système',
      os_version: 'Version du système',
      device_type: 'Type d’appareil',
      viewport: 'Taille d’écran',
      language: 'Langue',
      timezone: 'Fuseau horaire',
      app_version: 'Version applicative',
      user_agent: 'Agent utilisateur',
    } as Record<string, string>,

    attachmentsTitle: 'Pièces jointes',
    attachmentsEmpty: 'Aucune pièce jointe.',
    attachmentsOpen: 'Ouvrir',
    attachmentsNoScan:
      'Aucune analyse antivirale n’est réalisée sur ces fichiers : aucun outil de ce type n’est disponible sur la plateforme. Ouvrez-les avec la prudence d’usage.',
  },
} as const;

/** Remplacement de jetons `{cle}` — meme fonction que `tsup`, portée admin. */
export function tAdminSupport(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
