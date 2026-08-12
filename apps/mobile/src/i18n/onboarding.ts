/**
 * Chaines de l'onboarding mobile ISE-002 -> ISE-014.
 *
 * Fichier NOUVEAU et distinct de `src/i18n/fr.ts` (partagé entre lots
 * mobiles en parallèle — non modifié ici pour éviter toute collision).
 * Mêmes libellés que `apps/web/src/i18n/fr.ts` (blocs `auth`, `claim`) et
 * `apps/web/src/i18n/onboarding.ts` (`frOnboarding`) : le même écran doit
 * parler le même français des deux côtés (MASTER PROMPT §66).
 */
export const frOnboarding = {
  auth: {
    signUp: {
      title: 'Créer votre compte',
      subtitle: 'Rejoignez Compétences ISE en quelques étapes.',
      claimTitle: 'Votre profil ISE existe peut-être déjà.',
      claimBody: 'Vérifiez l’annuaire avant de créer un nouveau profil.',
      firstNameLabel: 'Prénom',
      firstNamePlaceholder: 'Votre prénom',
      lastNameLabel: 'Nom',
      lastNamePlaceholder: 'Votre nom',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      passwordLabel: 'Mot de passe',
      passwordHint: '12 caractères minimum, avec au moins une minuscule, une majuscule et un chiffre.',
      passwordConfirmationLabel: 'Confirmer le mot de passe',
      termsLabel: 'J’accepte les Conditions d’utilisation et la Politique de confidentialité.',
      submit: 'Créer mon compte',
      submitPending: 'Création du compte…',
      alreadyMember: 'Déjà membre ?',
      signInLink: 'Se connecter',
      confirmationTitle: 'Compte créé',
      confirmationBody: 'Votre compte a été créé. Vous pouvez maintenant vous connecter.',
      accountNote:
        'Créer un compte ne crée pas un profil ISE : vous pourrez ensuite réclamer le vôtre dans l’annuaire.',
    },

    forgotPassword: {
      title: 'Mot de passe oublié',
      subtitle: 'Saisissez l’adresse e-mail associée à votre compte Compétences ISE.',
      hintTitle: 'Conseil',
      hintBody: 'Utilisez l’adresse de création ou de réclamation de votre profil.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      submit: 'Envoyer le lien',
      submitPending: 'Envoi en cours…',
      sentTitle: 'Message envoyé',
      sentBody: 'Si un compte est associé à cette adresse, un lien de réinitialisation vient d’être envoyé.',
      backToSignIn: '← Retour à la connexion',
      spamHint: 'Pensez aussi à vérifier vos courriers indésirables.',
    },

    resetPassword: {
      title: 'Nouveau mot de passe',
      subtitle: 'Votre lien est valide.',
      linkVerifiedTitle: 'Lien vérifié',
      linkVerifiedBody: 'Vous pouvez sécuriser votre accès.',
      passwordLabel: 'Nouveau mot de passe',
      passwordConfirmationLabel: 'Confirmer le mot de passe',
      rulesTitle: 'Règles',
      rulesBody: '8 caractères minimum · 1 lettre · 1 chiffre\nÉvitez un mot de passe déjà utilisé ailleurs.',
      submit: 'Mettre à jour',
      submitPending: 'Enregistrement…',
      redirectHint: 'Retour automatique à la connexion après validation.',
    },
  },

  claim: {
    confirm: {
      title: 'Est-ce bien votre profil ?',
      subtitle: 'Vérifiez les informations avant association.',
      referencedBadge: 'Profil référencé',
      matchTitle: 'Correspondances',
      promotionLabel: 'Promotion',
      cityLabel: 'Ville',
      organizationLabel: 'Organisation',
      positionLabel: 'Poste',
      emailLabel: 'E-mail historique',
      notProvided: 'Non renseigné',
      okBadge: 'OK',
      toConfirmBadge: 'À confirmer',
      methodLegend: 'Méthode de vérification',
      methodHint: 'Ce choix détermine la preuve que nous pourrons examiner.',
      methodEmail: 'L’adresse e-mail de mon compte est celle connue de l’annuaire',
      methodEmailHint:
        'Si les deux adresses sont identiques et votre compte confirmé, l’association est immédiate.',
      methodEmailUnavailable: 'Aucune adresse historique n’est enregistrée pour ce profil.',
      methodDocument: 'Je fournirai une pièce justificative',
      methodDocumentHint: 'Diplôme, attestation ou pièce d’identité. Votre demande part en revue.',
      methodPromotionManager: 'Le délégué de ma promotion peut confirmer mon identité',
      methodPromotionManagerHint: 'Votre demande part en revue.',
      confirmLabel: 'Je confirme que ce profil correspond à mon identité.',
      submit: 'Demander l’association',
      submitPending: 'Envoi de la demande…',
      notMe: 'Ce n’est pas moi',
      backToResults: 'Retour aux résultats',
      unavailableTitle: 'Ce profil n’est plus réclamable.',
      unavailableBody: 'Il a peut-être été réclamé entre-temps. Relancez une recherche.',
    },
  },

  shell: {
    stepCounter: '{current} / {total}',
    back: 'Retour',
    skip: 'Passer',
    savedNotice: 'Votre progression est enregistrée à chaque étape.',
    loadErrorTitle: 'Impossible de charger cette étape.',
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

  /** Étape 1 — Vérification (D-03/D-111 : aucun code n'est envoyé). */
  verification: {
    title: 'Vérifiez vos informations',
    subtitle: 'Ces éléments proviennent de votre compte et de l’annuaire ISE.',
    accountEmailLabel: 'Adresse e-mail du compte',
    accountConfirmed: 'Adresse confirmée',
    accountNotConfirmed: 'Adresse non confirmée',
    profileLabel: 'Profil ISE associé',
    promotionLabel: 'Promotion enregistrée',
    promotionUnknown: 'Aucune promotion enregistrée — vous la choisirez à l’étape suivante.',
    verificationLabel: 'Vérification d’identité',
    noCodeTitle: 'Aucun code ne vous sera envoyé.',
    noCodeBody:
      'Votre adresse a déjà été confirmée à la création du compte, et l’association de votre profil a déjà été vérifiée lors de la réclamation.',
    acknowledge: 'Je confirme que ces informations sont bien les miennes.',
    submit: 'Commencer',
    submitPending: 'Enregistrement…',
  },

  /** Étape 2 — Promotion (ISE-008). */
  promotion: {
    title: 'Confirmez votre promotion ISE',
    subtitle: 'Retrouvez votre génération et vos camarades dans le réseau.',
    label: 'Quelle est votre promotion ?',
    placeholder: 'Sélectionner une promotion',
    currentLabel: 'Promotion déjà enregistrée',
    missingLead: 'Vous ne trouvez pas votre promotion ?',
    missingLink: 'Signaler une promotion manquante',
    confirmTitle: 'Une fois confirmée, votre promotion apparaîtra sur votre profil.',
    confirmBody: 'Elle pourra aussi être vérifiée par un responsable de promotion.',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    emptyTitle: 'Aucune promotion n’est disponible.',
    emptyBody: 'Le référentiel des promotions est vide ou n’a pas pu être lu.',
    required: 'Sélectionnez votre promotion.',
  },

  /** ISE-009 — Signaler une promotion absente. */
  missingPromotion: {
    title: 'Promotion absente ?',
    subtitle: 'Signalez-la sans bloquer votre onboarding.',
    noBlockTitle: 'Aucun blocage',
    noBlockBody: 'Vous pourrez poursuivre dès l’envoi.',
    labelField: 'Année ou libellé de promotion',
    labelPlaceholder: 'Ex. ISE 2006',
    institutionField: 'Établissement / centre',
    institutionPlaceholder: 'Ex. ENSEA Abidjan',
    countryField: 'Pays',
    countryPlaceholder: 'Sélectionner un pays',
    yearField: 'Année de sortie',
    yearPlaceholder: 'Ex. 2006',
    commentField: 'Commentaire facultatif',
    commentPlaceholder: 'Précisez si nécessaire l’intitulé ou toute information utile.',
    qualifyTitle: 'Aucune création automatique sans contrôle.',
    submit: 'Envoyer le signalement',
    submitPending: 'Envoi en cours…',
    backLink: '← Retour à la promotion',
    sentTitle: 'Signalement enregistré.',
    sentBody: 'Une personne habilitée l’examinera. Poursuivez votre onboarding.',
    duplicateTitle: 'Vous avez déjà signalé cette promotion.',
    mineTitle: 'Vos signalements',
    status: {
      submitted: 'En attente de revue',
      under_review: 'En cours d’examen',
      accepted: 'Acceptée',
      rejected: 'Non retenue',
      duplicate: 'Doublon',
    } as Record<string, string>,
  },

  /** Étape 3 — Compétences (ISE-010). */
  skills: {
    title: 'Vos compétences principales',
    subtitle: 'Choisissez jusqu’à {max} expertises qui vous représentent le mieux.',
    searchLabel: 'Rechercher une compétence',
    searchPlaceholder: 'Rechercher une compétence',
    selectedLabel: 'Sélectionnées',
    counter: '{count} / {max}',
    limitReached: 'Vous avez atteint {max} compétences. Retirez-en une pour en ajouter une autre.',
    suggestionsTitle: 'Suggestions',
    declarativeTitle: 'Le niveau est déclaratif.',
    declarativeBody: 'Vous préciserez votre niveau après l’onboarding, sur l’écran « Mes compétences ».',
    emptyTitle: 'Aucune compétence ne correspond à cette recherche.',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    required: 'Choisissez au moins une compétence.',
  },

  /** Étape 4 — Secteurs (ISE-011). */
  sectors: {
    title: 'Vos secteurs',
    subtitle: 'Choisissez jusqu’à {max} secteurs principaux.',
    adviceTitle: 'Conseil',
    adviceBody: 'Sélectionnez ceux où votre expérience est réelle.',
    searchLabel: 'Rechercher un secteur',
    searchPlaceholder: 'Rechercher un secteur…',
    selectedLabel: 'Sélectionnés',
    counter: '{count} / {max}',
    suggestionsTitle: 'Suggestions',
    noAutoTitle: 'Ces choix améliorent recherche et recommandations.',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    skip: 'Passer',
  },

  /** Étape 5 — Localisation (ISE-012). */
  location: {
    title: 'Votre localisation',
    subtitle: 'Où êtes-vous basé actuellement ?',
    currentTitle: 'Localisation actuelle',
    countryLabel: 'Pays',
    countryPlaceholder: 'Sélectionner un pays',
    cityLabel: 'Ville',
    cityPlaceholder: 'Ex. Abidjan',
    zonesTitle: 'Zones d’expérience',
    zonesHint: 'Pays ou régions où vous avez travaillé.',
    zonesSearchPlaceholder: 'Ajouter un pays ou une région…',
    privacyTitle: 'Vie privée',
    privacyBody: 'Aucune adresse personnelle n’est publiée.',
    showCityLabel: 'Afficher ma ville sur mon profil',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    skip: 'Passer',
  },

  /** Étape 6 — Disponibilité (ISE-013). */
  availability: {
    title: 'Votre disponibilité',
    subtitle: 'Comment pouvez-vous aider le réseau ?',
    calloutTitle: 'Disponible pour aider',
    calloutBody: 'Sélectionnez uniquement ce qui vous convient.',
    intensityLabel: 'Niveau de disponibilité',
    intensity: {
      low: 'Faible',
      moderate: 'Modérée',
      high: 'Élevée',
    },
    visibilityLabel: 'Qui peut voir ma disponibilité ?',
    noObligationTitle: 'Indicatif : vous gardez toujours le dernier mot.',
    submit: 'Continuer',
    submitPending: 'Enregistrement…',
    skip: 'Passer',
    selectedCount: '{count} forme(s) sélectionnée(s)',
  },

  /** Étape 7 — Finalisation (ISE-014). */
  finalize: {
    title: 'Finalisez votre profil',
    subtitle: 'Une dernière vérification avant activation.',
    summaryTitle: 'Résumé',
    promotionLabel: 'Promotion',
    skillsLabel: 'Compétences',
    sectorsLabel: 'Secteurs',
    locationLabel: 'Localisation',
    availabilityLabel: 'Disponibilité',
    completionLabel: 'Complétion du profil',
    completionUnknown: 'Complétion indisponible pour le moment.',
    nothingYet: 'Non renseigné',
    countLabel: '{count} sélectionné(s)',
    edit: 'Modifier',
    confirm: 'Je confirme que ces informations me décrivent fidèlement.',
    submit: 'Activer mon profil',
    submitPending: 'Activation en cours…',
    promotionRequiredTitle: 'Votre promotion n’est pas encore enregistrée.',
    promotionRequiredBody: 'C’est la seule information indispensable à l’activation.',
    promotionRequiredAction: 'Choisir ma promotion',
  },

  visibility: {
    private: 'Moi uniquement',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    members: 'Tous les membres',
  },
} as const;

/** Substitution `{cle}` — même convention que `apps/web/src/i18n/fr.ts::t`. */
export function t(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce<string>(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
