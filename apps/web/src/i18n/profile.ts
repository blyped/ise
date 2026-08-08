/**
 * Chaines du profil membre ISE-016 -> ISE-023.
 * Fichier distinct de `src/i18n/fr.ts` (lots parallèles).
 */
export const frProfile = {
  common: {
    save: 'Enregistrer',
    savePending: 'Enregistrement…',
    cancel: 'Annuler',
    edit: 'Modifier',
    add: 'Ajouter',
    remove: 'Supprimer',
    removePending: 'Suppression…',
    back: 'Retour',
    saved: 'Vos modifications ont été enregistrées.',
    notProvided: 'Non renseigné',
    loadErrorTitle: 'Impossible de charger cette section.',
    loadErrorBody: 'Le reste de la page reste utilisable. Réessayez dans un instant.',
    saveErrorTitle: 'L’enregistrement a échoué.',
    visibilityLabel: 'Qui peut voir cet élément ?',
    visibilityHint:
      'Ce choix est appliqué par la base de données, pas seulement par l’affichage : un membre non autorisé ne reçoit jamais la donnée.',
    counter: '{current} / {max}',
    onboardingPendingTitle: 'Votre inscription n’est pas terminée.',
    onboardingPendingBody:
      'Quelques étapes suffisent pour que votre profil devienne utile au réseau.',
    onboardingPendingAction: 'Terminer mon inscription',
  },

  visibility: {
    private: 'Moi uniquement',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    members: 'Tous les membres',
    privateHint: 'Personne d’autre que vous ne voit cet élément.',
    connectionsHint: 'Seules vos relations acceptées le voient.',
    promotionHint: 'Seuls les membres de votre promotion le voient.',
    membersHint: 'Tous les membres authentifiés le voient. Jamais le web public.',
  },

  /** ISE-016 — Mon profil. */
  overview: {
    title: 'Mon profil',
    subtitle: 'Voici ce que le réseau voit de vous — et ce que vous pouvez encore enrichir.',
    editHeader: 'Modifier mon profil',
    aboutTitle: 'À propos',
    aboutEmpty: 'Vous n’avez pas encore rédigé de présentation.',
    experienceTitle: 'Expérience récente',
    experienceAll: 'Tout voir',
    experienceEmpty: 'Aucune expérience enregistrée.',
    educationTitle: 'Formations',
    educationAll: 'Tout voir',
    educationEmpty: 'Aucune formation enregistrée.',
    skillsTitle: 'Expertises principales',
    skillsManage: 'Gérer',
    skillsEmpty: 'Aucune compétence déclarée.',
    skillsCount: '{count} expertise(s) renseignée(s)',
    completionTitle: 'Complétion du profil',
    completionValue: '{value} % complété',
    completionUnknown: 'Complétion indisponible pour le moment.',
    completionHint: 'Calculée à partir des informations réellement enregistrées.',
    missingTitle: 'Ce qui reste à compléter',
    missingEmpty: 'Toutes les sections mesurées sont complètes.',
    availabilityTitle: 'Ma disponibilité',
    availabilityEmpty: 'Aucune disponibilité déclarée.',
    sectorsTitle: 'Secteurs',
    sectorsEmpty: 'Aucun secteur déclaré.',
    promotionTitle: 'Promotion',
    promotionUnknown: 'Promotion non renseignée',
    verified: 'Identité vérifiée',
    unverified: 'Identité non vérifiée',
    noProfileTitle: 'Votre compte n’est pas encore rattaché à un profil ISE.',
    noProfileBody: 'Recherchez votre profil dans l’annuaire pour l’associer à votre compte.',
    noProfileAction: 'Réclamer mon profil',
  },

  /** ISE-017 — Modifier l'en-tête et À propos. */
  header: {
    title: 'Modifier l’en-tête & À propos',
    subtitle: 'Ces éléments sont les premiers vus lorsqu’un membre ouvre votre profil.',
    identityTitle: 'Identité',
    firstNameLabel: 'Prénom',
    lastNameLabel: 'Nom',
    headlineTitle: 'En-tête professionnel',
    headlineLabel: 'Titre professionnel',
    headlinePlaceholder: 'Ex. Ingénieure Statisticienne Économiste · Suivi-évaluation',
    organizationLabel: 'Organisation actuelle',
    organizationPlaceholder: 'Ex. Banque Atlantique',
    positionLabel: 'Fonction actuelle',
    positionPlaceholder: 'Ex. Responsable études & performance',
    locationTitle: 'Localisation',
    countryLabel: 'Pays',
    countryPlaceholder: 'Sélectionner un pays',
    cityLabel: 'Ville',
    cityPlaceholder: 'Ex. Abidjan',
    linksTitle: 'Liens',
    linkedinLabel: 'Profil LinkedIn',
    websiteLabel: 'Site web personnel',
    aboutTitle: 'À propos',
    aboutLabel: 'Présentation',
    aboutPlaceholder:
      'Précisez ce que vous savez faire et dans quels contextes vous êtes utile au réseau.',
    visibilityTitle: 'Visibilité de ces informations',
    visibilityHint:
      'Chaque champ porte sa propre visibilité (4 niveaux). Le choix est enregistré et appliqué par la base.',
    photoTitle: 'Identité visuelle',
    photoUnavailable:
      'Le dépôt de photo n’est pas encore ouvert : aucun écran d’envoi de fichier n’est livré à ce jour. Vos initiales sont utilisées en attendant.',
  },

  /** ISE-018 — Mes expériences. */
  experiences: {
    title: 'Mes expériences',
    subtitle:
      'Présentez votre parcours de façon structurée pour aider le réseau à comprendre votre expérience réelle.',
    add: 'Ajouter une expérience',
    count: '{count} expérience(s) renseignée(s)',
    current: 'Aujourd’hui',
    emptyTitle: 'Aucune expérience enregistrée.',
    emptyBody:
      'Ajoutez vos postes pour que le réseau comprenne votre rôle et votre niveau d’intervention.',
    deleteConfirm: 'Supprimer cette expérience ?',
    deleted: 'L’expérience a été supprimée.',
  },

  /** ISE-019 — Ajouter / modifier une expérience. */
  experienceForm: {
    addTitle: 'Ajouter une expérience',
    editTitle: 'Modifier une expérience',
    subtitle:
      'Décrivez une expérience suffisamment précise pour qu’un autre ISE comprenne votre rôle et votre niveau d’intervention.',
    backLink: 'Retour aux expériences',
    organizationLabel: 'Organisation',
    organizationPlaceholder: 'Ex. Banque Atlantique',
    positionLabel: 'Poste / fonction',
    positionPlaceholder: 'Ex. Responsable études & performance',
    startLabel: 'Date de début',
    endLabel: 'Date de fin',
    currentLabel: 'J’occupe actuellement ce poste',
    countryLabel: 'Pays',
    cityLabel: 'Ville',
    sectorLabel: 'Secteur',
    sectorPlaceholder: 'Sélectionner un secteur',
    functionLabel: 'Fonction',
    functionPlaceholder: 'Sélectionner une fonction',
    descriptionLabel: 'Responsabilités principales',
    descriptionPlaceholder:
      'Pilotage des études, production d’analyses, structuration du reporting…',
    notFoundTitle: 'Cette expérience n’existe plus.',
    notFoundBody: 'Elle a peut-être été supprimée. Revenez à la liste de vos expériences.',
  },

  /** ISE-020 — Mes formations. */
  educations: {
    title: 'Mes formations',
    subtitle:
      'Ajoutez les diplômes et certifications qui renforcent la crédibilité de votre expertise.',
    add: 'Ajouter une formation',
    count: '{count} formation(s) renseignée(s)',
    emptyTitle: 'Aucune formation enregistrée.',
    emptyBody: 'Ajoutez au moins votre diplôme ISE pour compléter votre profil.',
    deleteConfirm: 'Supprimer cette formation ?',
    deleted: 'La formation a été supprimée.',
    typeAcademic: 'Diplôme académique',
    typeCertification: 'Certification professionnelle',
  },

  /** ISE-021 — Ajouter / modifier une formation. */
  educationForm: {
    addTitle: 'Ajouter une formation',
    editTitle: 'Modifier une formation',
    subtitle:
      'Ajoutez un diplôme ou une certification qui renforce la crédibilité de votre expertise.',
    backLink: 'Retour aux formations',
    typeLegend: 'Type de formation',
    degreeLabel: 'Intitulé du diplôme / certification',
    degreePlaceholder: 'Ex. Diplôme d’Ingénieur Statisticien Économiste',
    institutionLabel: 'Établissement / organisme',
    institutionPlaceholder: 'Ex. ENSEA',
    fieldLabel: 'Domaine',
    fieldPlaceholder: 'Ex. Statistique & économie',
    startYearLabel: 'Année de début',
    endYearLabel: 'Année d’obtention',
    countryLabel: 'Pays',
    cityLabel: 'Ville',
    credentialLabel: 'Justificatif ou lien de vérification',
    credentialPlaceholder: 'https://… ou identifiant du certificat',
    descriptionLabel: 'Description facultative',
    verificationTitle: 'Vérification',
    verificationBody:
      'Les justificatifs sont facultatifs. Ils peuvent renforcer la confiance sans rendre le profil inaccessible. Aucune validation automatique n’en est déduite.',
    notFoundTitle: 'Cette formation n’existe plus.',
    notFoundBody: 'Elle a peut-être été supprimée. Revenez à la liste de vos formations.',
  },

  /** ISE-022 — Mes compétences. */
  skills: {
    title: 'Mes compétences',
    subtitle:
      'Structurez les expertises sur lesquelles le réseau peut réellement vous identifier et vous solliciter.',
    add: 'Ajouter une compétence',
    count: '{count} compétence(s) active(s)',
    primaryCount: '{count} principale(s)',
    primaryBadge: 'Compétence principale',
    primaryTitle: 'Compétences principales',
    otherTitle: 'Autres compétences',
    yearsLabel: '{count} an(s) d’expérience',
    manage: 'Modifier',
    emptyTitle: 'Aucune compétence déclarée.',
    emptyBody:
      'Vos compétences alimentent la recherche et les recommandations : sans elles, le réseau ne peut pas vous identifier.',
    declarativeTitle: 'Le niveau déclaré n’est pas un badge automatique.',
    declarativeBody:
      'Expériences, projets et recommandations apportent du contexte. Aucune promotion automatique en « validé » ou « certifié » n’a lieu.',
    visibilityTitle: 'Visibilité de mes compétences',
  },

  /** ISE-023 — Gérer une compétence. */
  skillForm: {
    addTitle: 'Ajouter une compétence',
    editTitle: 'Gérer une compétence',
    subtitle: 'Décrivez votre niveau réel et le contexte qui donne du sens à cette expertise.',
    backLink: 'Retour aux compétences',
    skillLabel: 'Compétence',
    searchLabel: 'Rechercher une compétence',
    searchPlaceholder: 'Ex. Économétrie, suivi-évaluation, Python…',
    levelLegend: 'Niveau déclaré',
    levelHint:
      'Repère, pas verdict : le niveau déclaré ne remplace ni les expériences, ni les projets, ni les recommandations.',
    level: {
      notion: 'Débutant',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
      expert: 'Expert',
      none: 'Non déclaré',
    },
    yearsLabel: 'Années d’expérience',
    primaryLabel: 'Compétence principale',
    primaryHint: 'Les compétences principales sont mises en avant sur votre profil.',
    contextLabel: 'Contexte d’utilisation',
    contextPlaceholder:
      'Conception de cadres de résultats, indicateurs, dispositifs de collecte, évaluations…',
    declarativeTitle: 'Niveau : repère, pas verdict.',
    declarativeBody:
      'Le niveau déclaré sert à orienter la recherche. Aucune validation ni certification n’en découle (D-75).',
    evidenceTitle: 'Preuves associées',
    evidenceExperiences: 'Expériences',
    evidenceLinked: '{count} liée(s)',
    evidenceNote:
      'Le décompte porte sur vos expériences dont le secteur ou l’intitulé mentionne cette compétence. Aucun lien n’est inventé.',
    notFoundTitle: 'Cette compétence n’est pas déclarée sur votre profil.',
    notFoundBody: 'Ajoutez-la depuis la liste de vos compétences.',
    alreadyTitle: 'Cette compétence figure déjà dans votre profil.',
    delete: 'Supprimer la compétence',
    deleted: 'La compétence a été retirée de votre profil.',
  },
} as const;
