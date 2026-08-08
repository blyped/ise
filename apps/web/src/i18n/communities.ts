/**
 * Chaînes de la tranche COMMUNAUTÉS (ISE-084 → ISE-087).
 *
 * Règles appliquées ici :
 *  - MASTER PROMPT §1 : aucun libellé ne parle de « populaire », de
 *    « tendance », de « meilleure réponse » ni de classement. Une
 *    communauté est décrite par ce qu'elle permet de faire, pas par sa
 *    taille relative.
 *  - CA-COMM-02 : chaque recommandation est accompagnée de sa raison,
 *    formulée à partir d'une donnée que la personne a elle-même
 *    déclarée.
 *  - CA-COMM-03 : le vocabulaire évite « fil », « publication virale »,
 *    « abonnés ». On publie une question, une ressource, une analyse.
 */
export const frCommunities = {
  common: {
    breadcrumb: 'Communautés',
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    endOfList: 'Vous avez vu toutes les communautés disponibles.',
    endOfPosts: 'Vous avez vu toutes les publications de cette communauté.',
    loadErrorTitle: 'Les communautés n’ont pas pu être chargées.',
    loadErrorBody:
      'Réessayez dans un instant. Si le problème persiste, communiquez la référence ci-dessous à l’assistance.',
    notFoundTitle: 'Cette communauté n’est pas accessible.',
    notFoundBody:
      'Elle est privée, archivée, ou elle n’existe pas. Les communautés privées n’apparaissent que pour leurs membres.',
    optional: 'Facultatif',
    required: 'Obligatoire',
    members: 'membres',
    memberBadge: 'Membre',
    pendingBadge: 'Demande en attente',
    moderatorBadge: 'Animateur',
  },

  type: {
    country: 'Pays',
    sector: 'Secteur',
    thematic: 'Expertise',
    special: 'Spécifique',
  },

  joinPolicy: {
    open: 'Adhésion libre',
    request: 'Adhésion sur demande',
    invitation: 'Adhésion sur invitation',
  },

  postType: {
    question: 'Question',
    experience: 'Retour d’expérience',
    resource: 'Ressource',
    analysis: 'Analyse',
    news: 'Actualité sectorielle',
    opportunity_reference: 'Opportunité',
    network_call_reference: 'Appel au réseau',
    event_reference: 'Événement',
    project_reference: 'Projet',
  },

  reason: {
    skill_domain: 'Recommandée car ce domaine figure parmi vos compétences déclarées',
    sector: 'Recommandée car ce secteur figure parmi vos secteurs d’expérience',
    country: 'Recommandée car ce pays figure dans votre parcours déclaré',
    connections: 'Des relations que vous avez déjà en font partie',
    title: 'Pourquoi cette recommandation ?',
  },

  /** ISE-084 — Espace Communautés. */
  list: {
    title: 'Communautés ISE',
    subtitle:
      'Échangez avec les bonnes personnes autour d’un domaine, d’un secteur ou d’un enjeu professionnel.',
    tabForMe: 'Pour moi',
    tabAll: 'Toutes',
    tabMine: 'Mes communautés',
    tabNew: 'Nouvelles',
    searchLabel: 'Rechercher une communauté',
    searchPlaceholder: 'Nom, thème, secteur, pays…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer les filtres',
    filterType: 'Type',
    filterCountry: 'Pays',
    filterSector: 'Secteur',
    filterAll: 'Toutes',
    filterApply: 'Appliquer',
    open: 'Ouvrir',
    join: 'Rejoindre',
    request: 'Demander à rejoindre',
    lastActivity: 'Dernière activité utile',
    lastTopic: 'Dernier sujet',
    openQuestions: 'question(s) ouverte(s) attendant une expérience',
    emptyForMeTitle: 'Aucune communauté ne correspond encore à votre profil.',
    emptyForMeBody:
      'Les recommandations s’appuient sur vos compétences, vos secteurs et votre pays. Complétez votre profil, ou parcourez toutes les communautés.',
    emptyForMeAction: 'Voir toutes les communautés',
    emptyMineTitle: 'Vous n’avez encore rejoint aucune communauté.',
    emptyMineBody:
      'Une communauté vous fait retrouver les ISE qui travaillent aujourd’hui sur les mêmes sujets que vous.',
    emptyAllTitle: 'Aucune communauté ne correspond à cette recherche.',
    emptyAllBody: 'Élargissez les filtres, ou revenez à la liste complète.',
    noCreationTitle: 'La création de communautés est réservée à l’administration.',
    noCreationBody:
      'C’est volontaire : mieux vaut peu de communautés vivantes que beaucoup de communautés vides. Une demande de nouvelle communauté passe par l’assistance.',
    contributeTitle: 'Contribuer, pas seulement suivre',
    contributeBody:
      'Une communauté vit grâce aux réponses, aux ressources et aux retours d’expérience de ses membres.',
  },

  /** ISE-085 — Détail d'une communauté. */
  detail: {
    tabFeed: 'Fil',
    tabQuestions: 'Questions ouvertes',
    tabMembers: 'Membres',
    tabAbout: 'À propos',
    publish: 'Publier dans la communauté',
    join: 'Rejoindre la communauté',
    request: 'Demander à rejoindre',
    leave: 'Quitter la communauté',
    leaveConfirm: 'Quitter cette communauté ?',
    notifications: 'Notifications',
    notificationLevel: 'Ce que je veux recevoir',
    notificationAll: 'Toutes les activités',
    notificationImportant: 'Important uniquement',
    notificationNone: 'Aucune notification immédiate',
    digest: 'Résumé périodique',
    digestNone: 'Pas de résumé',
    digestDaily: 'Résumé quotidien',
    digestWeekly: 'Résumé hebdomadaire',
    notificationSave: 'Enregistrer mes préférences',
    notificationHelp:
      'Par défaut, une communauté ne notifie pas chaque publication : seul l’essentiel vous parvient, complété d’un résumé hebdomadaire.',
    briefTitle: 'La communauté en bref',
    statMembers: 'Membres',
    statActive: 'Ont publié ces 30 derniers jours',
    statOpenDiscussions: 'Discussions ouvertes',
    statExpertiseCalls: 'Questions sans réponse marquée utile',
    statCountries: 'Pays représentés',
    statPromotions: 'Promotions représentées',
    moderatorsTitle: 'Animation',
    moderatorsBody: 'Les animateurs accueillent, modèrent et proposent des initiatives.',
    knownMembersTitle: 'Membres que vous connaissez',
    knownMembersBody: 'Uniquement des relations déjà confirmées.',
    expertiseTitle: 'Expertises présentes dans les publications',
    charterTitle: 'Charte de la communauté',
    purposeTitle: 'Ce que cette communauté permet de faire',
    membersReservedTitle: 'L’annuaire de la communauté est réservé à ses membres.',
    membersReservedBody:
      'La fiche d’une communauté ouverte au réseau est visible de tous ; la liste de ses membres, non.',
    membersSearchLabel: 'Rechercher un membre de cette communauté',
    membersSearchPlaceholder: 'Nom, fonction…',
    emptyFeedTitle: 'Aucune publication pour le moment.',
    emptyFeedBody:
      'Soyez parmi les premiers à partager une question professionnelle ou une ressource utile.',
    emptyMembersTitle: 'Aucun membre ne correspond à cette recherche.',
    emptyMembersBody: 'Essayez un autre nom ou une autre fonction.',
    joinToPublish: 'Rejoignez la communauté pour publier et répondre.',
    pendingNotice:
      'Votre demande d’adhésion est en attente. Un animateur la traitera ; vous pourrez publier une fois l’adhésion acceptée.',
    replies: 'réponse(s)',
    helpful: 'réponse(s) marquée(s) utile(s)',
    resolved: 'Synthèse publiée',
    openPost: 'Ouvrir la publication',
  },

  /** ISE-086 — Publier dans la communauté. */
  publish: {
    title: 'Publier dans la communauté',
    subtitle: 'Une publication utile explique le contexte et formule une demande précise.',
    stepType: 'Quel type de contribution souhaitez-vous publier ?',
    typeQuestion: 'Poser une question',
    typeQuestionHint: 'Vous cherchez l’expérience d’autres ISE sur un point précis.',
    typeResource: 'Partager une ressource',
    typeResourceHint: 'Un document, un article, un jeu de données, un outil.',
    typeExperience: 'Partager une expérience',
    typeExperienceHint: 'Contexte, ce qui a fonctionné, ce qui a moins bien marché.',
    typeAnalysis: 'Publier une analyse',
    typeAnalysisHint: 'Un point de vue argumenté sur un sujet professionnel.',
    typeNews: 'Signaler une actualité sectorielle',
    typeNewsHint: 'Une information sectorielle utile aux membres.',
    titleLabel: 'Titre de la publication',
    titlePlaceholder: 'Formulez une question ou un sujet explicite',
    titleHelp: 'Entre 8 et 240 caractères. Un titre explicite reçoit plus de réponses utiles.',
    bodyLabel: 'Contexte et contenu',
    bodyPlaceholder:
      'Décrivez le contexte, ce que vous avez déjà essayé et le type de retour attendu.',
    skillsLabel: 'Compétences concernées',
    skillsHelp:
      'Les compétences aident les membres dont c’est le domaine à repérer votre publication.',
    visibilityLabel: 'Audience',
    visibilityCommunity: 'Les membres de cette communauté',
    visibilityNetwork: 'Tout le réseau ISE',
    visibilityNetworkHelp:
      'Disponible seulement pour une communauté elle-même ouverte au réseau. Une communauté privée ne peut pas produire une publication visible au-delà de ses membres.',
    checklistTitle: 'Avant de publier',
    checklistExplicit: 'Le titre dit de quoi il s’agit.',
    checklistContext: 'Le contexte est suffisant pour répondre.',
    checklistAsk: 'La demande est précise.',
    checklistTags: 'Les compétences associées sont pertinentes.',
    checklistPrivacy: 'Aucune donnée confidentielle n’apparaît.',
    audienceTitle: 'Audience estimée',
    audienceBody:
      'Nombre de membres actifs de la communauté. Aucune estimation de portée n’est calculée.',
    antiSpamTitle: 'Une publication, une communauté',
    antiSpamBody:
      'Republier le même contenu dans plusieurs communautés est bloqué. Choisissez la communauté où la question a le plus de chances de trouver une réponse.',
    moderationNotice:
      'Cette communauté relit les publications avant diffusion. La vôtre sera visible une fois validée par un animateur.',
    submit: 'Publier',
    submitPending: 'Publication…',
    successPublished: 'Publication en ligne.',
    successPending: 'Publication envoyée : elle sera visible après relecture par un animateur.',
  },

  /** ISE-087 — Suivi de ma publication. */
  tracking: {
    title: 'Suivi de ma publication',
    subtitle: 'Identifiez les contributions utiles, synthétisez et clôturez la discussion.',
    counterReplies: 'réponses',
    counterHelpful: 'réponses marquées utiles',
    counterContributors: 'membres contributeurs',
    helpfulTitle: 'Réponses marquées utiles',
    helpfulEmpty:
      'Aucune réponse n’est encore marquée utile. Le marquage est un repère pour les futurs lecteurs, pas une note attribuée à une personne.',
    markHelpful: 'Marquer comme utile',
    unmarkHelpful: 'Retirer le marquage',
    contributorsTitle: 'Contributeurs',
    contributorsBody:
      'Vous pouvez remercier une personne directement par message. Aucun remerciement automatique n’est envoyé.',
    thank: 'Envoyer un message',
    repliesTitle: 'Toutes les réponses',
    replyLabel: 'Votre réponse',
    replyPlaceholder: 'Répondez avec ce que vous avez réellement constaté.',
    replySubmit: 'Répondre',
    replyPending: 'Envoi…',
    replyLocked: 'Cette discussion est verrouillée : elle n’accepte plus de réponse.',
    resolveTitle: 'Clôturer la publication',
    resolveBody:
      'Lorsque votre question est résolue, publiez une courte synthèse : elle laisse une trace utile aux futurs membres.',
    resolveLabel: 'Synthèse à retenir',
    resolvePlaceholder: 'Ce que vous retenez des réponses reçues, en quelques lignes.',
    resolveHelp: 'Au moins 20 caractères.',
    resolveSubmit: 'Publier la synthèse et clôturer',
    resolvePending: 'Publication…',
    resolvedTitle: 'Synthèse publiée',
    notAuthorTitle: 'Ce suivi est réservé à l’auteur de la publication.',
    notAuthorBody: 'Vous pouvez consulter la publication elle-même depuis le fil de la communauté.',
  },
} as const;
