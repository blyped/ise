/**
 * Chaines de la tranche RECHERCHE & DECOUVERTE (ISE-034 -> ISE-037).
 *
 * Fichier separe de `src/i18n/fr.ts` : la tranche est developpee en
 * parallele d'une autre, et deux agents qui editent le meme dictionnaire
 * se marchent dessus. La convention de nommage reste celle de `fr.ts`
 * (arborescence des ecrans, jamais la couleur ni la position visuelle).
 *
 * MASTER PROMPT §66 : aucune chaine importante n'est dispersee dans le code.
 */
export const frSearch = {
  common: {
    loading: 'Chargement en cours…',
    retry: 'Réessayer',
    cancel: 'Annuler',
    clearAll: 'Effacer tous les critères',
    remove: 'Retirer',
    optional: 'facultatif',
    unknown: 'Non renseigné',
    notAuthorized: 'Non communiqué par ce membre.',
    correlationLabel: 'Référence à communiquer à l’assistance',
  },

  /** ISE-034 — Trouver un ISE */
  find: {
    title: 'Trouver un ISE',
    subtitle: 'Recherchez une personne précise ou partez d’un besoin d’expertise.',
    breadcrumbNetwork: 'Réseau',
    breadcrumbCurrent: 'Trouver un ISE',

    queryLegend: 'Qui ou quelle expertise recherchez-vous ?',
    queryLabel: 'Recherche libre',
    queryPlaceholder: 'Ex. économètre agriculture Sénégal, Banque mondiale, promotion 2000…',
    queryHint:
      'Nom, compétence, organisation, pays ou promotion. Les fautes de frappe et les sigles usuels (M&E, S&E) sont tolérés.',

    criteriaLegend: 'Affiner par critères',
    criteriaHint:
      'Chaque liste vient du référentiel de la plateforme. Les critères se combinent : un profil doit satisfaire chacune des dimensions renseignées.',

    skillsLabel: 'Compétences',
    sectorsLabel: 'Secteurs',
    functionsLabel: 'Fonctions',
    countriesLabel: 'Pays (résidence ou expérience)',
    subregionsLabel: 'Zones géographiques',
    promotionsLabel: 'Promotions',
    languagesLabel: 'Langues de travail',
    availabilityLabel: 'Types de disponibilité',
    experienceLabel: 'Années d’expérience (minimum)',
    experienceHint: 'Ancienneté professionnelle déclarée, calculée à partir des expériences.',
    experienceAny: 'Sans minimum',

    filterSearchPlaceholder: 'Filtrer la liste…',
    filterNoMatch: 'Aucune entrée du référentiel ne correspond.',
    filterShowing: '{shown} entrées affichées sur {total}. Affinez pour voir les autres.',
    filterSelectedLegend: 'Sélection',
    filterCount: '{count} sélectionné',
    filterCountPlural: '{count} sélectionnés',
    filterEmptyReferential:
      'Ce référentiel est vide en base : le critère est masqué plutôt que proposé sans contenu.',

    submit: 'Voir les profils',
    submitHint:
      'Sans texte libre, les résultats sont classés par pertinence et chaque profil est justifié.',
    reset: 'Réinitialiser',
    validationFailed:
      'Certains critères sont invalides. Corrigez-les avant de lancer la recherche.',
    noCriteria: 'Renseignez au moins un critère ou un texte libre avant de lancer la recherche.',

    savedTitle: 'Mes recherches enregistrées',
    savedEmpty: 'Vous n’avez encore enregistré aucune recherche.',
    savedEmptyHint:
      'Depuis une page de résultats, « Enregistrer la recherche » conserve vos critères et peut vous alerter.',
    savedOpen: 'Relancer',
    savedManage: 'Gérer mes recherches enregistrées',
    savedAlertOn: 'Alerte active',
    savedAlertPaused: 'Alerte suspendue',
    savedAlertOff: 'Sans alerte',
  },

  /** ISE-035 — Résultats */
  results: {
    title: 'Résultats de recherche',
    breadcrumbCurrent: 'Résultats',
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
    announce: '{count} profils affichés.',
    announceMore: '{count} profils supplémentaires chargés.',

    criteriaLegend: 'Critères appliqués',
    whyThisProfile: 'Pourquoi ce profil ?',
    availableFor: 'Disponible pour',
    topSkills: 'Compétences principales',
    viewProfile: 'Voir le profil',
    verified: 'Vérifié',
    partialProfile: 'Profil partiellement renseigné.',

    loadMore: 'Charger la page suivante',
    loadMorePending: 'Chargement…',
    endOfResults: 'Vous avez atteint la fin des résultats.',
    cursorExpired:
      'Ce lien de pagination n’est plus valable. Relancez la recherche pour repartir de la première page.',

    emptyTitle: 'Aucun ISE ne correspond exactement à ces critères.',
    emptyBody: 'Élargissez la recherche : chaque critère retiré augmente le nombre de profils.',
    emptySuggestionsTitle: 'Suggestions concrètes',
    emptySuggestions: [
      'Retirez le critère le plus restrictif — souvent la fonction ou la promotion.',
      'Remplacez le pays par sa zone géographique : un ISE basé à Abidjan a souvent travaillé dans toute l’Afrique de l’Ouest.',
      'Abaissez le minimum d’années d’expérience, ou retirez-le.',
      'Ne gardez qu’une compétence : le moteur classe déjà par proximité.',
      'Retirez le type de disponibilité : un profil sans disponibilité déclarée peut malgré tout répondre.',
    ],
    emptyAction: 'Revenir aux critères',

    errorTitle: 'Les résultats n’ont pas pu être chargés.',
    errorAction: 'Réessayer',
  },

  /** ISE-036 — Enregistrer la recherche / alerte */
  save: {
    title: 'Enregistrer la recherche',
    subtitle:
      'Retrouvez cette sélection en un clic, et soyez prévenu quand de nouveaux profils y correspondent.',
    backToResults: 'Retour aux résultats',

    nameLabel: 'Nom de la recherche',
    namePlaceholder: 'Ex. Experts suivi-évaluation · Banque · Abidjan',
    nameHint: 'Visible de vous seul.',
    nameRequired: 'Donnez un nom à cette recherche.',
    nameTooLong: 'Ce nom dépasse 120 caractères.',

    criteriaLegend: 'Critères enregistrés',
    criteriaEmpty: 'Aucun critère : revenez aux résultats pour en définir.',
    criteriaNote:
      'Les critères sont enregistrés tels quels. Pour les modifier, relancez la recherche puis enregistrez de nouveau.',

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
    submitUpdate: 'Mettre à jour',
    submitPending: 'Enregistrement…',
    successTitle: 'Recherche enregistrée.',
    successWithAlert:
      'Vos préférences d’alerte sont enregistrées. Elles s’appliqueront dès que le service d’alerte sera déployé.',
    successWithoutAlert: 'Aucune alerte n’est associée à cette recherche.',

    listTitle: 'Mes recherches enregistrées',
    listEmpty: 'Aucune recherche enregistrée pour l’instant.',
    listEmptyHint: 'Enregistrez la recherche en cours à l’aide du formulaire ci-contre.',
    listRelaunch: 'Relancer',
    listPause: 'Suspendre l’alerte',
    listResume: 'Réactiver l’alerte',
    listDelete: 'Supprimer',
    listDeleteConfirm: 'Supprimer définitivement cette recherche et son alerte ?',
    listCreatedAt: 'Enregistrée le {date}',
    listNeverNotified: 'Jamais notifiée',
    listAlertNone: 'Sans alerte',
    listAlertActive: 'Alerte {frequency} · {channel}',
    listAlertPaused: 'Alerte suspendue ({frequency} · {channel})',
  },

  /** ISE-037 — Profil d'un autre ISE */
  profile: {
    breadcrumbCurrent: 'Profil',
    backToResults: 'Retour aux résultats',
    verified: 'Vérifié',
    unverified: 'Profil non vérifié',
    referenced: 'Profil référencé, non encore réclamé',
    referencedHint:
      'Ce profil provient de l’annuaire historique. Son titulaire ne l’a pas encore réclamé : les informations peuvent être incomplètes.',

    notFoundTitle: 'Ce profil n’est pas accessible.',
    notFoundBody:
      'Il n’existe pas, il a été retiré de l’annuaire, ou il n’est pas consultable depuis votre compte.',
    notFoundAction: 'Revenir à la recherche',

    tabAbout: 'À propos',
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

    keyFactsTitle: 'Informations clés',
    keyFactSectors: 'Secteurs',
    keyFactFunctions: 'Fonctions',
    keyFactExpertise: 'Domaines d’expertise',
    keyFactOrganization: 'Organisation actuelle',
    keyFactPosition: 'Poste actuel',
    keyFactLocation: 'Localisation',
    keyFactExperienceCountries: 'Pays d’expérience',
    keyFactLanguages: 'Langues',
    keyFactTools: 'Outils',
    keyFactLinks: 'Liens',
    keyFactLinkedin: 'Profil LinkedIn',
    keyFactWebsite: 'Site web',

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
    educationsEmpty: 'Aucune formation visible.',

    promotionTitle: 'Promotion',

    hiddenFieldsTitle: 'Certaines informations ne sont pas affichées',
    hiddenFieldsBody:
      'Ce membre a restreint la visibilité d’une partie de son profil. Les données concernées ne sont pas transmises à votre navigateur : elles ne sont pas simplement masquées.',

    actionsTitle: 'Entrer en contact',
    actionsUnavailable:
      'Les demandes de connexion (ISE-038) et les demandes d’introduction (ISE-044) ne sont pas encore livrées. Aucun bouton n’est affiché tant que l’action n’aboutit nulle part.',
  },

  /** Libellés des critères, réutilisés par les puces de rappel. */
  criteria: {
    query: 'Texte libre',
    skills: 'Compétence',
    sectors: 'Secteur',
    functions: 'Fonction',
    countries: 'Pays',
    subregions: 'Zone',
    promotions: 'Promotion',
    languages: 'Langue',
    availability: 'Disponibilité',
    experience: 'Expérience',
    experienceValue: '{years} ans minimum',
  },
} as const;
