/**
 * Sous-ensemble francais des libelles necessaires a cette premiere tranche
 * mobile (ISE-001 connexion, ISE-015 tableau de bord, navigation D-94).
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
} as const;
