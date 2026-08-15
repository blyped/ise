/**
 * Textes francais du back-office CMS (CMS-001 -> CMS-010).
 *
 * Fichier separe de `src/i18n/fr.ts`, comme `i18n/opportunities.ts` : le
 * dictionnaire central n'a pas a grandir a chaque tranche.
 *
 * REGLE : aucun texte ne promet une action que la base refuserait. Les
 * libelles de statut sont ceux du vocabulaire ferme de `docs/cms.md` §3,
 * traduits une seule fois ici.
 */
export const frCms = {
  brand: {
    title: 'Compétences',
    subtitle: 'CMS',
    breadcrumb: 'CMS · Site public',
    skipToContent: 'Aller au contenu principal',
    openMenu: 'Ouvrir le menu du CMS',
    closeMenu: 'Fermer le menu du CMS',
    nav: 'Navigation du CMS',
  },

  nav: {
    dashboard: 'Tableau de bord',
    carousel: 'Carrousel',
    sections: 'Sections accueil',
    pillars: 'Piliers réseau',
    news: 'Actualités',
    events: 'Événements',
    opportunities: 'Opportunités',
    featuredProfile: 'ISE du jour',
    partners: 'Partenaires',
    landingOrganizations: 'Organisations (logos)',
    media: 'Médiathèque',
    schedule: 'Programmation',
    landingQueue: 'File « À la une »',
    preview: 'Aperçu',
    backToAdmin: "Retour à l'administration",
    backToMember: "Retour à l'espace membre",
    /**
     * Pastille d'écart d'exposition d'une entrée de menu (0139). Le nombre
     * seul ne dit pas de quoi il s'agit : ce complément est lu à la suite du
     * libellé (« Événements, 1 à traiter »), et la couleur de la pastille ne
     * porte donc jamais seule l'information (D-90).
     *
     * « À traiter » plutôt qu'« en attente » comme en administration : rien
     * n'attend ici une décision reçue d'un tiers, c'est la vitrine qui
     * s'écarte de ce que le CMS a demandé.
     */
    pendingCount: (count: number) => `, ${count} à traiter`,
    /** Même comptage, cumulé, sur le bouton du menu replié (mobile). */
    pendingTotal: (count: number) =>
      count > 1 ? `${count} éléments à traiter` : `${count} élément à traiter`,
  },

  /** Vocabulaire d'etat commun (docs/cms.md §3). */
  status: {
    draft: 'Brouillon',
    scheduled: 'Programmé',
    published: 'Publié',
    expired: 'Expiré',
    archived: 'Archivé',
  } as Record<string, string>,

  /**
   * 0137 — pourquoi un contenu marqué « Visible sur la landing » n'y paraît
   * pourtant pas.
   *
   * Ces libellés traduisent les codes renvoyés par
   * `private.landing_event_block_reason()` et
   * `private.landing_opportunity_block_reason()`, c'est-à-dire par le
   * prédicat même dont les projections se servent pour filtrer. Tant qu'un
   * code apparaît ici, l'écran dit la vérité ; un code inconnu se replie sur
   * `unknown` plutôt que d'afficher une chaîne vide rassurante.
   */
  landingBlocked: {
    label: 'Ne paraît pas sur la landing',
    reasons: {
      /* Événements. */
      not_published: 'l’événement n’est pas au statut « publié ».',
      cancelled: 'l’événement est annulé.',
      past: 'l’événement est terminé. Seuls les événements à venir ou en cours paraissent sur la landing, et l’épinglage ne change pas cette règle. Pour mettre en avant un événement passé, publiez une actualité rétrospective.',
      /* Opportunités. */
      not_active: 'l’offre n’est pas au statut « active ».',
      moderation_pending: 'l’offre attend encore une décision de modération.',
      not_published_yet: 'l’offre n’a pas encore de date de publication passée.',
      deadline_passed: 'l’échéance de candidature est dépassée.',
      /* Communs. */
      not_members: 'la visibilité du contenu n’est pas « membres ».',
      landing_hidden: 'le contenu est masqué de la landing.',
      excluded: 'le contenu est exclu par une règle éditoriale du CMS.',
      unknown: 'une règle de publication n’est pas satisfaite.',
    } as Record<string, string>,
  },

  scheduleStatus: {
    pending: 'En attente',
    applied: 'Appliqué',
    cancelled: 'Annulé',
    failed: 'En échec',
  } as Record<string, string>,

  sourceMode: {
    automatic: 'Automatique',
    manual: 'Manuel',
    hybrid: 'Mixte',
  } as Record<string, string>,

  placement: {
    carousel: 'Carrousel',
    partners_band: 'Bandeau partenaires',
    news_inline: 'Dans les actualités',
    sidebar: 'Colonne latérale',
    // 0133 — le libelle dit ce que l'emplacement fait reellement depuis que
    // le bandeau image du bas de page existe. « Pied de page » seul laissait
    // croire a un encart dans le pied de page du site.
    footer: 'Bandeau bas de page (image seule)',
  } as Record<string, string>,

  selectionMode: {
    automatic: 'Automatique',
    manual: 'Manuel',
    fallback: 'Repli',
  } as Record<string, string>,

  landingVisibility: {
    hidden: 'Masqué sur la landing',
    visible: 'Visible sur la landing',
  } as Record<string, string>,

  common: {
    search: 'Rechercher…',
    searchLabel: 'Rechercher',
    submitSearch: 'Rechercher',
    clear: 'Effacer',
    add: '+ Ajouter',
    save: 'Enregistrer',
    cancel: 'Annuler',
    saving: 'Enregistrement en cours…',
    manage: 'Gérer',
    back: 'Retour',
    actions: 'Actions',
    notScheduled: 'Non programmé',
    permanent: 'Permanent',
    realTime: 'Temps réel',
    none: '—',
    yes: 'Oui',
    no: 'Non',
    loadError: 'Impossible de charger cette section.',
    saved: 'Modification enregistrée.',
    published: 'Contenu publié. Le cache de la landing a été invalidé.',
    publishedNoCache: 'Contenu publié. Le cache de la landing n’a pas pu être invalidé.',
    unpublished: 'Contenu retiré de la landing.',
    rolledBack: 'Version publiée précédente restaurée.',
    deleted: 'Élément supprimé.',
    requiredField: 'Ce champ est obligatoire.',
    forbidden: 'Vous n’avez pas la permission d’effectuer cette action.',
    readOnlyHint:
      'Vous consultez le CMS en lecture seule : la permission d’édition n’est pas rattachée à votre compte.',
    mobileHint:
      'Sur mobile, le CMS permet de consulter, activer, programmer et valider. Les éditions lourdes restent plus confortables sur ordinateur.',
  },

  actions: {
    publish: 'Publier',
    unpublish: 'Dépublier',
    schedule: 'Programmer',
    archive: 'Archiver',
    restore: 'Remettre en brouillon',
    rollback: 'Revenir à la version précédente',
    delete: 'Supprimer',
    edit: 'Modifier',
    duplicate: 'Dupliquer',
    moveUp: 'Monter d’un rang',
    moveDown: 'Descendre d’un rang',
    enable: 'Activer',
    disable: 'Désactiver',
  },

  guard: {
    /** SYS-006 : la redirection est decidee cote serveur, pas par un bouton masque. */
    deniedTitle: 'Accès au CMS refusé',
    deniedBody:
      'Aucune permission CMS n’est rattachée à votre compte. L’accès est décidé en base, pas par l’interface.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-001 — Tableau de bord                                        */
  /* ---------------------------------------------------------------- */
  dashboard: {
    title: 'Tableau de bord CMS',
    subtitle: 'Pilotez l’ensemble du contenu visible sur la landing page.',
    kpiPublishedToday: 'contenus publiés aujourd’hui',
    kpiScheduled: 'éléments programmés',
    kpiCarouselLive: 'slides de carrousel en ligne',
    kpiAlerts: 'alertes éditoriales',
    cardCarousel: 'Carrousel',
    cardSections: 'Sections accueil',
    cardNews: 'Actualités',
    cardEvents: 'Événements',
    cardFeatured: 'ISE du jour',
    cardPartners: 'Partenaires',
    cardMedia: 'Médiathèque',
    cardSchedule: 'Programmation',
    previewTitle: 'Prévisualisation de la landing',
    previewOpen: 'Ouvrir l’aperçu',
    lastPublication: 'Dernière publication',
    neverPublished: 'Aucune publication à ce jour.',
    automationTitle: 'Automatisations',
    automationSubtitle:
      'État réel lu dans pg_cron. Une tâche n’est déclarée « active » que si l’ordonnanceur la contient.',
    automationNever: 'Jamais exécutée',
    automationLastRun: 'Dernière exécution',
    automationActive: 'Active',
    automationInactive: 'Inactive',
    automationUnavailable:
      'L’état des automatisations n’a pas pu être lu. Le point d’appel manuel reste run_cms_automations().',
    alertsTitle: 'Alertes éditoriales',
    noAlerts: 'Aucune alerte : rien à corriger dans la configuration actuelle.',
    emptyCounters:
      'Les compteurs affichent l’état réel de la base. Un zéro signifie qu’il n’existe encore rien, pas que la lecture a échoué.',
    jobs: {
      cms_expire_content: 'Expiration automatique',
      cms_publish_scheduled: 'Publication programmée',
      cms_select_featured_profile: 'Sélection ISE du jour',
      cms_publish_featured_profile: 'Publication ISE du jour',
    } as Record<string, string>,
    alerts: {
      schedule_failed: 'ordre(s) de programmation en échec',
      schedule_overdue: 'ordre(s) de programmation échus, non encore appliqués',
      sponsored_orphan: 'slide(s) sponsorisée(s) sans campagne active',
      media_no_variant: 'média(s) sans variante Desktop ni Mobile',
      featured_missing: 'aucun ISE du jour publié pour aujourd’hui',
      campaign_expiring: 'campagne(s) partenaires expirant sous 7 jours',
    } as Record<string, string>,
  },

  /* ---------------------------------------------------------------- */
  /* CMS-002 — Carrousel                                              */
  /* ---------------------------------------------------------------- */
  carousel: {
    title: 'Carrousel',
    subtitle: 'Gérez ordre, visuels, dates et liens.',
    add: '+ Ajouter une slide',
    slide: 'Slide',
    emptyTitle: 'Aucune slide dans le carrousel',
    emptyBody:
      'Le carrousel de la landing est vide. Créez une première slide : elle restera en brouillon jusqu’à sa publication.',
    orderLabel: 'Ordre d’affichage',
    orderHelp:
      'Le rang se change au clavier avec les boutons Monter et Descendre, ou en saisissant une priorité. Aucun glisser-déposer n’est nécessaire.',
    reorderRegion: 'Réordonnancement du carrousel',
    moved: 'Ordre du carrousel mis à jour.',
    fieldTitle: 'Titre',
    fieldSubtitle: 'Sous-titre',
    fieldDescription: 'Description',
    fieldContentType: 'Nature de la slide',
    fieldMedia: 'Visuel Desktop',
    fieldMobileMedia: 'Visuel Mobile',
    fieldMediaHelp:
      'Deux visuels distincts : le Desktop est cadré en 16/9, le Mobile en portrait. Chacun porte son propre texte alternatif. Formats recommandés : Desktop 1920 × 1080 px (16/9), Mobile 1080 × 1350 px (4/5), JPEG/WebP/AVIF, 5 Mo maximum.',
    fieldCta: 'Libellé du bouton',
    fieldEntity: 'Ressource liée',
    fieldEntityHelp:
      'La slide pointe une ressource par son type et son identifiant. Aucune URL interne n’est stockée : la route est calculée par l’application (ADDENDUM §10).',
    fieldEntityType: 'Type de ressource',
    fieldEntityId: 'Identifiant de la ressource',
    fieldStart: 'Début de diffusion',
    fieldEnd: 'Fin de diffusion',
    fieldPriority: 'Priorité (0 à 1000)',
    fieldTextPosition: 'Affichage des textes',
    fieldTextPositionHelp:
      'Sur l’image, sous l’image (bandeau bleu nuit), ou masqués. Le titre reste requis : il sert à l’administration et aux lecteurs d’écran.',
    textPositionOverlay: 'Sur l’image',
    textPositionBelow: 'Sous l’image',
    textPositionHidden: 'Masqués',
    fieldDimMedia: 'Assombrir le visuel',
    fieldDimMediaHelp:
      'Applique un voile sombre sur l’image. Recommandé quand les textes sont affichés sur l’image, pour la lisibilité.',
    fieldSponsored: 'Slide sponsorisée',
    fieldCampaign: 'Campagne partenaire',
    sponsoredHelp:
      'Une slide sponsorisée est obligatoirement rattachée à la campagne qui porte sa mention de transparence. Sans campagne active, elle n’est pas diffusée (ADDENDUM §26).',
    sponsoredBadge: 'Sponsorisé',
    noMedia: 'Aucun visuel',
    previewTitle: 'Aperçu de la slide',
    previewNote:
      'Aperçu du brouillon en cours. Il ne modifie pas la landing tant que la slide n’est pas publiée.',
    createdTitle: 'Nouvelle slide',
    createdBody:
      'La slide est créée en brouillon. Publiez-la pour qu’elle paraisse sur la landing.',
    deleteTitle: 'Supprimer cette slide ?',
    deleteBody:
      'La slide et son texte éditorial seront supprimés définitivement. Les médias restent dans la médiathèque.',
    deleteConfirm: 'Supprimer définitivement',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-003 — Sections d'accueil                                     */
  /* ---------------------------------------------------------------- */
  sections: {
    title: 'Sections accueil',
    subtitle: 'Activez, masquez et réordonnez les sections.',
    emptyTitle: 'Aucune section configurée',
    emptyBody: 'Le squelette de la landing est vide.',
    fieldTitle: 'Titre affiché',
    fieldSubtitle: 'Sous-titre',
    fieldEnabled: 'Section active',
    fieldOrder: 'Ordre',
    fieldSource: 'Source du contenu',
    fieldMaxItems: 'Nombre de cartes (0 à 24)',
    fieldCtaLabel: 'Libellé du CTA',
    fieldCtaEntityType: 'Cible du CTA — type',
    fieldCtaEntityId: 'Cible du CTA — identifiant',
    structural: 'Section structurelle',
    structuralHelp:
      'Une section structurelle fait partie du squelette de la landing : elle peut être masquée, jamais supprimée.',
    sourceHelp:
      'Automatique : la section se remplit depuis les modules. Manuel : seuls les contenus épinglés paraissent. Mixte : les épinglages passent devant, le reste suit la source automatique.',
    cardsCount: (n: number) => `${n} carte${n > 1 ? 's' : ''}`,
  },

  /* ---------------------------------------------------------------- */
  /* CMS-011 (0114) — Piliers « Un réseau conçu pour être utile »      */
  /* ---------------------------------------------------------------- */
  pillars: {
    title: 'Piliers du réseau',
    subtitle:
      'Connecter, Entraider, Collaborer, Impacter — les quatre encarts de « Un réseau conçu pour être utile » sur la page d’accueil. Modifiez ici leur titre, leur texte, leur visuel, une légende optionnelle et le lien vers un écran réel.',
    scopeNote:
      'Les quatre piliers sont fixes : on n’en ajoute ni n’en supprime. Tout leur contenu se modifie ici (0129). Laisser le titre ou le texte vide remet le pilier sur son libellé d’origine — la page d’accueil n’affiche jamais un encart sans texte. Un pilier sans lien choisi reste du texte seul — jamais un écran inventé (D-168).',
    fieldTitle: 'Titre du pilier',
    fieldTitleHint:
      'Le mot affiché en majuscules en haut de l’encart (2 à 60 caractères). Laissez vide pour revenir au libellé d’origine.',
    fieldBody: 'Texte du pilier',
    fieldBodyHint:
      'La phrase affichée sous le titre (2 à 280 caractères). Laissez vide pour revenir au texte d’origine.',
    /** Compteur commun aux deux champs libres, même formulation qu’ailleurs. */
    charactersLeft: '{count} caractère restant',
    charactersLeftPlural: '{count} caractères restants',
    fieldMedia: 'Visuel du pilier',
    fieldMediaNone: 'Aucun visuel',
    fieldMediaHint:
      'Visuel choisi dans la médiathèque publique — jamais un chemin recopié à la main. Format recommandé : 1600 × 900 px (ratio 16/9), JPEG/WebP/AVIF, 5 Mo maximum. Sans visuel, le pilier s’affiche en texte seul (0114).',
    fieldCaption: 'Légende (optionnelle)',
    fieldCaptionHint:
      'S’ajoute au texte du pilier, sans le remplacer — une précision de circonstance, par exemple. Laissez vide pour n’afficher que le texte du pilier.',
    fieldLink: 'Lien',
    fieldLinkNone: 'Aucun lien (texte seul)',
    linkOptions: {
      search: 'Rechercher un ISE (/rechercher)',
      calls: 'Appels au réseau (/appels)',
      projects: 'Projets & consortiums (/projets)',
      opportunities: 'Opportunités (/opportunites)',
      applications: 'Mes candidatures (/candidatures)',
    } as Record<string, string>,
    submit: 'Enregistrer le pilier',
    done: 'Pilier enregistré.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-004 — Actualites                                             */
  /* ---------------------------------------------------------------- */
  news: {
    title: 'Actualités',
    subtitle: 'Choisissez ce qui paraît sur la landing, et quand.',
    emptyTitle: 'Aucune actualité',
    emptyBody:
      'Le module Actualités ne contient encore aucun article. Le CMS n’en crée pas : il choisit lesquels paraissent sur la vitrine publique.',
    scopeNote:
      'Le CMS orchestre l’exposition sur la landing. Il ne remplace pas le circuit éditorial du module Actualités : ni le statut éditorial ni le corps de l’article ne sont modifiables ici (D-128).',
    editorialStatus: 'Statut éditorial',
    landingVisible: 'Visible sur la landing',
    landingHidden: 'Masquée',
    featured: 'À la une',
    notFeatured: 'Pas à la une',
    setFeatured: 'Mettre à la une',
    unsetFeatured: 'Retirer de la une',
    show: 'Afficher sur la landing',
    hide: 'Retirer de la landing',
    priority: 'Priorité éditoriale',
    cover: 'Couverture',
    noCover: 'Aucune couverture',
    /**
     * 0117 — une seule image par article, choisie ici, réutilisée telle
     * quelle sur la carte de la landing et sur la page article : plus de
     * chemin recopié à la main (`news.image_path`, déprécié), plus de
     * second visuel à téléverser ailleurs.
     */
    coverLabel: 'Visuel',
    coverMedia: 'Visuel de couverture',
    coverMediaNone: 'Aucun visuel',
    coverHelp:
      'Visuel choisi dans la médiathèque publique (comme le carrousel, les événements et les opportunités) — jamais un chemin recopié à la main. Réutilisé automatiquement sur la carte de la landing et sur la page de l’article : un seul visuel à téléverser pour tout l’article. Format recommandé : 1600 × 900 px (ratio 16/9), JPEG/WebP/AVIF, 5 Mo maximum. Sans visuel, la carte et l’article s’affichent sans image (0117).',
    coverSubmit: 'Enregistrer le visuel',
    coverDone: 'Visuel enregistré.',
    coverHasText: 'Texte déjà incrusté dans l’image',
    coverHasTextOn: 'Contient déjà un titre',
    coverHasTextOff: 'Photo simple, sans texte',
    coverHasTextHelp:
      'À activer quand le visuel est une affiche ou un visuel d’événement qui porte déjà son titre : la carte d’accueil n’affiche alors plus le titre en double sous l’image (il reste présent pour les lecteurs d’écran). Sans effet sur la page de l’article, où le titre reste toujours affiché.',
    scheduleLabel: 'Programmer l’exposition',
    pendingSchedule: 'Programmation en attente',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-005 — Evenements                                             */
  /* ---------------------------------------------------------------- */
  events: {
    title: 'Événements',
    subtitle: 'Source réelle : le module Événements. Le CMS choisit ce qui paraît.',
    emptyTitle: 'Aucun événement',
    emptyBody:
      'Le module Événements ne contient encore aucune date. Un événement passé quitte la landing de lui-même : aucun drapeau à maintenir.',
    upcoming: 'À venir',
    past: 'Passé',
    cancelled: 'Annulé',
    pinned: 'Épinglé',
    pin: 'Épingler sur la landing',
    unpin: 'Retirer l’épinglage',
    pinHelp:
      'L’épinglage est un override éditorial borné dans le temps : il passe devant la source automatique, puis expire de lui-même (ADDENDUM §43).',
    scopeNote:
      'Le CMS ne modifie ni le statut de l’événement, ni ses dates, ni son URL de connexion. Il ne pilote que son exposition sur la landing (D-128).',
    coverLabel: 'Visuel',
    coverMedia: 'Visuel de la carte',
    coverMediaNone: 'Aucun visuel',
    coverHelp:
      'Visuel choisi dans la médiathèque publique (comme le carrousel) — jamais un chemin recopié à la main. Format recommandé : 1600 × 900 px (ratio 16/9), JPEG/WebP/AVIF, 5 Mo maximum. Sans visuel, la carte s’affiche sans image (0113).',
    coverSubmit: 'Enregistrer le visuel',
    coverDone: 'Visuel enregistré.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-006bis (0113) — Opportunites                                  */
  /* ---------------------------------------------------------------- */
  opportunities: {
    title: 'Opportunités',
    subtitle: 'Source réelle : le module Opportunités. Le CMS choisit ce qui paraît.',
    emptyTitle: 'Aucune opportunité',
    emptyBody:
      'Le module Opportunités ne contient encore aucune offre. Une opportunité expirée ou dépubliée quitte la landing d’elle-même.',
    pinned: 'Épinglée',
    pin: 'Épingler sur la landing',
    unpin: 'Retirer l’épinglage',
    pinHelp:
      'L’épinglage est un override éditorial borné dans le temps : il passe devant la source automatique, puis expire de lui-même (ADDENDUM §43).',
    scopeNote:
      'Le CMS ne modifie ni le statut de l’offre, ni sa modération, ni sa description. Ni la rémunération, ni le contact, ni l’URL de candidature externe ne transitent jamais ici (ADDENDUM §13). Il ne pilote que son exposition sur la landing et son visuel (D-128).',
    coverLabel: 'Visuel',
    coverMedia: 'Visuel de la carte',
    coverMediaNone: 'Aucun visuel',
    coverHelp:
      'Visuel choisi dans la médiathèque publique — jamais un chemin recopié à la main, et distinct de tout logo d’organisation. Format recommandé : 1600 × 900 px (ratio 16/9), JPEG/WebP/AVIF, 5 Mo maximum. Sans visuel, la carte s’affiche sans image (0113).',
    coverSubmit: 'Enregistrer le visuel',
    coverDone: 'Visuel enregistré.',
    scheduleLabel: 'Programmer l’exposition',
    pendingSchedule: 'Programmation en attente',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-006 — ISE du jour                                            */
  /* ---------------------------------------------------------------- */
  featured: {
    title: 'ISE du jour',
    subtitle: 'Automatisez la sélection quotidienne tout en gardant un contrôle éditorial.',
    automationOn: 'Automatisation active',
    automationOff: 'Automatisation suspendue',
    automationHelp:
      'Sélection à 05:30 UTC · publication à 06:00 UTC après contrôles d’éligibilité.',
    suspend: 'Suspendre l’automatisation',
    resume: 'Reprendre l’automatisation',
    resumeNote:
      'La reprise clôt les épinglages en cours : la rotation automatique redevient la source.',
    currentTitle: 'ISE du jour actuel',
    currentNone: 'Aucune sélection publiée',
    currentNoneBody:
      'Aucun profil n’a encore été retenu. Le bloc est simplement masqué sur la landing : la page ne casse pas.',
    rulesTitle: 'Règles d’éligibilité',
    rulesHelp:
      'Ces règles sont celles appliquées en base par private.featured_profile_eligible(). L’écran les lit, il ne les paraphrase pas.',
    ruleMinDays: 'Délai minimum entre deux mises en avant (jours)',
    ruleRequireClaimed: 'Profil réclamé et actif',
    ruleRequirePublicPhoto: 'Portrait public consenti',
    ruleRequirePromotion: 'Promotion renseignée',
    ruleRequireExpertise: 'Expertise ou fonction renseignée',
    ruleBalance: 'Dimension d’équilibrage de la rotation',
    balance: {
      none: 'Aucune',
      promotion: 'Promotion',
      country: 'Pays',
      sector: 'Secteur',
      expertise: 'Expertise',
    } as Record<string, string>,
    fieldsTitle: 'Champs repris automatiquement',
    fieldsNote: 'Jamais d’e-mail, de téléphone ni de donnée privée.',
    fieldName: 'Nom',
    fieldPromotion: 'Promotion',
    fieldPosition: 'Fonction',
    fieldOrganization: 'Organisation',
    fieldSummary: 'Description',
    fieldExpertises: 'Expertises',
    eligibleCount: 'profils actuellement éligibles',
    historyTitle: 'Historique des sélections',
    historyEmpty: 'Aucune sélection enregistrée.',
    historyDate: 'Date',
    historyProfile: 'Profil',
    historyMode: 'Mode',
    historyActor: 'Décidé par',
    historySystem: 'Système',
    overrideTitle: 'Forcer un profil',
    overrideHelp:
      'L’override est daté, motivé et attribué à son auteur : il est auditable (ADDENDUM §22). Il refuse un profil non éligible — il ne contourne pas le consentement.',
    overrideProfile: 'Profil à mettre en avant',
    overrideStart: 'Début',
    overrideEnd: 'Fin (facultative)',
    overrideReason: 'Motif',
    overrideSubmit: 'Forcer ce profil',
    overrideDone: 'Profil forcé. L’override est journalisé.',
    excludeTitle: 'Exclure un profil',
    excludeHelp:
      'L’exclusion est un acte éditorial borné dans le temps, pas un attribut permanent du profil (D-122).',
    excludeUntil: 'Exclure jusqu’au',
    excludeSubmit: 'Exclure ce profil',
    excludeDone: 'Profil exclu. L’exclusion est journalisée.',
    overridesTitle: 'Overrides et exclusions',
    overridesEmpty: 'Aucun override enregistré.',
    overrideActive: 'En cours',
    overrideEnded: 'Terminé',
    candidatesEmpty:
      'Aucun profil éligible pour le moment. Un profil devient éligible lorsqu’il est réclamé, actif, doté d’un résumé public et qu’il a donné son accord.',
    previewTitle: 'Aperçu du teaser public',
    previewNote:
      'Ce teaser est celui que sert get_landing_featured_profile() : la même projection que le site public, sans champ privé.',
    showcaseTitle: 'Visuel et accroche (D-165)',
    showcaseHelp:
      'Visuel choisi dans la médiathèque publique (comme le carrousel), jamais la photo privée du profil : la politique « pas d’avatar » (D-135) ne change pas. Format recommandé : 1600 × 900 px (ratio 16/9), JPEG/WebP/AVIF, 5 Mo maximum.',
    showcaseMedia: 'Visuel',
    showcaseMediaNone: 'Aucun visuel',
    showcaseTagline: 'Accroche',
    showcaseTaglineHint:
      'Exemple : « Gilles N’Gatta, le ISE qui voulait parler l’anglais, indétrônable bosseur ». 3 à 160 caractères.',
    showcaseSubmit: 'Enregistrer le visuel',
    showcaseDone: 'Visuel et accroche enregistrés.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-007 — Partenaires                                            */
  /* ---------------------------------------------------------------- */
  partners: {
    title: 'Partenaires',
    subtitle: 'Pilotez les campagnes sponsorisées, leurs visuels, durées et mentions.',
    add: '+ Ajouter une campagne',
    emptyTitle: 'Aucune campagne partenaire',
    emptyBody: 'Aucune campagne n’est enregistrée. Créez-en une : elle démarrera en brouillon.',
    fieldOrganization: 'Organisation partenaire',
    fieldOrganizationHelp:
      'L’organisation est celle du référentiel. Le CMS ne crée pas d’organisation : seule la campagne est nouvelle.',
    fieldName: 'Nom de la campagne',
    fieldPlacement: 'Emplacement',
    fieldTitle: 'Titre affiché',
    fieldDescription: 'Description',
    fieldMedia: 'Visuel Desktop',
    fieldMobileMedia: 'Visuel Mobile',
    fieldMediaHelp:
      'Deux visuels distincts : le Desktop est cadré en 16/9, le Mobile en portrait. Formats recommandés : Desktop 1920 × 1080 px (16/9), Mobile 1080 × 1350 px (4/5), JPEG/WebP/AVIF, 5 Mo maximum. Pour l’emplacement « Bandeau bas de page », le format attendu est différent : 1920 × 480 px (ratio 4:1).',
    /**
     * 0133 — rappel affiché sous le sélecteur d'emplacement. Le format du
     * bandeau n'est pas une préférence : c'est la taille annoncée au porteur,
     * et le conteneur de la page d'accueil est calé dessus. Une image d'un
     * autre rapport n'est pas rognée — elle apparaît avec des bandes.
     */
    placementFooterHelp:
      '« Bandeau bas de page » : la campagne s’affiche en bas de la page d’accueil sous la forme d’une image seule, qui défile avec les autres bandeaux. Ni titre, ni description, ni bouton ne sont affichés — seul le visuel Desktop (et le visuel Mobile s’il existe). Format attendu : 1920 × 480 px (ratio 4:1), JPEG ou WebP, 5 Mo maximum. Pour cet emplacement uniquement, l’adresse cible est facultative.',
    fieldCta: 'Libellé du bouton',
    fieldTargetUrl: 'Adresse cible (https)',
    fieldTargetEntityType: 'Ou ressource interne — type',
    fieldTargetEntityId: 'Ou ressource interne — identifiant',
    fieldTargetHelp:
      'Une campagne pointe soit une ressource interne, soit une adresse externe en https. Au moins l’une des deux est obligatoire.',
    fieldSponsoredLabel: 'Mention de transparence',
    sponsoredLabelHelp:
      'Obligatoire, au moins 3 caractères : « Partenaire », « Sponsorisé », « Contenu partenaire ». Une campagne sans mention ne peut pas exister en base (ADDENDUM §26).',
    fieldStart: 'Début de la campagne',
    fieldEnd: 'Fin de la campagne',
    fieldContact: 'Contact administratif',
    metricsTitle: 'Mesures réelles',
    metricsImpressions: 'Impressions',
    metricsClicks: 'Clics',
    metricsCtr: 'CTR',
    metricsNone: 'Aucune impression enregistrée : aucun taux n’est calculé.',
    metricsNote:
      'Chiffres issus des événements réellement enregistrés. Aucune impression, aucun clic ni CTR n’est estimé (ADDENDUM §51).',
    outOfPeriod: 'Hors période',
    active: 'Diffusion en cours',
    deleteTitle: 'Supprimer cette campagne ?',
    deleteBody:
      'La campagne sera supprimée. Les slides de carrousel qui la référencent perdront leur mention et cesseront d’être diffusées.',
    deleteConfirm: 'Supprimer définitivement',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-013 (0133) — Organisations affichees sur la page d'accueil    */
  /* ---------------------------------------------------------------- */
  landingOrganizations: {
    title: 'Organisations (logos)',
    subtitle:
      'Choisissez les organisations dont le logo paraît sur la page d’accueil, et leur ordre.',
    /**
     * Le CMS DIT ce que la section est, et ce qu'elle n'est pas. Sans cette
     * phrase, un administrateur peut croire que la liste se remplit toute
     * seule à partir des employeurs saisis par les membres — ce n'est pas le
     * cas, et ce serait indésirable (voir l'en-tête de la migration 0133).
     */
    scopeNote:
      'Cette liste est entièrement manuelle. Rien n’y entre automatiquement : ni les employeurs saisis par les membres, ni les organisations les plus fréquentes. Vous seul décidez qui paraît, dans quel ordre, et à partir de quand. La page publique n’affiche que les logos — aucun nom, aucun chiffre, aucun texte.',
    emptyTitle: 'Aucune organisation retenue',
    emptyBody:
      'Aucun logo n’est encore affiché sur la page d’accueil. La section reste entièrement absente de la page tant qu’aucun logo publié n’est affichable.',
    addTitle: 'Ajouter une organisation',
    fieldOrganization: 'Organisation',
    fieldOrganizationHelp:
      'Organisation du référentiel. Le CMS ne crée pas d’organisation : seule sa présence sur la page d’accueil se règle ici.',
    fieldOrganizationEmpty:
      'Le référentiel des organisations est vide : aucune organisation ne peut encore être ajoutée.',
    fieldMedia: 'Logo',
    fieldMediaHelp:
      'Logo choisi dans la médiathèque publique. À défaut, le logo enregistré sur la fiche de l’organisation est utilisé s’il figure dans la médiathèque avec son texte alternatif. Format recommandé : logo détouré sur fond transparent ou blanc, environ 400 × 200 px, PNG/WebP, 5 Mo maximum.',
    fieldMediaNone: 'Logo de la fiche organisation',
    fieldOrder: 'Ordre d’affichage',
    fieldOrderHelp: 'Croissant, de 0 à 999. À égalité, les logos suivent l’ordre alphabétique.',
    fieldPublished: 'Afficher sur la page d’accueil',
    logoReady: 'Logo affichable',
    /**
     * Signalé AVANT publication : sans cette alerte, l'administrateur
     * découvrirait sur la vitrine que sa ligne ne paraît pas — sans savoir
     * pourquoi. La projection écarte silencieusement toute ligne sans logo.
     */
    logoMissing:
      'Aucun logo affichable : cette organisation ne paraîtra pas, même publiée. Choisissez un logo dans la médiathèque.',
    submit: 'Enregistrer',
    add: 'Ajouter',
    remove: 'Retirer',
    done: 'Organisation enregistrée.',
    removed: 'Organisation retirée de la page d’accueil.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-008 — Mediatheque                                            */
  /* ---------------------------------------------------------------- */
  media: {
    title: 'Médiathèque',
    subtitle: 'Centralisez images, logos et visuels utilisés sur le site public.',
    add: '+ Importer un média',
    emptyTitle: 'Aucun média',
    emptyBody:
      'La médiathèque est vide. Importez une première image pour l’utiliser sur la landing.',
    uploadTitle: 'Importer un média',
    fieldFile: 'Fichier image',
    fieldFileHelp:
      'PNG, JPEG, WebP ou AVIF. 5 Mo maximum. Le SVG est refusé : il peut contenir du script et le bucket est public. Taille recommandée selon l’emplacement : environ 1920 × 1080 px pour un visuel plein cadre (carrousel, couverture d’événement ou d’opportunité, « ISE du jour »), 1080 × 1350 px pour un visuel Mobile en portrait. Un fichier plus petit reste accepté mais s’affichera flou en grand format.',
    fieldUsage: 'Emplacement sur la vitrine',
    fieldUsageHelp:
      'Détermine le dossier de rangement dans le bucket public. Le serveur refuse tout autre emplacement.',
    usages: {
      carousel: 'Carrousel',
      partners: 'Partenaires',
      news: 'Actualités',
      sections: 'Sections',
    } as Record<string, string>,
    thumbnailAlt: 'Aperçu du média',
    publicBucketTitle: 'Bucket public',
    publicBucketBody:
      'Les médias importés ici sont déposés dans le bucket « landing-media », le seul bucket public de la plateforme. Toute personne connaissant l’URL d’un fichier peut le charger, sans être connectée. N’y déposez que des visuels destinés à la vitrine.',
    fieldAlt: 'Texte alternatif',
    fieldAltHelp:
      'Obligatoire. Décrivez ce que l’image montre, pour les personnes qui ne la voient pas. Un média sans alternative textuelle n’est pas publiable.',
    fieldCredit: 'Crédit',
    dimensions: 'Dimensions',
    size: 'Poids',
    variants: 'Variantes',
    variantOriginal: 'Original',
    variantDesktop: 'Desktop',
    variantMobile: 'Mobile',
    variantThumbnail: 'Vignette',
    noVariant: 'Aucune variante générée',
    usageTitle: 'Références d’usage',
    usageNone: 'Ce média n’est utilisé nulle part.',
    usageCarousel: 'slide(s) de carrousel',
    usageCampaign: 'campagne(s) partenaire',
    uploaded: 'Média importé.',
    deleteTitle: 'Supprimer ce média ?',
    deleteBody:
      'Le média sera retiré de la médiathèque. Les contenus qui l’utilisent perdront leur visuel.',
    deleteConfirm: 'Supprimer définitivement',
    deleteBlocked:
      'Ce média est référencé par un contenu. Retirez d’abord la référence, puis supprimez-le.',
    pipelineTitle: 'Pipeline d’image',
    /**
     * ADDENDUM §39. On decrit ce qui se passe REELLEMENT, et on nomme ce qui
     * ne se passe pas : la generation des variantes exige un encodeur
     * d'images cote serveur, absent du deploiement actuel.
     */
    pipelineBody:
      'À l’import : le format et le poids sont validés, les dimensions sont lues dans l’en-tête du fichier, l’original est déposé dans le bucket public « landing-media » sous le dossier de l’emplacement choisi, et ses métadonnées sont enregistrées.',
    pipelineGap:
      'Les variantes Desktop, Mobile et vignette ne sont PAS générées : aucun encodeur d’images n’est déployé sur ce serveur. Le modèle les accepte (variant_kind, source_media_id) et l’alerte « média sans variante » du tableau de bord les réclame, mais tant qu’un encodeur n’est pas ajouté, seul l’original existe. Aucune variante fictive n’est enregistrée.',
    invalidType: 'Format non accepté. Utilisez PNG, JPEG, WebP ou AVIF.',
    invalidSize: 'Fichier trop volumineux : 5 Mo maximum.',
    invalidImage: 'Ce fichier n’est pas une image lisible.',
    altRequired: 'Le texte alternatif est obligatoire (au moins 3 caractères).',
    uploadFailed: 'Le dépôt du fichier a échoué.',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-009 — Programmation                                          */
  /* ---------------------------------------------------------------- */
  schedule: {
    title: 'Programmation',
    subtitle: 'Visualisez et contrôlez toutes les publications planifiées.',
    add: '+ Programmer',
    emptyTitle: 'Aucune publication programmée',
    emptyBody: 'Aucun ordre de programmation n’est enregistré.',
    weekLabel: 'Semaine du calendrier',
    previousWeek: 'Semaine précédente',
    nextWeek: 'Semaine suivante',
    today: 'Aujourd’hui',
    dayNothing: 'Rien de programmé ce jour.',
    start: 'Début',
    end: 'Fin',
    entityType: 'Type de contenu',
    entityId: 'Identifiant du contenu',
    publishAt: 'Publier le',
    unpublishAt: 'Dépublier le',
    createSubmit: 'Enregistrer l’ordre',
    cancelOrder: 'Annuler l’ordre',
    cancelled: 'Ordre annulé.',
    created: 'Ordre de programmation enregistré.',
    conflictsTitle: 'Conflits détectés',
    noConflicts: 'Aucun conflit de programmation.',
    conflictOverlap: 'Deux ordres se chevauchent sur le même contenu',
    conflictContradiction: 'Un ordre publie ce contenu pendant qu’un autre le dépublie',
    conflictOverdue: 'Ordre échu, non encore appliqué par l’ordonnanceur',
    conflictFailed: 'Ordre en échec lors de sa dernière exécution',
    conflictPast: 'La date de publication est déjà passée',
    checksTitle: 'Contrôles automatiques',
    checkExpiry: 'expiration automatique des campagnes échues',
    checkSponsored: 'retrait des slides sponsorisées sans campagne active',
    checkTimezone: 'toutes les dates sont stockées en UTC',
    lastError: 'Dernière erreur',
    runCount: 'Exécutions',
    entityTypes: {
      news: 'Actualité',
      event: 'Événement',
      opportunity: 'Opportunité',
      cms_carousel_item: 'Slide de carrousel',
      cms_partner_campaign: 'Campagne partenaire',
      cms_section: 'Section d’accueil',
    } as Record<string, string>,
    frontierNote:
      'Pour une actualité, un événement ou une opportunité, la programmation ne modifie que la visibilité sur la landing. Elle ne touche jamais le statut éditorial ni le cycle de vie métier (D-128).',
  },

  /* ---------------------------------------------------------------- */
  /* CMS-010 — Apercu                                                 */
  /* ---------------------------------------------------------------- */
  preview: {
    title: 'Aperçu',
    subtitle: 'Prévisualisez la landing avant publication.',
    modeTitle: 'Mode d’aperçu',
    desktop: 'Desktop',
    mobile: 'Mobile',
    contextTitle: 'Contexte',
    visitor: 'Visiteur non connecté',
    member: 'Membre connecté',
    sourceTitle: 'Source des données',
    sourceDraft: 'Configuration de brouillon',
    sourcePublished: 'Configuration publiée',
    draftNote:
      'L’aperçu lit les colonnes vivantes — le brouillon réel — sans le publier. Le site public, lui, lit l’instantané publié (§48).',
    publishedNote: 'Vous voyez exactement ce que sert la landing en ce moment.',
    navigationTitle: 'Règle de navigation',
    navigationVisitor: 'Visiteur : clic → connexion avec redirectTo',
    navigationMember: 'Membre : clic → ressource réelle',
    noDuplication: 'Aucun détail métier dupliqué.',
    publishAll: 'Publier les changements',
    publishAllHelp:
      'Publie les sections et les slides encore en brouillon, une transition serveur par élément, puis invalide le cache de la landing.',
    publishAllDone: (n: number) => `${n} élément(s) publié(s).`,
    nothingToPublish: 'Aucun brouillon à publier.',
    emptySection: 'Section active, sans contenu à afficher pour l’instant.',
    disabledSection: 'Section désactivée : elle ne paraîtra pas.',
    carouselEmpty: 'Aucune slide diffusée dans ce mode.',
    /** Ce que l'apercu ne peut pas montrer, dit franchement. */
    fidelityNote:
      'L’aperçu restitue la structure réelle et les textes réels des sections et du carrousel. Il n’est pas un rendu pixel de PUB-001 : c’est la configuration qui est prévisualisée, pas la feuille de style de la landing.',
  },
} as const;
