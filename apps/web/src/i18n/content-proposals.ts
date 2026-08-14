/**
 * PROPOSITION DE CONTENU PAR LES ISE — libellés français (migration 0132).
 *
 * Fichier i18n DÉDIÉ, comme `admin-news.ts` ou `profile-documents.ts` : la
 * tranche a deux faces (membre et administration) et n'a pas à grossir
 * `content.ts` ni `admin.ts`.
 *
 * Un mot sur le vocabulaire retenu : on dit « proposition », jamais
 * « publication ». Le membre ne publie pas — il propose, et
 * l'administration tranche. L'écran ne doit rien laisser croire d'autre.
 */

export const frContentProposals = {
  /**
   * Codes machine levés par 0132 qui n'existent pas dans le dictionnaire
   * partagé `@ise/domain` — même procédé que `frAdmin.errors` (D-102) :
   * un code machine, une phrase française, jamais le message de
   * PostgreSQL. Sans cela, `P0001` retomberait sur « Cette action n'est
   * plus possible dans l'état actuel », qui ne dit rien à personne quand
   * il manque simplement un lien de connexion.
   */
  errors: {
    news_missing_required_field: 'Le titre et le résumé sont obligatoires.',
    event_missing_required_field: 'Le titre, le type et la date de début sont obligatoires.',
    invalid_category: 'Choisissez une catégorie dans la liste.',
    media_alt_required: 'Décrivez l’image en quelques mots (3 caractères au minimum).',
    media_not_found: 'Le visuel n’a pas été retrouvé. Redéposez-le puis réessayez.',
    event_online_url_required:
      'Un événement en ligne ou hybride exige un lien de connexion.',
    event_place_required: 'Un événement en présentiel exige une ville ou un lieu.',
    reason_required: 'Un refus exige un motif d’au moins 10 caractères.',
    slug_already_exists:
      'Un contenu porte déjà ce titre. Reformulez-le légèrement puis réessayez.',
    news_not_found: 'Cette proposition n’existe plus.',
    event_not_found: 'Cette proposition n’existe plus.',
    invalid_status: 'Cette valeur n’est pas acceptée.',
  } as Record<string, string>,

  common: {
    /** Une décision, deux issues, et rien entre les deux. */
    statusPending: 'En attente de validation',
    statusPublished: 'Publiée',
    statusRejected: 'Refusée',
    statusOther: 'État intermédiaire',
    kindNews: 'Actualité',
    kindEvent: 'Événement',
    loadErrorTitle: 'Chargement impossible',
    saveErrorTitle: 'Envoi impossible',
    retry: 'Réessayer',
    back: 'Retour',
    coverJoined: 'Visuel joint',
    coverNone: 'Aucun visuel',
    required: 'Ce champ est obligatoire.',
  },

  /* ---------------------------------------------------------------- */
  /* Côté membre                                                       */
  /* ---------------------------------------------------------------- */

  member: {
    /** Point d'entrée depuis le fil ISE-092 et l'espace Événements. */
    entryNewsTitle: 'Proposer une actualité',
    entryNewsBody:
      'Une prise de poste, une distinction, une publication ? Proposez-la : l’administration la relit, puis la publie.',
    entryEventTitle: 'Proposer un événement',
    entryEventBody:
      'Un webinaire, une rencontre, une conférence ouverte au réseau ? Proposez-la à l’administration.',
    myProposalsLink: 'Mes propositions',

    newsTitle: 'Proposer une actualité',
    newsSubtitle:
      'Votre proposition part en validation. Elle n’est visible de personne d’autre tant que l’administration n’a pas tranché — vous en suivez l’état dans « Mes propositions ».',
    eventTitle: 'Proposer un événement',
    eventSubtitle:
      'Votre proposition part en validation. Rien n’apparaît dans l’agenda du réseau avant la décision de l’administration.',

    /* Champs — actualité */
    fieldCategory: 'Catégorie',
    fieldCategoryHint: 'Elle oriente la relecture et le classement dans le fil.',
    fieldTitle: 'Titre',
    fieldTitleHint: 'De 3 à 240 caractères.',
    fieldSummary: 'Résumé',
    fieldSummaryHint: '400 caractères au maximum. C’est ce que le réseau lira en premier.',
    fieldBody: 'Texte complet',
    fieldBodyHint: 'Facultatif.',
    fieldEventDate: 'Date de l’événement rapporté',
    fieldEventDateHint: 'Facultatif : la date du fait raconté, pas celle de la publication.',
    fieldSourceUrl: 'Lien vers la source',
    fieldSourceUrlHint:
      'Facultatif, mais fortement conseillé : une source vérifiable accélère la validation.',

    /* Champs — événement */
    fieldEventType: 'Type d’événement',
    fieldDescription: 'Description',
    fieldStartsAt: 'Début',
    fieldEndsAt: 'Fin',
    fieldEndsAtHint: 'Facultatif.',
    fieldEndsAtInvalid: 'La fin ne peut pas précéder le début.',
    fieldTimezone: 'Fuseau horaire',
    fieldFormat: 'Format',
    formatOnline: 'En ligne',
    formatInPerson: 'En présentiel',
    formatHybrid: 'Hybride',
    fieldOnlineUrl: 'Lien de connexion',
    fieldOnlineUrlHint:
      'Exigé dès que l’événement est en ligne ou hybride. Il n’est montré qu’aux inscrits.',
    fieldCity: 'Ville',
    fieldVenue: 'Lieu',
    fieldPlaceHint: 'Ville ou lieu : au moins l’un des deux dès qu’il y a du présentiel.',
    fieldCountry: 'Pays',

    /* Visuel */
    coverTitle: 'Visuel (facultatif)',
    coverIntro:
      'Joindre votre propre image évite à l’administration de la fabriquer à la validation. Elle reste PRIVÉE jusqu’à la décision : personne d’autre que vous et l’administration n’y a accès.',
    coverFileLabel: 'Fichier image',
    coverFileHint: 'PNG, JPEG, WebP ou AVIF. 5 Mo au maximum. Format conseillé : 1200 × 675 px.',
    coverAltLabel: 'Description de l’image',
    coverAltHint:
      'Obligatoire si vous joignez une image : ce texte est lu par les lecteurs d’écran. 3 caractères au minimum.',
    coverAltRequired: 'Décrivez l’image en quelques mots.',
    coverInvalid: 'Ce fichier n’est pas une image exploitable.',
    coverTooLarge: 'L’image dépasse 5 Mo.',
    coverWrongType: 'Formats acceptés : PNG, JPEG, WebP ou AVIF.',
    coverUploadFailed: 'Le dépôt de l’image a échoué. Réessayez dans un instant.',

    submitNews: 'Envoyer en validation',
    submitEvent: 'Envoyer en validation',
    submitPending: 'Envoi en cours…',
    sentNews: 'Votre proposition d’actualité est partie en validation.',
    sentEvent: 'Votre proposition d’événement est partie en validation.',
    invalid: 'Vérifiez les champs signalés.',

    /* Suivi */
    listTitle: 'Mes propositions',
    listSubtitle:
      'Ce que vous avez proposé au réseau, et où en est chaque proposition. Un refus est toujours motivé.',
    listEmpty: 'Aucune proposition pour l’instant',
    listEmptyBody:
      'Proposez une actualité ou un événement : l’administration la relit, puis la publie.',
    listSubmittedOn: 'Proposée le',
    listReviewedOn: 'Décision le',
    listPublishedOn: 'Publiée le',
    listRejectionReason: 'Motif du refus',
    listSee: 'Voir la publication',
    pendingNote:
      'En attente : personne d’autre que vous et l’administration ne voit cette proposition.',
  },

  /* ---------------------------------------------------------------- */
  /* Côté administration                                               */
  /* ---------------------------------------------------------------- */

  admin: {
    newsQueueTitle: 'Propositions d’actualités',
    newsQueueSubtitle:
      'Les actualités proposées par les ISE. Rien n’est visible du réseau avant votre décision.',
    eventQueueTitle: 'Propositions d’événements',
    eventQueueSubtitle:
      'Les événements proposés par les ISE. Rien n’entre dans l’agenda avant votre décision.',
    queueLinkNews: 'Propositions des ISE',
    queueLinkEvents: 'Propositions des ISE',

    tabPending: 'En attente',
    tabRejected: 'Refusées',
    empty: 'Aucune proposition en attente',
    emptyBody: 'La file est vide. Les nouvelles propositions apparaîtront ici.',
    emptyRejected: 'Aucune proposition refusée',
    emptyRejectedBody: 'Les propositions refusées restent consultables ici, avec leur motif.',
    open: 'Examiner',
    author: 'Proposée par',
    submittedAt: 'Reçue le',

    detailTitle: 'Examen d’une proposition',
    detailSubtitle:
      'Accepter publie immédiatement. Refuser exige un motif, transmis tel quel à l’auteur.',
    sectionContent: 'Contenu proposé',
    sectionCover: 'Visuel proposé',
    sectionDecision: 'Décision',
    notFound: 'Cette proposition n’existe plus, ou a déjà été tranchée.',

    fieldTitle: 'Titre',
    fieldSummary: 'Résumé',
    fieldBody: 'Texte',
    fieldCategory: 'Catégorie',
    fieldEventDate: 'Date rapportée',
    fieldSource: 'Source',
    fieldFormat: 'Format',
    fieldStartsAt: 'Début',
    fieldEndsAt: 'Fin',
    fieldPlace: 'Lieu',
    fieldTimezone: 'Fuseau',

    coverNone: 'Aucun visuel joint. Vous pourrez en attribuer un depuis le CMS après publication.',
    coverIntro:
      'Ce visuel est dans un espace PRIVÉ. Il ne devient public qu’à l’acceptation, et seulement si vous le retenez.',
    coverPreviewAlt: 'Visuel proposé par l’auteur',
    coverKeep: 'Reprendre ce visuel à la publication',
    coverKeepHint:
      'L’image est alors recopiée dans la médiathèque et rattachée à la publication. Décochez pour publier sans image.',
    coverAltLabel: 'Description de l’image',
    coverAltHint: 'Reprise de l’auteur. Corrigez-la si elle est imprécise.',
    coverPromoteFailed:
      'La reprise du visuel a échoué. La proposition n’a PAS été publiée — réessayez, ou publiez sans le visuel.',

    approve: 'Accepter et publier',
    approvePending: 'Publication en cours…',
    approved: 'Proposition publiée.',
    reject: 'Refuser',
    rejectPending: 'Refus en cours…',
    rejected: 'Proposition refusée. L’auteur a été prévenu du motif.',
    reasonLabel: 'Motif du refus',
    reasonHint:
      'Transmis tel quel à l’auteur : 10 caractères au minimum. Dites ce qui manque, pas seulement que cela ne convient pas.',
    reasonRequired: 'Un refus sans motif est un refus muet. Expliquez en une phrase.',

    /** D-128 rappelée à l'écran : publier n'est pas mettre en avant. */
    landingNote:
      'Publier ne met rien en avant sur la vitrine publique : l’exposition « À la une » reste pilotée depuis le CMS.',
  },
} as const;
