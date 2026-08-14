/**
 * Chaines de l'AIDE & SUPPORT (ISE-100), volet « Remonter une information »
 * du module Communication.
 *
 * D-85 : AUCUN delai de reponse n'est annonce. Les documents n'en
 * definissent aucun ; afficher un delai sans engagement reel serait un
 * faux indicateur (MASTER PROMPT §98). Aucune chaine de ce fichier ne
 * mentionne d'heure, de jour ouvre ni de priorite promise.
 *
 * D-85 (suite) : aucune chaine ne propose au demandeur de CHOISIR une
 * priorite. La priorite est posee par la plateforme d'apres la nature de
 * la remontee, puis ajustee par l'administration. Le texte le dit.
 */
export const frSupport = {
  title: 'Aide & Support',
  subtitle: 'Trouvez une réponse, remontez une information ou suivez vos demandes.',
  correlationLabel: 'Référence à communiquer à l’assistance',
  errorTitle: 'Impossible de charger le centre d’aide.',
  back: 'Retour',

  help: {
    categoriesTitle: 'De quoi s’agit-il ?',
    categoriesBody:
      'Choisissez la nature de votre remontée : un bug, une suggestion, une idée, une demande d’aide ou une observation. C’est ce choix qui oriente votre demande.',
    moderationHint: 'Orientée vers la modération',
    noFaqTitle: 'Aucun article d’aide n’est encore publié',
    noFaqBody:
      'La base d’articles n’est pas alimentée : rien n’est affiché plutôt que des réponses inventées. Décrivez votre problème dans une demande, l’équipe vous répondra dans le fil de la demande.',
    createTicket: 'Remonter une information',
    myTickets: 'Mes demandes',
    reportContent: 'Signaler un profil ou un contenu',
    noSla:
      'Aucun délai de réponse n’est annoncé : aucun engagement de traitement n’est défini à ce jour. Vous suivez l’avancement de votre demande dans « Mes demandes ».',
  },

  ticket: {
    newTitle: 'Remonter une information',
    newSubtitle:
      'Un bug, une suggestion, une idée, un problème, une demande d’aide ou une simple observation : décrivez-le ici. Plus le contexte est précis, plus la réponse l’est.',
    categoryLabel: 'Nature de votre remontée',
    categoryPlaceholder: 'Choisissez la nature de votre remontée',
    subjectLabel: 'Objet',
    subjectPlaceholder: 'Résumez votre remontée en une phrase',
    subjectHint: 'Entre 3 et 200 caractères.',
    descriptionLabel: 'Description',
    descriptionPlaceholder:
      'Ce que vous tentiez de faire, ce qui s’est passé, et ce que vous attendiez.',
    descriptionHint: 'Au moins 10 caractères.',
    technicalContextTitle: 'Contexte technique joint automatiquement',
    technicalContextBody:
      'La page d’où part votre remontée, votre navigateur, votre système et le type d’appareil sont ajoutés à la demande pour aider au diagnostic. Aucune coordonnée, aucun mot de passe, aucun contenu privé n’y est joint. Ces informations ne servent qu’à l’équipe qui traite la demande.',
    urgencyNotice:
      'La priorité n’est pas choisie par le demandeur : elle est posée d’après la nature de la remontée, puis ajustée par l’administration.',
    submit: 'Envoyer ma remontée',
    submitting: 'Envoi en cours…',
    created: 'Votre demande {reference} a été enregistrée.',

    listTitle: 'Mes demandes',
    listSubtitle: 'Suivez l’avancement de vos remontées.',
    openCount: '{count} demande en cours',
    openCountPlural: '{count} demandes en cours',
    emptyTitle: 'Aucune demande',
    emptyBody: 'Vous n’avez encore remonté aucune information.',
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
    authorAgent: 'Administration',
    authorSystem: 'Système',
  },

  /**
   * Pieces jointes d'une remontee (migration 0131).
   *
   * Le texte sur l'absence d'analyse antivirale n'est pas une precaution
   * de style : aucun antivirus n'est disponible sur la plateforme. Le
   * dire vaut mieux que de laisser croire a un controle inexistant.
   */
  attachments: {
    label: 'Pièces jointes (facultatif)',
    hint: 'Jusqu’à 3 fichiers, 10 Mo maximum chacun. Formats acceptés : PNG, JPEG, WebP, PDF, DOCX, XLSX, PPTX. Une capture d’écran est souvent la pièce la plus parlante.',
    noScan:
      'Les fichiers déposés ne font l’objet d’aucune analyse antivirale : aucun outil de ce type n’est disponible sur la plateforme. Ne déposez que des fichiers dont vous connaissez l’origine.',
    listLabel: 'Pièces jointes',
    download: 'Ouvrir la pièce jointe',
    tooMany: 'Vous ne pouvez joindre que 3 fichiers par message.',
    tooLarge: 'Chaque fichier doit peser 10 Mo au maximum.',
    typeInvalid: 'Ce format de fichier n’est pas accepté.',
    contentMismatch: 'Le contenu du fichier ne correspond pas à son format annoncé.',
    partial:
      'Votre message est enregistré, mais une pièce jointe au moins n’a pas pu être déposée. Vous pouvez la joindre à nouveau dans une réponse.',
  },

  /**
   * Libelles membre de `support_tickets.status` — six etats (0131).
   *
   * `waiting_user` s'affiche « Répondu » : c'est l'etat ou
   * l'administration a repondu et ou la main revient au membre. Le code
   * technique est conserve, le libelle dit la meme chose du bon cote.
   */
  status: {
    open: 'Nouvelle',
    acknowledged: 'Prise en charge',
    in_progress: 'En cours',
    waiting_user: 'Répondu',
    resolved: 'Résolue',
    closed: 'Fermée',
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
      'L’ajout de pièces justificatives (capture, document) n’est pas encore livré sur cet écran : le téléversement n’y est pas en place.',
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
