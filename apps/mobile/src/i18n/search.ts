/**
 * Chaines de la tranche RECHERCHE & DECOUVERTE mobile (ISE-034 -> ISE-037).
 *
 * Fichier separe de `i18n/fr.ts`, pour la meme raison que cote web
 * (`apps/web/src/i18n/search.ts`) : cette tranche est developpee en
 * parallele d'autres lots mobiles qui touchent potentiellement le meme
 * dictionnaire plat (D-94 et les lots Onboarding / Profil / Relations /
 * Appels / Opportunites tournent en meme temps). Les libelles sont
 * VOLONTAIREMENT identiques a ceux de `apps/web/src/i18n/search.ts`
 * (MASTER PROMPT §66) : le meme ecran doit parler le meme francais des
 * deux cotes. Seules les entrees inutiles a cette premiere tranche
 * mobile (competences, fonctions, zones, promotions, langues — non
 * pilotables depuis un selecteur mobile pour cette livraison, voir le
 * rapport de livraison) sont omises ; rien n'est renomme.
 */
export const frSearch = {
  common: {
    loading: 'Chargement en cours…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    remove: 'Retirer',
    optional: 'facultatif',
  },

  /** ISE-034 — Trouver un ISE */
  find: {
    title: 'Trouver un ISE',
    subtitle: 'Recherchez une personne précise ou partez d’un besoin d’expertise.',

    queryLabel: 'Recherche libre',
    queryPlaceholder: 'Nom, compétence, organisation…',
    queryHint:
      'Nom, compétence, organisation, pays ou promotion. Les fautes de frappe et les sigles usuels (M&E, S&E) sont tolérés.',

    criteriaLegend: 'Affiner par critères',
    criteriaHint:
      'Chaque liste vient du référentiel de la plateforme. Les critères se combinent avec le texte libre.',

    sectorsLabel: 'Secteur',
    countriesLabel: 'Pays',
    availabilityLabel: 'Type de disponibilité',
    experienceLabel: 'Années d’expérience (minimum)',
    experiencePlaceholder: 'Sans minimum',

    submit: 'Rechercher',
    submitHint:
      'Sans texte libre, les résultats sont classés par pertinence et chaque profil est justifié.',
    reset: 'Réinitialiser les critères',
    noCriteria: 'Renseignez au moins un critère ou un texte libre avant de lancer la recherche.',

    referentialsErrorTitle: 'Impossible de charger les référentiels de recherche.',

    savedTitle: 'Mes recherches enregistrées',
    savedEmpty: 'Vous n’avez encore enregistré aucune recherche.',
    savedOpen: 'Relancer',
    savedAlertOn: 'Alerte active',
    savedAlertPaused: 'Alerte suspendue',
    savedAlertOff: 'Sans alerte',
  },

  /** ISE-035 — Résultats */
  results: {
    title: 'Résultats de recherche',
    backToSearch: 'Modifier les critères',
    saveSearch: 'Enregistrer la recherche',

    modeRelevance: 'Classement par pertinence',
    modeRelevanceHint:
      'Chaque profil est accompagné du motif de sa proposition. Aucun profil sans motif explicite n’est proposé.',
    modeDirectory: 'Recherche par mots-clés',
    modeDirectoryHint:
      'Le classement suit la correspondance textuelle. Le libellé de pertinence n’est calculé que pour une recherche par critères, sans texte libre : il n’est donc pas affiché ici.',

    countOne: '{count} profil sur cette page.',
    countMany: '{count} profils sur cette page.',

    criteriaLegend: 'Critères appliqués',
    whyThisProfile: 'Pourquoi ce profil ?',
    availableFor: 'Disponible pour',
    topSkills: 'Compétences principales',
    viewProfile: 'Voir le profil',
    verified: 'Vérifié',
    partialProfile: 'Profil partiellement renseigné.',

    loadMore: 'Charger la page suivante',
    endOfResults: 'Vous avez atteint la fin des résultats.',

    emptyTitle: 'Aucun ISE ne correspond exactement à ces critères.',
    emptyBody: 'Élargissez la recherche : chaque critère retiré augmente le nombre de profils.',

    errorTitle: 'Les résultats n’ont pas pu être chargés.',
  },

  /** ISE-036 — Enregistrer la recherche / alerte */
  save: {
    title: 'Enregistrer la recherche',
    subtitle:
      'Retrouvez cette sélection en un clic, et soyez prévenu quand de nouveaux profils y correspondent.',

    nameLabel: 'Nom de la recherche',
    namePlaceholder: 'Ex. Experts suivi-évaluation · Banque · Abidjan',
    nameHint: 'Visible de vous seul.',
    nameRequired: 'Donnez un nom à cette recherche.',
    nameTooLong: 'Ce nom dépasse 120 caractères.',

    criteriaLegend: 'Critères enregistrés',
    criteriaEmpty: 'Aucun critère : revenez aux résultats pour en définir.',

    alertLegend: 'Alerte sur les nouveaux résultats',
    alertToggle: 'M’alerter lorsqu’un nouveau profil correspond à ces critères',
    alertToggleHint: 'Vous pouvez suspendre ou supprimer l’alerte à tout moment.',

    frequencyLabel: 'Fréquence',
    frequencyDaily: 'Chaque jour',
    frequencyWeekly: 'Chaque semaine',
    frequencyMonthly: 'Chaque mois',

    channelLabel: 'Canal',
    channelInApp: 'Dans l’application',
    channelEmail: 'E-mail',
    channelBoth: 'Les deux',

    workerWarningTitle: 'Ce que fait réellement l’enregistrement, aujourd’hui',
    workerWarningBody:
      'Vos critères et vos préférences d’alerte sont bien enregistrés en base. En revanche, le service qui parcourt périodiquement l’annuaire pour déclencher les alertes n’est pas encore déployé : aucune notification ne partira tant qu’il n’existe pas. Nous ne pouvons donc annoncer aucun délai d’envoi. La recherche enregistrée, elle, est relançable immédiatement.',

    submitCreate: 'Enregistrer',
    successTitle: 'Recherche enregistrée.',

    listTitle: 'Mes recherches enregistrées',
    listEmpty: 'Aucune recherche enregistrée pour l’instant.',
    listRelaunch: 'Relancer',
    listPause: 'Suspendre l’alerte',
    listResume: 'Réactiver l’alerte',
    listDelete: 'Supprimer',
    listDeleteConfirm: 'Supprimer définitivement cette recherche et son alerte ?',
    listAlertNone: 'Sans alerte',
    listAlertActive: 'Alerte {frequency} · {channel}',
    listAlertPaused: 'Alerte suspendue ({frequency} · {channel})',

    errorTitle: 'Impossible de charger vos recherches enregistrées.',
  },

  /** ISE-037 — Profil d'un autre ISE */
  profile: {
    verified: 'Vérifié',
    unverified: 'Profil non vérifié',
    referenced: 'Profil référencé, non encore réclamé',

    notFoundTitle: 'Ce profil n’est pas accessible.',
    notFoundBody:
      'Il n’existe pas, il a été retiré de l’annuaire, ou il n’est pas consultable depuis votre compte.',

    errorTitle: 'Impossible de charger ce profil.',

    aboutTitle: 'À propos',
    aboutEmpty: 'Ce membre n’a pas encore renseigné de présentation.',

    relationTitle: 'Ce qui vous relie',
    relationNone: 'Aucun lien direct connu avec ce membre pour l’instant.',
    relationConnected: 'Vous êtes en relation directe.',
    relationPromotion: 'Même promotion : {promotion}.',
    relationOrganization: 'Même organisation actuelle : {organization}.',
    relationMutualOne: '1 relation en commun.',
    relationMutualMany: '{count} relations en commun.',
    relationSelf: 'Ceci est votre propre profil.',
    relationSource:
      'Établi à partir de vos relations confirmées, de votre promotion et de votre organisation déclarée.',

    availabilityTitle: 'Disponible pour aider',
    availabilityEmpty: 'Ce membre n’a déclaré aucune disponibilité active.',

    skillsTitle: 'Compétences',
    skillsEmpty: 'Aucune compétence renseignée.',
    skillsDeclarative: 'Niveaux déclarés par le membre : ils ne sont ni validés ni certifiés.',
    skillYears: '{years} ans',
    skillLevel: {
      notion: 'Notions',
      intermediate: 'Opérationnel',
      advanced: 'Avancé',
      expert: 'Expert',
      undeclared: 'Niveau non déclaré',
    },

    experiencesTitle: 'Parcours professionnel',
    experiencesEmpty: 'Aucune expérience visible.',
    experienceCurrent: 'En cours',
    experiencePeriod: '{start} — {end}',

    educationsTitle: 'Formations',

    promotionTitle: 'Promotion',

    keyFactsTitle: 'Informations clés',
    keyFactSectors: 'Secteurs',
    keyFactLanguages: 'Langues',
    keyFactLinkedin: 'Profil LinkedIn',
    keyFactWebsite: 'Site web',

    hiddenFieldsTitle: 'Certaines informations ne sont pas affichées',
    hiddenFieldsBody:
      'Ce membre a restreint la visibilité d’une partie de son profil. Les données concernées ne sont pas transmises à votre appareil : elles ne sont pas simplement masquées.',

    actionsTitle: 'Entrer en contact',
    /**
     * E-05 (tranche Recherche) : les demandes de connexion (ISE-038) et
     * d'introduction (ISE-043/044) relevent d'un autre lot mobile
     * (« Relations & introductions », ISE-038 -> ISE-046, developpe en
     * parallele). Cet ecran ne les fabrique pas : aucun bouton n'est
     * affiche tant que l'action n'aboutit nulle part (MASTER PROMPT §113).
     */
    actionsUnavailable:
      'Les demandes de connexion et d’introduction se font depuis l’onglet Réseau, une fois ce lot mobile livré. Aucun bouton n’est affiché ici tant que l’action n’aboutit nulle part.',
  },

  /** Libellés des critères, réutilisés par les puces de rappel. */
  criteria: {
    query: 'Texte libre',
    sectors: 'Secteur',
    countries: 'Pays',
    availability: 'Disponibilité',
    experienceValue: '{years} ans minimum',
  },
} as const;
