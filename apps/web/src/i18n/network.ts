/**
 * Chaines de la tranche RELATIONS & INTRODUCTIONS (ISE-038 -> ISE-046).
 *
 * Fichier dedie, sur le modele de `src/i18n/search.ts` : `fr.ts` reste le
 * socle transverse, chaque tranche apporte son vocabulaire.
 *
 * Regle appliquee partout ici — MASTER PROMPT §25 et D-55 : aucune chaine
 * n'affirme un fait non constate. « L'intermediaire a accepte » ne dit
 * jamais « mise en relation reussie », et « introduction transmise » ne
 * dit jamais « echange realise ».
 */
export const frNetwork = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loading: 'Chargement en cours…',
    loadMore: 'Charger la suite',
    loadMorePending: 'Chargement…',
    endOfList: 'Vous avez vu toutes les entrées disponibles.',
    correlationLabel: 'Référence à communiquer à l’assistance',
    seeProfile: 'Voir le profil',
    seeFullProfile: 'Voir le profil complet',
    breadcrumbNetwork: 'Réseau',
    charactersLeft: '{count} caractères restants',
    optional: 'Facultatif',
  },

  /** Codes de `connection_requests.context`, alignes sur la base. */
  context: {
    promotion: 'Entretenir le réseau ISE',
    organization: 'Organisation commune',
    sector: 'Secteur commun',
    event: 'Rencontre lors d’un événement',
    project: 'Explorer une collaboration',
    network_call: 'Appel au réseau',
    opportunity: 'Opportunité',
    introduction: 'Échanger sur une expertise',
    other: 'Demander un conseil',
  } as Record<string, string>,

  /** Codes de `introduction_requests.purpose`, alignes sur la base. */
  purpose: {
    advice: 'Demander un conseil',
    expertise: 'Échanger sur une expertise',
    opportunity: 'Accéder à une organisation',
    consortium: 'Explorer un consortium',
    mentorship: 'Demander un mentorat',
    partnership: 'Explorer une collaboration',
    other: 'Autre motif',
  } as Record<string, string>,

  /** Signaux explicites du classement des intermédiaires (D-51). */
  reason: {
    direct_relation: 'Relation directe des deux côtés',
    shared_organization: 'Même organisation que la personne visée',
    shared_promotion: 'Même promotion que la personne visée',
    introduction_availability: 'A déclaré être disponible pour des introductions',
  } as Record<string, string>,

  pathLabel: {
    recommended: 'Recommandé',
    relevant: 'Pertinent',
    possible: 'Possible',
  } as Record<string, string>,

  /** ISE-038 — Se connecter à cet ISE. */
  connect: {
    title: 'Se connecter à cet ISE',
    titleShort: 'Se connecter',
    subtitle:
      'Envoyez une demande courte et contextualisée pour créer une relation utile — pas simplement ajouter un contact.',
    backToProfile: 'Retour au profil',
    contextLegend: 'Pourquoi souhaitez-vous vous connecter ?',
    contextHint: 'Ce motif est transmis avec votre demande.',
    messageLabel: 'Message personnel',
    messageHint:
      'Un message contextualisé vaut mieux qu’une demande générique. Il est facultatif, mais il est lu.',
    messagePlaceholder: 'Expliquez en une ou deux phrases ce que vous souhaitez échanger.',
    submit: 'Envoyer la demande',
    submitPending: 'Envoi de la demande…',
    introductionTitle: 'Une introduction est peut-être possible',
    introductionBody:
      'Si un lien commun est fort, une introduction par une relation peut être préférable à une demande directe.',
    introductionAction: 'Voir les chemins d’introduction',
    respectTitle: 'Respect du destinataire',
    respectBody:
      'Une demande peut être acceptée, déclinée ou laissée sans réponse. Aucune relance n’est envoyée automatiquement.',
    alreadyConnectedTitle: 'Vous êtes déjà en relation avec cet ISE.',
    alreadyConnectedBody: 'Aucune demande de connexion n’est nécessaire.',
    pendingTitle: 'Une demande est déjà en cours avec cet ISE.',
    pendingBody: 'Attendez sa réponse : envoyer une seconde demande n’est pas possible.',
    selfTitle: 'Il s’agit de votre propre profil.',
    selfBody: 'Vous ne pouvez pas vous adresser une demande de connexion.',
    errorTitle: 'La demande n’a pas pu être envoyée.',
    notFoundTitle: 'Ce profil n’est pas accessible.',
    notFoundBody:
      'Il n’existe pas, il n’est plus actif, ou il n’est pas consultable depuis votre compte.',
  },

  /** ISE-039 — Demande de connexion envoyée. */
  sent: {
    title: 'Demande de connexion envoyée',
    titleShort: 'Demande envoyée',
    banner: '{name} recevra votre demande et votre message personnel.',
    bannerHint: 'Aucune action supplémentaire n’est nécessaire pour le moment.',
    detailTitle: 'Détail de la demande',
    motiveLabel: 'Motif',
    motiveNone: 'Aucun motif précisé',
    messageLabel: 'Votre message',
    messageNone: 'Aucun message n’accompagnait la demande.',
    trackingTitle: 'Suivi',
    step1: 'Demande envoyée',
    step2: 'Réponse de {name}',
    step2Pending: 'En attente',
    step3: 'Connexion établie',
    step3Pending: 'Après acceptation',
    waitTitle: 'Pendant l’attente',
    waitBody:
      'Vous pouvez continuer à explorer le réseau normalement. Évitez les relances : laissez au destinataire le temps de répondre à son rythme.',
    controlTitle: 'Vous gardez le contrôle',
    controlBody: 'Vous pouvez retirer la demande tant qu’elle n’a pas été acceptée.',
    withdraw: 'Retirer la demande',
    withdrawPending: 'Retrait en cours…',
    backToNetwork: 'Retour au réseau',
    seeConnections: 'Voir mes relations',
    notFoundTitle: 'Cette demande n’existe plus ou ne vous concerne pas.',
    errorTitle: 'Impossible de lire l’état de cette demande.',
    expiresAt: 'Expire le {date} sans réponse.',
  },

  /** ISE-040 — Mes relations. */
  connections: {
    title: 'Mes relations',
    subtitle:
      'Retrouvez les ISE avec lesquels vous êtes connecté et mobilisez votre réseau selon le contexte.',
    findMember: 'Trouver un ISE',
    statConnections: 'relations',
    statPromotions: 'promotions représentées',
    statCountries: 'pays couverts',
    statAvailable: 'disponibles pour aider',
    statsNote:
      'Ces nombres ne comptent que ce que vos relations ont choisi de vous rendre visible.',
    searchLabel: 'Rechercher dans mes relations',
    searchPlaceholder: 'Nom d’une relation…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer la recherche',
    relationLabel: 'Relation',
    relationSince: 'En relation depuis le {date}',
    announce: '{count} relation(s) affichée(s).',
    emptyTitle: 'Vous n’avez encore aucune relation.',
    emptyBody:
      'Une relation naît d’une demande de connexion acceptée. Commencez par rechercher un ISE dans l’annuaire.',
    emptySearchTitle: 'Aucune relation ne correspond à cette recherche.',
    emptySearchBody:
      'Vérifiez l’orthographe, ou effacez la recherche pour voir toutes vos relations.',
    errorTitle: 'Impossible de charger vos relations.',
    mobiliseTitle: 'Mobiliser mon réseau',
    mobiliseBody:
      'Vos relations peuvent vous introduire auprès d’un autre ISE. Le chemin se calcule depuis le profil de la personne visée.',
    callOnTitle: 'À qui puis-je faire appel ?',
    callOnEmpty: 'Aucune de vos relations n’a déclaré de disponibilité visible par vous.',
    callOnCount: '{count} relation(s)',
    qualityTitle: 'Réseau utile, pas volumique',
    qualityBody:
      'Le nombre de relations n’est jamais affiché comme un score sur votre profil. La valeur vient du contexte et des introductions.',
    invitationsLink: 'Invitations reçues',
    invitationsPending: '{count} en attente',
    introductionsLink: 'Mes demandes d’introduction',
  },

  /** ISE-041 — Invitations reçues. */
  invitations: {
    title: 'Invitations reçues',
    subtitle: 'Examinez les demandes de connexion reçues et leur contexte avant de décider.',
    countPending: '{count} invitation en attente',
    countPendingPlural: '{count} invitations en attente',
    pace: 'Décidez à votre rythme.',
    tabPending: 'En attente',
    tabAccepted: 'Acceptées',
    tabDeclined: 'Déclinées',
    motiveLabel: 'Motif',
    detail: 'Voir le détail',
    accept: 'Accepter',
    acceptPending: 'Acceptation…',
    decline: 'Décliner',
    declinePending: 'Refus…',
    ignore: 'Ignorer',
    ignoreHint:
      'Ignorer n’envoie rien et n’enregistre rien : la demande reste en attente jusqu’à son expiration.',
    announce: '{count} invitation(s) affichée(s).',
    emptyPendingTitle: 'Aucune invitation en attente.',
    emptyPendingBody: 'Les demandes de connexion qui vous sont adressées apparaîtront ici.',
    emptyAcceptedTitle: 'Aucune invitation acceptée pour le moment.',
    emptyAcceptedBody: 'Les invitations que vous accepterez apparaîtront ici.',
    emptyDeclinedTitle: 'Aucune invitation déclinée.',
    emptyDeclinedBody: 'Les invitations que vous déclinerez apparaîtront ici.',
    errorTitle: 'Impossible de charger vos invitations.',
    beforeTitle: 'Avant d’accepter',
    beforeItems: [
      'Le motif est-il clair ?',
      'Le profil est-il pertinent pour vous ?',
      'Existe-t-il un contexte commun ?',
      'Souhaitez-vous pouvoir être sollicité ?',
    ],
    acceptMeansTitle: 'Accepter signifie',
    acceptMeansItems: [
      'apparaître dans vos relations',
      'permettre certains chemins d’introduction',
    ],
    acceptMeansNote: 'Aucun engagement professionnel.',
    declineMeansTitle: 'Décliner reste discret',
    declineMeansBody:
      'La personne n’est pas informée du motif de votre refus. Aucun score, aucune conséquence sur votre profil.',
  },

  /** ISE-042 — Détail de l'invitation. */
  invitation: {
    title: 'Détail de l’invitation',
    subtitle: 'Examinez le profil, le contexte et le message avant de décider.',
    backToList: 'Retour aux invitations',
    motiveTitle: 'Motif de la demande',
    motiveNone: 'Aucun motif n’a été précisé.',
    messageTitle: 'Message reçu',
    messageNone: 'Aucun message n’accompagnait cette invitation.',
    receivedAt: 'Reçu le {date}',
    commonTitle: 'Liens et points communs',
    commonNone:
      'Aucun lien commun explicite n’a été trouvé. Ce n’est pas un signal négatif : cela veut dire que la plateforme n’a rien de structuré à afficher.',
    commonMutual: 'Relations communes',
    commonPromotion: 'Promotion',
    commonPromotionValue: 'Vous êtes de la même promotion',
    commonOrganization: 'Organisation',
    commonSource:
      'Ces éléments viennent de données structurées de profil. Aucun message privé n’est analysé.',
    acceptTitle: 'Si vous acceptez',
    acceptBody:
      'Cette personne rejoindra vos relations et pourra apparaître dans certains chemins d’introduction. Aucun engagement de collaboration.',
    declineTitle: 'Si vous déclinez',
    declineBody:
      'La demande est simplement fermée. Aucune raison détaillée n’est transmise, et votre profil n’en porte aucune trace.',
    statusPending: 'Invitation en attente',
    alreadyAnswered: 'Cette invitation a déjà reçu une réponse.',
    notFoundTitle: 'Cette invitation n’existe plus ou ne vous concerne pas.',
    errorTitle: 'Impossible de charger cette invitation.',
  },

  /** ISE-043 — Chemin d'introduction. */
  paths: {
    title: 'Chemin d’introduction',
    subtitle:
      'Identifiez la relation la plus crédible pour être présenté à {name} dans un contexte professionnel.',
    backToProfile: 'Retour au profil',
    targetLabel: 'ISE cible',
    bestTitle: 'Votre meilleur chemin',
    othersTitle: 'Autres chemins possibles',
    you: 'Vous',
    edgeDirect: 'relation directe',
    edgeTarget: 'relation directe',
    countFound: '{count} chemin trouvé',
    countFoundPlural: '{count} chemins trouvés',
    reasonsTitle: 'Pourquoi cette relation',
    askVia: 'Demander à {name} de m’introduire',
    pendingVia: 'Demande déjà en cours via {name}',
    seeRequest: 'Voir le suivi de la demande',
    linkSince: 'En relation avec vous depuis {date}',
    targetLinkSince: 'En relation avec la personne visée depuis {date}',
    howTitle: 'Comment le chemin est choisi',
    howBody:
      'Seuls des signaux explicites sont utilisés : relation directe confirmée des deux côtés, organisation commune, promotion commune, disponibilité déclarée pour des introductions.',
    howLimit:
      'Le réseau n’est jamais exploré au-delà d’une relation directe, et aucun message privé n’est analysé.',
    privacyTitle: 'Vie privée',
    privacyBody:
      'Seules vos propres relations sont affichées. Aucun carnet d’adresses tiers n’est exposé, et aucun score n’est calculé ni montré.',
    respectTitle: 'Respect de l’intermédiaire',
    respectBody:
      'La personne sollicitée reste libre d’accepter ou de décliner. Aucune introduction n’est transmise automatiquement.',
    emptyTitle: 'Aucun chemin d’introduction n’existe aujourd’hui.',
    emptyBody:
      'Aucune de vos relations directes n’est en relation avec cette personne. La plateforme ne cherche pas plus loin : c’est une limite volontaire, pas un défaut.',
    emptyAction: 'Envoyer plutôt une demande de connexion',
    alreadyConnectedTitle: 'Vous êtes déjà en relation avec cette personne.',
    alreadyConnectedBody: 'Une introduction n’aurait aucun objet.',
    errorTitle: 'Impossible de calculer les chemins d’introduction.',
  },

  /** ISE-044 — Demander une introduction. */
  ask: {
    title: 'Demander une introduction',
    subtitle: 'Expliquez clairement à {name} pourquoi vous souhaitez être présenté à {target}.',
    backToPaths: 'Retour au chemin d’introduction',
    pathLabel: 'Chemin sélectionné',
    purposeLegend: 'Pourquoi souhaitez-vous cette introduction ?',
    messageLabel: 'Contexte à transmettre à {name}',
    messageHint: '20 caractères au minimum. Ce texte n’est lu que par l’intermédiaire.',
    messagePlaceholder:
      'Expliquez sur quoi vous travaillez et ce que vous attendez de cet échange.',
    messageToTargetLabel: 'Message destiné à {target}',
    messageToTargetHint:
      'Facultatif. Il ne sera lisible par la personne visée qu’une fois l’introduction réellement transmise.',
    sharedTitle: 'Ce que {name} pourra transmettre',
    sharedItems: [
      'Votre nom et votre profil ISE',
      'Votre motif d’introduction',
      'Votre message ci-dessus',
    ],
    sharedExcluded: 'Vos coordonnées personnelles ne sont jamais transmises.',
    notAutomaticTitle: 'Ce qui n’arrive pas automatiquement',
    notAutomaticItems: [
      'aucun message n’est envoyé à la personne visée',
      'aucun contact privé n’est partagé',
      'aucune relation n’est créée',
      'aucune relance n’est programmée',
    ],
    notAutomaticNote: 'L’intermédiaire reste seul acteur de la suite.',
    submit: 'Envoyer la demande d’introduction',
    submitPending: 'Envoi de la demande…',
    errorTitle: 'La demande n’a pas pu être envoyée.',
    invalidPathTitle: 'Ce chemin d’introduction n’est pas valable.',
    invalidPathBody:
      'La personne choisie n’est pas en relation directe avec vous et avec la personne visée. Revenez aux chemins proposés.',
  },

  /** ISE-045 — Suivi d'une demande d'introduction. */
  follow: {
    listTitle: 'Mes demandes d’introduction',
    listSubtitle:
      'Les demandes que vous avez envoyées, celles qui vous sont adressées comme intermédiaire, et celles qui vous concernent une fois transmises.',
    listEmptyTitle: 'Aucune demande d’introduction.',
    listEmptyBody:
      'Une demande d’introduction se lance depuis le profil de la personne que vous souhaitez rencontrer.',
    listAnnounce: '{count} demande(s) affichée(s).',
    roleRequester: 'Vous êtes le demandeur',
    roleIntermediary: 'Vous êtes l’intermédiaire',
    roleTarget: 'Vous êtes la personne présentée',
    title: 'Suivi de la demande d’introduction',
    titleShort: 'Suivi de l’introduction',
    subtitle: 'Suivez l’avancement de votre demande via {intermediary} vers {target}.',
    backToList: 'Retour aux introductions',
    pathTitle: 'Chemin de l’introduction',
    historyTitle: 'Historique',
    historyEmpty: 'Aucun événement enregistré.',
    stepPending: 'À venir',
    stepCurrent: 'Étape actuelle',
    stepDone: 'Constaté',
    factsTitle: 'Ce qui est constaté à ce jour',
    factsNone: 'Rien d’autre que l’envoi de la demande.',
    confusionTitle: 'À ne pas confondre',
    confusionBody:
      '« L’intermédiaire a accepté » ne signifie pas que la personne visée a été contactée. Chaque étape est distincte, et aucune n’est posée sans un fait constaté.',
    waitTitle: 'Pendant l’attente',
    waitBody:
      'Aucune relance n’est nécessaire. L’intermédiaire choisit le moment et la façon d’introduire.',
    actionsTitle: 'Actions disponibles',
    actionsNone: 'Aucune action ne vous revient à cette étape. Elle dépend d’un autre participant.',
    actionPending: 'Enregistrement…',
    outcomeLink: 'Déclarer le résultat',
    messageToIntermediaryTitle: 'Contexte transmis à l’intermédiaire',
    messageToTargetTitle: 'Message destiné à la personne présentée',
    declineReasonTitle: 'Motif communiqué par l’intermédiaire',
    purposeLabel: 'Motif',
    notFoundTitle: 'Cette demande d’introduction n’existe pas ou ne vous concerne pas.',
    notFoundBody:
      'Si vous en êtes la personne visée, elle ne vous sera visible qu’une fois l’introduction réellement transmise.',
    errorTitle: 'Impossible de charger cette demande d’introduction.',
  },

  /** ISE-046 — Bilan d'introduction. */
  outcome: {
    title: 'Bilan de l’introduction',
    subtitle: 'Indiquez ce que cette introduction a réellement permis. Rien de plus.',
    backToFollow: 'Retour au suivi',
    pathTitle: 'Chemin réalisé',
    legend: 'Qu’a permis cette introduction ?',
    noteLabel: 'Note',
    noteHint: 'Facultative. Visible par les participants de cette introduction.',
    notePlaceholder: 'Ce qui a été échangé, en une ou deux phrases.',
    submit: 'Enregistrer le bilan',
    submitPending: 'Enregistrement…',
    honestyTitle: 'Rester factuel',
    honestyBody:
      'Déclarez uniquement ce qui s’est produit. Une collaboration « envisagée » n’est pas une mission gagnée, et la plateforme ne transformera jamais l’une en l’autre.',
    measuredTitle: 'Ce qui est mesuré',
    measuredBody:
      'Des résultats professionnels : échange réalisé, collaboration explorée, contact utile obtenu. Jamais la popularité d’un membre, jamais un score social.',
    tooEarlyTitle: 'Le bilan n’est pas encore ouvert.',
    tooEarlyBody:
      'Un résultat d’échange ne peut être déclaré qu’une fois l’échange constaté. Tant que la personne présentée n’a pas répondu, la plateforme refuse d’écrire « introduction réussie ».',
    notAllowedTitle: 'Ce bilan ne vous revient pas.',
    notAllowedBody: 'Seuls le demandeur et la personne présentée peuvent déclarer un résultat.',
    doneTitle: 'Le résultat a déjà été déclaré.',
    doneBy: 'Déclaré par {role} le {date}.',
    errorTitle: 'Le bilan n’a pas pu être enregistré.',
    labels: {
      exchange_held: 'Échange réalisé',
      collaboration_considered: 'Collaboration envisagée',
      collaboration_confirmed: 'Collaboration confirmée',
      referred_to_other_contact: 'Orientation vers un autre contact',
      no_response: 'Pas encore de suite',
      not_relevant: 'Sans pertinence pour l’un ou l’autre',
    } as Record<string, string>,
    hints: {
      exchange_held: 'Une discussion professionnelle a eu lieu.',
      collaboration_considered: 'Un projet ou une mission est à l’étude.',
      collaboration_confirmed: 'Une collaboration a été engagée.',
      referred_to_other_contact: 'La personne présentée vous a orienté vers un autre contact.',
      no_response: 'La relation est faite, mais rien n’a démarré.',
      not_relevant: 'L’échange n’a pas trouvé d’objet commun.',
    } as Record<string, string>,
  },

  role: {
    requester: 'le demandeur',
    intermediary: 'l’intermédiaire',
    target: 'la personne présentée',
    system: 'la plateforme',
  } as Record<string, string>,
} as const;

/** Remplacement de jetons `{cle}`, identique a `fr.ts`. */
export function tn(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
