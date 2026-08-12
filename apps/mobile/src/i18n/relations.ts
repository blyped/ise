/**
 * Chaines de la tranche RELATIONS & INTRODUCTIONS (ISE-038 -> ISE-046),
 * coquille mobile. Fichier dedie sur le modele de `i18n/network-calls.ts` :
 * `i18n/fr.ts` reste le socle transverse mobile, ce module apporte son
 * propre vocabulaire plutot que de le melanger dedans.
 *
 * Les libelles reprennent VOLONTAIREMENT les memes mots que
 * `apps/web/src/i18n/network.ts` (MASTER PROMPT §66) — un ISE qui bascule
 * d'un appareil a l'autre doit retrouver le meme francais.
 *
 * Deux regles heritees du web restent respectees ici :
 *  - MASTER PROMPT §25 / D-55 : aucune chaine n'affirme un fait non
 *    constate. « L'intermediaire a accepte » ne dit jamais « mise en
 *    relation reussie », « introduction transmise » ne dit jamais
 *    « echange realise ».
 *  - Les libelles de STATUT ne sont PAS dupliques ici : ils viennent
 *    directement de `CONNECTION_STATUS_LABELS` / `INTRODUCTION_STATUS_LABELS`
 *    (`@ise/domain`), source unique partagee avec le web.
 */
