/**
 * Textes francais du back-office Superadmin — Actualites (0110, tache
 * #83). Fichier separe de `i18n/admin.ts`, meme principe que
 * `i18n/admin-events.ts` : namespace propre par tranche.
 *
 * Rappel de frontiere (D-128) : cet ecran redige et publie
 * EDITORIALEMENT un article (`editorial_status`, `body`). Il ne touche
 * JAMAIS `landing_visibility` / `landing_priority` / `is_featured` —
 * l'exposition sur la vitrine reste le role de `/cms/actualites`, une
 * fois l'article publie ici.
 */
export const frAdminNews = {
  list: {
    title: 'Actualités',
    subtitle:
      "Rédaction des actualités du réseau, tous statuts éditoriaux. La mise en avant sur la landing se règle ensuite depuis le CMS.",
    searchPlaceholder: 'Titre…',
    filterStatus: 'Statut éditorial',
    filterCategory: 'Catégorie',
    empty: 'Aucun article ne correspond à ces critères.',
    emptyBody: 'Modifiez les filtres ou rédigez le premier article.',
    newNews: 'Nouvel article',
    columns: {
      category: 'Catégorie',
      published: 'Publié le',
    },
    open: 'Ouvrir',
  },

  status: {
    draft: 'Brouillon',
    submitted: 'Soumis',
    under_review: 'En revue',
    approved: 'Approuvé',
    published: 'Publié',
    rejected: 'Rejeté',
    archived: 'Archivé',
    duplicate: 'Doublon',
  } as Record<string, string>,

  category: {
    ise_spotlight: 'ISE en lumière',
    appointment: 'Nomination',
    new_position: 'Nouvelle fonction',
    distinction: 'Distinction',
    publication: 'Publication',
    entrepreneurship: 'Entrepreneuriat',
    project: 'Projet',
    research: 'Recherche',
    international: 'International',
    major_mission: 'Mission importante',
    career_path: 'Parcours',
    network_achievement: 'Réalisation du réseau',
    promotion_life: 'Vie des promotions',
    community_life: 'Vie des communautés',
    network_life: 'Vie du réseau',
    event_report: 'Événement',
    other: 'Autre',
  } as Record<string, string>,

  sourceType: {
    internal: 'Rédaction interne',
    linkedin_public: 'LinkedIn (public)',
    organization_site: "Site d'une organisation",
    media_article: 'Article de presse',
    scientific_publication: 'Publication scientifique',
    institutional_site: 'Site institutionnel',
    other: 'Autre',
  } as Record<string, string>,

  visibility: {
    members: 'Tous les membres',
    promotion: 'Promotion',
    community: 'Communauté',
  } as Record<string, string>,

  form: {
    createTitle: 'Rédiger un article',
    editTitle: "Modifier l'article",
    category: 'Catégorie',
    title: 'Titre',
    slug: 'Slug',
    slugHelp: 'Identifiant d’URL : minuscules, chiffres et tirets uniquement (ex. : mon-article). Non modifiable après création.',
    summary: 'Résumé',
    summaryHelp: '400 caractères maximum — affiché dans les listes et le teaser.',
    body: 'Corps de l’article',
    eventDate: 'Date associée (optionnelle)',
    /**
     * 0117 — l'image ne se saisit plus ici : un seul visuel par article,
     * choisi depuis /cms/actualites, réutilisé automatiquement sur la
     * carte de la landing et sur la page de l'article.
     */
    coverTitle: 'Image de couverture',
    coverCreateHint:
      'Se choisit après création, depuis le CMS (Actualités) : un seul visuel par article, réutilisé automatiquement sur la carte de la landing et sur la page de l’article.',
    coverDefined: 'Une couverture est définie.',
    coverUndefined: 'Aucune couverture définie pour le moment.',
    coverManage: 'Gérer la couverture dans le CMS',
    sourceType: 'Type de source',
    sourceUrl: 'Lien de la source',
    visibility: 'Visibilité',
    promotionId: 'Identifiant de la promotion (numéro)',
    communityId: 'Identifiant de la communauté (UUID)',
    submitCreate: 'Créer l’article (brouillon)',
    submitEdit: 'Enregistrer',
    created: 'Article créé (brouillon).',
    edited: 'Article mis à jour.',
    invalid: 'Vérifiez le titre, le slug, la catégorie et le résumé (obligatoires).',
  },

  detail: {
    title: 'Fiche article',
    contentTitle: 'Contenu',
    createdAt: 'Créé le',
    publishedAt: 'Publié le',
    lifecycleTitle: 'Cycle éditorial',
    lifecycleHint:
      'Chaque transition est appliquée immédiatement. Publier un article ne le rend pas visible sur la landing : réglez ensuite son exposition depuis le CMS (Actualités).',
    setStatus: 'Passer à ce statut',
    editSubmit: 'Enregistrer les modifications',
    done: 'Article mis à jour.',
    exposureTitle: 'Exposition sur la page d’accueil publique',
    exposureHint: 'Publier ici ne l’affiche pas automatiquement sur la landing : réglez sa visibilité et sa mise en avant depuis le CMS → Actualités.',
  },
} as const;
