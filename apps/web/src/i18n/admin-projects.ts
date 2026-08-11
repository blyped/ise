/**
 * Textes francais du back-office Superadmin — Projets & consortiums
 * (SA-023 -> 026). Fichier separe de `i18n/admin.ts`, comme
 * `i18n/admin-opportunities.ts` : namespace propre, pas de croissance
 * du dictionnaire central a chaque tranche.
 *
 * Les vocabulaires fermes (statut projet, type de projet, statut de
 * demande de consortium, issue de cloture) traduisent les contraintes
 * CHECK de 0012 — une seule fois, ici.
 */
export const frAdminProjects = {
  nav: {
    manage: 'Gestion du projet',
  },

  list: {
    title: 'Projets & consortiums',
    subtitle:
      'Missions, consortiums et initiatives declares sur la plateforme, tous statuts (y compris brouillons).',
    searchPlaceholder: 'Titre ou resume…',
    filterStatus: 'Statut',
    filterType: 'Type',
    empty: 'Aucun projet ne correspond a ces criteres.',
    emptyBody: 'Modifiez les filtres ou creez le projet manquant.',
    newProject: 'Nouveau projet',
    columns: {
      owner: 'Porteur',
      type: 'Type',
      status: 'Statut',
      created: 'Cree le',
    },
    open: 'Ouvrir',
  },

  status: {
    draft: 'Brouillon',
    recruiting: 'Recrutement',
    team_ready: 'Equipe prete',
    active: 'En cours',
    paused: 'En pause',
    completed: 'Termine',
    failed: 'Echoue',
    cancelled: 'Annule',
    archived: 'Archive',
  } as Record<string, string>,

  projectType: {
    mission: 'Mission',
    tender: 'Appel d’offres',
    consortium: 'Consortium',
    study: 'Etude',
    research: 'Recherche',
    entrepreneurial: 'Entrepreneurial',
    product: 'Produit',
    publication: 'Publication',
    working_group: 'Groupe de travail',
    community_initiative: 'Initiative communautaire',
    other: 'Autre',
  } as Record<string, string>,

  compensationType: {
    paid: 'Remunere',
    conditional_on_award: 'Conditionne a l’attribution',
    volunteer: 'Benevole',
    equity: 'Participation au capital',
    mixed: 'Mixte',
    to_be_defined: 'A definir',
  } as Record<string, string>,

  visibility: {
    network: 'Reseau',
    community: 'Communaute',
    promotion: 'Promotion',
    invitation_only: 'Sur invitation',
    team_only: 'Equipe uniquement',
  } as Record<string, string>,

  form: {
    createTitle: 'Creer un projet',
    ownerProfileId: 'Identifiant du profil porteur (UUID)',
    ownerProfileHelp:
      'Copiez l’identifiant depuis la fiche du membre (section Membres & profils). Le projet est cree en brouillon, au nom de ce profil.',
    projectType: 'Type de projet',
    title: 'Titre',
    summary: 'Resume',
    expectedOutcome: 'Resultat attendu',
    description: 'Description',
    qualificationCriteria: 'Criteres de qualification',
    compensationType: 'Type de remuneration',
    compensationStatement: 'Precisions sur la remuneration',
    visibility: 'Visibilite',
    submitCreate: 'Creer le projet (brouillon)',
    created: 'Projet cree (brouillon).',
    invalid: 'Verifiez le profil porteur et les champs obligatoires (titre, resume, resultat attendu).',
  },

  detail: {
    title: 'Fiche projet',
    contentTitle: 'Contenu du projet',
    owner: 'Porteur',
    createdAt: 'Cree le',
    publishedAt: 'Publie le',
    startedAt: 'Demarre le',
    closedAt: 'Cloture le',
    sector: 'Secteur',
    compensationTitle: 'Remuneration',
    lifecycleTitle: 'Cycle de vie',
    publish: 'Publier (recrutement)',
    setStatus: 'Passer a ce statut',
    statusActionsHint:
      'Transitions non terminales uniquement : la cloture (issue, livrable, donnees financieres) se fait plus bas.',
    consortiumsTitle: 'Demandes de consortium',
    noConsortiums: 'Aucune demande de consortium pour ce projet.',
    consortiumsColumns: {
      organization: 'Organisation',
      role: 'Role propose',
      requestedBy: 'Demandeur',
      submitted: 'Deposee le',
      status: 'Statut',
    },
    reviewConsortium: 'Decider',
    done: 'Projet mis a jour.',
    financialsTitle: 'Donnees financieres confidentielles',
    noFinancials: 'Aucune donnee financiere enregistree.',
    closureTitle: 'Bilan de cloture',
  },

  consortium: {
    status: {
      submitted: 'Soumise',
      reviewing: 'En revue',
      shortlisted: 'Preselectionnee',
      selected: 'Retenue',
      not_selected: 'Non retenue',
      withdrawn: 'Retiree',
    } as Record<string, string>,
    partnerRole: {
      lead_firm: 'Chef de file',
      partner: 'Partenaire',
      country_partner: 'Partenaire pays',
      subcontractor: 'Sous-traitant',
      thematic_specialist: 'Specialiste thematique',
    } as Record<string, string>,
    reviewTitle: 'Decider de cette demande',
    reviewBody: 'La decision est journalisee.',
  },

  closure: {
    title: 'Cloturer le projet',
    subtitle:
      'Cloture definitive : resultat declare, livrable, attribution au reseau et donnees financieres confidentielles.',
    outcomeStatus: 'Issue',
    outcomeStatusOptions: {
      succeeded: 'Reussi',
      partially_succeeded: 'Partiellement reussi',
      cancelled: 'Annule',
      failed: 'Echoue',
    } as Record<string, string>,
    expectedOutcomeAchieved: 'Resultat attendu atteint',
    expectedOutcomeAchievedOptions: {
      yes: 'Oui',
      partially: 'Partiellement',
      no: 'Non',
    } as Record<string, string>,
    outcomeCode: 'Code de resultat',
    outcomeCodeOptions: {
      contract_won: 'Contrat remporte',
      contract_lost: 'Contrat perdu',
      study_completed: 'Etude achevee',
      report_delivered: 'Rapport livre',
      publication_produced: 'Publication produite',
      working_paper: 'Document de travail',
      dataset_produced: 'Jeu de donnees produit',
      company_created: 'Entreprise creee',
      product_launched: 'Produit lance',
      prototype: 'Prototype',
      consortium_formed: 'Consortium forme',
      interrupted: 'Interrompu',
      abandoned: 'Abandonne',
      pending: 'En attente',
      other: 'Autre',
    } as Record<string, string>,
    deliverableTitle: 'Titre du livrable',
    deliverableUrl: 'URL du livrable',
    publicResultSheetAllowed: 'Fiche resultat publique autorisee',
    testimonial: 'Temoignage',
    networkAttribution: 'Attribution au reseau',
    networkAttributionOptions: {
      mainly: 'Principalement',
      partially: 'Partiellement',
      no: 'Non',
    } as Record<string, string>,
    collaboratorsCount: 'Nombre de collaborateurs',
    clientName: 'Client',
    funderName: 'Bailleur',
    budgetEstimate: 'Budget estime',
    budgetCurrency: 'Devise du budget (ex. EUR)',
    financialNotes: 'Notes financieres',
    revenueGenerated: 'Revenu genere',
    revenueCurrency: 'Devise du revenu (ex. EUR)',
    submit: 'Cloturer le projet',
    done: 'Projet cloture.',
    invalid: 'Indiquez au moins l’issue et si le resultat attendu a ete atteint.',
  },
} as const;
