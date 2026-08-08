/**
 * Chaines de l'AIDE & SUPPORT (ISE-100).
 *
 * D-85 : AUCUN delai de reponse n'est annonce. Les documents n'en
 * definissent aucun ; afficher un delai sans engagement reel serait un
 * faux indicateur (MASTER PROMPT §98). Aucune chaine de ce fichier ne
 * mentionne d'heure, de jour ouvre ni de priorite promise.
 */
export const frSupport = {
  title: 'Aide & Support',
  subtitle: 'Trouvez une réponse, signalez un problème ou suivez vos demandes d’assistance.',
  correlationLabel: 'Référence à communiquer à l’assistance',
  errorTitle: 'Impossible de charger le centre d’aide.',
  back: 'Retour',

  help: {
    categoriesTitle: 'Choisissez le sujet de votre demande',
    categoriesBody:
      'Les catégories ci-dessous sont celles utilisées par l’équipe d’assistance pour orienter votre demande.',
    moderationHint: 'Orientée vers la modération',
    noFaqTitle: 'Aucun article d’aide n’est encore publié',
    noFaqBody:
      'La base d’articles n’est pas alimentée : rien n’est affiché plutôt que des réponses inventées. Décrivez votre problème dans une demande, l’équipe vous répondra dans le fil de la demande.',
    createTicket: 'Créer une demande',
    myTickets: 'Mes demandes',
    reportContent: 'Signaler un profil ou un contenu',
    noSla:
      'Aucun délai de réponse n’est annoncé : aucun engagement de traitement n’est défini à ce jour. Vous suivez l’avancement de votre demande dans « Mes demandes ».',
  },

  ticket: {
    newTitle: 'Nouvelle demande',
    newSubtitle:
      'Décrivez le problème rencontré : plus le contexte est précis, plus la réponse l’est.',
    categoryLabel: 'Catégorie',
    categoryPlaceholder: 'Choisissez une catégorie',
    subjectLabel: 'Objet',
    subjectPlaceholder: 'Résumez votre demande en une phrase',
    subjectHint: 'Entre 3 et 200 caractères.',
    descriptionLabel: 'Description',
    descriptionPlaceholder:
      'Ce que vous tentiez de faire, ce qui s’est passé, et ce que vous attendiez.',
    descriptionHint: 'Au moins 10 caractères.',
    technicalContextTitle: 'Contexte technique joint automatiquement',
    technicalContextBody:
      'La page concernée et la référence d’incident sont ajoutées à votre demande. Aucune coordonnée, aucun secret, aucun contenu de message privé n’y est joint.',
    urgencyNotice:
      'Le niveau d’urgence n’est pas choisi par le demandeur : il est attribué par l’équipe d’assistance.',
    attachmentsUnavailable:
      'L’ajout d’une capture ou d’un fichier n’est pas encore livré : le téléversement n’est pas en place.',
    submit: 'Envoyer ma demande',
    submitting: 'Envoi en cours…',
    created: 'Votre demande {reference} a été enregistrée.',

    listTitle: 'Mes demandes',
    listSubtitle: 'Suivez l’avancement de vos demandes d’assistance.',
    openCount: '{count} demande en cours',
    openCountPlural: '{count} demandes en cours',
    emptyTitle: 'Aucune demande',
    emptyBody: 'Vous n’avez encore déposé aucune demande d’assistance.',
    loadMore: 'Charger les demandes plus anciennes',
    reference: 'Référence',
    createdOn: 'Déposée le {date}',
    lastUpdate: 'Dernière mise à jour le {date}',
    messageCount: '{count} message',
    messageCountPlural: '{count} messages',

    detailTitle: 'Demande {reference}',
    threadLabel: 'Échanges de la demande',
    replyLabel: 'Votre réponse',
    replyPlaceholder: 'Ajoutez une précision ou répondez à l’équipe.',
    reply: 'Envoyer',
    replied: 'Votre réponse est enregistrée.',
    closedNoReply: 'Cette demande est close : elle n’accepte plus de réponse.',
    close: 'Clôturer cette demande',
    closed: 'Votre demande est clôturée.',
    reopen: 'Rouvrir cette demande',
    reopened: 'Votre demande est rouverte.',
    notFound: 'Cette demande n’existe pas ou ne vous est pas accessible.',
    authorMember: 'Vous',
    authorAgent: 'Équipe d’assistance',
    authorSystem: 'Système',
  },

  /** Libelles membre de `support_tickets.status` [34 §127]. */
  status: {
    open: 'Reçue',
    in_progress: 'En traitement',
    waiting_user: 'Information demandée',
    resolved: 'Résolue',
    closed: 'Clôturée',
  } as Record<string, string>,

  report: {
    title: 'Signaler',
    subtitle:
      'Le signalement est examiné par la modération. Le membre concerné ne sait jamais qui l’a signalé.',
    targetTypeLabel: 'Type d’élément signalé',
    targetLabel: 'Élément signalé',
    reasonLabel: 'Motif',
    reasonPlaceholder: 'Choisissez un motif',
    reasonHint: 'Seuls les motifs applicables à ce type d’élément sont proposés.',
    descriptionLabel: 'Précisions',
    descriptionPlaceholder: 'Décrivez ce qui vous paraît problématique.',
    descriptionHint: 'Facultatif, mais utile à l’examen.',
    submit: 'Envoyer le signalement',
    submitting: 'Envoi en cours…',
    created: 'Votre signalement est enregistré. Vous n’en serez pas informé publiquement.',
    blockDistinction:
      'Signaler et bloquer sont deux actions distinctes : vous pouvez bloquer un membre sans le signaler.',
    myReportsTitle: 'Mes signalements',
    myReportsEmpty: 'Vous n’avez déposé aucun signalement.',
    noEvidence:
      'L’ajout de pièces justificatives (capture, document) n’est pas encore livré : le téléversement n’est pas en place.',
    missingTarget: 'Aucun élément à signaler n’a été indiqué.',
    /** Libelles de `reports.status`. */
    status: {
      open: 'Reçu',
      reviewing: 'En cours d’examen',
      resolved: 'Traité',
      dismissed: 'Classé sans suite',
    } as Record<string, string>,
    targetType: {
      profile: 'Profil',
      conversation: 'Conversation',
      message: 'Message',
      network_call: 'Appel au réseau',
      opportunity: 'Opportunité',
      project: 'Projet',
      news_post: 'Actualité',
      event: 'Événement',
      community: 'Communauté',
      comment: 'Commentaire',
    } as Record<string, string>,
  },
} as const;

export function tsup(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
