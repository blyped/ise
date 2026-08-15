/**
 * Toutes les chaines de l'interface Web, regroupees en un seul endroit.
 * MASTER PROMPT §66 : la V1 est en francais, mais aucune chaine importante
 * n'est dispersee dans le code — l'ajout d'un `en.ts` doit suffire.
 *
 * Convention : les cles suivent l'arborescence des ecrans (`auth.signIn.*`,
 * `dashboard.*`, `system.*`), jamais la couleur ni la position visuelle.
 */
export const fr = {
  brand: {
    name: 'Compétences ISE',
    nameLine1: 'COMPÉTENCES',
    nameLine2: 'ISE',
    signature: 'Une expertise. Un réseau. Un impact.',
    promise: 'Le réseau professionnel des Ingénieurs Statisticiens Économistes.',
    pitch:
      'Retrouvez votre promotion, rendez votre expertise visible et accédez aux bonnes personnes, aux bons projets et aux bonnes opportunités.',
    pillars: ['Trouver une expertise', 'Aider et être aidé', 'Collaborer entre promotions'],
    privacyNote: 'Vos coordonnées restent sous votre contrôle.',
  },

  common: {
    back: 'Retour',
    retry: 'Réessayer',
    continue: 'Continuer',
    cancel: 'Annuler',
    close: 'Fermer',
    loading: 'Chargement en cours…',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    goHome: 'Retour à l’accueil',
    comingSoon: 'À venir',
    correlationLabel: 'Référence à communiquer à l’assistance',
    genericError:
      'Une erreur est survenue. Réessayez ; si le problème persiste, contactez l’assistance.',
  },

  footer: {
    privacy: 'Confidentialité',
    terms: 'Conditions',
    help: 'Aide',
  },

  auth: {
    signIn: {
      title: 'Bienvenue',
      subtitle: 'Connectez-vous à Compétences ISE.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      passwordLabel: 'Mot de passe',
      forgotLink: 'Mot de passe oublié ?',
      submit: 'Se connecter',
      submitPending: 'Connexion en cours…',
      rememberMe: 'Rester connecté sur cet appareil',
      claimTitle: 'Votre profil existe peut-être déjà.',
      claimBody:
        'Si vous êtes ISE, recherchez votre nom et votre promotion avant de créer un nouveau profil.',
      noAccount: 'Pas encore de compte ?',
      createAccount: 'Créer mon compte',
      orDivider: 'ou',
      googleButton: 'Continuer avec Google',
      googlePending: 'Redirection vers Google…',
      googleUnavailable:
        'La connexion avec Google est momentanément indisponible. Utilisez votre e-mail et votre mot de passe.',
      passwordUpdated:
        'Votre mot de passe a été mis à jour. Connectez-vous avec votre nouveau mot de passe.',
      sessionExpired: 'Votre session a expiré. Reconnectez-vous pour continuer.',
      invalidCredentials: 'L’adresse e-mail ou le mot de passe est incorrect.',
      emailNotConfirmed:
        'Votre adresse e-mail n’a pas encore été confirmée. Ouvrez le message que nous vous avons envoyé.',
      tooManyAttempts:
        'Trop de tentatives de connexion. Patientez quelques minutes avant de réessayer.',
      invalidLink:
        'Ce lien de connexion n’est plus valable. Demandez-en un nouveau ou connectez-vous normalement.',
    },

    signUp: {
      title: 'Créer votre compte',
      subtitle: 'Rejoignez Compétences ISE en quelques étapes.',
      claimTitle: 'Votre profil ISE existe peut-être déjà.',
      claimBody: 'Avant de créer un nouveau profil, vérifiez l’annuaire.',
      firstNameLabel: 'Prénom',
      firstNamePlaceholder: 'Votre prénom',
      firstNameRequired: 'Renseignez votre prénom.',
      lastNameLabel: 'Nom',
      lastNamePlaceholder: 'Votre nom',
      lastNameRequired: 'Renseignez votre nom.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      passwordLabel: 'Mot de passe',
      passwordHint:
        '12 caractères minimum, avec au moins une minuscule, une majuscule et un chiffre.',
      passwordConfirmationLabel: 'Confirmer le mot de passe',
      termsLabel: 'J’accepte les Conditions d’utilisation et la Politique de confidentialité.',
      submit: 'Créer mon compte',
      submitPending: 'Création du compte…',
      alreadyMember: 'Déjà membre ?',
      signInLink: 'Se connecter',
      confirmationTitle: 'Vérifiez votre boîte e-mail',
      confirmationBody:
        'Nous venons d’envoyer un lien de confirmation à {email}. Ouvrez-le pour activer votre compte.',
      confirmationHint:
        'Le lien est valable quelques heures. Pensez à regarder dans les indésirables.',
      emailAlreadyUsed:
        'Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou réinitialisez votre mot de passe.',
      accountNote:
        'Créer un compte ne crée pas un profil ISE : vous pourrez ensuite réclamer le vôtre dans l’annuaire.',
    },

    forgotPassword: {
      title: 'Mot de passe oublié',
      subtitle:
        'Indiquez votre adresse e-mail : si un compte y est associé, vous recevrez un lien de réinitialisation.',
      emailLabel: 'Adresse e-mail',
      emailPlaceholder: 'vous@exemple.com',
      submit: 'Envoyer le lien',
      submitPending: 'Envoi en cours…',
      sentTitle: 'Message envoyé',
      sentBody:
        'Si un compte est associé à cette adresse, un lien de réinitialisation vient d’être envoyé.',
      backToSignIn: 'Revenir à la connexion',
    },

    resetPassword: {
      title: 'Choisir un nouveau mot de passe',
      subtitle: 'Votre nouveau mot de passe remplacera immédiatement l’ancien.',
      passwordLabel: 'Nouveau mot de passe',
      passwordConfirmationLabel: 'Confirmer le nouveau mot de passe',
      submit: 'Enregistrer le mot de passe',
      submitPending: 'Enregistrement…',
      invalidLinkTitle: 'Ce lien n’est plus valable',
      invalidLinkBody:
        'Le lien de réinitialisation a expiré ou a déjà été utilisé. Demandez-en un nouveau.',
      requestNewLink: 'Demander un nouveau lien',
      samePassword: 'Choisissez un mot de passe différent de l’ancien.',
    },

    /** D-161 — activation d'un compte pre-cree depuis le recensement. */
    activateAccount: {
      title: 'Bienvenue sur Compétences ISE',
      subtitle:
        'Votre profil vous attend, déjà rempli avec les informations du recensement. Choisissez votre mot de passe pour y accéder — vous pourrez ensuite le mettre à jour.',
      submit: 'Activer mon compte',
      submitPending: 'Activation…',
      invalidLinkTitle: 'Ce lien d’activation n’est plus valable',
      invalidLinkBody:
        'Le lien a expiré ou a déjà été utilisé. Utilisez « Mot de passe oublié » avec votre adresse e-mail pour recevoir un nouveau lien.',
      goToForgot: 'Recevoir un nouveau lien',
    },

    signOut: {
      title: 'Se déconnecter',
      body: 'Vous êtes sur le point de fermer votre session sur cet appareil.',
      submit: 'Se déconnecter',
      submitPending: 'Déconnexion…',
      stay: 'Rester connecté',
    },
  },

  /** ISE-005 · ISE-006 · ISE-007 — Réclamation de profil. */
  claim: {
    search: {
      title: 'Retrouver votre profil ISE',
      subtitle: 'Recherchez un profil déjà référencé avant d’en créer un nouveau.',
      panelTitle: 'Votre parcours ISE existe peut-être déjà.',
      panelBody:
        'De nombreux profils ont été référencés à partir des promotions et annuaires ISE. Retrouvez le vôtre pour conserver votre historique, vos liens et votre identité réseau.',
      panelPillars: [
        'Éviter les profils en double',
        'Retrouver votre promotion',
        'Conserver votre identité réseau',
      ],
      lastNameLabel: 'Nom',
      lastNamePlaceholder: 'Votre nom de famille',
      firstNameLabel: 'Prénom',
      firstNamePlaceholder: 'Votre prénom (facultatif)',
      graduationYearLabel: 'Année de promotion',
      graduationYearAll: 'Toutes les promotions',
      graduationYearHint: 'Facultatif : restreint la recherche à une seule promotion.',
      submit: 'Rechercher mon profil',
      submitPending: 'Recherche en cours…',
      resultsTitle: 'Profils proches',
      resultsCount: '{count} résultat',
      resultsCountPlural: '{count} résultats',
      resultsHint:
        'Ces profils sont référencés dans l’annuaire et n’ont encore été réclamés par personne.',
      promotionLabel: 'ISE {year}',
      promotionUnknown: 'Promotion non renseignée',
      organizationUnknown: 'Organisation non renseignée',
      emailHintLabel: 'E-mail historique',
      emailHintMasked: 'Masqué',
      emailHintUnknown: 'Aucun e-mail historique connu',
      select: 'C’est mon profil',
      emptyTitle: 'Aucun profil ne correspond à cette recherche.',
      emptyBody:
        'Aucun profil référencé ne porte ce nom dans l’annuaire ISE, ou il est déjà rattaché à un compte.',
      emptyAction: 'Signaler mon absence de l’annuaire',
      missingTitle: 'Le signalement en ligne n’est pas encore ouvert.',
      missingBody:
        'Aucun formulaire ne permet à ce jour de déclarer un profil absent de l’annuaire. Vérifiez l’orthographe de votre nom et réessayez sans prénom ni année : l’annuaire peut contenir une variante de votre état civil.',
      errorTitle: 'La recherche n’a pas pu aboutir.',
      alreadyLinkedTitle: 'Votre compte est déjà rattaché à un profil ISE.',
      alreadyLinkedBody:
        'Un compte ne peut être associé qu’à un seul profil. Vous n’avez donc plus de profil à réclamer.',
      pendingTitle: 'Une réclamation est déjà en cours pour votre compte.',
      pendingAction: 'Voir l’état de ma réclamation',
      backToDashboard: 'Aller au tableau de bord',
    },

    confirm: {
      title: 'Est-ce bien votre profil ?',
      subtitle: 'Vérifiez les informations avant de demander l’association à votre compte.',
      panelTitle: 'Confirmez votre identité dans le réseau ISE.',
      panelBody:
        'Votre profil référencé permet de conserver votre promotion, votre historique et les liens déjà connus du réseau. L’association au compte est vérifiée avant activation.',
      panelPillars: [
        'Aucun doublon de profil',
        'Informations vérifiées avant activation',
        'Historique réseau conservé',
      ],
      referencedBadge: 'Profil référencé',
      matchTitle: 'Éléments de correspondance',
      promotionLabel: 'Promotion',
      cityLabel: 'Ville',
      organizationLabel: 'Organisation',
      positionLabel: 'Poste',
      emailLabel: 'E-mail historique',
      notProvided: 'Non renseigné',
      methodLegend: 'Méthode de vérification',
      methodHint: 'Ce choix détermine la preuve que nous pourrons examiner.',
      methodEmail: 'L’adresse e-mail de mon compte est celle connue de l’annuaire',
      methodEmailHint:
        'Si les deux adresses sont identiques et que votre compte est confirmé, l’association est immédiate. Sinon, la demande part en revue.',
      methodEmailUnavailable:
        'Aucune adresse historique n’est enregistrée pour ce profil : cette méthode n’est pas proposée.',
      methodDocument: 'Je fournirai une pièce justificative',
      // Honnêteté : le dépôt de fichier n'est pas encore ouvert (bucket
      // `verification-documents` créé, aucun écran de dépôt livré).
      methodDocumentHint:
        'Diplôme, attestation ou pièce d’identité. Votre demande part en revue ; le dépôt du fichier en ligne n’est pas encore ouvert.',
      methodPromotionManager: 'Le délégué de ma promotion peut confirmer mon identité',
      methodPromotionManagerHint:
        'Votre demande part en revue. La sollicitation du délégué se fait aujourd’hui hors plateforme.',
      confirmLabel: 'Je confirme que ce profil correspond bien à mon identité professionnelle.',
      submit: 'Demander l’association de ce profil',
      submitPending: 'Envoi de la demande…',
      notMe: 'Ce n’est pas moi',
      backToResults: 'Retour à la recherche',
      unavailableTitle: 'Ce profil n’est plus réclamable.',
      unavailableBody:
        'Il a peut-être été réclamé entre-temps, ou il n’existe plus dans l’annuaire. Relancez une recherche.',
    },

    verification: {
      title: 'Vérification de votre réclamation',
      panelTitle: 'Bienvenue dans Compétences ISE.',
      panelBody:
        'L’association d’un compte à un profil référencé est vérifiée avant activation : c’est ce qui protège l’identité de chaque ISE.',
      panelPillars: [
        'Vérification de l’identité',
        'Aucune usurpation de profil',
        'Activation après contrôle',
      ],
      noneTitle: 'Aucune réclamation en cours.',
      noneBody: 'Commencez par rechercher votre profil dans l’annuaire ISE.',
      noneAction: 'Rechercher mon profil',
      approvedTitle: 'Votre profil est associé à votre compte.',
      approvedAutoBody:
        'L’adresse e-mail de votre compte correspond à celle enregistrée dans l’annuaire pour {name} : la vérification a été faite automatiquement.',
      approvedManualBody:
        'Votre demande sur {name} a été validée par un vérificateur. Votre profil est actif.',
      approvedAction: 'Continuer',
      pendingTitle: 'Votre demande est en attente de revue.',
      pendingBody:
        'L’adresse e-mail de votre compte ne correspond pas à celle enregistrée dans l’annuaire pour {name}. Une personne habilitée doit donc examiner votre demande.',
      // D-85 : aucun delai n'est annonce tant qu'aucun engagement reel n'existe.
      pendingNoDelay:
        'Nous ne pouvons pas vous annoncer de délai : aucun engagement de traitement n’est en place à ce jour. Vous serez prévenu dès qu’une décision sera prise.',
      pendingSubmitted: 'Demande déposée le {date}.',
      rejectedTitle: 'Votre demande n’a pas été retenue.',
      rejectedBody:
        'Le profil {name} n’a pas été associé à votre compte. Vous pouvez relancer une recherche si vous pensez qu’il s’agit d’une erreur.',
      rejectedAction: 'Relancer une recherche',
      withdrawnTitle: 'Cette réclamation a été retirée.',
      expiredTitle: 'Cette réclamation a expiré.',
      statusLabel: 'État de la demande',
      status: {
        submitted: 'En attente de revue',
        under_review: 'En cours d’examen',
        approved: 'Approuvée',
        rejected: 'Refusée',
        withdrawn: 'Retirée',
        expired: 'Expirée',
      },
      errorTitle: 'Impossible de lire l’état de votre réclamation.',
    },

    entryLink: 'Réclamer mon profil',
  },

  nav: {
    sidebarLabel: 'Navigation principale',
    home: 'Accueil',
    network: 'Réseau',
    networkCalls: 'Appels au réseau',
    opportunities: 'Opportunités',
    collaborate: 'Collaborer',
    communities: 'Communautés',
    news: 'Actualités',
    events: 'Événements',
    messages: 'Messages',
    myProfile: 'Mon profil',
    myAvailability: 'Ma disponibilité',
    settings: 'Paramètres',
    help: 'Aide & Support',
    comingSoonHint: 'Cette section sera ouverte dans une prochaine livraison.',
    accountMenuLabel: 'Mon compte',
    /** D-160 — lien d'en-tete vers le back-office, visible seulement avec des permissions. */
    adminArea: 'Administration',
  },

  dashboard: {
    greeting: 'Bonjour {firstName}',
    greetingFallback: 'Bonjour',
    subtitle: 'Voici ce qui mérite votre attention aujourd’hui.',
    noProfileTitle: 'Votre compte n’est pas encore rattaché à un profil ISE.',
    noProfileBody:
      'Un compte de connexion et un profil ISE sont deux choses distinctes. Recherchez votre profil dans l’annuaire pour les associer.',
    noProfileAction: 'Réclamer mon profil',
    claimApprovedTitle: 'Votre profil ISE est désormais associé à votre compte.',
    claimApprovedBody:
      'Les étapes de complétion de votre profil seront ouvertes dans une prochaine livraison.',
    profileCardTitle: 'Votre profil',
    profileCompletion: '{value} % complété',
    profileCompletionHint: 'Calculé à partir des informations réellement enregistrées.',
    profileCompletionUnknown: 'Complétion indisponible pour le moment.',
    promotionCardTitle: 'Votre promotion',
    promotionUnknownTitle: 'Promotion non renseignée',
    promotionUnknownBody:
      'Aucune promotion n’est encore associée à votre profil dans la base Compétences ISE.',
    claimStatus: {
      unclaimed: 'Profil non réclamé',
      claim_pending: 'Réclamation en cours d’examen',
      claimed: 'Profil réclamé',
    },
    verificationStatus: {
      unverified: 'Identité non vérifiée',
      pending: 'Vérification en cours',
      verified: 'Identité vérifiée',
      rejected: 'Vérification refusée',
    },
    networkNeedsYou: 'Le réseau a besoin de vous',
    opportunitiesForYou: 'Opportunités pour vous',
    peopleYouMayKnow: 'ISE que vous pourriez connaître',
    moduleUnavailableTitle: 'Ce module n’est pas encore ouvert',
    moduleUnavailableBody:
      'Rien n’est affiché ici tant que les données réelles ne sont pas disponibles : aucun contenu de démonstration n’est présenté.',
    loadErrorTitle: 'Impossible de charger vos informations de profil.',
    loadErrorBody: 'Le reste du tableau de bord reste utilisable.',
  },

  system: {
    notFound: {
      code: '404',
      title: 'Cette page n’existe pas ou a été déplacée.',
      body: 'Aucun souci : vous pouvez revenir à l’accueil.',
      primary: 'Retour à l’accueil',
    },
    serverError: {
      code: '500',
      title: 'Une erreur est survenue de notre côté.',
      body: 'L’incident a été enregistré. Réessayez dans un instant ; si le problème persiste, communiquez la référence ci-dessous à l’assistance.',
      primary: 'Réessayer',
      secondary: 'Retour à l’accueil',
    },
    sessionExpired: {
      title: 'Votre session a expiré',
      body: 'Pour protéger votre compte, nous vous demandons de vous reconnecter.',
      reason: 'Votre session est restée inactive trop longtemps.',
      kept: 'Les données déjà enregistrées restent disponibles. Les données non enregistrées peuvent devoir être saisies de nouveau.',
      primary: 'Se reconnecter',
      secondary: 'Retour à l’accueil',
      securityNote: 'Ne partagez jamais votre mot de passe ni un code de connexion.',
    },
    accessDenied: {
      title: 'Accès refusé',
      body: 'Votre compte ne dispose pas des droits nécessaires pour consulter cette page.',
      hint: 'Si vous pensez qu’il s’agit d’une erreur, contactez l’assistance en indiquant la référence ci-dessous.',
      primary: 'Retour à l’accueil',
    },
    /**
     * SYS-003 — Service temporairement indisponible.
     * Affiché quand une fenêtre de maintenance RÉELLEMENT active (table
     * `maintenance_windows`) ne concerne qu'un service. Aucun horaire ni
     * pourcentage inventé (MASTER PROMPT §44) : seules les informations
     * déclarées par la fenêtre sont affichées.
     */
    serviceUnavailable: {
      title: 'Service temporairement indisponible',
      body: '{service} n’est pas disponible pour le moment.',
      rest: 'Le reste de Compétences ISE continue de fonctionner normalement.',
      serviceLabel: 'Service concerné',
      unavailableBadge: 'Indisponible',
      restoring: 'Nous rétablissons l’accès dès que possible.',
      retry: 'Réessayer',
      continueHome: 'Continuer sur l’accueil',
      othersTitle: 'Vous pouvez continuer à utiliser',
      noQueue:
        'Aucune action n’est mise en file d’attente pendant l’indisponibilité : rien n’est envoyé à votre insu.',
      services: {
        messaging: 'La messagerie',
        search: 'La recherche',
        notifications: 'Les notifications',
        imports: 'Les imports de données',
      },
    },
    /**
     * SYS-004 — Maintenance en cours. Même règle : uniquement ce que la
     * fenêtre déclare (titre, période planifiée, message, périmètre).
     */
    maintenance: {
      title: 'Maintenance en cours',
      body: 'Compétences ISE est momentanément indisponible pour une intervention planifiée.',
      reassurance: 'Vos données restent protégées.',
      windowTitle: 'Fenêtre de maintenance',
      statusInProgress: 'En cours',
      statusScheduled: 'Annoncée',
      fromTo: 'Du {start} au {end}',
      readOnly: 'Pendant cette fenêtre, la plateforme est en lecture seule.',
      scopeLabel: 'Périmètre',
      scopeAll: 'Toute la plateforme',
      retry: 'Réessayer',
      honesty:
        'Seules les informations déclarées par l’équipe sont affichées ici : aucune progression ni heure de retour n’est estimée.',
      upcomingTitle: 'Maintenance planifiée',
    },
    /**
     * SYS-010 — Connexion perdue. Bandeau global `role="status"`,
     * reprise automatique à la reconnexion. Aucune promesse de
     * synchronisation d'actions hors ligne (§45-46 : mobile uniquement).
     */
    connectionLost: {
      title: 'Connexion perdue',
      body: 'Compétences ISE ne peut plus communiquer avec le serveur.',
      hint: 'Vous pouvez continuer à consulter l’écran affiché ; les actions nécessitant un envoi échoueront tant que la connexion n’est pas rétablie. Aucune action n’est enregistrée hors connexion.',
      retry: 'Réessayer maintenant',
      retrying: 'Vérification de la connexion…',
      stillOffline: 'Toujours hors connexion. Nous réessaierons automatiquement.',
      restored: 'Connexion rétablie.',
    },
  },
  /**
   * PUB-001 — Site public (ADDENDUM §7, §8, §52, §53).
   *
   * Aucune donnee metier ici : uniquement des libelles d'interface et le
   * discours de marque. Les titres de section, les chiffres, les noms et les
   * cartes viennent de la base (ADDENDUM §8 et §23).
   */
  public: {
    skipToContent: 'Aller au contenu principal',

    nav: {
      label: 'Navigation principale',
      home: 'Accueil',
      highlights: 'À la une',
      network: 'Le réseau',
      news: 'Actualités',
      events: 'Événements',
      opportunities: 'Opportunités',
      expertises: 'Expertises',
      partners: 'Partenaires',
      signIn: 'Connexion',
      memberSpace: 'Mon espace',
      openMenu: 'Ouvrir le menu',
      closeMenu: 'Fermer le menu',
      menuLabel: 'Menu',
    },

    carousel: {
      label: 'Mises en avant du réseau',
      roleDescription: 'carrousel',
      slideRoleDescription: 'diapositive',
      previous: 'Diapositive précédente',
      next: 'Diapositive suivante',
      pause: 'Mettre le défilement en pause',
      play: 'Reprendre le défilement',
      goTo: 'Aller à la diapositive {index}',
      position: 'Diapositive {index} sur {total}',
      emptyTitle: 'Aucune mise en avant publiée.',
      emptyBody:
        'Le carrousel affichera les contenus programmés depuis le CMS. Tant qu’aucun contenu n’est publié, rien n’est inventé ici.',
    },

    highlights: {
      title: 'À la une du réseau',
      emptyTitle: 'Aucun contenu à la une pour le moment.',
      emptyBody:
        'Actualités, événements, opportunités et ISE du jour apparaîtront ici dès leur publication.',
      sponsored: 'Contenu partenaire',
    },

    pillars: {
      title: 'Un réseau conçu pour être utile',
      /**
       * VALEURS D'ORIGINE, PAS LA SOURCE DE VÉRITÉ (0129).
       *
       * Depuis la migration 0129, le titre et le corps des quatre piliers
       * viennent de `cms_pillars` et se modifient dans /cms/piliers. Ces
       * quatre couples y ont été recopiés à l'identique par la migration :
       * ce que voit un visiteur vient de la base, pas d'ici.
       *
       * Pourquoi les garder alors ? Pour deux cas où la base ne dit rien,
       * et où une carte vide serait un contenu cassé :
       *   1. l'administrateur vide le champ — l'aide du formulaire annonce
       *      justement « laisser vide = revenir au texte d'origine » ;
       *   2. `get_landing_pillars()` est en panne — la section doit encore
       *      afficher ses quatre piliers.
       * La clé s'appelle `defaults` et non `items` précisément pour qu'aucun
       * appelant ne puisse la prendre pour la source de vérité. Ces libellés
       * ne sont donc pas un doublon silencieux : ils sont le repli déclaré.
       * Elle fixe aussi l'ordre et la liste des quatre clés, qui eux ne sont
       * pas éditables (4 lignes fixes en base depuis 0114).
       */
      defaults: [
        { key: 'connecter', title: 'Connecter', body: 'Trouvez l’expertise et la bonne personne.' },
        { key: 'entraider', title: 'Entraider', body: 'Demandez ou apportez une aide ciblée.' },
        {
          key: 'collaborer',
          title: 'Collaborer',
          body: 'Montez missions, projets et consortiums.',
        },
        {
          key: 'impacter',
          title: 'Impacter',
          body: 'Mesurez les résultats professionnels facilités.',
        },
      ],
    },

    stats: {
      title: 'Le réseau en quelques chiffres',
      shortTitle: 'Le réseau en chiffres',
      emptyTitle: 'Les chiffres du réseau ne sont pas encore calculés.',
      emptyBody:
        'Ils seront produits par les fonctions d’agrégation de la base. Aucun nombre n’est affiché tant qu’il n’est pas mesuré.',
    },

    expertises: {
      title: 'Explorer les expertises',
      emptyTitle: 'Aucune expertise mise en avant.',
      emptyBody: 'La sélection provient de la taxonomie réelle des compétences.',
    },

    partners: {
      title: 'Entreprises & partenaires',
      emptyTitle: 'Aucune campagne partenaire en cours.',
      emptyBody:
        'Les campagnes programmées apparaîtront ici pendant leur période de diffusion, avec leur mention de transparence.',
    },

    finalCta: {
      title: 'Vous êtes Ingénieur Statisticien Économiste ?',
      body: 'Votre expertise a sa place dans le réseau.',
      signIn: 'Connexion',
      claim: 'Réclamer mon profil',
    },

    footer: {
      label: 'Liens de bas de page',
      contact: 'Contact',
      rights: 'Compétences ISE',
      /** Mention discrète de crédit, affichée après le copyright dans PublicFooter. */
      credit: 'BLY Ped, ISE 2000',
    },

    signInPrompt: 'Connectez-vous pour accéder à cette ressource.',
    resourcePrompt: {
      evenement: 'Connectez-vous pour accéder à cet événement.',
      actualite: 'Connectez-vous pour accéder à cette actualité.',
      opportunite: 'Connectez-vous pour accéder à cette opportunité.',
      profil: 'Connectez-vous pour accéder à ce profil.',
      expertise: 'Connectez-vous pour explorer cette expertise.',
      appel: 'Connectez-vous pour accéder à cet appel au réseau.',
      'espace-membre': 'Connectez-vous pour accéder à cette ressource.',
    },

    seo: {
      title: 'Compétences ISE — le réseau des Ingénieurs Statisticiens Économistes',
      description:
        'Retrouvez votre promotion, rendez votre expertise visible et accédez aux bonnes personnes, aux bons projets et aux bonnes opportunités.',
      ogAlt: 'Compétences ISE — une expertise, un réseau, un impact.',
    },
  },
} as const;

/** Remplacement de jetons `{cle}` dans une chaine traduite. */
export function t(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