export const frRelations = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    loadMorePending: 'Chargement…',
    correlationLabel: 'Référence à communiquer à l’assistance',
    optional: 'Facultatif',
    seeProfile: 'Voir le profil',
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

  /** Signaux explicites du classement des intermediaires (D-51). */
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
    subtitle:
      'Envoyez une demande courte et contextualisée pour créer une relation utile — pas simplement ajouter un contact.',
    contextLegend: 'Pourquoi souhaitez-vous vous connecter ?',
    messageLabel: 'Message personnel',
    messageHint: 'Facultatif, mais il est lu. Une ou deux phrases suffisent.',
    messagePlaceholder: 'Expliquez en une ou deux phrases ce que vous souhaitez échanger.',
    submit: 'Envoyer la demande',
    submitPending: 'Envoi de la demande…',
    introductionTitle: 'Une introduction est peut-être possible',
    introductionBody:
      'Si un lien commun est fort, une introduction par une relation peut être préférable à une demande directe.',
    introductionAction: 'Voir les chemins d’introduction',
    alreadyConnectedTitle: 'Vous êtes déjà en relation avec cet ISE.',
    alreadyConnectedBody: 'Aucune demande de connexion n’est nécessaire.',
    selfTitle: 'Il s’agit de votre propre profil.',
    selfBody: 'Vous ne pouvez pas vous adresser une demande de connexion.',
    errorTitle: 'La demande n’a pas pu être envoyée.',
    notFoundTitle: 'Ce profil n’est pas accessible.',
    notFoundBody:
      'Il n’existe pas, il n’est plus actif, ou il n’est pas consultable depuis votre compte.',
  },

  /** ISE-039 — Demande de connexion envoyée. */
  sent: {
    title: 'Demande envoyée',
    banner: 'Votre demande et votre message personnel ont été transmis.',
    motiveLabel: 'Motif',
    motiveNone: 'Aucun motif précisé',
    messageLabel: 'Votre message',
    messageNone: 'Aucun message n’accompagnait la demande.',
    waitBody:
      'Vous pouvez continuer à explorer le réseau normalement. Évitez les relances : laissez au destinataire le temps de répondre à son rythme.',
    withdraw: 'Retirer la demande',
    withdrawPending: 'Retrait en cours…',
    withdrawDone: 'Votre demande a été retirée.',
    notFoundTitle: 'Cette demande n’existe plus ou ne vous concerne pas.',
    errorTitle: 'Impossible de lire l’état de cette demande.',
  },

  /** ISE-041 — Invitations reçues. */
  invitations: {
    title: 'Invitations reçues',
    subtitle: 'Examinez les demandes de connexion reçues et leur contexte avant de décider.',
    tabPending: 'En attente',
    tabAccepted: 'Acceptées',
    tabDeclined: 'Déclinées',
    motiveLabel: 'Motif',
    detail: 'Voir le détail',
    accept: 'Accepter',
    acceptPending: 'Acceptation…',
    acceptDone: 'La relation est établie.',
    decline: 'Décliner',
    declinePending: 'Refus…',
    declineDone: 'L’invitation a été déclinée.',
    ignore: 'Ignorer',
    ignoreHint:
      'Ignorer n’envoie rien et n’enregistre rien : la demande reste en attente jusqu’à son expiration.',
    emptyPendingTitle: 'Aucune invitation en attente.',
    emptyPendingBody: 'Les demandes de connexion qui vous sont adressées apparaîtront ici.',
    emptyAcceptedTitle: 'Aucune invitation acceptée pour le moment.',
    emptyDeclinedTitle: 'Aucune invitation déclinée.',
    errorTitle: 'Impossible de charger vos invitations.',
  },

  /** ISE-042 — Détail de l'invitation. */
  invitation: {
    title: 'Détail de l’invitation',
    motiveTitle: 'Motif de la demande',
    motiveNone: 'Aucun motif n’a été précisé.',
    messageTitle: 'Message reçu',
    messageNone: 'Aucun message n’accompagnait cette invitation.',
    commonTitle: 'Liens et points communs',
    commonNone:
      'Aucun lien commun explicite n’a été trouvé. Ce n’est pas un signal négatif : cela veut dire que la plateforme n’a rien de structuré à afficher.',
    commonMutual: 'Relations communes',
    commonPromotionValue: 'Vous êtes de la même promotion',
    commonOrganization: 'Organisation commune',
    acceptBody:
      'Cette personne rejoindra vos relations et pourra apparaître dans certains chemins d’introduction. Aucun engagement de collaboration.',
    declineBody:
      'La demande est simplement fermée. Aucune raison détaillée n’est transmise, et votre profil n’en porte aucune trace.',
    alreadyAnswered: 'Cette invitation a déjà reçu une réponse.',
    notFoundTitle: 'Cette invitation n’existe plus ou ne vous concerne pas.',
    errorTitle: 'Impossible de charger cette invitation.',
  },

  /** ISE-043 — Chemin d'introduction. */
  paths: {
    title: 'Chemin d’introduction',
    subtitle: 'Identifiez la relation la plus crédible pour être présenté à cette personne.',
    bestTitle: 'Meilleur chemin',
    othersTitle: 'Autres chemins possibles',
    reasonsTitle: 'Pourquoi cette relation',
    askVia: 'Demander à {name} de m’introduire',
    pendingVia: 'Demande déjà en cours via {name}',
    seeRequest: 'Voir le suivi de la demande',
    linkSince: 'En relation avec vous depuis {date}',
    targetLinkSince: 'En relation avec la personne visée depuis {date}',
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
    purposeLegend: 'Pourquoi souhaitez-vous cette introduction ?',
    messageLabel: 'Contexte à transmettre à {name}',
    messageHint: '20 caractères au minimum. Ce texte n’est lu que par l’intermédiaire.',
    messagePlaceholder:
      'Expliquez sur quoi vous travaillez et ce que vous attendez de cet échange.',
    messageToTargetLabel: 'Message destiné à {target}',
    messageToTargetHint:
      'Facultatif. Il ne sera lisible par la personne visée qu’une fois l’introduction réellement transmise.',
    notAutomaticTitle: 'Ce qui n’arrive pas automatiquement',
    notAutomaticItems: [
      'aucun message n’est envoyé à la personne visée',
      'aucun contact privé n’est partagé',
      'aucune relation n’est créée',
      'aucune relance n’est programmée',
    ],
    submit: 'Envoyer la demande d’introduction',
    submitPending: 'Envoi de la demande…',
    errorTitle: 'La demande n’a pas pu être envoyée.',
    invalidPathTitle: 'Ce chemin d’introduction n’est pas valable.',
    invalidPathBody:
      'La personne choisie n’est pas en relation directe avec vous et avec la personne visée. Revenez aux chemins proposés.',
  },

  /** ISE-045 — Mes demandes d'introduction (liste + suivi). */
  introductions: {
    listTitle: 'Mes demandes d’introduction',
    listSubtitle:
      'Les demandes que vous avez envoyées, celles qui vous sont adressées comme intermédiaire, et celles qui vous concernent une fois transmises.',
    tabAll: 'Toutes',
    tabRequester: 'Envoyées',
    tabIntermediary: 'Comme intermédiaire',
    tabTarget: 'Comme personne présentée',
    listEmptyTitle: 'Aucune demande d’introduction.',
    listEmptyBody:
      'Une demande d’introduction se lance depuis le profil de la personne que vous souhaitez rencontrer, via un chemin d’introduction.',
    listErrorTitle: 'Impossible de charger vos demandes d’introduction.',
    roleRequester: 'Vous êtes le demandeur',
    roleIntermediary: 'Vous êtes l’intermédiaire',
    roleTarget: 'Vous êtes la personne présentée',
    title: 'Suivi de l’introduction',
    pathTitle: 'Chemin de l’introduction',
    historyTitle: 'Historique',
    stepPending: 'À venir',
    stepCurrent: 'Étape actuelle',
    stepDone: 'Constaté',
    confusionTitle: 'À ne pas confondre',
    confusionBody:
      '« L’intermédiaire a accepté » ne signifie pas que la personne visée a été contactée. Chaque étape est distincte, et aucune n’est posée sans un fait constaté.',
    actionsTitle: 'Actions disponibles',
    actionsNone: 'Aucune action ne vous revient à cette étape. Elle dépend d’un autre participant.',
    actionPending: 'Enregistrement…',
    actionDone: 'L’étape a été enregistrée.',
    outcomeLink: 'Déclarer le résultat',
    messageToIntermediaryTitle: 'Contexte transmis à l’intermédiaire',
    messageToTargetTitle: 'Message destiné à la personne présentée',
    declineReasonTitle: 'Motif communiqué par l’intermédiaire',
    purposeLabel: 'Motif',
    notFoundTitle: 'Cette demande d’introduction n’existe pas ou ne vous concerne pas.',
    errorTitle: 'Impossible de charger cette demande d’introduction.',
  },

  /** ISE-046 — Bilan d'introduction. */
  outcome: {
    title: 'Bilan de l’introduction',
    subtitle: 'Indiquez ce que cette introduction a réellement permis. Rien de plus.',
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

  /** Points d'entree exposes depuis `NetworkScreen` (ISE-040). */
  entryPoints: {
    invitations: 'Invitations reçues',
    invitationsPending: '{count} en attente',
    introductions: 'Mes introductions',
    introductionsHint: 'Suivez vos demandes d’introduction, envoyées ou reçues.',
  },
} as const;

/** Substitution de jetons `{cle}`. Identique a `i18n/network-calls.ts`. */
export function tRelations(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
