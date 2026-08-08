/**
 * Chaînes de la tranche PROJETS & CONSORTIUMS (ISE-088 → ISE-091).
 *
 * Règles appliquées ici :
 *  - MASTER PROMPT §32 : le vocabulaire distingue en permanence
 *    « proposer sa contribution » (une intention) de « confirmer sa
 *    participation » (un engagement horodaté). Aucune chaîne ne laisse
 *    croire qu'une candidature vaut appartenance.
 *  - CA-PROJ-04 : le caractère rémunéré ou non est toujours explicite,
 *    y compris « rémunération conditionnée à l'obtention du marché ».
 *  - MASTER PROMPT §15 : jamais de pourcentage de correspondance ; un
 *    libellé qualitatif et ses raisons.
 */
export const frProjects = {
  common: {
    breadcrumb: 'Projets & consortiums',
    collaborate: 'Collaborer',
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    endOfList: 'Vous avez vu tous les projets disponibles.',
    loadErrorTitle: 'Les projets n’ont pas pu être chargés.',
    loadErrorBody:
      'Réessayez dans un instant. Si le problème persiste, communiquez la référence ci-dessous à l’assistance.',
    notFoundTitle: 'Ce projet n’est pas accessible.',
    notFoundBody: 'Il est réservé à son équipe, limité aux personnes invitées, ou il n’existe pas.',
    optional: 'Facultatif',
    seeProfile: 'Voir le profil',
  },

  relevance: {
    very_relevant: 'Très pertinent',
    relevant: 'Pertinent',
    close_profile: 'Profil proche',
    title: 'Pourquoi ce projet vous est proposé',
  },

  reason: {
    skill: 'Compétence recherchée présente dans votre profil',
    experience: 'Années d’expérience déclarées',
    sector: 'Secteur d’expérience commun',
    country: 'Pays présent dans votre parcours',
    availability: 'Disponibilité déclarée',
    language: 'Langue demandée présente dans votre profil',
  },

  projectType: {
    mission: 'Mission',
    tender: 'Appel d’offres',
    consortium: 'Consortium',
    study: 'Étude',
    research: 'Recherche',
    entrepreneurial: 'Projet entrepreneurial',
    product: 'Produit',
    publication: 'Publication',
    working_group: 'Groupe de travail',
    community_initiative: 'Initiative de communauté',
    other: 'Autre',
  },

  status: {
    draft: 'Brouillon',
    recruiting: 'Équipe en constitution',
    team_ready: 'Équipe confirmée',
    active: 'En cours',
    paused: 'En pause',
    completed: 'Terminé',
    failed: 'Non abouti',
    cancelled: 'Annulé',
    archived: 'Archivé',
  },

  compensation: {
    paid: 'Rémunéré',
    conditional_on_award: 'Rémunération conditionnée à l’obtention du marché',
    volunteer: 'Bénévole',
    equity: 'Participation au capital',
    mixed: 'Mixte',
    to_be_defined: 'À définir',
    label: 'Conditions',
    notDisclosed: 'Les conditions financières détaillées ne sont pas encore communiquées.',
    disclosureApplied: 'Elles le seront après examen de votre proposition.',
    disclosureShortlisted: 'Elles le seront si votre proposition est retenue en présélection.',
    disclosureSelected: 'Elles le seront si votre proposition est retenue.',
    disclosureTeam: 'Elles sont réservées aux membres de l’équipe.',
  },

  commitment: {
    ad_hoc_advice: 'Conseil ponctuel',
    few_hours: 'Quelques heures',
    part_time: 'Temps partiel',
    full_mission: 'Mission complète',
    cofounder: 'Cofondateur',
  },

  requirement: {
    required: 'requise',
    desired: 'souhaitée',
  },

  /** ISE-088 — Espace Projets & Consortiums. */
  list: {
    title: 'Projets & Consortiums',
    subtitle:
      'Trouvez des collaborations où votre expertise peut réellement faire avancer une équipe ISE.',
    tabForMe: 'Pour moi',
    tabAll: 'Tous les projets',
    tabConsortiums: 'Consortiums',
    tabMine: 'Mes collaborations',
    searchLabel: 'Rechercher un projet',
    searchPlaceholder: 'Projet, expertise, secteur…',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer les filtres',
    filterType: 'Type de projet',
    filterSector: 'Secteur',
    filterCountry: 'Pays',
    filterCompensation: 'Conditions',
    filterAll: 'Tous',
    filterApply: 'Appliquer',
    open: 'Voir le projet',
    soughtRoles: 'Rôles recherchés',
    teamProgress: 'rôle(s) pourvu(s) sur',
    deadlineTeam: 'Clôture de l’équipe',
    deadlineEnd: 'Fin visée',
    groupCoordinating: 'Je coordonne',
    groupParticipating: 'Je participe',
    groupInvitations: 'Invitations reçues',
    groupInterests: 'Mes propositions',
    groupCompleted: 'Terminés',
    emptyForMeTitle: 'Aucun projet ne recherche encore une expertise proche de votre profil.',
    emptyForMeBody:
      'La correspondance se calcule sur les rôles réellement ouverts. Complétez vos compétences et votre disponibilité, ou parcourez tous les projets.',
    emptyForMeAction: 'Voir tous les projets',
    emptyAllTitle: 'Aucun projet ne correspond à cette recherche.',
    emptyAllBody: 'Élargissez les filtres, ou revenez à la liste complète.',
    emptyMineTitle: 'Vous ne participez encore à aucune collaboration.',
    emptyMineBody:
      'Proposer sa contribution à un projet est le point de départ ; l’appartenance à l’équipe se confirme ensuite explicitement.',
    noCreationTitle: 'La création d’un projet n’est pas encore ouverte ici.',
    noCreationBody:
      'L’assistant de création (titre, contexte, rôles, conditions, visibilité, aperçu) fera l’objet d’une livraison dédiée. Aucun bouton n’est affiché tant qu’il ne fonctionne pas.',
  },

  /** ISE-089 — Détail d'un projet. */
  detail: {
    projectTitle: 'Le projet',
    expectedOutcome: 'Résultat attendu',
    context: 'Contexte',
    criteria: 'Critères de qualification',
    restrictedTitle: 'Projet à divulgation restreinte',
    restrictedBody:
      'Le porteur a choisi de ne publier qu’un résumé. Le détail est communiqué après invitation ou acceptation.',
    infoTitle: 'Informations',
    infoType: 'Type',
    infoSector: 'Secteur',
    infoCountries: 'Pays',
    infoStart: 'Démarrage',
    infoDeadline: 'Date limite de candidature',
    infoEnd: 'Fin visée',
    infoNda: 'Accord de confidentialité exigé avant accès aux documents sensibles.',
    teamTitle: 'Composition de l’équipe',
    teamConfirmed: 'Confirmé',
    teamPending: 'En attente de confirmation',
    teamInvited: 'Invité',
    teamVacant: 'À pourvoir',
    rolesTitle: 'L’équipe recherchée',
    roleSeats: 'poste(s)',
    roleFilled: 'pourvu(s)',
    roleSkills: 'Compétences',
    roleLanguages: 'Langues',
    roleExperience: 'Expérience minimale',
    roleYears: 'ans',
    roleWorkload: 'Charge estimée',
    roleDays: 'jours',
    roleHoursWeek: 'h / semaine',
    rolePeriod: 'Période',
    roleInvitationOnly: 'Ce rôle est pourvu sur invitation.',
    roleApply: 'Proposer ma contribution',
    linksTitle: 'Documents et liens',
    linksConfidential: 'Confidentiel — équipe uniquement',
    closureTitle: 'Résultat du projet',
    closureAchieved: 'Résultat attendu obtenu',
    achieved: { yes: 'Oui', partially: 'Partiellement', no: 'Non' },
    myInterest: 'Vous avez proposé votre contribution le',
    myInterestStatus: 'État de votre proposition',
    myInvitation: 'Vous avez reçu une invitation à rejoindre ce projet.',
    invitationAccept: 'Accepter l’invitation',
    invitationDecline: 'Décliner',
    invitationDeclineHelp: 'Un refus n’a pas à être justifié.',
    invitationAccepted:
      'Invitation acceptée. Votre participation n’est pas encore engagée : elle le sera après votre confirmation explicite.',
    myMembership: 'Vous faites partie de l’équipe.',
    openParticipation: 'Ouvrir ma participation',
    confirmNeeded: 'Votre participation attend votre confirmation.',
  },

  /** ISE-090 — Proposer ma contribution. */
  contribution: {
    title: 'Proposer ma contribution',
    subtitle: 'Expliquez ce que vous pouvez apporter à l’équipe, et dans quelles conditions.',
    roleLabel: 'Rôle que vous proposez de tenir',
    roleNone: 'Contribution au projet, sans rôle précis',
    messageLabel: 'Ce que vous pouvez apporter',
    messagePlaceholder:
      'Décrivez concrètement ce que vous prendriez en charge, en vous appuyant sur ce que vous avez déjà fait.',
    availabilityLabel: 'Disponibilité annoncée',
    availabilityPlaceholder: 'Par exemple : disponible du 11 au 25 août, environ 8 jours.',
    availabilityConfirm: 'Je confirme être disponible sur la période indiquée.',
    termsConfirm:
      'J’ai pris connaissance des conditions de participation (engagement attendu, échéances, conditions financières telles qu’elles sont communiquées à ce stade).',
    termsRequired: 'Cette confirmation est obligatoire.',
    cvConsent: 'J’autorise le porteur à utiliser mon CV pour cette proposition.',
    cvConsentHelp:
      'Sans cette autorisation, aucun document de votre profil n’est transmis avec la proposition.',
    noticeTitle: 'Ce que vous envoyez est une proposition',
    noticeBody:
      'Elle exprime un intérêt. Elle ne vaut ni engagement contractuel, ni appartenance à l’équipe : l’équipe se constitue ensuite, avec votre confirmation explicite.',
    reviewersTitle: 'Qui examinera votre proposition',
    reviewersBody: 'Le porteur décide ; aucune sélection ni aucun rejet n’est automatique.',
    afterTitle: 'Après l’envoi',
    afterBody:
      'Vous pourrez suivre l’état de votre proposition : examen, présélection, retenue ou non retenue. Vous pouvez la retirer à tout moment tant qu’elle n’a pas été examinée.',
    submit: 'Envoyer ma proposition',
    submitPending: 'Envoi…',
    success:
      'Proposition envoyée. Elle n’a créé aucune appartenance à l’équipe : la confirmation viendra plus tard, et de vous.',
    withdraw: 'Retirer ma proposition',
    withdrawPending: 'Retrait…',
    withdrawSuccess: 'Proposition retirée.',
    alreadyTitle: 'Vous avez déjà une proposition en cours sur ce projet.',
    alreadyBody: 'Retirez-la depuis la fiche du projet avant d’en déposer une autre.',
  },

  /** ISE-091 — Ma participation. */
  participation: {
    title: 'Ma participation',
    subtitle: 'Suivez vos responsabilités, les jalons et le résultat de cette collaboration.',
    myRole: 'Votre rôle',
    statusLabel: 'État de votre participation',
    confirmedAt: 'Participation confirmée le',
    notConfirmedTitle: 'Votre participation n’est pas encore engagée',
    notConfirmedBody:
      'Vous avez été ajouté à l’équipe, mais rien n’est acté tant que vous n’avez pas confirmé. Prenez connaissance du rôle et des conditions, puis confirmez.',
    confirmTerms:
      'Je confirme ma participation à ce projet, au rôle et aux conditions décrites ci-dessus.',
    confirmCvConsent: 'J’autorise l’utilisation de mon CV dans le cadre de ce projet.',
    confirmSubmit: 'Je confirme ma participation',
    confirmPending: 'Confirmation…',
    confirmSuccess: 'Participation confirmée. La date de votre consentement est enregistrée.',
    agreedTermsTitle: 'Conditions acceptées',
    agreedTermsBody:
      'Elles sont conservées telles qu’elles étaient au moment de votre confirmation. La plateforme ne se substitue à aucun contrat.',
    withdraw: 'Demander mon retrait',
    withdrawPending: 'Retrait…',
    withdrawSuccess: 'Retrait enregistré. Le porteur en est informé et peut rouvrir le rôle.',
    withdrawHelp: 'Un membre n’est jamais retenu indéfiniment dans un projet.',
    milestonesTitle: 'Jalons du projet',
    myMilestonesTitle: 'Mes responsabilités',
    milestoneStatus: {
      todo: 'À faire',
      in_progress: 'En cours',
      done: 'Terminé',
      blocked: 'Bloqué',
    },
    milestoneUpdate: 'Mettre à jour',
    milestoneEmpty: 'Aucun jalon n’est encore défini pour ce projet.',
    nextMilestone: 'Prochaine échéance',
    teamTitle: 'Équipe constituée',
    impactTitle: 'Où en est la collaboration',
    impactMembers: 'membre(s) ayant confirmé leur participation',
    impactRoles: 'rôle(s) pourvu(s) sur',
    impactMilestones: 'jalon(s) terminé(s) sur',
    impactHelp:
      'Ces nombres sont des décomptes de ce qui existe réellement. Aucun pourcentage d’avancement n’est estimé.',
    financialsTitle: 'Éléments financiers du projet',
    financialsBody:
      'Réservés aux membres de l’équipe. Ils ne sont jamais visibles depuis la fiche publique du projet.',
    financialsClient: 'Client',
    financialsFunder: 'Bailleur',
    financialsBudget: 'Budget estimé',
    financialsRevenue: 'Produit constaté',
    financialsNotes: 'Notes',
    financialsEmpty: 'Aucun élément financier n’a été renseigné pour ce projet.',
    notParticipantTitle: 'Vous ne participez pas à ce projet.',
    notParticipantBody: 'Cette page est réservée aux membres de l’équipe et au porteur du projet.',
  },
} as const;
