/**
 * Chaînes de la tranche OPPORTUNITÉS (ISE-055 → ISE-066).
 *
 * Règle cardinale portée par ce fichier (MASTER PROMPT §27, D-55) :
 * aucune chaîne n'affirme qu'une candidature a été envoyée à un
 * organisme externe. Le vocabulaire distingue trois faits différents :
 *   « candidature envoyée »      → uniquement pour le mode interne ;
 *   « vous avez déclaré avoir postulé » → déclaration du membre ;
 *   « vous avez consulté l'offre »      → clic sortant, rien de plus.
 *
 * D27 §32 : la rémunération n'est jamais inventée. Non renseignée se dit
 * « non précisée », jamais « 0 ».
 */
export const frOpportunities = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    loadMorePending: 'Chargement…',
    endOfList: 'Vous avez vu toutes les opportunités disponibles.',
    correlationLabel: 'Référence à communiquer à l’assistance',
    breadcrumb: 'Opportunités',
    optional: 'Facultatif',
    save: 'Enregistrer et continuer',
    savePending: 'Enregistrement…',
    required: 'Obligatoire',
    preferred: 'Souhaité',
    seeProfile: 'Voir le profil',
    loadErrorTitle: 'Les opportunités n’ont pas pu être chargées.',
    loadErrorBody: 'Réessayez dans un instant. Si le problème persiste, contactez l’assistance.',
    notSpecified: 'Non précisée',
  },

  type: {
    job: 'Emploi',
    internship: 'Stage',
    mission: 'Mission',
    business: 'Business',
    research: 'Recherche',
    scholarship: 'Bourse',
  } as Record<string, string>,

  contractType: {
    permanent: 'CDI',
    fixed_term: 'CDD',
    local_contract: 'Contrat local',
    international_contract: 'Contrat international',
    public_service: 'Fonction publique',
    graduate_program: 'Graduate programme',
    consultancy: 'Consultance',
    short_term_expert: 'Expert court terme',
    long_term_expert: 'Expert long terme',
    team_leader: 'Team leader',
    key_expert: 'Key expert',
    technical_assistance: 'Assistance technique',
    academic_internship: 'Stage académique',
    professional_internship: 'Stage professionnel',
    final_year_internship: 'Stage de fin d’études',
    research_internship: 'Stage de recherche',
    pre_employment_internship: 'Stage pré-emploi',
    other: 'Autre',
  } as Record<string, string>,

  experienceLevel: {
    junior: 'Junior',
    intermediate: 'Intermédiaire',
    senior: 'Senior',
    executive: 'Direction',
  } as Record<string, string>,

  remoteMode: {
    onsite: 'Sur site',
    hybrid: 'Hybride',
    remote: 'À distance',
  } as Record<string, string>,

  sourceType: {
    ise_member: 'Publiée par un ISE',
    partner_organization: 'Organisation partenaire',
    external_source: 'Source externe',
    administration: 'Administration',
  } as Record<string, string>,

  status: {
    draft: 'Brouillon',
    active: 'Ouverte',
    paused: 'En pause',
    closed: 'Clôturée',
    expired: 'Expirée',
    cancelled: 'Annulée',
    moderated: 'Retirée',
  } as Record<string, string>,

  moderation: {
    not_required: 'Publication immédiate',
    pending: 'En attente de validation',
    approved: 'Validée',
    rejected: 'Refusée',
  } as Record<string, string>,

  relevance: {
    very_relevant: 'Très pertinente pour votre profil',
    relevant: 'Pertinente pour votre profil',
    close_profile: 'Profil proche',
  } as Record<string, string>,

  visibility: {
    members: 'Réseau ISE vérifié',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    private: 'Membres sélectionnés',
  } as Record<string, string>,

  applicationMode: {
    internal: 'Candidature via Compétences ISE',
    external_url: 'Candidature sur le site de l’organisation',
    external_email: 'Candidature par e-mail',
    contact_recruiter: 'Prise de contact avec un référent',
  } as Record<string, string>,

  applicationModeHint: {
    internal:
      'Votre candidature est déposée ici. La plateforme peut donc en suivre l’évolution réelle.',
    external_url:
      'Vous postulez sur le site de l’organisation. La plateforme ne saura pas si vous l’avez fait : vous seul pouvez le déclarer.',
    external_email:
      'Vous postulez par e-mail. La plateforme ne saura pas si vous l’avez fait : vous seul pouvez le déclarer.',
    contact_recruiter:
      'Vous prenez contact avec un référent. La plateforme ne constate aucune candidature par ce chemin.',
  } as Record<string, string>,

  /** Statuts de candidature. Vocabulaire neutre : jamais « rejeté ». */
  applicationStatus: {
    draft: 'Brouillon',
    submitted: 'Envoyée',
    viewed: 'Consultée',
    under_review: 'En cours d’examen',
    interview: 'Entretien',
    selected: 'Retenue',
    not_selected: 'Non retenue',
    withdrawn: 'Retirée',
    closed: 'Clôturée',
  } as Record<string, string>,

  applicationStatusHint: {
    viewed: 'Le dossier a été ouvert.',
    under_review: 'Le dossier est en cours d’examen.',
    interview: 'Un entretien est prévu ou a eu lieu.',
    selected: 'La démarche a abouti.',
    not_selected: 'La démarche est terminée sans suite.',
    withdrawn: 'Vous avez retiré votre candidature.',
    closed: 'L’offre a été clôturée sans décision individuelle.',
  } as Record<string, string>,

  outcomeType: {
    ise_hired: 'Un ISE a été recruté',
    mission_awarded: 'Une mission a été attribuée',
    intern_selected: 'Un stagiaire a été sélectionné',
    multiple_selected: 'Plusieurs profils ont été retenus',
    no_selection: 'Aucun candidat retenu',
    external_hire: 'Recrutement externe',
    cancelled: 'Opportunité annulée',
    other: 'Autre',
  } as Record<string, string>,

  attributionLevel: {
    direct: 'Candidature et sélection via la plateforme',
    partial: 'La plateforme a facilité la mise en relation',
    self_reported: 'Déclaré par le membre',
    unknown: 'Non déterminé',
  } as Record<string, string>,

  /* ---------------- ISE-055 — hub ---------------- */
  list: {
    title: 'Opportunités',
    subtitle: 'Emplois, missions et stages accessibles au réseau ISE.',
    create: 'Publier une opportunité',
    mine: 'Mes offres',
    myApplications: 'Mes candidatures',
    savedLink: 'Opportunités enregistrées',
    tabForYou: 'Pour vous',
    tabJobs: 'Emplois',
    tabInternships: 'Stages',
    tabMissions: 'Missions',
    tabAll: 'Toutes',
    searchLabel: 'Rechercher une opportunité',
    searchPlaceholder: 'Un poste, une compétence, une organisation…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer',
    filterSector: 'Secteur',
    filterCountry: 'Pays',
    filterLevel: 'Niveau d’expérience',
    filterRemote: 'Télétravail possible',
    filterNewGraduates: 'Adapté aux jeunes diplômés',
    filterAll: 'Tous',
    filterApply: 'Filtrer',
    announce: '{count} opportunités affichées.',
    deadlineOn: 'Date limite : {date}',
    noDeadline: 'Sans date limite',
    startOn: 'Démarrage : {date}',
    durationDays: 'Durée : {count} jours',
    positions: '{count} postes',
    compensation: 'Rémunération',
    whyTitle: 'Pourquoi cette opportunité vous correspond',
    see: 'Voir l’opportunité',
    save: 'Enregistrer',
    unsave: 'Retirer des enregistrées',
    appliedBadge: 'Candidature envoyée',
    declaredBadge: 'Candidature déclarée',
    newGraduatesBadge: 'Adapté aux jeunes diplômés',
    remoteBadge: 'Télétravail',
    verifiedBadge: 'Source vérifiée',
    emptyForYouTitle: 'Aucune opportunité ne correspond encore à votre profil.',
    emptyForYouBody:
      'Complétez vos compétences et votre disponibilité : le moteur ne propose que ce qui correspond réellement.',
    emptyForYouAction: 'Voir toutes les opportunités',
    emptyAllTitle: 'Aucune opportunité ouverte pour l’instant.',
    emptyAllBody: 'Vous pouvez publier la vôtre et la proposer aux profils pertinents.',
    emptySavedTitle: 'Vous n’avez enregistré aucune opportunité.',
    emptySavedBody: 'Enregistrer une offre la met de côté. Cela ne vaut jamais candidature.',
  },

  /* ---------------- ISE-056 — détail ---------------- */
  detail: {
    breadcrumb: 'Détail',
    aboutTitle: 'À propos de l’opportunité',
    profileTitle: 'Profil recherché',
    skillsRequired: 'Compétences obligatoires',
    skillsPreferred: 'Compétences souhaitées',
    toolsTitle: 'Outils',
    languagesTitle: 'Langues',
    countriesTitle: 'Zones d’expérience',
    infoTitle: 'Informations',
    typeLabel: 'Type',
    contractLabel: 'Contrat',
    locationLabel: 'Lieu',
    startLabel: 'Démarrage',
    durationLabel: 'Durée',
    deadlineLabel: 'Date limite',
    experienceLabel: 'Expérience minimale',
    experienceYears: '{years} ans',
    positionsLabel: 'Postes ouverts',
    sourceLabel: 'Source',
    statusLabel: 'Statut',
    publishedLabel: 'Publié le',
    organizationTitle: 'Organisation',
    whyTitle: 'Pourquoi cette opportunité vous correspond',
    howToApplyTitle: 'Comment postuler',
    ctaInternal: 'Postuler sur Compétences ISE',
    ctaExternal: 'Voir comment postuler',
    questionsTitle: 'Questions complémentaires',
    notFoundTitle: 'Cette opportunité n’est pas accessible.',
    notFoundBody:
      'Elle n’existe plus, elle attend une validation, ou elle ne s’adresse pas à vous.',
    closedTitle: 'Cette opportunité est clôturée.',
    closedBody: 'Elle reste consultable pour mémoire ; elle n’accepte plus de candidature.',
    pendingModerationTitle: 'Cette offre attend une validation.',
    pendingModerationBody:
      'Relayée d’une source externe, elle n’est visible que de vous tant qu’elle n’a pas été validée.',
    manageTitle: 'Vous gérez cette opportunité',
    manageTracking: 'Voir les candidatures',
    manageClose: 'Clôturer',
    managePause: 'Mettre en pause',
    alreadyAppliedTitle: 'Vous avez déjà candidaté à cette opportunité.',
    alreadyDeclaredTitle: 'Vous avez déclaré avoir postulé à cette opportunité.',
    seeApplication: 'Voir ma candidature',
  },

  /* ---------------- Postuler (cible du CTA d'ISE-056) ---------------- */
  apply: {
    titleInternal: 'Postuler',
    titleExternal: 'Comment postuler',
    subtitleInternal: 'Votre profil Compétences ISE sera joint à votre candidature.',
    externalNoticeTitle: 'La candidature se fait hors de la plateforme',
    externalNoticeBody:
      'Compétences ISE ne transmet aucun dossier à cette organisation et ne saura pas si vous avez postulé. Ouvrir le lien ne vaut pas candidature.',
    openExternal: 'Ouvrir l’offre chez l’organisation',
    openExternalEmail: 'Adresse de candidature',
    contactRecruiter: 'Référent à contacter',
    clickRecordedTitle: 'Consultation enregistrée',
    clickRecordedBody:
      'Nous avons noté que vous avez consulté cette offre. Ce n’est pas une candidature : seule votre déclaration en est une.',
    declareTitle: 'Vous avez postulé ?',
    declareBody:
      'Déclarez-le pour suivre la démarche dans « Mes candidatures ». Vous seul pouvez le faire : la plateforme ne le devinera jamais.',
    declareDateLabel: 'Date à laquelle vous avez postulé',
    declareDateHint: 'Une date passée ou aujourd’hui.',
    declareNoteLabel: 'Note',
    declareNoteHint: 'Facultatif. Par exemple le canal utilisé ou la personne contactée.',
    declareSubmit: 'Je déclare avoir postulé',
    declarePending: 'Enregistrement…',
    messageLabel: 'Message au recruteur',
    messagePlaceholder: 'Pourquoi cette opportunité vous intéresse-t-elle ?',
    messageHint: 'Facultatif. 2 000 caractères au maximum.',
    cvLabel: 'CV à joindre',
    cvNone: 'Aucun CV',
    cvEmptyTitle: 'Vous n’avez aucun document enregistré.',
    cvEmptyBody:
      'Vous pouvez candidater sans CV : votre profil est joint. Le dépôt de document n’est pas encore ouvert.',
    cvPrivacyTitle: 'Votre CV reste privé',
    cvPrivacyBody:
      'Il devient accessible au responsable de l’offre uniquement dans le contexte de cette candidature.',
    submit: 'Envoyer ma candidature',
    submitPending: 'Envoi…',
    doneTitle: 'Candidature envoyée.',
    doneBody: 'Vous pourrez suivre son évolution dans « Mes candidatures ».',
    doneDeclaredTitle: 'Déclaration enregistrée.',
    doneDeclaredBody:
      'Vous suivrez vous-même l’avancement : la plateforme n’a aucun moyen de le constater.',
    noMassApplyTitle: 'Une candidature, un geste réfléchi',
    noMassApplyBody:
      'Aucune candidature en masse n’est possible ici : une seule candidature par opportunité, et un message quand il apporte quelque chose.',
  },

  /* ---------------- ISE-057 → ISE-059 — publication ---------------- */
  wizard: {
    stepLabel: 'Étape {current} sur {total}',
    step1: 'Offre',
    step2: 'Ciblage',
    step3: 'Aperçu',
    createTitle: 'Publier une opportunité',
    createSubtitle:
      'Décrivez ce que vous proposez. Compétences ISE l’adresse aux profils réellement pertinents.',
    typeLegend: 'Que souhaitez-vous proposer au réseau ?',
    typeHint: 'Le périmètre actuel couvre les emplois, les stages et les missions.',
    titleLabel: 'Intitulé',
    titlePlaceholder: 'Ex. Consultant senior en suivi-évaluation',
    organizationLabel: 'Organisation',
    organizationHint: 'Saisissez le nom si l’organisation n’est pas encore au référentiel.',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Contexte, mission, responsabilités, conditions…',
    descriptionHint: 'Entre 20 et 20 000 caractères.',
    summaryLabel: 'Résumé court',
    summaryHint: 'Facultatif. 400 caractères au maximum, affichés sur la carte.',
    contractLabel: 'Type de contrat',
    countryLabel: 'Pays',
    cityLabel: 'Ville',
    remoteLabel: 'Mode de travail',
    startLabel: 'Date de démarrage',
    durationLabel: 'Durée (jours)',
    deadlineLabel: 'Date limite de candidature',
    positionsLabel: 'Nombre de postes',
    compensationTitle: 'Rémunération',
    compensationHint:
      'Facultative. Si vous ne la renseignez pas, l’offre affiche « non précisée » — jamais un montant inventé.',
    compensationMinLabel: 'Minimum',
    compensationMaxLabel: 'Maximum',
    currencyLabel: 'Devise',
    compensationDisclosedLabel: 'Afficher la rémunération sur l’offre',
    applicationModeLegend: 'Comment souhaitez-vous recevoir les candidatures ?',
    applicationModeHint:
      'Seule la candidature interne permet de constater le résultat. Les autres modes limitent le suivi au clic sortant.',
    externalUrlLabel: 'Adresse de l’offre',
    externalEmailLabel: 'Adresse e-mail de candidature',
    contactLabel: 'Identifiant du profil référent',
    newGraduatesLabel: 'Adapté aux jeunes diplômés',
    newGraduatesHint:
      'Coché, ce filtre neutralise l’ancienneté minimale dans le ciblage : une promotion sortante n’est plus écartée.',

    audienceTitle: 'Ciblage et matching',
    audienceSubtitle:
      'Les critères obligatoires excluent. Les critères souhaités pondèrent. Choisissez en connaissance de cause.',
    skillsLabel: 'Compétences souhaitées',
    skillsRequiredLabel: 'Compétences obligatoires',
    toolsLabel: 'Outils',
    sectorLabel: 'Secteur',
    sectorRequiredLabel: 'Le secteur est obligatoire',
    functionLabel: 'Fonction',
    levelLabel: 'Niveau d’expérience',
    minExperienceLabel: 'Expérience minimale (années)',
    idealExperienceLabel: 'Expérience idéale (années)',
    languageLabel: 'Langue de travail',
    languageLevelLabel: 'Niveau minimal',
    experienceCountriesLabel: 'Pays d’expérience souhaités',
    audiencePromotionsLabel: 'Promotions ciblées',
    visibilityLegend: 'Qui peut voir cette opportunité ?',
    questionsLabel: 'Questions complémentaires',
    questionsHint: 'Trois au maximum. Un formulaire long décourage les bonnes candidatures.',
    noDiscriminationTitle: 'Des critères utiles, pas des critères excluants',
    noDiscriminationBody:
      'N’utilisez « obligatoire » que lorsque le critère conditionne réellement la mission. Un critère obligatoire retire le profil du ciblage.',

    previewTitle: 'Aperçu avant publication',
    previewSubtitle: 'Voici exactement ce que verront les profils ciblés.',
    previewCard: 'La carte dans le hub',
    previewDetail: 'Le détail de l’offre',
    publish: 'Publier l’opportunité',
    publishPending: 'Publication…',
    publishedTitle: 'Opportunité publiée.',
    publishedBody: '{count} profils correspondent à vos critères.',
    publishedNoMatch:
      'Aucun profil ne correspond encore à vos critères. L’offre est publiée et sera recalculée à chaque modification.',
    publishedPendingTitle: 'Opportunité enregistrée, en attente de validation.',
    publishedPendingBody:
      'Relayée d’une source externe, elle sera visible du réseau une fois validée. Vous seul la voyez pour l’instant.',
    editStep: 'Modifier',
  },

  /* ---------------- ISE-060 — suivi ---------------- */
  tracking: {
    title: 'Suivi de l’opportunité',
    breadcrumb: 'Suivi',
    metricsTitle: 'Ce que l’offre a produit',
    applications: 'Candidatures',
    targeted: 'Profils ciblés',
    strongMatches: 'Profils fortement correspondants',
    metricsNotice: 'Aucune mesure de vanité',
    metricsBody:
      'Ni vues, ni clics : seules les candidatures réelles et le ciblage effectif sont comptés.',
    candidatesTitle: 'Candidatures reçues',
    filterAll: 'Toutes',
    noScoreTitle: 'Le classement est une aide, jamais un filtre',
    noScoreBody:
      'Aucun candidat n’est écarté automatiquement. Les libellés de pertinence expliquent un rapprochement, ils ne décident de rien.',
    emptyTitle: 'Aucune candidature reçue pour l’instant.',
    emptyBody:
      'Vous pouvez vérifier le ciblage, élargir un critère obligatoire, ou prolonger la date limite.',
    matchesTitle: 'Profils correspondants',
    seeApplication: 'Voir la candidature',
    changeStatus: 'Changer le statut',
    closeCta: 'Clôturer et enregistrer le résultat',
    externalApplication: 'Candidature déclarée par le membre',
    externalApplicationHint:
      'Ce membre a déclaré avoir postulé hors plateforme. Le statut reflète sa déclaration.',
  },

  /* ---------------- ISE-061 — clôture ---------------- */
  closure: {
    title: 'Clôturer l’opportunité',
    subtitle:
      'Le résultat que vous déclarez alimente les indicateurs d’impact. Il n’est jamais déduit.',
    questionOutcome: 'Quel a été le résultat ?',
    hiresLabel: 'Nombre de personnes retenues',
    beneficiariesLabel: 'Qui a été retenu ?',
    beneficiariesHint: 'Uniquement parmi les personnes ayant réellement candidaté à cette offre.',
    facilitatedLabel: 'Cette mise en relation a-t-elle été réalisée grâce à Compétences ISE ?',
    facilitatedHint:
      'Répondez non si la plateforme n’a joué aucun rôle : aucun impact ne sera attribué.',
    attributionLabel: 'Niveau d’attribution',
    notesLabel: 'Commentaire',
    submit: 'Clôturer et enregistrer',
    submitPending: 'Clôture…',
    noImpactTitle: 'Un résultat sans recrutement ne produit aucun impact',
    noImpactBody:
      'La base refuse toute attribution positive lorsqu’aucune personne n’a été retenue. C’est volontaire.',
    doneTitle: 'Opportunité clôturée.',
  },

  /* ---------------- ISE-062 / ISE-063 ---------------- */
  saved: {
    title: 'Opportunités enregistrées',
    subtitle: 'Les offres que vous avez mises de côté. Les enregistrer ne vaut jamais candidature.',
  },

  applications: {
    title: 'Mes candidatures',
    subtitle: 'Les démarches que vous avez engagées, sur la plateforme comme à l’extérieur.',
    tabInProgress: 'En cours',
    tabFinished: 'Terminées',
    tabWithdrawn: 'Retirées',
    tabDrafts: 'Brouillons',
    channelPlatform: 'Via Compétences ISE',
    channelExternal: 'Déclarée par vous',
    channelExternalHint:
      'Cette candidature a été déclarée par vous. La plateforme ne l’a pas constatée.',
    sentOn: 'Envoyée le {date}',
    declaredOn: 'Déclarée le {date}',
    decidedOn: 'Décision le {date}',
    emptyInProgressTitle: 'Aucune candidature en cours.',
    emptyInProgressBody:
      'Les opportunités auxquelles vous postulez apparaîtront ici, ainsi que celles que vous déclarez.',
    emptyOtherTitle: 'Rien à afficher dans cet onglet.',
    emptyOtherBody: 'Les candidatures terminées ou retirées apparaîtront ici.',
    see: 'Voir la candidature',
  },

  /* ---------------- ISE-064 → ISE-066 ---------------- */
  application: {
    breadcrumb: 'Détail',
    title: 'Candidature',
    timelineTitle: 'Historique de la candidature',
    documentsTitle: 'Pièces jointes',
    answersTitle: 'Réponses aux questions',
    messageTitle: 'Votre message',
    noDocuments: 'Aucune pièce jointe.',
    noTimeline: 'Aucun événement enregistré.',
    selfDeclaredTitle: 'Vous suivez vous-même cette candidature',
    selfDeclaredBody:
      'Elle a été déposée hors de la plateforme. Chaque étape que vous enregistrez est une déclaration de votre part, pas un fait constaté.',
    platformTitle: 'Candidature déposée sur Compétences ISE',
    platformBody:
      'Les étapes constatées par le responsable de l’offre apparaissent ici automatiquement.',
    actorApplicant: 'Déclaré par vous',
    actorRecruiter: 'Constaté par le responsable de l’offre',
    actorAdmin: 'Correction administrative',
    actorSystem: 'Enregistré par la plateforme',
    update: 'Mettre à jour l’avancement',
    outcome: 'Enregistrer le résultat final',
    withdraw: 'Retirer ma candidature',
    withdrawConfirm:
      'Retirer une candidature est définitif : vous ne pourrez pas candidater à nouveau à cette opportunité.',
    notFoundTitle: 'Cette candidature n’est pas accessible.',
    notFoundBody: 'Elle n’existe plus, ou elle ne vous concerne pas.',
  },

  update: {
    title: 'Mettre à jour la candidature',
    subtitle: 'Sélectionnez l’étape qui décrit le mieux la situation actuelle.',
    statusLegend: 'Nouvelle étape',
    noTransitionTitle: 'Aucune mise à jour n’est possible pour l’instant.',
    noTransitionBody:
      'La candidature est dans un état terminal, ou l’étape suivante appartient au responsable de l’offre.',
    noteLabel: 'Note',
    noteHint: 'Facultatif. Elle reste attachée à cette étape.',
    submit: 'Enregistrer l’étape',
    submitPending: 'Enregistrement…',
    declarationTitle: 'Ce que vous enregistrez est une déclaration',
    declarationBody:
      'La plateforme n’a aucun moyen de vérifier l’avancement d’une candidature déposée ailleurs. Elle enregistre ce que vous constatez.',
    doneTitle: 'Étape enregistrée.',
  },

  outcome: {
    title: 'Résultat final',
    subtitle: 'Clôturez la démarche en indiquant ce qui s’est réellement passé.',
    resultLegend: 'Quel est le résultat ?',
    selected: 'Retenue',
    notSelected: 'Non retenue',
    withdrawn: 'J’ai retiré ma candidature',
    impactTitle: 'Impact du réseau',
    impactBody:
      'Un résultat positif obtenu grâce au réseau alimente les indicateurs d’impact. Un résultat négatif n’en produit aucun.',
    noteLabel: 'Commentaire',
    submit: 'Enregistrer le résultat',
    submitPending: 'Enregistrement…',
    doneTitle: 'Résultat enregistré.',
  },

  /* ---------------- Mes offres ---------------- */
  mine: {
    title: 'Mes offres publiées',
    subtitle: 'Vos opportunités actives, en brouillon, clôturées ou expirées.',
    tabActive: 'Actives',
    tabDrafts: 'Brouillons',
    tabClosed: 'Clôturées',
    tabExpired: 'Expirées',
    emptyActiveTitle: 'Vous n’avez aucune offre active.',
    emptyActiveBody: 'Publier une opportunité prend quelques minutes.',
    emptyDraftsTitle: 'Aucun brouillon.',
    emptyDraftsBody: 'Une offre commencée et non publiée apparaîtra ici.',
    emptyOtherTitle: 'Rien à afficher dans cet onglet.',
    emptyOtherBody: 'Les offres clôturées ou expirées apparaîtront ici.',
    continueDraft: 'Reprendre le brouillon',
    tracking: 'Voir les candidatures',
    close: 'Clôturer',
    applications: '{count} candidatures',
    targeted: '{count} profils ciblés',
    strong: '{count} fortement correspondants',
  },
} as const;

/** Substitution de jetons `{cle}`. */
export function to(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
