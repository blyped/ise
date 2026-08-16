/**
 * Libelles francais des ecrans de gestion de profil ISE-017 -> ISE-033
 * (coquilles mobile).
 *
 * Fichier dedie, distinct de `./fr.ts` (qui reste proprietaire de la
 * premiere tranche mobile ISE-001/015/016/040/055 et de la navigation
 * D-94) : les deux lots sont developpes en parallele et ne doivent pas se
 * disputer le meme fichier. Les libelles reprennent, quand ils existent,
 * les memes formulations que `apps/web/src/i18n/profile.ts`, pour que
 * l'ecran web et l'ecran mobile parlent le meme francais (MASTER PROMPT
 * §66).
 */
export const profileManagement = {
  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    add: 'Ajouter',
    edit: 'Modifier',
    loading: 'Chargement…',
    retry: 'Réessayer',
    saved: 'Modifications enregistrées.',
    deleted: 'Élément supprimé.',
    errorTitle: "Une erreur est survenue.",
    visibilityLabel: 'Visibilité',
    visibility: {
      private: 'Privé',
      connections: 'Mes relations',
      promotion: 'Ma promotion',
      members: 'Tous les membres',
    },
  },

  hub: {
    title: 'Modifier mon profil',
    subtitle: 'Gérez les informations visibles de votre profil ISE.',
    sections: {
      header: { title: 'En-tête & À propos', hint: 'Titre, organisation, présentation.' },
      experiences: { title: 'Expériences', hint: 'Votre parcours professionnel.' },
      educations: { title: 'Formations & certifications', hint: 'Diplômes et certifications.' },
      skills: { title: 'Compétences', hint: 'Vos compétences déclarées.' },
      positioning: { title: 'Secteurs, fonctions & expertises', hint: 'Votre positionnement.' },
      projects: { title: 'Projets & réalisations', hint: 'Vos contributions concrètes.' },
      languagesZones: { title: 'Langues & zones d’expérience', hint: 'Langues, pays, outils.' },
      recommendations: { title: 'Recommandations', hint: 'Reçues et demandées.' },
      completion: { title: 'Complétion du profil', hint: 'Votre score, privé.' },
      availability: { title: 'Ma disponibilité', hint: 'Comment vous aidez le réseau.' },
    },
  },

  header: {
    title: 'En-tête & À propos',
    heading: 'En-tête & À propos',
    subtitle: 'Les éléments les plus visibles de votre profil.',
    firstNameLabel: 'Prénom',
    lastNameLabel: 'Nom',
    headlineLabel: 'Titre professionnel',
    organizationLabel: 'Organisation actuelle',
    positionLabel: 'Fonction',
    countryLabel: 'Pays',
    cityLabel: 'Ville',
    bioLabel: 'À propos',
    linkedinLabel: 'LinkedIn',
    websiteLabel: 'Site web',
    hint: 'Décrivez surtout ce que vous savez faire et où vous êtes utile.',
    errorTitle: 'Impossible de charger votre en-tête.',

    /**
     * Photo de profil — révision de D-117 (14/08/2026).
     *
     * Le dépôt est désormais OUVERT sur mobile (`expo-image-picker`) : ces
     * libellés ne doivent plus renvoyer le membre vers le site web. Ils
     * reprennent les formulations de `apps/web/src/i18n/profile.ts`, pour que
     * l'écran web et l'écran mobile parlent le même français (MASTER PROMPT
     * §66), en n'ajoutant que ce qui n'a pas d'équivalent sur le web : les
     * autorisations système de l'appareil photo et de la galerie.
     */
    photo: {
      title: 'Photo de profil',
      currentNotice: 'Cette photo n’est visible que des membres autorisés.',
      noneNotice: 'Vos initiales sont utilisées tant qu’aucune photo n’est déposée.',
      formatsHint:
        'PNG, JPEG ou WebP, 5 Mo maximum. Un cadrage carré du visage donne le meilleur rendu.',
      replaceHint: 'Déposer une nouvelle photo remplacera celle-ci ; l’ancienne sera effacée.',
      cameraAction: 'Prendre une photo',
      libraryAction: 'Choisir dans la galerie',
      uploadPending: 'Dépôt en cours…',
      uploadSucceeded: 'Votre photo de profil a été enregistrée.',
      removeAction: 'Retirer ma photo',
      removePending: 'Retrait en cours…',
      removeConfirm: 'Votre photo sera effacée. Vos initiales reprendront sa place.',
      removeFailed: 'Le retrait de la photo a échoué. Réessayez dans un instant.',
      visibilityNote:
        'Qui voit votre photo se règle plus bas, avec la visibilité des autres informations.',

      /** Autorisations système, demandées à l'usage et jamais au démarrage. */
      permissionTitle: 'Autorisation nécessaire',
      cameraDenied:
        'L’accès à l’appareil photo est refusé. Autorisez-le dans les réglages du téléphone, ou choisissez plutôt une image dans votre galerie.',
      libraryDenied:
        'L’accès à vos photos est refusé. Autorisez-le dans les réglages du téléphone, ou prenez plutôt une photo avec l’appareil.',
      openSettings: 'Ouvrir les réglages',

      /** Refus du dépôt : mêmes motifs, mêmes phrases que sur le web. */
      errors: {
        unreadable:
          'Ce fichier n’est pas une image exploitable. Choisissez un PNG, un JPEG ou un WebP.',
        wrong_type:
          'Ce format d’image n’est pas accepté ici. Choisissez un PNG, un JPEG ou un WebP.',
        too_large: 'Cette image dépasse 5 Mo. Choisissez un fichier plus léger.',
        upload_failed: 'Le dépôt de la photo a échoué. Réessayez dans un instant.',
        save_failed: 'Le dépôt de la photo a échoué. Réessayez dans un instant.',
      },
    },
  },

  experiences: {
    title: 'Mes expériences',
    heading: 'Mon parcours',
    addAction: '+ Ajouter une expérience',
    emptyTitle: 'Aucune expérience renseignée',
    emptyBody: 'Ajoutez votre parcours professionnel pour enrichir votre profil.',
    hint: 'Privilégiez les responsabilités et résultats concrets.',
    current: 'aujourd’hui',
    deleteConfirmTitle: 'Supprimer cette expérience ?',
    errorTitle: 'Impossible de charger vos expériences.',
  },

  experienceForm: {
    titleNew: 'Ajouter une expérience',
    titleEdit: 'Modifier l’expérience',
    heading: 'Nouvelle expérience',
    headingEdit: 'Modifier l’expérience',
    subtitle: 'Décrivez votre rôle et vos résultats.',
    organizationLabel: 'Organisation',
    positionLabel: 'Poste / fonction',
    startDateLabel: 'Début (AAAA-MM-JJ)',
    endDateLabel: 'Fin (AAAA-MM-JJ)',
    currentLabel: 'Poste actuel',
    cityLabel: 'Localisation',
    sectorLabel: 'Secteur',
    descriptionLabel: 'Responsabilités et réalisations',
    visibleHint: 'Visible sur mon profil',
    errorTitle: "Impossible d'enregistrer cette expérience.",
  },

  educations: {
    title: 'Mes formations',
    heading: 'Formations & certifications',
    addAction: '+ Ajouter une formation',
    academicSection: 'Diplômes principaux',
    certificationSection: 'Certifications',
    certificationBadge: 'Certification',
    emptyTitle: 'Aucune formation renseignée',
    emptyBody: 'Ajoutez vos diplômes et certifications.',
    hint: 'Ajoutez surtout les formations utiles à votre crédibilité.',
    errorTitle: 'Impossible de charger vos formations.',
  },

  educationForm: {
    titleNew: 'Ajouter une formation',
    titleEdit: 'Modifier la formation',
    heading: 'Nouvelle formation',
    headingEdit: 'Modifier la formation',
    subtitle: 'Diplôme ou certification professionnelle.',
    typeAcademic: 'Diplôme académique',
    typeCertification: 'Certification',
    institutionLabel: 'Établissement',
    degreeLabel: 'Intitulé',
    fieldLabel: 'Domaine',
    startYearLabel: 'Début',
    endYearLabel: 'Obtention',
    countryLabel: 'Pays',
    credentialLabel: 'Justificatif / lien',
    descriptionLabel: 'Description facultative',
    visibleHint: 'Afficher sur mon profil',
    errorTitle: 'Impossible d’enregistrer cette formation.',
  },

  skills: {
    title: 'Mes compétences',
    heading: 'Mes compétences',
    addAction: '+ Ajouter',
    emptyTitle: 'Aucune compétence déclarée',
    emptyBody: 'Déclarez vos compétences pour être mieux repéré du réseau.',
    hint: 'La qualité des preuves compte plus que le nombre.',
    primaryBadge: 'Principale',
    modify: 'Modifier',
    errorTitle: 'Impossible de charger vos compétences.',
    level: {
      notion: 'Notion',
      intermediate: 'Intermédiaire',
      advanced: 'Avancée',
      expert: 'Expert',
    },
  },

  skillForm: {
    titleNew: 'Ajouter une compétence',
    titleEdit: 'Gérer une compétence',
    heading: 'Gérer une compétence',
    subtitle: 'Précisez votre niveau et son contexte.',
    searchLabel: 'Rechercher une compétence…',
    levelLabel: 'Niveau',
    yearsLabel: 'Années d’expérience',
    primaryLabel: '★ Compétence principale',
    contextLabel: 'Contexte d’utilisation',
    evidenceTitle: 'Preuves associées',
    evidenceExperiences: 'Expériences',
    declarativeNotice: 'Le niveau reste déclaratif.',
    declarativeHint: 'Il oriente la recherche, sans certification automatique.',
    deleteAction: 'Supprimer la compétence',
    errorTitle: 'Impossible d’enregistrer cette compétence.',
  },

  positioning: {
    title: 'Positionnement',
    heading: 'Votre positionnement',
    subtitle: 'Où, comment et sur quoi vous intervenez.',
    notice: 'Secteur ≠ fonction ≠ expertise',
    noticeHint: 'Ces trois dimensions améliorent la recherche.',
    sectorsTitle: 'Secteurs',
    functionsTitle: 'Fonctions',
    expertiseTitle: 'Expertises',
    primaryLabel: 'Secteur principal',
    reminderTitle: 'Ces trois listes structurent votre visibilité.',
    reminderHint: 'Elles ne calculent ni score ni classement dans la recherche.',
    errorTitle: 'Impossible de charger votre positionnement.',
  },

  projects: {
    title: 'Mes projets',
    heading: 'Projets & réalisations',
    addAction: '+ Ajouter un projet',
    emptyTitle: 'Aucun projet renseigné',
    emptyBody: 'Mettez en avant vos contributions concrètes.',
    hint: 'Mettez en avant votre contribution et le résultat obtenu.',
    errorTitle: 'Impossible de charger vos projets.',
  },

  projectForm: {
    titleNew: 'Ajouter un projet',
    titleEdit: 'Modifier le projet',
    heading: 'Nouveau projet',
    headingEdit: 'Modifier le projet',
    subtitle: 'Mettez en avant votre contribution et le résultat.',
    titleLabel: 'Nom du projet',
    organizationLabel: 'Organisation',
    roleLabel: 'Votre rôle',
    startDateLabel: 'Début (AAAA-MM-JJ)',
    endDateLabel: 'Fin (AAAA-MM-JJ)',
    countryLabel: 'Zone',
    summaryLabel: 'Votre contribution',
    outcomeLabel: 'Résultat obtenu',
    linkLabel: 'Lien',
    errorTitle: 'Impossible d’enregistrer ce projet.',
  },

  languagesZones: {
    title: 'Langues & zones',
    heading: 'Langues & zones d’expérience',
    subtitle: 'Ce que vous pratiquez réellement.',
    languagesTitle: 'Langues de travail',
    zonesTitle: 'Zones d’expérience',
    toolsTitle: 'Outils & logiciels',
    addLanguage: 'Ajouter une langue',
    addZone: 'Ajouter un pays',
    addTool: 'Ajouter un outil',
    hint: 'Déclarez uniquement les zones d’expérience réelle.',
    errorTitle: 'Impossible de charger ces informations.',
    proficiency: {
      basic: 'Notions',
      intermediate: 'Intermédiaire',
      professional: 'Professionnel',
      fluent: 'Courant',
      native: 'Langue maternelle',
    },
    toolLevel: {
      notion: 'Notion',
      intermediate: 'Intermédiaire',
      advanced: 'Avancé',
      expert: 'Expert',
    },
  },

  recommendations: {
    title: 'Mes recommandations',
    heading: 'Recommandations',
    requestAction: 'Demander',
    tabAll: 'Toutes',
    tabReceived: 'Reçues',
    tabRequests: 'Demandes',
    visibleBadge: 'Visible',
    hiddenBadge: 'Masquée',
    toValidateBadge: 'À valider',
    pendingBadge: 'En attente',
    publish: 'Publier',
    hide: 'Masquer',
    accept: 'Accepter',
    decline: 'Décliner',
    withdraw: 'Retirer',
    emptyTitle: 'Aucune recommandation pour le moment',
    emptyBody: 'Demandez à un membre de votre réseau de témoigner de votre travail.',
    hint: 'Les recommandations contextualisent votre expertise.',
    hintSecondary: 'Aucun score public n’est calculé.',
    errorTitle: 'Impossible de charger vos recommandations.',
  },

  requestRecommendation: {
    title: 'Demander une recommandation',
    heading: 'Nouvelle demande',
    subtitle: 'Choisissez une personne qui connaît votre travail.',
    memberLabel: 'Membre',
    memberSearchPlaceholder: 'Rechercher un membre…',
    changeAction: 'Changer',
    contextLabel: 'Contexte',
    skillLabel: 'Compétence',
    messageLabel: 'Message',
    relationshipLabel: 'Nature de la relation',
    relationship: {
      project: 'Projet commun',
      mission: 'Mission commune',
      management: 'Lien hiérarchique',
      other: 'Autre',
    },
    hint: 'Demande individuelle · aucune relance agressive.',
    submit: 'Envoyer la demande',
    errorTitle: 'Impossible d’envoyer cette demande.',
  },

  completion: {
    title: 'Complétion du profil',
    heading: 'Votre profil',
    subtitle: 'Complétez seulement ce qui apporte de la valeur.',
    completedLabel: 'complété',
    privateLabel: 'Non public',
    prioritiesTitle: 'Priorités',
    sectionsTitle: 'État des sections',
    doAction: 'Faire',
    footerNote: 'Pas besoin d’atteindre 100 % pour être utile au réseau.',
    missingLink: 'Voir les suggestions',
    errorTitle: 'Impossible de charger votre complétion.',
  },

  missingItems: {
    title: 'Suggestions',
    heading: 'À compléter utilement',
    subtitle: 'suggestion(s) · aucune n’est bloquante.',
    banner: 'Votre profil est déjà exploitable.',
    bannerHint: 'Objectif : pertinence, pas 100 %.',
    canWaitTitle: 'Peut attendre',
    canWaitHint: 'Les éléments listés ci-dessous sont vos manques réels de plus faible priorité.',
    footerNote: 'Les suggestions disparaissent une fois traitées.',
    doAction: 'Faire',
    impact: {
      fort: 'Fort',
      moyen: 'Moyen',
      utile: 'Utile',
    },
    errorTitle: 'Impossible de charger vos suggestions.',
  },

  availability: {
    title: 'Ma disponibilité',
    heading: 'Ma disponibilité',
    subtitle: 'Comment je souhaite aider le réseau.',
    activeCount: 'formes d’aide actives',
    updatedAt: 'Mise à jour',
    needsRefresh: 'à actualiser',
    editAction: 'Modifier ma disponibilité',
    helpTitle: 'Je peux aider par',
    reminderTitle: 'Vous restez libre d’accepter ou non chaque demande.',
    reminderHint: 'La disponibilité déclarée ne vaut jamais obligation d’accepter.',
    errorTitle: 'Impossible de charger votre disponibilité.',
  },

  availabilityForm: {
    title: 'Modifier ma disponibilité',
    heading: 'Disponibilité',
    subtitle: 'Choisissez comment le réseau peut vous solliciter.',
    helpTitle: 'Je peux aider par',
    preferencesTitle: 'Préférences',
    maxPerMonthLabel: 'Fréquence max (par mois)',
    idealDelayLabel: 'Délai idéal (jours)',
    channelLabel: 'Canal préféré',
    channel: {
      message: 'Message',
      email: 'E-mail',
      call: 'Appel',
      video: 'Visio',
    },
    notesLabel: 'Note',
    privacyHint: 'Votre agenda reste privé. Vous acceptez ou refusez chaque sollicitation.',
    errorTitle: 'Impossible d’enregistrer votre disponibilité.',
  },
} as const;
