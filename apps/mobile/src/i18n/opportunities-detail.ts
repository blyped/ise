/**
 * Chaînes ISE-056 -> ISE-066 (détail, candidatures, publication).
 *
 * Fichier séparé de `apps/mobile/src/i18n/fr.ts` (déjà livré, ISE-055) :
 * ce module NE modifie PAS `fr.ts` pour éviter tout conflit avec les
 * autres tranches mobiles en cours. Copie fidèle du vocabulaire de
 * `apps/web/src/i18n/opportunities.ts`, réduite aux écrans construits ici.
 *
 * Règle cardinale (MASTER PROMPT §27, D-55) : aucune chaîne n'affirme
 * qu'une candidature a été envoyée à un organisme externe. Le vocabulaire
 * distingue « candidature envoyée » (interne), « vous avez déclaré avoir
 * postulé » (déclaration) et « vous avez consulté l'offre » (clic).
 */
export const frOpportunitiesDetail = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    correlationLabel: 'Référence à communiquer à l’assistance',
    optional: 'Facultatif',
    notSpecified: 'Non précisée',
    loadErrorTitle: 'Le contenu n’a pas pu être chargé.',
  },

  type: {
    job: 'Emploi',
    internship: 'Stage',
    mission: 'Mission',
    business: 'Business',
    research: 'Recherche',
    scholarship: 'Bourse',
  } as Record<string, string>,

  remoteMode: {
    onsite: 'Sur site',
    hybrid: 'Hybride',
    remote: 'À distance',
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

  relevance: {
    very_relevant: 'Très pertinente',
    relevant: 'Pertinente',
    close_profile: 'Profil proche',
  } as Record<string, string>,

  applicationMode: {
    internal: 'Candidature via Compétences ISE',
    external_url: 'Candidature sur le site de l’organisation',
    external_email: 'Candidature par e-mail',
    contact_recruiter: 'Prise de contact avec un référent',
  } as Record<string, string>,

  /** Vocabulaire neutre : jamais « rejeté ». */
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

  /* ---------------- ISE-056 — détail ---------------- */
  detail: {
    title: 'Détail de l’opportunité',
    aboutTitle: 'À propos de la mission',
    whyTitle: 'Pourquoi pour vous ?',
    howToApplyCta: 'Voir comment postuler',
    applyCta: 'Postuler sur Compétences ISE',
    save: 'Enregistrer',
    unsave: 'Retirer',
    deadlineLabel: 'Deadline',
    notFoundTitle: 'Cette opportunité n’est pas accessible.',
    notFoundBody: 'Elle n’existe plus, ou elle ne s’adresse pas à vous.',
    closedTitle: 'Cette opportunité est clôturée.',
    closedBody: 'Elle reste consultable pour mémoire ; elle n’accepte plus de candidature.',
    alreadyAppliedTitle: 'Vous avez déjà candidaté à cette opportunité.',
    alreadyDeclaredTitle: 'Vous avez déclaré avoir postulé à cette opportunité.',
    seeApplication: 'Voir ma candidature',
    manageTitle: 'Vous gérez cette opportunité',
    manageTracking: 'Voir le suivi',
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
    clickRecordedTitle: 'Consultation enregistrée',
    clickRecordedBody:
      'Nous avons noté que vous avez consulté cette offre. Ce n’est pas une candidature : seule votre déclaration en est une.',
    declareTitle: 'Vous avez postulé ?',
    declareBody:
      'Déclarez-le pour suivre la démarche dans « Mes candidatures ». Vous seul pouvez le faire.',
    declareDateLabel: 'Date à laquelle vous avez postulé (AAAA-MM-JJ)',
    declareNoteLabel: 'Note (facultatif)',
    declareSubmit: 'Je déclare avoir postulé',
    messageLabel: 'Message au recruteur (facultatif)',
    messagePlaceholder: 'Pourquoi cette opportunité vous intéresse-t-elle ?',
    submit: 'Envoyer ma candidature',
    doneTitle: 'Candidature envoyée.',
    doneDeclaredTitle: 'Déclaration enregistrée.',
  },

  /* ---------------- ISE-057 -> ISE-059 — publication ---------------- */
  wizard: {
    createTitle: 'Publier une opportunité',
    createSubtitle: 'Décrivez l’opportunité à partager.',
    step1Title: 'Informations essentielles',
    typeLegend: 'Type',
    titleLabel: 'Intitulé',
    titlePlaceholder: 'Ex. Consultant senior en suivi-évaluation',
    organizationLabel: 'Organisation',
    locationLabel: 'Lieu / pays',
    locationPlaceholder: 'Ville, pays ou Remote',
    descriptionLabel: 'Description',
    descriptionPlaceholder: 'Contexte, responsabilités, durée et informations utiles…',
    skillsLabel: 'Compétences recherchées',
    skillsPlaceholder: 'Ajouter une compétence, séparée par des virgules',
    draft: 'Brouillon',
    continue: 'Continuer',

    audienceTitle: 'Matching',
    audienceHeading: 'Vérifiez le matching',
    audienceCriteriaTitle: 'Critères de matching',
    audienceProfilesTitle: 'Profils les plus proches',
    back: 'Retour',
    continueToPreview: 'Continuer vers l’aperçu',

    previewTitle: 'Aperçu',
    previewHeading: 'Vérifiez avant de publier',
    previewSubtitle: 'Voici ce que les membres verront.',
    readyTitle: 'Prêt à publier',
    readyComplete: 'Informations complètes',
    readyMatching: 'Matching cohérent',
    readyAudience: 'Audience ciblée',
    afterTitle: 'Après publication',
    afterBody: 'Suivez vues utiles, clics et intérêt.',
    publish: 'Publier maintenant',
    publishedTitle: 'Opportunité publiée.',
    targetedCount: '{count} profils ciblés',
  },

  /* ---------------- ISE-060 — suivi ---------------- */
  tracking: {
    title: 'Suivi de l’opportunité',
    open: 'OUVERTE',
    paused: 'EN PAUSE',
    closed: 'CLÔTURÉE',
    publishedInfo: 'Publié il y a {days} jours · {count} profils',
    applications: 'Candidatures',
    targeted: 'Profils ciblés',
    strongMatches: 'Fortement correspondants',
    interestedTitle: 'Profils intéressés',
    watchTitle: 'À surveiller',
    seeCandidates: 'Voir les profils concernés',
    emptyTitle: 'Aucune candidature reçue pour l’instant.',
    seeProfile: 'Voir le profil',
    edit: 'Modifier',
    seeApplications: 'Voir les intéressés',
    fulfilledNotice: 'Opportunité pourvue ? Pensez à la fermer.',
  },

  /* ---------------- ISE-061 — clôture ---------------- */
  closure: {
    title: 'Fermer l’opportunité',
    subtitle: 'Le résultat que vous déclarez alimente les indicateurs d’impact.',
    reasonLegend: 'Pourquoi la fermer ?',
    reasonFulfilled: 'Pourvue',
    reasonExpired: 'Échue',
    reasonCancelled: 'Annulée',
    reasonOther: 'Autre',
    facilitatedLabel: 'Le réseau a-t-il contribué ?',
    yes: 'Oui',
    partial: 'Partiellement',
    no: 'Non',
    resultTitle: 'Résultat facilité',
    resultCandidate: 'Candidat identifié',
    resultIntroduction: 'Introduction',
    resultRecommendation: 'Recommandation',
    beneficiaryLabel: 'Personne concernée',
    commentLabel: 'Commentaire',
    commentPlaceholder: 'Décrivez brièvement le résultat…',
    submit: 'Fermer et enregistrer l’impact',
    doneTitle: 'Opportunité clôturée.',
  },

  /* ---------------- ISE-062 ---------------- */
  saved: {
    title: 'Enregistrées',
    tabSaved: 'Enregistrées',
    tabApplications: 'Candidatures',
    tabHistory: 'Historique',
    searchPlaceholder: 'Rechercher…',
    filters: 'Filtres',
    deadlineNoticeOne: '1 échéance approche',
    deadlineNotice: '{count} échéances approchent',
    expiresIn: 'Expire dans {days} jours',
    deadlineOn: 'Deadline {date}',
    see: 'Voir l’opportunité →',
    emptyTitle: 'Vous n’avez enregistré aucune opportunité.',
    emptyBody: 'Enregistrer une offre la met de côté. Cela ne vaut jamais candidature.',
  },

  /* ---------------- Mes offres (support ISE-060/061) ---------------- */
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
    applicationsCount: '{count} candidatures',
    targetedCount: '{count} profils ciblés',
  },

  /* ---------------- ISE-063 ---------------- */
  applications: {
    title: 'Mes candidatures',
    tabInProgress: 'En cours',
    tabDrafts: 'À préparer',
    tabFinished: 'Terminées',
    actionsThisWeek: '{count} actions cette semaine',
    statToPrepare: 'À préparer',
    statSent: 'Envoyées',
    statInterview: 'Entretien',
    statSelected: 'Retenue',
    sentOn: 'Envoyée le {date}',
    declaredOn: 'Déclarée le {date}',
    channelExternal: 'Déclarée par vous',
    emptyTitle: 'Aucune candidature dans cet onglet.',
    emptyBody: 'Les opportunités auxquelles vous postulez apparaîtront ici.',
  },

  /* ---------------- ISE-064 ---------------- */
  application: {
    title: 'Détail candidature',
    toFinalizeTitle: 'À FINALISER',
    toFinalizeBody: 'Complétez votre dossier avant l’échéance.',
    timelineTitle: 'Timeline',
    documentsTitle: 'Pièces',
    added: 'Ajoutée',
    messageTitle: 'Votre message',
    selfDeclaredTitle: 'Vous suivez vous-même cette candidature',
    selfDeclaredBody:
      'Elle a été déposée hors de la plateforme. Chaque étape que vous enregistrez est une déclaration de votre part, pas un fait constaté.',
    update: 'Mettre à jour',
    outcome: 'Résultat final',
    notFoundTitle: 'Cette candidature n’est pas accessible.',
    notFoundBody: 'Elle n’existe plus, ou elle ne vous concerne pas.',
  },

  /* ---------------- ISE-065 ---------------- */
  update: {
    title: 'Mettre à jour',
    heading: 'Nouveau statut',
    noTransitionTitle: 'Aucune mise à jour n’est possible pour l’instant.',
    noTransitionBody:
      'La candidature est dans un état terminal, ou l’étape suivante appartient au responsable de l’offre.',
    nextDeadlineLabel: 'Prochaine échéance (AAAA-MM-JJ)',
    nextActionLabel: 'Prochaine action',
    nextActionPlaceholder: 'Préparer l’entretien…',
    networkHelpedLabel: 'Le réseau a-t-il aidé ?',
    helpTypeLabel: 'Type d’aide',
    helpTypePlaceholder: 'Introduction / conseil…',
    nextStepTitle: 'Prochaine étape',
    nextStepBody: 'Enregistrer le résultat à la fin.',
    submit: 'Enregistrer la mise à jour',
    declarationTitle: 'Ce que vous enregistrez est une déclaration',
    declarationBody:
      'La plateforme n’a aucun moyen de vérifier l’avancement d’une candidature déposée ailleurs.',
    doneTitle: 'Étape enregistrée.',
  },

  /* ---------------- ISE-066 ---------------- */
  outcome: {
    title: 'Résultat final',
    successHeading: 'La démarche a abouti',
    failureHeading: 'La démarche est terminée',
    statusLabel: 'Statut : {status}',
    recordPrompt: 'Enregistrez le résultat obtenu.',
    resultLegend: 'Résultat obtenu',
    resultMission: 'Mission obtenue',
    resultJob: 'Emploi obtenu',
    resultShortlist: 'Shortlist finale',
    networkContributedLabel: 'Le réseau a-t-il contribué ?',
    contributionLabel: 'Contribution principale',
    contributionPlaceholder: 'Introduction + préparation…',
    thanksLabel: 'Personnes à remercier (facultatif)',
    thanksPlaceholder: 'Ex. Mariam Koné, Serge N’Guessan',
    impactTitle: 'Impact réseau',
    impactBody: 'Un résultat positif obtenu grâce au réseau alimente les indicateurs d’impact.',
    submit: 'Enregistrer le résultat',
    doneTitle: 'Résultat enregistré.',
  },
} as const;

/** Substitution de jetons `{cle}`, copie de `apps/web/src/i18n/opportunities.ts`. */
export function toDetail(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
