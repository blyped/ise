/**
 * Chaines de l'onboarding ISE-008 -> ISE-014.
 *
 * Fichier distinct de `src/i18n/fr.ts` : les deux lots avancent en
 * parallele. Meme convention de nommage (arborescence des ecrans, jamais
 * la couleur ni la position), meme fonction de substitution `{cle}`.
 */
export const frOnboarding = {
  shell: {
    kicker: 'Onboarding membre',
    stepCounter: 'Étape {current} sur {total}',
    progressLabel: 'Progression de l’onboarding',
    stepsLabel: 'Étapes de l’onboarding',
    stepDone: 'Terminée',
    stepCurrent: 'Étape en cours',
    stepLocked: 'Étape à venir',
    savedNotice: 'Votre progression est enregistrée à chaque étape.',
    savedHint:
      'Vous pouvez fermer cet onglet : vous reprendrez exactement là où vous vous êtes arrêté.',
    back: 'Retour',
    skip: 'Passer cette étape',
    loadErrorTitle: 'Impossible de charger cette étape.',
    loadErrorBody: 'Vos saisies précédentes sont conservées. Réessayez dans un instant.',
    saveErrorTitle: 'Votre saisie n’a pas pu être enregistrée.',
  },

  steps: {
    verification: 'Vérification',
    promotion: 'Promotion',
    competences: 'Compétences',
    secteurs: 'Secteurs',
    localisation: 'Localisation',
    disponibilite: 'Disponibilité',
    finalisation: 'Finalisation',
  },

  /** Étape 1 — Vérification (D-03 : aucun code n'est renvoyé). */
  verification: {
    panelTitle: 'Votre identité ISE',
    panelBody:
      'Avant de construire votre profil, vérifions ensemble ce que la base connaît déjà de vous.',
    title: 'Vérifions vos informations',
    subtitle:
      'Ces éléments proviennent de votre compte et de l’annuaire ISE. Rien n’est deviné, rien n’est inventé.',
    accountEmailLabel: 'Adresse e-mail du compte',
    accountConfirmed: 'Adresse confirmée',
    accountNotConfirmed: 'Adresse non confirmée',
    profileLabel: 'Profil ISE associé',
    promotionLabel: 'Promotion enregistrée',
    promotionUnknown: 'Aucune promotion enregistrée — vous la choisirez à l’étape suivante.',
    verificationLabel: 'Vérification d’identité',
    noCodeTitle: 'Aucun code ne vous sera envoyé.',
    noCodeBody:
      'Votre adresse a déjà été confirmée à la création du compte, et l’association de votre profil a été vérifiée lors de la réclamation. Vous redemander un code vérifierait une seconde fois la même chose.',
    acknowledge: 'Je confirme que ces informations sont bien les miennes.',
    submit: 'Commencer',
    submitPending: 'Enregistrement…',
  },

  /** Étape 2 — Promotion (ISE-008). */
  promotion: {
    panelTitle: 'Votre identité ISE',
    panelBody:
      'Votre promotion vous rattache à votre génération et permet de retrouver vos camarades.',
    title: 'Confirmez votre promotion ISE',
    subtitle:
      'Cette information vous rattache à votre génération et vous permet de retrouver vos camarades.',
    noteTitle: 'Promotion',
    noteBody: 'Année de sortie / cohorte ISE.',
    label: 'Quelle est votre promotion ?',
    placeholder: 'Sélectionner une promotion',
    hint: 'Liste issue du référentiel des promotions ISE.',
    currentLabel: 'Promotion déjà enregistrée sur votre profil',
    missingLead: 'Vous ne trouvez pas votre promotion ?',
    missingLink: 'Signaler une promotion manquante',
    confirmTitle: 'Une fois confirmée, votre promotion apparaîtra sur votre profil.',
    confirmBody:
      'Elle pourra aussi être vérifiée par un responsable de promotion ou un administrateur.',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    emptyTitle: 'Aucune promotion n’est disponible.',
    emptyBody:
      'Le référentiel des promotions est vide ou n’a pas pu être lu. Signalez-le à l’assistance en indiquant la référence ci-dessous.',
  },

  /** ISE-009 — Signaler une promotion absente. */
  missingPromotion: {
    title: 'Votre promotion n’apparaît pas ?',
    subtitle:
      'Signalez-la en quelques secondes. Vous pourrez ensuite poursuivre votre onboarding normalement.',
    noBlockTitle: 'Aucun blocage',
    noBlockBody:
      'Votre signalement sera examiné plus tard. Il n’empêche pas l’activation de votre profil.',
    labelField: 'Année ou libellé de promotion',
    labelPlaceholder: 'Ex. ISE 2006',
    institutionField: 'Établissement / centre de formation',
    institutionPlaceholder: 'Ex. ENSEA Abidjan',
    countryField: 'Pays',
    countryPlaceholder: 'Sélectionner un pays',
    yearField: 'Année de sortie approximative',
    yearPlaceholder: 'Ex. 2006',
    commentField: 'Commentaire facultatif',
    commentPlaceholder:
      'Précisez si nécessaire l’intitulé, une ancienne appellation ou toute information utile.',
    qualifyTitle: 'Vos informations servent uniquement à qualifier la promotion.',
    qualifyBody: 'Aucun nouveau profil ni nouvelle promotion n’est créé automatiquement.',
    submit: 'Envoyer le signalement',
    submitPending: 'Envoi en cours…',
    skip: 'Ignorer pour l’instant',
    backLink: 'Retour à la promotion',
    sentTitle: 'Signalement enregistré.',
    sentBody:
      'Une personne habilitée l’examinera. Vous n’avez rien d’autre à faire : poursuivez votre onboarding.',
    duplicateTitle: 'Vous avez déjà signalé cette promotion.',
    duplicateBody: 'Un seul signalement suffit ; il est déjà en attente de revue.',
    mineTitle: 'Vos signalements',
    statusLabel: 'État',
    status: {
      submitted: 'En attente de revue',
      under_review: 'En cours d’examen',
      accepted: 'Acceptée',
      rejected: 'Non retenue',
      duplicate: 'Doublon',
    },
  },

  /** Étape 3 — Compétences (ISE-010). */
  skills: {
    panelTitle: 'Votre expertise',
    panelBody:
      'Les compétences déclarées sont ce qui permet au réseau de vous identifier et de vous solliciter à bon escient.',
    title: 'Quelles sont vos principales compétences ?',
    subtitle:
      'Choisissez jusqu’à {max} expertises qui représentent le mieux ce que vous savez réellement faire aujourd’hui.',
    searchLabel: 'Rechercher une compétence',
    searchPlaceholder: 'Ex. Économétrie, suivi-évaluation, Python, finance…',
    searchHint:
      'La recherche accepte les abréviations connues du référentiel (par exemple « M&E » ou « S&E »).',
    selectedLabel: 'Sélectionnées',
    counter: '{count} / {max}',
    limitReached: 'Vous avez atteint {max} compétences. Retirez-en une pour en ajouter une autre.',
    browseTitle: 'Le référentiel, par domaine',
    browseHint:
      'Toutes les compétences proviennent du référentiel ISE : aucune liste n’est saisie à la main.',
    resultsTitle: 'Résultats',
    add: 'Ajouter',
    remove: 'Retirer',
    aliasHint: 'Trouvée par l’abréviation « {alias} »',
    declarativeTitle: 'Le niveau est déclaratif.',
    declarativeBody:
      'Vous préciserez votre niveau après l’onboarding, sur l’écran « Mes compétences ». Aucun niveau n’est déduit ni validé automatiquement.',
    emptyTitle: 'Aucune compétence ne correspond à cette recherche.',
    emptyBody:
      'Essayez un terme plus court, ou parcourez le référentiel par domaine ci-dessous. Le référentiel évolue par le back-office.',
    submit: 'Continuer vers les secteurs',
    submitPending: 'Enregistrement…',
    required: 'Choisissez au moins une compétence.',
  },

  /** Étape 4 — Secteurs (ISE-011). */
  sectors: {
    panelTitle: 'Votre expérience',
    panelBody:
      'Les secteurs servent à trouver les bonnes expertises et à proposer des mises en relation plus pertinentes.',
    title: 'Dans quels secteurs intervenez-vous ?',
    subtitle: 'Choisissez jusqu’à {max} secteurs principaux. Vous pourrez les modifier plus tard.',
    adviceTitle: 'Conseil',
    adviceBody:
      'Privilégiez les secteurs où votre expérience peut réellement être utile à un autre membre du réseau.',
    searchLabel: 'Rechercher un secteur',
    searchPlaceholder: 'Ex. Banque, agriculture, santé, énergie…',
    selectedLabel: 'Sélectionnés',
    counter: '{count} / {max}',
    listTitle: 'Tous les secteurs',
    listHint: 'Les 35 secteurs proviennent du référentiel : aucune liste n’est codée en dur.',
    noAutoTitle: 'Ces secteurs améliorent vos résultats de recherche et vos recommandations.',
    noAutoBody:
      'Ils ne seront jamais utilisés pour vous attribuer automatiquement une expertise que vous n’avez pas déclarée.',
    submit: 'Continuer vers la localisation',
    submitPending: 'Enregistrement…',
    emptyTitle: 'Aucun secteur ne correspond à cette recherche.',
    emptyBody: 'Effacez la recherche pour parcourir la totalité du référentiel.',
  },

  /** Étape 5 — Localisation (ISE-012). */
  location: {
    panelTitle: 'Votre présence',
    panelBody:
      'Votre localisation aide le réseau à identifier les membres proches et les expériences géographiques pertinentes.',
    title: 'Où êtes-vous basé actuellement ?',
    subtitle: 'Indiquez votre localisation principale et, si utile, vos zones d’expérience.',
    currentTitle: 'Localisation actuelle',
    currentHint: 'Utilisée pour les recherches géographiques et les rencontres de proximité.',
    countryLabel: 'Pays',
    countryPlaceholder: 'Sélectionner un pays',
    cityLabel: 'Ville',
    cityPlaceholder: 'Ex. Abidjan',
    zonesTitle: 'Zones d’expérience professionnelle',
    zonesHint:
      'Ajoutez les pays dans lesquels vous avez travaillé, conseillé ou conduit des missions.',
    zonesSearchLabel: 'Ajouter un pays',
    zonesSearchPlaceholder: 'Rechercher un pays…',
    zonesSelected: 'Pays sélectionnés',
    zonesEmpty: 'Aucun pays d’expérience déclaré pour l’instant.',
    privacyTitle: 'Visibilité maîtrisée',
    privacyBody:
      'Votre localisation détaillée n’est jamais publiée comme une adresse personnelle. Seuls le pays, la ville et les zones professionnelles choisies peuvent être visibles.',
    cityVisibilityLabel: 'Qui peut voir ma ville ?',
    cityVisibilityHint:
      'Ce choix est enregistré sur votre profil et s’applique réellement aux autres membres.',
    submit: 'Continuer vers la disponibilité',
    submitPending: 'Enregistrement…',
  },

  /** Étape 6 — Disponibilité (ISE-013). */
  availability: {
    panelTitle: 'Votre disponibilité',
    panelBody:
      'Le réseau devient utile quand chacun peut dire clairement comment il peut aider — ou être sollicité.',
    title: 'Comment pouvez-vous aider le réseau ?',
    subtitle:
      'Choisissez vos formes de disponibilité actuelles. Vous pourrez les modifier à tout moment.',
    calloutTitle: 'Disponible pour aider',
    calloutBody:
      'Cette information aide les autres membres à vous solliciter de façon plus pertinente.',
    typesLabel: 'Formes de disponibilité',
    intensityLabel: 'Niveau de disponibilité',
    intensity: {
      low: 'Faible',
      lowHint: 'Quelques sollicitations',
      moderate: 'Modérée',
      moderateHint: 'Disponible régulièrement',
      high: 'Élevée',
      highHint: 'Ouvert à plusieurs demandes',
    },
    visibilityLabel: 'Qui peut voir ma disponibilité ?',
    noObligationTitle: 'Votre disponibilité est indicative, jamais une obligation d’accepter.',
    noObligationBody: 'Chaque sollicitation reste sous votre contrôle.',
    submit: 'Continuer vers la finalisation',
    submitPending: 'Enregistrement…',
    emptyTitle: 'Aucun type de disponibilité n’est disponible.',
    emptyBody: 'Le référentiel n’a pas pu être lu. Réessayez dans un instant.',
    selectedCount: '{count} forme(s) sélectionnée(s)',
  },

  /** Étape 7 — Finalisation (ISE-014). */
  finalize: {
    panelTitle: 'Prêt à rejoindre le réseau',
    panelBody:
      'Une dernière vérification et votre profil pourra commencer à être utile aux autres membres.',
    afterTitle: 'Après activation',
    afterBody:
      'Vous pourrez enrichir votre profil, modifier votre disponibilité et gérer votre visibilité à tout moment.',
    title: 'Finalisez votre profil',
    subtitle:
      'Vérifiez les informations essentielles avant d’activer votre présence dans Compétences ISE.',
    summaryTitle: 'Résumé de votre profil',
    promotionLabel: 'Promotion',
    skillsLabel: 'Compétences',
    sectorsLabel: 'Secteurs',
    locationLabel: 'Localisation',
    availabilityLabel: 'Disponibilité',
    completionLabel: 'Complétion du profil',
    completionValue: '{value} % complété',
    completionUnknown: 'Complétion indisponible pour le moment.',
    missingTitle: 'Ce qui manque encore',
    missingHint:
      'Ces éléments ne bloquent pas l’activation : vous pourrez les compléter depuis votre profil.',
    nothingYet: 'Non renseigné',
    countLabel: '{count} enregistré(s)',
    edit: 'Modifier',
    confirm:
      'Je confirme que les informations saisies décrivent fidèlement mon profil professionnel.',
    submit: 'Activer mon profil',
    submitPending: 'Activation en cours…',
    promotionRequiredTitle: 'Votre promotion n’est pas encore enregistrée.',
    promotionRequiredBody:
      'C’est la seule information indispensable : elle rattache votre profil à votre génération.',
    promotionRequiredAction: 'Choisir ma promotion',
  },

  visibility: {
    private: 'Moi uniquement',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    members: 'Tous les membres',
  },
} as const;
