/**
 * Textes francais du back-office Superadmin — Communautes
 * (SA-027 -> 029). Fichier separe de `i18n/admin.ts`, comme
 * `i18n/admin-projects.ts` : namespace propre, pas de croissance du
 * dictionnaire central a chaque tranche.
 *
 * Les vocabulaires fermes (statut, type, visibilite, politique
 * d'adhesion, mode de moderation, statut de publication) traduisent
 * les contraintes CHECK de 0011 — une seule fois, ici.
 */
export const frAdminCommunities = {
  nav: {
    manage: 'Gestion de la communaute',
  },

  list: {
    title: 'Communautes',
    subtitle:
      'Communautes du reseau, tous statuts et visibilites (y compris brouillons et communautes privees) — creation reservee a l’administration.',
    searchPlaceholder: 'Nom ou description…',
    filterStatus: 'Statut',
    filterType: 'Type',
    filterVisibility: 'Visibilite',
    empty: 'Aucune communaute ne correspond a ces criteres.',
    emptyBody: 'Modifiez les filtres ou creez la communaute manquante.',
    newCommunity: 'Nouvelle communaute',
    columns: {
      type: 'Type',
      visibility: 'Visibilite',
      members: 'Membres',
      created: 'Creee le',
    },
    open: 'Ouvrir',
  },

  status: {
    draft: 'Brouillon',
    active: 'Active',
    inactive: 'En sommeil',
    merged: 'Fusionnee',
    archived: 'Archivee',
  } as Record<string, string>,

  communityType: {
    country: 'Pays',
    sector: 'Secteur',
    thematic: 'Thematique',
    special: 'Speciale',
  } as Record<string, string>,

  visibility: {
    network: 'Reseau',
    private: 'Privee',
  } as Record<string, string>,

  joinPolicy: {
    open: 'Ouverte (adhesion immediate)',
    request: 'Sur demande',
    invitation: 'Sur invitation uniquement',
  } as Record<string, string>,

  postModerationMode: {
    immediate: 'Publication immediate',
    pre_approval: 'Validation prealable',
  } as Record<string, string>,

  form: {
    createTitle: 'Creer une communaute',
    editTitle: 'Modifier la communaute',
    name: 'Nom',
    slug: 'Slug',
    slugHelp: 'Identifiant d’URL : minuscules, chiffres et tirets uniquement (ex. : mon-secteur).',
    description: 'Description',
    purpose: 'Objectif',
    purposeHelp: 'Ce que cette communaute permet aux ISE de faire ensemble — sans reponse claire, elle ne devrait pas exister.',
    charterText: 'Charte specifique',
    communityType: 'Type de communaute',
    countryCode: 'Code pays (ISO, 2 lettres)',
    countryCodeHelp: 'Obligatoire pour le type « Pays ».',
    sectorId: 'Identifiant du secteur',
    sectorIdHelp: 'Obligatoire pour le type « Secteur » (identifiant numerique du referentiel).',
    visibility: 'Visibilite',
    joinPolicy: 'Politique d’adhesion',
    postModerationMode: 'Moderation des publications',
    initialStatus: 'Statut initial',
    submitCreate: 'Creer la communaute',
    submitEdit: 'Enregistrer',
    created: 'Communaute creee.',
    edited: 'Communaute mise a jour.',
    invalid: 'Verifiez le nom, le slug et la description (obligatoires).',
    invalidSlug: 'Le slug doit etre en minuscules, sans espaces ni accents (ex. : mon-slug).',
  },

  detail: {
    title: 'Fiche communaute',
    contentTitle: 'Contenu de la communaute',
    infoTitle: 'Parametres',
    membersCount: 'Membres actifs',
    createdAt: 'Creee le',
    lastActivityAt: 'Derniere publication',
    openQuestions: 'Questions ouvertes',
    lifecycleTitle: 'Cycle de vie',
    lifecycleHint: 'Chaque transition est appliquee immediatement — aucune confirmation supplementaire pour les changements simples.',
    setStatus: 'Passer a ce statut',
    mergeTitle: 'Fusionner cette communaute',
    mergeTrigger: 'Fusionner dans une autre communaute',
    mergeBody:
      'La communaute est marquee « Fusionnee » et pointe vers la communaute cible. Aucune donnee (publications, membres) n’est deplacee automatiquement.',
    mergeInputLabel: 'Identifiant de la communaute cible (UUID)',
    mergeInputHelp: 'Copiez l’identifiant depuis l’URL de la fiche de la communaute cible.',
    editSubmit: 'Enregistrer les modifications',
    postsTitle: 'Publications — moderation',
    postsSubtitle: 'Tous statuts (y compris en attente de validation, signalees, masquees, retirees).',
    noPosts: 'Aucune publication dans cette communaute.',
    postsColumns: {
      type: 'Type',
      status: 'Statut',
      author: 'Auteur',
      created: 'Publiee le',
    },
    postLocked: 'Verrouillee',
    moderate: 'Moderer',
    moderateTitle: 'Moderer cette publication',
    moderateBody: 'Choisissez l’action et indiquez le motif. La decision est journalisee.',
    moderateSelectLabel: 'Action',
    moderateReasonLabel: 'Motif (obligatoire)',
    moderateReasonPlaceholder: 'Ex. : contenu hors charte, signalement confirme…',
    done: 'Communaute mise a jour.',
    postDone: 'Publication mise a jour.',
  },

  postType: {
    question: 'Question',
    experience: 'Retour d’experience',
    resource: 'Ressource',
    analysis: 'Analyse',
    news: 'Actualite',
    opportunity_reference: 'Opportunite (reference)',
    network_call_reference: 'Appel au reseau (reference)',
    event_reference: 'Evenement (reference)',
    project_reference: 'Projet (reference)',
  } as Record<string, string>,

  postStatus: {
    draft: 'Brouillon',
    pending_review: 'En attente de validation',
    published: 'Publiee',
    flagged: 'Signalee',
    hidden: 'Masquee',
    removed: 'Retiree',
    archived: 'Archivee',
  } as Record<string, string>,

  moderationAction: {
    hide: 'Masquer',
    restore: 'Restaurer',
    remove: 'Retirer definitivement',
    lock: 'Verrouiller la discussion',
    unlock: 'Deverrouiller la discussion',
  } as Record<string, string>,
} as const;
