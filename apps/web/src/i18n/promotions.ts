/**
 * Libelles de la tranche PROMOTIONS (ISE-067 -> ISE-071).
 *
 * Fichier separe de `src/i18n/fr.ts` : chaque tranche apporte ses
 * libelles sans toucher au catalogue central.
 *
 * REGISTRE : professionnel, jamais nostalgique (MASTER PROMPT §28).
 * Aucun libelle ne compare une promotion a une autre (CA-PROMO-02),
 * aucun ne suggere un classement, aucun ne promet une coordonnee.
 */
export const frPromotions = {
  hub: {
    title: 'Collaborer',
    subtitle:
      'Votre promotion, les stages de la promotion sortante et le mentorat entre ISE, au même endroit.',
    promotionTitle: 'Ma promotion',
    promotionBody:
      'Retrouvez votre génération, aidez à compléter l’annuaire et suivez ce qu’elle devient.',
    internshipsTitle: 'Stages',
    internshipsBody:
      'Aucun élève ISE ne devrait chercher seul son premier stage lorsqu’un ancien peut ouvrir une porte.',
    mentorshipTitle: 'Mentorat',
    mentorshipBody:
      'Un accompagnement ciblé, limité dans le temps, sur un objectif professionnel précis.',
    open: 'Ouvrir',
    comingSoon: 'Écrans en cours de développement.',
  },

  common: {
    loadErrorTitle: 'Impossible d’afficher cette page.',
    loadingLabel: 'Chargement en cours…',
    back: 'Retour',
    breadcrumb: 'Fil d’Ariane',
    save: 'Enregistrer',
    cancel: 'Annuler',
    noPromotionTitle: 'Aucune promotion n’est rattachée à votre profil.',
    noPromotionBody:
      'Le rattachement à une promotion se fait à la vérification du profil. Contactez l’assistance si votre promotion manque.',
  },

  overview: {
    kicker: 'MA PROMOTION',
    subtitle:
      'Retrouvez votre cohorte, partagez les nouvelles et activez l’entraide entre camarades.',
    invite: 'Inviter un camarade',
    tabOverview: 'Aperçu',
    tabMembers: 'Membres',
    tabInvitations: 'Suivi des invitations',
    classmates: 'Camarades de promotion',
    seeAllMembers: 'Voir tous les membres',
    profile: 'Profil',
    inBrief: 'Votre promotion en bref',
    statReferenced: 'membres identifiés',
    statClaimed: 'profils réclamés',
    statVerified: 'ISE vérifiés',
    statCountries: 'pays représentés',
    toFindTitle: 'Profils à retrouver',
    toFindBody: '{count} camarades n’ont pas encore réclamé leur profil.',
    toFindQuestion: 'Vous connaissez l’un d’eux ?',
    toFindAction: 'Aider à retrouver un camarade',
    newsTitle: 'Nouvelles de la promotion',
    newsEmpty: 'Aucune actualité publiée pour l’instant.',
    nextEventTitle: 'Prochain événement',
    nextEventEmpty: 'Aucune rencontre programmée pour l’instant.',
    managersTitle: 'Référents de la promotion',
    managerDelegate: 'Référent principal',
    managerCoDelegate: 'Référent adjoint',
    managerReferent: 'Référent',
    otherPromotionTitle: 'Vous n’êtes pas membre de cette promotion.',
    otherPromotionBody:
      'Les chiffres généraux restent visibles. L’annuaire, les profils à retrouver et les invitations sont réservés aux membres de la promotion.',
    backToMine: 'Revenir à ma promotion',
    networkBridgeTitle: 'Le réseau ne s’arrête pas à votre promotion',
    networkBridgeBody:
      'Les expertises, les opportunités et le mentorat sont ouverts à toutes les générations ISE.',
    networkBridgeAction: 'Explorer le réseau',
  },

  members: {
    title: 'Membres de la promotion {promotion}',
    subtitle:
      '{referenced} camarades identifiés · {claimed} profils réclamés · {toFind} à retrouver',
    searchLabel: 'Rechercher un camarade',
    searchPlaceholder: 'Nom, organisation, pays, compétence…',
    filterCountry: 'Pays',
    filterSector: 'Secteur',
    filterApply: 'Filtrer',
    filterAll: 'Tous',
    tabAll: 'Tous',
    tabClaimed: 'Profils réclamés',
    tabToFind: 'À retrouver',
    tabCanHelp: 'Disponibles pour aider',
    badgeClaimed: 'Profil réclamé',
    badgeReferenced: 'Référencé',
    badgeAvailable: 'Disponible pour aider',
    seeProfile: 'Voir le profil',
    helpFind: 'Aider à retrouver ce camarade',
    loadMore: 'Afficher plus de membres',
    emptyTitle: 'Aucun camarade ne correspond à cette recherche.',
    emptyBody: 'Élargissez les filtres, ou signalez un camarade absent de l’annuaire.',
    sideHelpTitle: 'Aidez à compléter la promotion',
    sideHelpBody:
      'Vous reconnaissez un profil référencé ? Signalez une information utile, ou invitez directement votre camarade à réclamer son profil.',
    sideHelpAction: 'Voir les profils à retrouver',
    distributionTitle: 'Répartition',
  },

  referenced: {
    title: 'Aider à retrouver {name}',
    badge: 'PROFIL RÉFÉRENCÉ',
    notActiveTitle: 'Ce profil n’est pas encore actif',
    notActiveBody:
      'Les informations ci-dessous proviennent des sources de référence du réseau. {name} n’a pas encore créé son compte ni confirmé ces données.',
    knownTitle: 'Informations connues',
    fieldPromotion: 'Promotion',
    fieldCountry: 'Pays connu',
    fieldExpertise: 'Expertise indiquée',
    fieldOrganization: 'Organisation',
    fieldUpdated: 'Dernière mise à jour',
    toConfirm: 'À confirmer',
    unknown: 'Inconnue',
    missing: 'À actualiser',
    confirmed: 'Confirmée',
    correctionNote:
      'Ces informations pourront être corrigées par {name} lorsqu’il ou elle réclamera son profil.',
    inviteAction: 'Inviter à réclamer le profil',
    qualityTitle: 'Qualité des données',
    howItWorksTitle: 'Comment fonctionne la réclamation ?',
    howItWorks: [
      '{name} reçoit une invitation.',
      'La personne crée son compte.',
      'Elle confirme son identité ISE.',
      'Elle valide ou corrige son profil.',
    ],
    noFakeAccount: 'Aucun compte fictif n’est créé.',
    privacyTitle: 'Respect de la vie privée',
    privacyBody:
      'Les coordonnées éventuellement transmises par un camarade restent en espace privé : elles ne sont jamais affichées ici et ne servent qu’à préparer l’invitation.',
    contactHintPresent:
      'Une information de contact a été transmise par un membre. Son contenu n’est pas affiché.',
    contactHintAbsent: 'Aucune information de contact n’a été transmise.',
    pendingInvitation: 'Une invitation est déjà en cours, valable jusqu’au {date}.',
    suggestTitle: 'Vous avez une information utile ?',
    suggestBody:
      'Signalez un camarade absent de l’annuaire. Un ajout ne crée jamais un profil ISE vérifié : il part en revue.',
    suggestFirstName: 'Prénom',
    suggestLastName: 'Nom',
    suggestCountry: 'Pays (facultatif)',
    suggestHint: 'Information pour le retrouver (facultatif)',
    suggestHintHelp:
      'E-mail, téléphone ou organisation. Cette information reste privée : elle ne sera montrée à aucun membre.',
    suggestSubmit: 'Signaler un camarade manquant',
    suggestDone: 'Merci. Le signalement part en revue.',
    duplicatesTitle: 'Un profil proche existe déjà',
    duplicatesBody: 'Vérifiez qu’il ne s’agit pas de la même personne avant de signaler à nouveau.',
  },

  invite: {
    title: 'Inviter {name} à réclamer son profil',
    subtitle:
      'Une invitation lui permettra de créer son compte puis de vérifier et compléter les informations déjà référencées.',
    modeTitle: 'Choisir le mode d’invitation',
    modeLink: 'Lien personnel',
    modeLinkHint: 'Vous partagez vous-même un lien unique.',
    modeEmail: 'Par e-mail',
    modeEmailHint: 'Compétences ISE prépare l’invitation pour cette adresse.',
    emailLabel: 'Adresse e-mail de {name}',
    emailHelp:
      'L’adresse n’est jamais enregistrée en clair : seule son empreinte est conservée, pour éviter les doublons.',
    submit: 'Générer l’invitation',
    previewTitle: 'Aperçu de l’invitation',
    previewBody:
      '{name}, votre promotion {promotion} vous attend sur Compétences ISE. Un profil de référence existe déjà à votre nom.',
    previewCta: 'Réclamer mon profil',
    previewNote: 'L’invitation indique votre nom comme invitant.',
    noAccountTitle: 'Aucun compte n’est créé à sa place',
    noAccountBody:
      '{name} choisira elle-même ou lui-même de créer son compte et de confirmer son profil. Aucune donnée de connexion n’est créée à sa place.',
    tokenTitle: 'Votre lien d’invitation',
    tokenBody:
      'Ce lien n’est affiché qu’une seule fois : la plateforme n’en conserve qu’une empreinte. Copiez-le maintenant.',
    tokenExpiry: 'Valable jusqu’au {date}, usage unique.',
    trackingTitle: 'Suivi de l’invitation',
    trackingSent: 'Envoyée',
    trackingOpened: 'Ouverte',
    trackingClaimed: 'Profil réclamé',
    trackingNote: 'Vous serez informé si le profil est réclamé.',
    whatsappNote:
      'La plateforme n’envoie aucun message WhatsApp automatiquement : le partage du lien reste manuel.',
  },

  invitations: {
    title: 'Suivi des invitations · {promotion}',
    subtitle: 'Suivez la reconstitution de la promotion sans relances inutiles.',
    statToFind: 'Profils à retrouver',
    statSent: 'Invitations envoyées',
    statOpened: 'Invitations ouvertes',
    statClaimed: 'Profils réclamés',
    progress: '{claimed} profils réclamés sur {referenced}',
    progressBody:
      'La promotion est complétée à {rate} %. Il reste {toFind} camarades à retrouver ou inviter.',
    tabToFollow: 'À suivre',
    tabClaimed: 'Réclamés',
    tabToFind: 'À retrouver',
    tabAll: 'Toutes',
    columnMember: 'Camarade',
    columnStatus: 'Statut',
    columnChannel: 'Canal',
    columnLastAction: 'Dernière action',
    columnAction: 'Action',
    statusNone: 'À retrouver',
    statusSent: 'Invitation envoyée',
    statusOpened: 'Invitation ouverte',
    statusClaimed: 'Profil réclamé',
    statusExpired: 'Lien expiré',
    statusRevoked: 'Invitation retirée',
    channelEmail: 'E-mail',
    channelLink: 'Lien',
    actionHelp: 'Aider',
    actionView: 'Voir',
    actionRevoke: 'Retirer l’invitation',
    actionSeeProfile: 'Voir le profil',
    emptyTitle: 'Aucun camarade dans cette vue.',
    emptyBody: 'La promotion est à jour, ou les filtres sont trop restrictifs.',
    footerNote:
      'Les invitations servent uniquement à permettre au camarade de réclamer son propre profil.',
    loadMore: 'Afficher plus',
  },

  errors: {
    not_authorized: 'Cet espace est réservé aux membres de la promotion.',
    profile_not_found: 'Ce profil n’est pas accessible.',
    profile_already_claimed: 'Ce profil a déjà été réclamé : aucune invitation n’est nécessaire.',
    request_already_sent: 'Une invitation est déjà en cours pour ce camarade.',
    rate_limited: 'Vous avez atteint la limite d’invitations autorisée aujourd’hui.',
    validation_failed: 'Certaines informations sont incomplètes.',
    cannot_target_self: 'Vous ne pouvez pas vous inviter vous-même.',
    invalid_transition: 'Cette action n’est plus possible dans l’état actuel.',
    unknown: 'Une erreur est survenue. Réessayez.',
  },
} as const;

export type PromotionErrorKey = keyof typeof frPromotions.errors;
