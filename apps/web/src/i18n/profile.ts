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
    organizationPickLabel: 'Organisation actuelle',
    organizationPickPlaceholder: 'Choisir dans la liste…',
    organizationPickHint:
      'Recherchez votre organisation dans la liste. Absente ? Saisissez son nom ci-dessous.',
    organizationLabel: 'Ou saisir le nom (si elle n’est pas répertoriée)',
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
    /**
     * Identité visuelle — révision de D-117 (14/08/2026).
     * Le dépôt de photo est OUVERT : ces libellés ne doivent plus annoncer
     * une indisponibilité. L'ancien message « pas encore ouvert » a été
     * retiré ici et l'écran porte désormais un vrai formulaire.
     */
    photoTitle: 'Identité visuelle',
    photoIntro:
      'Votre photo n’est visible que des membres connectés autorisés : le stockage est privé et l’image est servie par un lien signé qui expire. Elle n’est jamais publiée sur le site public — cela relève de « Ma vitrine publique », avec un consentement distinct.',
    photoCurrentTitle: 'Photo actuelle',
    photoCurrentHint: 'Déposer une nouvelle image remplacera celle-ci ; l’ancienne sera effacée.',
    photoCurrentAlt: 'Votre photo de profil actuelle',
    photoNoneTitle: 'Aucune photo pour l’instant',
    photoNoneHint: 'Vos initiales sont utilisées tant qu’aucune photo n’est déposée.',
    photoFileLabel: 'Fichier image',
    photoFileHint:
      'PNG, JPEG ou WebP, 2 Mo maximum. Un cadrage carré du visage (au moins 400 × 400 px) donne le meilleur rendu.',
    photoSubmit: 'Déposer ma photo',
    photoReplaceSubmit: 'Remplacer ma photo',
    photoSubmitPending: 'Dépôt en cours…',
    photoSaved: 'Votre photo de profil a été enregistrée.',
    photoRemove: 'Retirer ma photo',
    photoRemovePending: 'Retrait en cours…',
    photoRemoved: 'Votre photo de profil a été retirée.',
    photoInvalid: 'Ce fichier n’est pas une image exploitable. Choisissez un PNG, un JPEG ou un WebP.',
    photoWrongType: 'Ce format d’image n’est pas accepté ici. Choisissez un PNG, un JPEG ou un WebP.',
    photoTooLarge: 'Cette image dépasse 2 Mo. Choisissez un fichier plus léger.',
    photoUploadFailed: 'Le dépôt de la photo a échoué. Réessayez dans un instant.',
    photoVisibilityNote:
      'Qui voit votre photo se règle plus bas, avec la visibilité des autres informations.',
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
    organizationPickLabel: 'Organisation',
    organizationPickPlaceholder: 'Choisir dans la liste…',
    organizationPickHint:
      'Recherchez l’organisation dans la liste. Absente ? Saisissez son nom ci-dessous.',
    organizationLabel: 'Ou saisir le nom (si elle n’est pas répertoriée)',
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

  /** ISE-024 — Secteurs, fonctions & expertises. */
  positioning: {
    title: 'Secteurs, fonctions & expertises',
    subtitle:
      'Affinez votre positionnement pour que le réseau comprenne où, comment et sur quoi vous intervenez.',
    dimensionsTitle: 'Trois dimensions différentes',
    dimensionsBody:
      'Secteur = environnement d’activité · Fonction = rôle exercé · Expertise = savoir-faire mobilisable.',
    sectorsTitle: 'Secteurs d’activité',
    sectorsHint: 'Où intervenez-vous ?',
    functionsTitle: 'Fonctions exercées',
    functionsHint: 'Quel rôle jouez-vous ?',
    expertiseTitle: 'Domaines d’expertise',
    expertiseHint: 'Sur quoi peut-on vous solliciter ?',
    selectedCount: '{count} sélectionné(s)',
    addLabel: 'Ajouter',
    addSectorPlaceholder: 'Ajouter un secteur…',
    addFunctionPlaceholder: 'Ajouter une fonction…',
    addExpertisePlaceholder: 'Ajouter un domaine…',
    removeLabel: 'Retirer',
    primaryLegend: 'Secteur principal',
    primaryHint:
      'Le secteur principal est mis en avant sur votre profil et dans la recherche. Il doit faire partie de vos secteurs sélectionnés.',
    primaryBadge: 'Principal',
    noPrimary: 'Aucun secteur principal',
    searchImpactTitle: 'Impact sur la recherche',
    searchImpactBody:
      'Ces trois listes alimentent directement la recherche et les mises en relation : elles ne servent qu’à cela.',
    saved: 'Votre positionnement a été enregistré.',
  },

  /** ISE-025 — Mes projets & réalisations. */
  projects: {
    title: 'Mes projets & réalisations',
    subtitle:
      'Montrez les réalisations qui permettent au réseau de comprendre ce que vous avez réellement accompli.',
    add: 'Ajouter un projet',
    count: '{count} réalisation(s) renseignée(s)',
    emptyTitle: 'Aucun projet enregistré.',
    emptyBody:
      'Les projets donnent du contexte à vos compétences et montrent votre niveau d’intervention réel.',
    outcomeLabel: 'Résultat :',
    deleteConfirm: 'Supprimer ce projet ?',
    deleted: 'Le projet a été supprimé.',
    adviceTitle: 'Conseil',
    adviceBody:
      'Faites ressortir votre contribution personnelle et le résultat obtenu, pas seulement le nom du projet.',
    linkLabel: 'Voir le lien associé',
  },

  /** ISE-026 — Ajouter / modifier un projet. */
  projectForm: {
    addTitle: 'Ajouter un projet',
    editTitle: 'Modifier un projet',
    subtitle:
      'Présentez votre contribution personnelle et le résultat obtenu — pas seulement le nom du projet.',
    backLink: 'Retour aux projets',
    titleLabel: 'Nom du projet / réalisation',
    titlePlaceholder: 'Ex. Refonte du dispositif de suivi-évaluation régional',
    organizationLabel: 'Organisation / commanditaire',
    organizationPlaceholder: 'Ex. Programme régional',
    roleLabel: 'Votre rôle',
    rolePlaceholder: 'Ex. Pilotage méthodologique',
    startLabel: 'Début',
    endLabel: 'Fin',
    countryLabel: 'Pays / zone',
    sectorLabel: 'Secteur',
    sectorPlaceholder: 'Sélectionner un secteur',
    summaryLabel: 'Votre contribution',
    summaryPlaceholder:
      'Conception du cadre de résultats, harmonisation des indicateurs, coordination avec les équipes pays…',
    outcomeLabel: 'Résultat obtenu',
    outcomePlaceholder:
      'Ex. Reporting mensuel harmonisé dans 6 pays, avec une lecture commune des indicateurs.',
    linkLabel: 'Lien associé (facultatif)',
    linkPlaceholder: 'https://…',
    questionsTitle: 'Un bon projet répond à 3 questions',
    questions: [
      'Qu’avez-vous personnellement fait ?',
      'Dans quel contexte ?',
      'Quel résultat observable ?',
    ],
    usefulTitle: 'Pourquoi c’est utile',
    usefulBody:
      'Les projets donnent du contexte à vos compétences et permettent au réseau de comprendre votre niveau d’intervention réel.',
    usefulNoScore: 'Aucune note automatique.',
    notFoundTitle: 'Ce projet n’existe plus.',
    notFoundBody: 'Il a peut-être été supprimé. Revenez à la liste de vos projets.',
  },

  /** ISE-027 — Langues, zones d'expérience et outils. */
  languagesZones: {
    title: 'Langues & zones d’expérience',
    subtitle:
      'Indiquez les langues dans lesquelles vous pouvez travailler et les zones où vous avez une expérience réelle.',
    languagesTitle: 'Langues de travail',
    languagesHint: 'Déclarez votre niveau professionnel réel.',
    languagesCount: '{count} langue(s) renseignée(s)',
    addLanguagePlaceholder: 'Ajouter une langue…',
    proficiencyLabel: 'Niveau',
    proficiency: {
      basic: 'Notions',
      intermediate: 'Intermédiaire',
      professional: 'Professionnel',
      fluent: 'Courant',
      native: 'Langue maternelle',
    },
    zonesTitle: 'Zones d’expérience professionnelle',
    zonesHint: 'Pays où vous avez travaillé, conseillé ou piloté des projets.',
    zonesCount: '{count} zone(s) renseignée(s)',
    addZonePlaceholder: 'Ajouter un pays…',
    toolsTitle: 'Outils & logiciels',
    toolsHint:
      'Les outils que vous maîtrisez réellement. Ils affinent la recherche par expertise technique.',
    toolsCount: '{count} outil(s) renseigné(s)',
    addToolPlaceholder: 'Ajouter un outil…',
    toolLevel: {
      none: 'Non déclaré',
      notion: 'Notions',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
      expert: 'Expert',
    },
    realityTitle: 'Expérience réelle uniquement',
    realityBody:
      'Une mission courte peut justifier une zone ; un simple voyage ou une relation commerciale ne suffit pas. Ces données servent aux recherches géographiques et aux opportunités internationales.',
    usefulTitle: 'Utilité réseau',
    usefulItems: [
      'missions & consortiums',
      'introductions régionales',
      'recherche par pays / langue',
    ],
    saved: 'Langues, zones et outils ont été enregistrés.',
    removeLabel: 'Retirer',
  },

  /** ISE-028 — Mes recommandations. */
  recommendations: {
    title: 'Mes recommandations',
    subtitle:
      'Des témoignages contextualisés de membres qui ont réellement travaillé, collaboré ou échangé avec vous.',
    request: 'Demander une recommandation',
    receivedCount: '{count} recommandation(s) reçue(s)',
    filters: { all: 'Toutes', visible: 'Visibles', toValidate: 'À valider', hidden: 'Masquées' },
    filterLabel: 'Filtrer les recommandations',
    status: { published: 'Visible', draft: 'À valider', hidden: 'Masquée' },
    emptyTitle: 'Aucune recommandation reçue.',
    emptyBody:
      'Une recommandation repose sur une relation professionnelle réelle : demandez-en une à un membre avec qui vous avez travaillé.',
    emptyFilterTitle: 'Aucune recommandation dans ce filtre.',
    contextLabel: 'Contexte :',
    skillLabel: 'Compétence :',
    publish: 'Valider et afficher',
    hide: 'Masquer',
    unhide: 'Réafficher',
    published: 'La recommandation est maintenant visible.',
    hidden: 'La recommandation a été masquée.',
    moderationHint:
      'Vous contrôlez la visibilité des recommandations reçues. Vous ne pouvez jamais en modifier le texte.',
    qualityTitle: 'Règle de qualité',
    qualityBody:
      'Une recommandation doit reposer sur une relation professionnelle réelle et préciser son contexte. Jamais un simple like : pas de score ni de classement public.',
    receivedRequestsTitle: 'Demandes reçues',
    receivedRequestsEmpty: 'Aucune demande en attente de votre réponse.',
    sentRequestsTitle: 'Demandes envoyées',
    sentRequestsEmpty: 'Aucune demande envoyée.',
    requestStatus: {
      pending: 'En attente',
      accepted: 'Acceptée',
      declined: 'Déclinée',
      withdrawn: 'Retirée',
      expired: 'Expirée',
    },
    accept: 'Rédiger la recommandation',
    decline: 'Décliner',
    declined: 'La demande a été déclinée.',
    withdraw: 'Retirer la demande',
    withdrawn: 'La demande a été retirée.',
    acceptTitle: 'Rédiger une recommandation pour {name}',
    acceptBodyLabel: 'Votre témoignage (40 à 2 000 caractères)',
    acceptRelationshipLabel: 'Relation professionnelle',
    acceptRelationshipPlaceholder: 'Ex. Collaboration sur le projet régional 2024',
    acceptEngagementLabel: 'Mission ou contexte (facultatif)',
    acceptSent:
      'Votre recommandation a été transmise : elle sera visible après validation par son destinataire.',
    freeToRespond:
      'Le destinataire d’une demande reste libre : accepter et rédiger, décliner sans justification, ou ignorer. Aucune relance agressive.',
  },

  /** ISE-029 — Demander une recommandation. */
  recommendationRequest: {
    title: 'Demander une recommandation',
    subtitle:
      'Sollicitez une personne qui peut réellement témoigner de votre travail dans un contexte précis.',
    backLink: 'Retour aux recommandations',
    recipientLegend: 'À qui souhaitez-vous demander ?',
    recipientHint:
      'La liste propose vos relations acceptées : une recommandation repose sur une relation réelle.',
    recipientEmpty:
      'Vous n’avez pas encore de relation acceptée. Développez d’abord votre réseau : une recommandation vient d’une personne qui vous connaît.',
    searchLabel: 'Rechercher dans mes relations',
    searchPlaceholder: 'Rechercher un membre de votre réseau…',
    searchAction: 'Rechercher',
    contextLabel: 'Contexte de collaboration (facultatif)',
    contextPlaceholder: 'Ex. Projet régional · 2024',
    skillLabel: 'Compétence à recommander (facultatif)',
    skillPlaceholder: 'Sélectionner une compétence déclarée',
    relationshipLegend: 'Nature de la relation professionnelle',
    relationship: {
      project: 'Collaboration projet',
      mission: 'Mission / client',
      management: 'Management',
      other: 'Autre',
    },
    messageLabel: 'Message personnel',
    messagePlaceholder:
      'Bonjour, nous avons collaboré sur… Si tu es à l’aise avec cela, pourrais-tu partager une recommandation sur ma contribution ? Merci.',
    goodRequestTitle: 'Une bonne demande',
    goodRequestItems: [
      'vient d’une relation réelle',
      'rappelle le contexte',
      'vise une compétence précise',
      'laisse la personne libre de répondre',
    ],
    afterTitle: 'Après envoi',
    afterItems: ['accepter et rédiger', 'décliner sans justification', 'ignorer la demande'],
    afterNote: 'Pas de relance agressive.',
    targetedTitle: 'Demande ciblée',
    targetedBody:
      'Une seule personne recevra cette sollicitation. Aucun envoi groupé n’est effectué.',
    submit: 'Envoyer la demande',
    sent: 'Votre demande a été envoyée.',
  },

  /** ISE-030 — Complétion du profil. */
  completion: {
    title: 'Complétion du profil',
    subtitle:
      'Concentrez-vous sur les informations qui améliorent réellement votre visibilité et la qualité des mises en relation.',
    scoreValue: '{value} %',
    scoreCompleted: 'complété',
    scoreUnknown: 'Complétion indisponible pour le moment.',
    privacyNote: 'Ce score n’est pas public.',
    privacyBody:
      'Il sert uniquement à vous aider à prioriser les informations utiles. Il n’est jamais agrégé en classement ni affiché sur votre profil.',
    prioritiesTitle: 'Priorités recommandées',
    prioritiesEmpty: 'Toutes les sections mesurées sont complètes.',
    weightStrong: 'Fort',
    weightMedium: 'Moyen',
    weightLight: 'Utile',
    weightHint: 'Poids réel du bloc dans le calcul : {weight} / 100.',
    complete: 'Compléter',
    sectionsTitle: 'État des sections',
    sectionComplete: 'Complet',
    sectionPartial: 'À renforcer',
    improvesTitle: 'Ce que la complétion améliore',
    improvesItems: [
      'La précision des résultats « Trouver un ISE »',
      'La qualité de « Pourquoi ce profil ? »',
      'La pertinence des opportunités et introductions proposées',
    ],
    controlTitle: 'Vous gardez le contrôle',
    controlBody:
      'Les champs secondaires peuvent rester vides sans bloquer le profil. Pas de pression pour atteindre 100 %. La pertinence prime sur l’exhaustivité.',
    seeMissing: 'Voir les éléments manquants',
  },

  /** ISE-031 — Éléments manquants & suggestions. */
  missing: {
    title: 'Éléments manquants & suggestions',
    subtitle:
      'Priorisez uniquement les ajouts qui améliorent réellement la compréhension et la découvrabilité de votre profil.',
    summaryCount: '{count} suggestion(s) utile(s)',
    summaryNone: 'Aucune suggestion : toutes les sections mesurées sont complètes.',
    noBlocking: 'Aucun blocage pour votre profil',
    priorityTitle: 'À compléter en priorité',
    priorityBadge: 'Priorité {rank}',
    secondaryTitle: 'Peut attendre',
    secondaryHint:
      'Ces blocs comptent moins dans le calcul : complétez-les si vous le souhaitez, rien ne bloque sans eux.',
    progressLabel: 'Complété à {value} %',
    complete: 'Compléter',
    usableTitle: 'Votre profil est déjà utilisable',
    usableBody:
      'Compléter n’est pas une fin en soi. Les suggestions sont calculées selon l’utilité pour la recherche, les opportunités et les mises en relation. Objectif : pertinence, pas 100 %.',
    whyTitle: 'Pourquoi ces priorités ?',
    whyBody:
      'Les priorités suivent les pondérations réelles enregistrées en base (modifiables par l’équipe d’administration), jamais un classement entre membres.',
    afterTitle: 'Après complétion',
    afterBody:
      'Les suggestions traitées disparaissent de cette liste. Elles ne reviendront que si une information devient obsolète. Pas de relance répétitive inutile.',
  },

  /** ISE-032 — Ma disponibilité. */
  availability: {
    title: 'Ma disponibilité',
    subtitle:
      'Indiquez comment vous souhaitez contribuer au réseau et dans quelles conditions vous pouvez être sollicité.',
    edit: 'Modifier ma disponibilité',
    availableBadge: 'Disponible',
    unavailableBadge: 'Non disponible',
    summaryActive: '{count} forme(s) d’aide active(s) sur {total}',
    summaryNone: 'Aucune forme d’aide activée pour le moment.',
    updatedAt: 'Mise à jour le {date}',
    staleHint: 'À actualiser prochainement',
    typesTitle: 'Comment je peux aider le réseau',
    active: 'Actif',
    inactive: 'Inactif',
    notDeclared: 'Non déclaré',
    preferencesTitle: 'Préférences de sollicitation',
    channelLabel: 'Canal',
    channel: {
      message: 'Message sur la plateforme',
      email: 'E-mail',
      call: 'Appel',
      video: 'Visio',
    },
    delayLabel: 'Délai idéal',
    delayValue: '{count} jour(s)',
    frequencyLabel: 'Fréquence max.',
    frequencyValue: '{count} sollicitation(s) / mois',
    visibilityLabel: 'Visibilité',
    mixedValues: 'Valeurs différentes selon la forme d’aide',
    notProvided: 'Non renseigné',
    noteTitle: 'Note',
    obligationTitle: 'Rappel utile',
    obligationBody:
      'Votre disponibilité n’est jamais une obligation d’accepter. Vous gardez le dernier mot sur chaque sollicitation.',
    obligationReminder: 'Pensez à l’actualiser régulièrement.',
    visibleTitle: 'Visible pour le réseau',
    visibleBody: 'Sans afficher votre agenda détaillé.',
    emptyTitle: 'Aucune disponibilité déclarée.',
    emptyBody:
      'Déclarez les formes d’aide que vous acceptez pour que le réseau sache comment vous solliciter — sans jamais vous engager à accepter.',
  },

  /** ISE-033 — Modifier ma disponibilité. */
  availabilityForm: {
    title: 'Modifier ma disponibilité',
    subtitle:
      'Ajustez les sollicitations que vous souhaitez recevoir et les conditions dans lesquelles vous pouvez aider.',
    backLink: 'Retour à ma disponibilité',
    typesLegend: 'Comment pouvez-vous aider ?',
    typesHint:
      'Les {count} formes d’aide proviennent du référentiel de la plateforme : activez celles qui vous correspondent.',
    preferencesTitle: 'Préférences de sollicitation',
    preferencesHint: 'Ces préférences s’appliquent à toutes les formes d’aide actives.',
    frequencyLabel: 'Fréquence max. (sollicitations / mois)',
    delayLabel: 'Délai idéal (jours)',
    channelLabel: 'Canal préféré',
    channelPlaceholder: 'Sélectionner un canal',
    noteLabel: 'Note facultative',
    notePlaceholder: 'Ex. Disponibilité variable selon les périodes de mission.',
    visibilityLabel: 'Qui peut voir ma disponibilité ?',
    publicTitle: 'Ce qui est visible',
    publicItems: [
      'les formes d’aide acceptées',
      'vos préférences de sollicitation',
      'votre note éventuelle',
    ],
    publicPrivate: 'Votre agenda détaillé reste privé.',
    lastWordTitle: 'Vous gardez le dernier mot',
    lastWordBody:
      'Être « disponible » ne signifie jamais que vous acceptez automatiquement une mission, une introduction ou un échange. Chaque sollicitation reste à valider.',
    saved: 'Votre disponibilité a été enregistrée.',
  },
} as const;
