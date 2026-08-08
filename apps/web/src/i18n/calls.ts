/**
 * Chaînes de la tranche APPELS AU RÉSEAU (ISE-047 → ISE-054).
 *
 * Fichier dédié, sur le modèle de `src/i18n/network.ts` : `fr.ts` reste
 * le socle transverse, chaque tranche apporte son vocabulaire.
 *
 * Règles appliquées ici :
 *  - MASTER PROMPT §15 : aucune chaîne n'affiche de pourcentage ni de
 *    score. La pertinence est un LIBELLE, accompagné de ses raisons.
 *  - D6 §66 : le vocabulaire de rejet est interdit. Une réponse est
 *    « archivée », jamais « rejetée » — et le répondant ne voit
 *    de toute façon jamais ce statut.
 *  - D-52 : la clôture est ternaire. « Partiellement » n'est pas une
 *    variante polie de « oui ».
 */
export const frCalls = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    loadMorePending: 'Chargement…',
    endOfList: 'Vous avez vu tous les appels disponibles.',
    correlationLabel: 'Référence à communiquer à l’assistance',
    breadcrumb: 'Appels au réseau',
    optional: 'Facultatif',
    save: 'Enregistrer et continuer',
    savePending: 'Enregistrement…',
    seeProfile: 'Voir le profil',
    required: 'Obligatoire',
    preferred: 'Souhaité',
    loadErrorTitle: 'Les appels au réseau n’ont pas pu être chargés.',
    loadErrorBody: 'Réessayez dans un instant. Si le problème persiste, contactez l’assistance.',
  },

  /** Codes de `network_calls.call_type` (0007). Libellés harmonisés D6 §3 / D26 §5. */
  type: {
    expert: 'Expertise',
    consultant: 'Consultant',
    job: 'Emploi',
    internship: 'Stage',
    partner: 'Partenaire',
    contact: 'Mise en relation',
    recommendation: 'Recommandation',
    information: 'Information',
    skill: 'Compétence',
    speaker: 'Intervenant',
    funding: 'Financement',
    collaborators: 'Collaborateurs',
    mentor: 'Mentor',
    consortium: 'Consortium',
    other: 'Autre besoin',
  } as Record<string, string>,

  /** Codes de `network_calls.call_family` (étape « De quoi avez-vous besoin ? »). */
  family: {
    find_person: 'Trouver une personne',
    career: 'Carrière',
    collaboration: 'Collaboration',
    information: 'Information',
    business: 'Business',
    other: 'Autre',
  } as Record<string, string>,

  familyHint: {
    find_person: 'Expert, consultant, contact, partenaire.',
    career: 'Emploi, stage, mentorat.',
    collaboration: 'Projet, consortium, intervenant, collaborateurs.',
    information: 'Conseil, recommandation, retour d’expérience.',
    business: 'Financement, opportunité d’affaires.',
    other: 'Un besoin qui n’entre dans aucune des familles ci-dessus.',
  } as Record<string, string>,

  /** Codes de `network_call_help_types.help_type` (D6 §82). */
  helpType: {
    direct_expert: 'Une personne directement disponible',
    recommendation: 'Une recommandation de profil',
    introduction: 'Une mise en relation',
    advice: 'Un conseil',
    information: 'Une information utile',
  } as Record<string, string>,

  /** Codes de `network_call_responses.response_type`. */
  responseType: {
    direct: 'Je peux répondre directement',
    knows_someone: 'Je connais quelqu’un',
    introduction: 'Je peux faire une introduction',
    information: 'J’ai une information utile',
    participate: 'Je souhaite participer',
    other: 'Autre forme d’aide',
  } as Record<string, string>,

  responseTypeHint: {
    direct: 'Vous possédez l’expertise recherchée.',
    knows_someone: 'Vous recommandez un ISE ou une personne pertinente.',
    introduction: 'Vous pouvez faciliter une mise en relation.',
    information: 'Vous partagez une piste ou un conseil.',
    participate: 'Vous souhaitez rejoindre la démarche.',
    other: 'Décrivez comment vous pouvez être utile.',
  } as Record<string, string>,

  /** Statuts privés de traitement, côté auteur (D6 §65). */
  responseStatus: {
    new: 'À examiner',
    reviewed: 'Vue',
    useful: 'Utile',
    contacted: 'Contactée',
    selected: 'Retenue',
    archived: 'Archivée',
  } as Record<string, string>,

  /** Statuts de l'appel exposés en interface (D26 §20). */
  status: {
    draft: 'Brouillon',
    active: 'Actif',
    paused: 'En pause',
    resolved: 'Résolu',
    closed: 'Clôturé',
    expired: 'Expiré',
    cancelled: 'Annulé',
    moderated: 'Retiré',
  } as Record<string, string>,

  /** D-42 : libellés qualitatifs. Jamais de pourcentage. */
  relevance: {
    very_relevant: 'Très pertinent pour votre profil',
    relevant: 'Pertinent pour votre profil',
    close_profile: 'Profil proche',
  } as Record<string, string>,

  visibility: {
    members: 'Réseau ISE vérifié',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    private: 'Privé sur invitation',
  } as Record<string, string>,

  visibilityHint: {
    members: 'Visible par les membres vérifiés du réseau.',
    connections: 'Visible uniquement par vos relations confirmées.',
    promotion: 'Visible uniquement par les membres de votre promotion.',
    private: 'Visible uniquement par les membres que vous désignez.',
  } as Record<string, string>,

  /* ---------------- ISE-047 — liste ---------------- */
  list: {
    title: 'Appels au réseau',
    subtitle:
      'Des besoins professionnels ciblés où votre expérience ou votre réseau peuvent faire la différence.',
    create: 'Lancer un appel',
    mine: 'Mes appels',
    tabForMe: 'Pour moi',
    tabAll: 'Tous',
    tabPromotion: 'Ma promotion',
    tabSaved: 'Enregistrés',
    searchLabel: 'Rechercher un appel',
    searchPlaceholder: 'Un besoin, une compétence, un pays…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer',
    filterType: 'Type d’appel',
    filterSector: 'Secteur',
    filterCountry: 'Pays',
    filterUrgency: 'Échéance',
    filterAll: 'Tous',
    filterApply: 'Filtrer',
    urgencyNormal: 'Sans échéance proche',
    urgencySoon: 'Échéance proche',
    announce: '{count} appels affichés.',
    responses: '{count} réponses',
    noResponse: 'Aucune réponse pour l’instant',
    publishedOn: 'Publié le {date}',
    deadlineOn: 'Échéance : {date}',
    resolvedBadge: 'Besoin résolu',
    urgentBadge: 'Échéance proche',
    whyTitle: 'Pourquoi cet appel vous est proposé',
    help: 'Je peux aider',
    see: 'Voir',
    save: 'Enregistrer',
    unsave: 'Retirer des enregistrés',
    emptyForMeTitle: 'Aucun appel ne correspond actuellement à votre profil.',
    emptyForMeBody:
      'Plus votre profil est détaillé, plus nous pouvons identifier les demandes auxquelles vous pourriez contribuer.',
    emptyForMeAction: 'Voir tous les appels',
    emptyAllTitle: 'Aucun appel ouvert pour l’instant.',
    emptyAllBody: 'Vous pouvez lancer le vôtre : le réseau ne répond qu’aux besoins exprimés.',
    emptySavedTitle: 'Vous n’avez enregistré aucun appel.',
    emptySavedBody: 'Enregistrer un appel le met de côté. Cela n’a aucun effet sur son classement.',
    noBoostNotice: 'Aucun classement par popularité',
    noBoostBody:
      'Le nombre de réponses n’influence jamais l’ordre d’affichage, et aucune visibilité ne s’achète.',
  },

  /* ---------------- ISE-048 — détail ---------------- */
  detail: {
    breadcrumb: 'Détail de l’appel',
    needTitle: 'Le besoin',
    contextTitle: 'Pourquoi cette demande ?',
    wantedProfileTitle: 'Profil recherché',
    helpTypesTitle: 'Type d’aide attendue',
    keyInfoTitle: 'Informations',
    skillsLabel: 'Compétences',
    toolsLabel: 'Outils',
    languagesLabel: 'Langues',
    countriesLabel: 'Zones',
    sectorLabel: 'Secteur',
    experienceLabel: 'Expérience',
    experienceMin: '{years} ans minimum',
    experienceRange: 'de {min} à {max} ans',
    promotionRange: 'Promotions {from} à {to}',
    deadlineLabel: 'Échéance',
    statusLabel: 'Statut',
    visibilityLabel: 'Visibilité',
    responsesLabel: 'Réponses',
    authorLabel: 'Publié par',
    howToHelp: 'Comment pouvez-vous aider ?',
    alreadyRespondedTitle: 'Vous avez déjà répondu à cet appel.',
    alreadyRespondedBody:
      'Votre réponse a été transmise à l’auteur le {date}. Elle reste privée entre vous deux.',
    closedTitle: 'Cet appel est clôturé.',
    closedBody: 'Il reste consultable pour mémoire ; il n’accepte plus de réponse.',
    notFoundTitle: 'Cet appel n’est pas accessible.',
    notFoundBody:
      'Il n’existe plus, ou il ne s’adresse pas à vous. Les appels sont adressés à une audience précise.',
    privacyTitle: 'Les réponses restent privées',
    privacyBody:
      'Votre réponse n’est visible que de l’auteur de l’appel. Aucun autre membre ne la voit.',
    manageTitle: 'Vous êtes l’auteur de cet appel',
    manageBody: 'Suivez les réponses reçues, mettez l’appel en pause ou clôturez-le.',
    manageTracking: 'Voir le suivi',
    manageClose: 'Clôturer',
    managePause: 'Mettre en pause',
    manageResume: 'Reprendre',
  },

  /* ---------------- ISE-049 → ISE-052 — assistant ---------------- */
  wizard: {
    stepLabel: 'Étape {current} sur {total}',
    step1: 'Besoin',
    step2: 'Profil recherché',
    step3: 'Ciblage',
    step4: 'Aperçu',
    createTitle: 'Créer un appel au réseau',
    createSubtitle:
      'Décrivez votre besoin. Compétences ISE le montre aux personnes qui peuvent réellement aider.',
    familyLegend: 'De quoi avez-vous besoin ?',
    familyHint: 'Choisissez la famille la plus proche : elle oriente les questions suivantes.',
    typeLabel: 'Type d’appel',
    typeHint: 'Précise la nature de la demande et les réponses qui vous seront proposées.',
    titleLabel: 'Titre de l’appel',
    titlePlaceholder: 'Ex. Recherche d’un expert en enquêtes agricoles',
    titleHint: '120 caractères au maximum.',
    descriptionLabel: 'Décrivez le besoin',
    descriptionPlaceholder: 'Précisez le contexte, ce que vous cherchez et le résultat attendu…',
    descriptionHint: 'Entre 20 et 5 000 caractères. 200 à 1 500 est la longueur la plus efficace.',
    contextLabel: 'Pourquoi en avez-vous besoin ?',
    contextHint: 'Facultatif. Mission, projet, recrutement, initiative personnelle…',
    deadlineLabel: 'Jusqu’à quand votre demande est-elle valable ?',
    deadlineHint: 'Facultatif. L’urgence est déduite de cette date : elle ne se coche pas.',
    urgencyNotice: 'L’urgence n’est pas un choix',
    urgencyNoticeBody:
      'Le badge « Échéance proche » apparaît automatiquement quand la date que vous indiquez est à moins de quinze jours. Personne ne peut se déclarer urgent.',
    visibilityLegend: 'Qui peut voir cet appel ?',
    hideOrganizationLabel: 'Masquer mon organisation dans cet appel',
    tipsTitle: 'Un bon appel est précis',
    tip1: 'Expliquez le résultat attendu, pas seulement le poste.',
    tip2: 'Indiquez le niveau d’expertise nécessaire.',
    tip3: 'Ajoutez une échéance seulement si elle est réelle.',
    tip4: 'Évitez les descriptions trop générales.',

    wantedTitle: 'Qui peut vous aider ?',
    wantedSubtitle:
      'Chaque critère marqué « Obligatoire » exclut les profils qui ne le remplissent pas. Utilisez-le avec parcimonie.',
    wantedProfileLabel: 'Profil recherché',
    wantedProfilePlaceholder:
      'Ex. ISE ou profil équivalent, expérience en évaluation d’impact, disponibilité en septembre…',
    skillsLabel: 'Compétences utiles',
    skillsRequiredLabel: 'Compétences obligatoires',
    skillsRequiredHint:
      'Un profil qui ne déclare pas ces compétences ne sera pas proposé, quel que soit son parcours.',
    toolsLabel: 'Outils attendus',
    sectorLabel: 'Secteur',
    sectorRequiredLabel: 'Le secteur est obligatoire',
    countryLabel: 'Pays principal',
    experienceCountriesLabel: 'Pays d’expérience souhaités',
    minExperienceLabel: 'Expérience minimale (années)',
    languageLabel: 'Langue de travail',
    languageLevelLabel: 'Niveau minimal',
    promotionFromLabel: 'Promotions à partir de',
    promotionToLabel: 'Promotions jusqu’à',
    helpTypesLegend: 'Quelles formes d’aide vous conviennent ?',
    helpTypesHint:
      'Ces choix déterminent les réponses proposées aux membres et entrent dans le ciblage.',

    audienceTitle: 'À qui souhaitez-vous adresser cet appel ?',
    audienceSubtitle:
      'Un ciblage large ne produit pas plus de réponses utiles : il fatigue le réseau.',
    audiencePromotionsLabel: 'Promotions ciblées',
    audiencePromotionsHint:
      'Facultatif. Si vous en désignez, l’appel ne sera visible que par ces promotions.',
    audienceComputed: 'Audience calculée',
    audienceNotComputedTitle: 'L’audience n’a pas encore été calculée.',
    audienceNotComputedBody:
      'Elle est calculée à partir de vos critères réels. Enregistrez l’étape précédente pour la voir.',
    audienceTotal: '{count} profils correspondent à vos critères',
    audienceVeryRelevant: 'Très pertinents',
    audienceRelevant: 'Pertinents',
    audienceClose: 'Profils proches',
    audienceNoticePriority: '{count} pourraient recevoir une notification prioritaire.',
    audienceEmptyTitle: 'Aucun profil ne correspond encore à ces critères.',
    audienceEmptyBody:
      'Élargissez un critère obligatoire, ou retirez-en un : un critère obligatoire exclut, il ne pondère pas.',
    audienceSamples: 'Exemples de profils ciblés',
    overreachTitle: 'Éviter la sursollicitation',
    overreachBody:
      'Le réseau privilégie les diffusions ciblées. Une audience trop large réduit la pertinence.',

    previewTitle: 'Aperçu avant publication',
    previewSubtitle: 'Voici exactement ce que verront les membres ciblés.',
    previewCard: 'La carte dans le fil',
    previewDetail: 'Le détail de l’appel',
    previewSummary: 'Récapitulatif',
    publish: 'Publier l’appel',
    publishPending: 'Publication…',
    publishedTitle: 'Votre appel est publié.',
    publishedBody: 'Nous avons identifié {count} ISE dont le profil correspond à vos critères.',
    publishedNoMatch:
      'Aucun profil ne correspond encore à vos critères. L’appel reste visible et sera recalculé à chaque modification.',
    editStep: 'Modifier',
  },

  /* ---------------- ISE-051 — répondre ---------------- */
  respond: {
    title: 'Comment pouvez-vous aider ?',
    subtitle: 'Votre réponse est transmise à l’auteur seul. Elle n’est jamais publique.',
    messageLabel: 'Votre message',
    messagePlaceholder: 'Expliquez en quelques lignes comment vous pouvez être utile…',
    messageHint: '4 000 caractères au maximum.',
    shareContactLabel: 'Partager mes coordonnées avec l’auteur',
    shareContactHint:
      'Rien n’est partagé sans ce geste explicite. Vous pouvez répondre sans cocher cette case.',
    recommendLegend: 'Qui recommandez-vous ?',
    recommendMemberLabel: 'Un membre du réseau',
    recommendMemberHint: 'Saisissez son identifiant de profil, visible sur sa page.',
    recommendExternalLabel: 'Une personne hors réseau',
    recommendExternalNameLabel: 'Nom de la personne',
    recommendExternalContextLabel: 'Contexte',
    rationaleLabel: 'Pourquoi ce profil paraît-il pertinent ?',
    offersIntroductionLabel: 'Je propose de faire moi-même l’introduction',
    consentLabel: 'J’ai l’accord de cette personne pour la recommander',
    consentWarningTitle: 'Ne partagez pas les coordonnées d’un tiers',
    consentWarningBody:
      'Aucun téléphone ni e-mail d’une autre personne n’est enregistré ici. Proposez plutôt de faire l’introduction vous-même.',
    submit: 'Envoyer ma réponse',
    submitPending: 'Envoi…',
    doneTitle: 'Merci. Votre réponse a été transmise.',
    doneBody: 'Vous contribuez à rendre le réseau plus utile.',
    alreadyTitle: 'Vous avez déjà répondu à cet appel.',
    alreadyBody:
      'Une seule réponse par appel : elle reste modifiable tant qu’elle n’a pas été triée.',
  },

  /* ---------------- ISE-053 — suivi ---------------- */
  tracking: {
    title: 'Suivi de l’appel',
    breadcrumb: 'Suivi',
    metricsTitle: 'Ce que l’appel a produit',
    targeted: 'Profils ciblés',
    responses: 'Réponses',
    useful: 'Réponses utiles',
    recommendations: 'Profils recommandés',
    introductions: 'Introductions proposées',
    firstResponse: 'Première réponse : {date}',
    noFirstResponse: 'Aucune réponse pour l’instant.',
    metricsNotice: 'Aucune mesure de vanité',
    metricsBody:
      'Ni vues, ni clics, ni likes : seuls les faits utiles à votre besoin sont comptés.',
    responsesTitle: 'Réponses reçues',
    filterAll: 'Toutes',
    statusLabel: 'Statut de traitement',
    statusHint: 'Ce statut reste privé. Le répondant ne le voit jamais.',
    setStatus: 'Enregistrer le statut',
    emptyTitle: 'Votre appel n’a pas encore reçu de réponse.',
    emptyBody:
      'Vous pouvez préciser les compétences recherchées, élargir la zone géographique, ou prolonger l’échéance.',
    historyTitle: 'Historique',
    closeCta: 'Clôturer et enregistrer l’impact',
    closeCtaBody: 'Clôturez l’appel quand l’objectif est atteint — ou quand il ne l’est pas.',
    recommendationOf: 'Profil recommandé',
    externalPerson: 'Personne hors réseau',
    offersIntroduction: 'Propose de faire l’introduction',
    noConsent: 'Accord de la personne non confirmé',
    contactShared: 'A accepté de partager ses coordonnées',
  },

  /* ---------------- ISE-054 — clôture ---------------- */
  closure: {
    title: 'Clôturer l’appel',
    subtitle:
      'La clôture ne change pas seulement un statut : elle mesure si le réseau a réellement aidé.',
    questionResolution: 'Votre besoin a-t-il été résolu ?',
    resolutionHint: 'Répondez honnêtement : un faux positif fausse le matching de tout le réseau.',
    resolved: 'Oui, grâce au réseau',
    partially_resolved: 'Partiellement',
    not_resolved: 'Non',
    resolvedHint: 'Le besoin est couvert.',
    partiallyHint: 'Une partie du besoin est couverte, une autre non.',
    notResolvedHint: 'Le réseau n’a pas apporté de réponse utile.',
    questionResult: 'Quel résultat avez-vous obtenu ?',
    questionMissing: 'Qu’est-ce qui a manqué ?',
    questionContributors: 'Quels membres vous ont particulièrement aidé ?',
    contributorsHint:
      'Facultatif, et limité aux personnes qui ont répondu. Aucune note publique n’est créée.',
    notesLabel: 'Commentaire',
    testimonialLabel: 'Souhaitez-vous partager en une phrase comment le réseau vous a aidé ?',
    testimonialHint: 'Facultatif. 1 000 caractères au maximum.',
    consentLabel: 'J’autorise l’utilisation de ce témoignage.',
    consentHint: 'Sans cette autorisation, le témoignage reste interne et n’est jamais publié.',
    submit: 'Clôturer et enregistrer',
    submitPending: 'Clôture…',
    impactTitle: 'Pourquoi enregistrer le résultat ?',
    impactBody1: 'Améliorer le moteur de matching.',
    impactBody2: 'Valoriser les membres qui aident réellement.',
    impactBody3: 'Mesurer l’utilité du réseau sans l’inventer.',
    noImpactTitle: 'Une clôture non résolue ne produit aucun impact',
    noImpactBody:
      'Aucun événement positif n’est enregistré lorsque le besoin n’a pas été couvert. C’est la règle, pas une omission.',
    doneTitle: 'Appel clôturé.',
    doneResolved: 'Cette résolution sera comptabilisée dans l’impact du réseau.',
    doneNotResolved:
      'Aucun impact n’a été enregistré : le besoin n’a pas été couvert. Votre retour sert à améliorer le ciblage.',
  },

  /* ---------------- Mes appels ---------------- */
  mine: {
    title: 'Mes appels',
    subtitle: 'Vos demandes en cours, résolues, en brouillon ou expirées.',
    tabActive: 'Actifs',
    tabResolved: 'Résolus',
    tabDrafts: 'Brouillons',
    tabExpired: 'Expirés',
    emptyActiveTitle: 'Vous n’avez aucun appel en cours.',
    emptyActiveBody: 'Lancer un appel prend quelques minutes et cible les bonnes personnes.',
    emptyDraftsTitle: 'Aucun brouillon.',
    emptyDraftsBody: 'Un appel commencé et non publié apparaîtra ici.',
    emptyOtherTitle: 'Rien à afficher dans cet onglet.',
    emptyOtherBody: 'Les appels clôturés ou expirés apparaîtront ici.',
    continueDraft: 'Reprendre le brouillon',
    tracking: 'Voir les réponses',
    close: 'Clôturer',
    targeted: '{count} profils ciblés',
    responses: '{count} réponses',
    useful: '{count} utiles',
    recommendations: '{count} recommandations',
  },
} as const;

/** Substitution de jetons `{cle}`. Identique à `i18n/network.ts`. */
export function tc(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
