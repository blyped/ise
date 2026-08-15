/**
 * Sous-ensemble francais des libelles necessaires a cette premiere tranche
 * mobile (ISE-001 connexion, ISE-015 tableau de bord, ISE-040 relations,
 * ISE-055 opportunites, ISE-016 mon profil, navigation D-94).
 *
 * Ce n'est PAS un package partage : `apps/web/src/i18n/fr.ts` reste la
 * source de verite pour le web. Les cles reprises ici portent volontairement
 * les MEMES libelles que leurs equivalents web, pour que le meme ecran (ex.
 * ISE-001) parle le meme francais des deux cotes (MASTER PROMPT §66). A
 * mesure que la traceability matrix precisera les routes mobiles, ce fichier
 * grandira ; il pourra alors migrer vers un package `@ise/i18n` partage.
 */
export const fr = {
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    loadMore: 'Charger la suite',
    signOut: 'Se déconnecter',
    correlationLabel: 'Référence',
    comingSoonTitle: 'Écran à venir',
    comingSoonBody:
      'Cette section de Compétences ISE arrive dans une prochaine version mobile.',
  },

  nav: {
    home: 'Accueil',
    network: 'Réseau',
    actionCentral: 'Actions',
    opportunities: 'Opportunités',
    profile: 'Moi',
  },

  /** D-194 — icone de notifications, meme centre que le web (ISE-098), perimetre mobile reduit. */
  notifications: {
    title: 'Notifications',
    unreadHint: 'non lues',
    emptyTitle: 'Aucune notification',
    emptyBody: 'Vous serez prévenu ici des demandes, échéances et informations utiles.',
    errorTitle: 'Impossible de charger vos notifications.',
    close: 'Fermer',
    markRead: 'Marquer comme lue',
    markUnread: 'Marquer comme non lue',
    unreadDot: 'Non lue',
  },

  auth: {
    signIn: {
      title: 'Connexion',
      subtitle: 'Retrouvez votre réseau Compétences ISE.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      passwordLabel: 'Mot de passe',
      submit: 'Se connecter',
      submitPending: 'Connexion…',
      invalidCredentials: 'Adresse e-mail ou mot de passe incorrect.',
      emailNotConfirmed: 'Confirmez votre adresse e-mail avant de vous connecter.',
      tooManyAttempts: 'Trop de tentatives. Réessayez dans quelques minutes.',
    },
  },

  dashboard: {
    profileCardTitle: 'Votre profil',
    profileCompletionUnknown: 'Score de complétion indisponible pour le moment.',
    profileCompletionHint: 'Complétez votre profil pour être visible du réseau.',
    errorTitle: 'Impossible de charger votre profil.',
    emptyTitle: 'Aucun profil rattaché à ce compte.',
    emptyBody: 'Contactez votre promotion ou l’assistance pour relier votre compte ISE.',
    claimStatus: {
      unclaimed: 'Non réclamé',
      claim_pending: 'Réclamation en cours',
      claimed: 'Réclamé',
    },
    verificationStatus: {
      unverified: 'Non vérifié',
      pending: 'Vérification en cours',
      verified: 'Vérifié',
      rejected: 'Vérification refusée',
    },
  },

  /** ISE-040 — Mes relations (coquille mobile de `/reseau/relations`). */
  network: {
    title: 'Réseau',
    errorTitle: 'Impossible de charger votre réseau.',
    emptyTitle: 'Aucune relation pour le moment.',
    emptyBody: 'Vos relations acceptées apparaîtront ici.',
    statConnections: 'Relations',
    statPromotions: 'Promotions',
    statCountries: 'Pays',
  },

  /** ISE-055 — Opportunités (coquille mobile de `/opportunites`). */
  opportunities: {
    title: 'Opportunités',
    errorTitle: 'Impossible de charger les opportunités.',
    emptyTitle: 'Aucune opportunité ouverte pour l’instant.',
    emptyBody: 'De nouvelles opportunités apparaîtront ici dès qu’elles seront publiées.',
    type: {
      job: 'Emploi',
      internship: 'Stage',
      mission: 'Mission',
      business: 'Business',
      research: 'Recherche',
      scholarship: 'Bourse',
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
  },

  /** ISE-016 — Mon profil (« Moi »). */
  profile: {
    errorTitle: 'Impossible de charger votre profil.',
    emptyTitle: 'Aucun profil rattaché à ce compte.',
    emptyBody: 'Contactez votre promotion ou l’assistance pour relier votre compte ISE.',
    promotionUnknown: 'Promotion non renseignée.',
    completionUnknown: 'Score de complétion indisponible pour le moment.',
    completionHint: 'Complétez votre profil pour être visible du réseau.',
  },
} as const;
