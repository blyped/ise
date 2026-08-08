/**
 * Chaînes de la tranche ACTUALITÉS & ÉVÉNEMENTS (ISE-092 → ISE-096).
 *
 * Règles appliquées ici :
 *  - CA-NEWS-01 : ce n'est pas un fil social. Aucun libellé ne parle de
 *    « j'aime », de « vues », d'« abonnés » ni de « tendances ».
 *  - D-123 et D-131 : lorsqu'un contenu est exposé sur la vitrine
 *    publique, l'interface le dit avec des mots simples — « visible par
 *    toute personne, même sans compte ». C'est un fait, pas un réglage
 *    offert au membre.
 *  - D-128 : le circuit éditorial (soumission, relecture, publication)
 *    n'est pas piloté depuis l'espace membre ; les libellés le disent.
 *  - CA-EVENT-01 : le fuseau horaire est toujours écrit.
 */
export const frContent = {
  common: {
    back: 'Retour',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    endOfFeed: 'Vous avez vu tout ce qui vous est adressé.',
    endOfEvents: 'Vous avez vu tous les événements correspondants.',
    loadErrorTitle: 'Le contenu n’a pas pu être chargé.',
    loadErrorBody:
      'Réessayez dans un instant. Si le problème persiste, communiquez la référence ci-dessous à l’assistance.',
    optional: 'Facultatif',
    seeProfile: 'Voir le profil',
    source: 'Source',
    seeSource: 'Voir la source d’origine',
  },

  /** Fait éditorial, affiché tel quel (D-123). */
  landing: {
    visibleTitle: 'Ce contenu paraît sur le site public',
    visibleBody:
      'Il est visible par toute personne qui consulte le site, même sans compte ISE. Cette exposition est décidée par l’équipe éditoriale ; elle ne se modifie pas depuis l’espace membre.',
    hiddenTitle: 'Ce contenu reste dans le réseau',
    hiddenBody: 'Il n’apparaît pas sur le site public.',
  },

  news: {
    breadcrumb: 'Actualités',
    title: 'Actualités & événements du réseau',
    subtitle: 'Ce qui mérite votre attention aujourd’hui dans le réseau ISE.',
    tabForMe: 'Pour moi',
    tabNetwork: 'Réseau',
    tabCareers: 'Carrières',
    tabPublications: 'Publications',
    tabEvents: 'Événements',
    searchLabel: 'Rechercher dans le fil',
    searchPlaceholder: 'Actualité, événement, organisation…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer',
    antiBubbleTitle: 'Pourquoi ce fil ?',
    antiBubbleBody:
      'Il s’appuie sur votre promotion, vos communautés et vos secteurs. Les actualités adressées à tout le réseau y figurent toujours : la personnalisation ne referme pas le fil.',
    read: 'Lire',
    emptyTitle: 'Rien de nouveau pour l’instant.',
    emptyBody:
      'Le fil se remplit à mesure que le réseau publie. Rejoindre une communauté ou compléter votre promotion élargit ce que vous recevez.',
    emptyAction: 'Voir tout le réseau',
    submitTitle: 'Vous avez une information utile ?',
    submitBody:
      'La proposition d’actualité passe par un circuit éditorial : relecture, vérification de la source et accord de la personne concernée. Elle n’est pas encore ouverte depuis cet écran.',
  },

  newsDetail: {
    publishedOn: 'Publié le',
    eventDate: 'Date du fait rapporté',
    changeTitle: 'Ce qui change',
    whyTitle: 'Pourquoi c’est utile au réseau',
    peopleTitle: 'Personnes concernées',
    organizationsTitle: 'Organisations citées',
    communitiesTitle: 'Communautés liées',
    promotionTitle: 'Promotion',
    skillsTitle: 'Expertises liées',
    sourcesTitle: 'Sources',
    sourceVerified: 'Vérifiée le',
    sourceUnverified: 'Non vérifiée',
    reliabilityTitle: 'Fiabilité de l’information',
    reliabilityBody:
      'Chaque actualité indique sa source lorsqu’elle est externe. Signalez toute information inexacte : les nominations et les distinctions sont particulièrement sensibles.',
    report: 'Signaler une information incorrecte',
    relatedTitle: 'Actualités connexes',
    notFoundTitle: 'Cette actualité n’est pas accessible.',
    notFoundBody:
      'Elle n’est pas publiée, elle est réservée à une promotion ou à une communauté dont vous ne faites pas partie, ou elle n’existe pas.',
    noReactionsTitle: 'Pas de réactions ici',
    noReactionsBody:
      'Pour féliciter une personne ou réagir à une information, écrivez-lui : un message vaut mieux qu’un compteur.',
    sendMessage: 'Envoyer un message',
  },

  events: {
    breadcrumb: 'Événements',
    title: 'Événements ISE',
    subtitle: 'Rencontres, webinaires et rendez-vous professionnels utiles à votre réseau.',
    tabForMe: 'Pour moi',
    tabUpcoming: 'À venir',
    tabOnline: 'En ligne',
    tabNearby: 'À proximité',
    tabMine: 'Mes événements',
    tabPast: 'Passés',
    searchLabel: 'Rechercher un événement',
    searchPlaceholder: 'Thème, ville…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer les filtres',
    filterFormat: 'Format',
    filterCountry: 'Pays',
    filterAll: 'Tous',
    filterApply: 'Appliquer',
    format: { online: 'En ligne', in_person: 'Présentiel', hybrid: 'Hybride' },
    registered: 'inscrit(s)',
    knownRegistered: 'relation(s) déjà inscrite(s)',
    see: 'Voir',
    register: "S'inscrire",
    registerPending: 'Inscription…',
    registeredBadge: 'Inscrit',
    waitlistedBadge: 'Sur liste d’attente',
    pendingBadge: 'En attente de validation',
    cancelledBadge: 'Inscription annulée',
    eventCancelled: 'Événement annulé',
    emptyForMeTitle: 'Aucun événement ne correspond encore à votre profil.',
    emptyForMeBody:
      'La sélection s’appuie sur vos communautés, votre promotion et votre pays. Parcourez tous les événements à venir.',
    emptyForMeAction: 'Voir tous les événements à venir',
    emptyTitle: 'Aucun événement ne correspond à cette recherche.',
    emptyBody: 'Élargissez les filtres, ou consultez les événements passés et leurs ressources.',
    nearbyUnavailableTitle: 'Votre pays n’est pas renseigné.',
    nearbyUnavailableBody:
      'L’onglet « À proximité » s’appuie sur le pays déclaré dans votre profil.',
    proposeTitle: 'Un événement utile au réseau ?',
    proposeBody:
      'La création d’un événement (type, programme, intervenants, visibilité) fera l’objet d’une livraison dédiée. Aucun bouton n’est affiché tant qu’elle n’existe pas.',
  },

  eventDetail: {
    whyTitle: 'Pourquoi cet événement ?',
    audienceTitle: 'Public visé',
    programTitle: 'Programme',
    speakersTitle: 'Intervenants',
    speakerRole: {
      speaker: 'Intervenant',
      moderator: 'Modérateur',
      panelist: 'Panéliste',
      trainer: 'Formateur',
      host: 'Hôte',
      guest: 'Invité',
    },
    organizerTitle: 'Organisé par',
    placeTitle: 'Lieu',
    onlineTitle: 'Participation en ligne',
    onlineLinkLabel: 'Lien de connexion',
    onlineLinkAfterRegistration:
      'Le lien de connexion est communiqué aux personnes inscrites. Inscrivez-vous pour l’obtenir.',
    onlineLinkMissing: 'Aucun lien de connexion n’est encore enregistré pour cet événement.',
    capacityTitle: 'Places',
    capacityOf: 'places sur',
    capacityUnlimited: 'Nombre de places non limité.',
    registrationTitle: 'Votre inscription',
    registrationPolicy: {
      required: 'Inscription obligatoire',
      optional: 'Inscription facultative',
      none: 'Aucune inscription nécessaire',
      approval_required: 'Inscription soumise à validation',
    },
    registerNow: "S'inscrire à l'événement",
    cancelRegistration: 'Annuler mon inscription',
    cancelPending: 'Annulation…',
    questionsTitle: 'Quelques questions de l’organisateur',
    listedLabel: 'Apparaître dans la liste des participants',
    listedHelp:
      'Si vous le refusez, votre nom n’apparaît nulle part, y compris pour les autres inscrits.',
    listedSave: 'Enregistrer',
    knownAttendeesTitle: 'Qui vous connaissez déjà',
    knownAttendeesBody:
      'Uniquement les relations confirmées qui ont accepté de figurer dans la liste.',
    attendeesHiddenBody:
      'La liste complète des inscrits n’est pas publiée : chaque personne choisit d’y figurer ou non.',
    afterEvent: 'Après l’événement',
    notFoundTitle: 'Cet événement n’est pas accessible.',
    notFoundBody:
      'Il est réservé à une promotion, à une communauté ou aux personnes invitées, ou il n’existe pas.',
    cancelledNotice: 'Cet événement a été annulé.',
  },

  followup: {
    breadcrumb: 'Après l’événement',
    title: 'Après l’événement',
    subtitle: 'Transformez les échanges en relations utiles et en suites concrètes.',
    reportTitle: 'Compte rendu de l’organisateur',
    reportSummary: 'Résumé',
    reportConclusions: 'Conclusions',
    reportDecisions: 'Décisions',
    reportNextSteps: 'Suites prévues',
    replay: 'Voir le replay',
    reportEmptyTitle: 'Aucun compte rendu n’a encore été publié.',
    reportEmptyBody:
      'L’organisateur peut publier un résumé, des conclusions et des ressources après l’événement.',
    resourcesTitle: 'Ressources de l’événement',
    resourcesEmpty: 'Aucune ressource n’a été partagée pour cet événement.',
    myImpactTitle: 'Impact de ma participation',
    myImpactContacts: 'contact(s) à suivre que vous avez identifié(s)',
    myImpactFollowUps: 'suite(s) professionnelle(s) que vous avez déclarée(s)',
    myImpactResources: 'ressource(s) accessible(s)',
    myImpactHelp:
      'Ces nombres comptent exactement ce que vous avez enregistré. Rien n’est estimé ni déduit de votre présence.',
    outcomesTitle: 'Mes suites déclarées',
    outcomesEmptyTitle: 'Vous n’avez encore déclaré aucune suite.',
    outcomesEmptyBody:
      'Une suite est un fait constaté : une personne que vous voulez recontacter, un projet lancé, une publication engagée.',
    declareTitle: 'Déclarer une suite',
    declareBody:
      'Seul ce que vous déclarez est compté. La plateforme ne devine pas ce qu’un événement a produit.',
    declareType: 'Nature de la suite',
    outcomeType: {
      connection: 'Personne à recontacter',
      working_group: 'Groupe de travail',
      project: 'Projet',
      news: 'Actualité à proposer',
      community_discussion: 'Discussion en communauté',
      publication: 'Publication',
      mentorship: 'Mentorat',
      other: 'Autre',
    },
    declareNotes: 'Précision',
    declareNotesPlaceholder: 'Par exemple : échanger sur la structuration d’une fonction Data.',
    declareSubmit: 'Enregistrer cette suite',
    declarePending: 'Enregistrement…',
    declareSuccess: 'Suite enregistrée. Elle reste privée : personne d’autre ne la voit.',
    privateNotice:
      'Vos suites sont strictement personnelles. Ni l’organisateur ni les autres participants n’y ont accès.',
    remove: 'Retirer',
    removePending: 'Retrait…',
    contactMessage: 'Envoyer un message',
    organizerImpactTitle: 'Impact mesuré de l’événement',
    organizerImpactBody: 'Dernier relevé enregistré. Aucun chiffre n’est estimé.',
    organizerImpactEmpty: 'Aucun relevé d’impact n’a encore été enregistré pour cet événement.',
    organizerImpact: {
      registered: 'inscrits',
      attended: 'présents',
      noShow: 'absents',
      promotions: 'promotions représentées',
      countries: 'pays représentés',
      connections: 'relations créées',
      projects: 'projets initiés',
      mentorships: 'mentorats initiés',
      resources: 'ressources produites',
    },
    notParticipantTitle: 'Cette page est réservée aux participants.',
    notParticipantBody:
      'Le suivi d’après-événement s’adresse aux personnes inscrites et à l’organisateur.',
  },
} as const;
