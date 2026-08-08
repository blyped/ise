/**
 * Chaînes ajoutées par le branchement de PUB-001 sur les projections réelles.
 *
 * Fichier distinct de `fr.ts` : le bloc `fr.public` existant reste la source
 * des libellés de la coquille (navigation, carrousel, pieds de page). Ce
 * module n'ajoute que ce qu'exige l'affichage des données réelles.
 *
 * Règle cardinale (ADDENDUM §23, §51) : **aucun chiffre, aucun nom, aucune
 * date d'exemple**. Les valeurs 1842, 37, 29 et 126 des maquettes sont
 * illustratives et n'apparaissent nulle part.
 */
export const frPublic = {
  /**
   * Sur-titres des cartes de « À la une du réseau ». Ce sont des libellés de
   * colonne, pas des données : la colonne existe même vide.
   */
  kickers: {
    news: 'ACTUALITÉ',
    featuredProfile: 'ISE DU JOUR',
    event: 'ÉVÉNEMENT',
    opportunity: 'OPPORTUNITÉ',
  },

  /** Libellés des natures de contenu mises en avant par le carrousel. */
  contentTypes: {
    news: 'ACTUALITÉ',
    event: 'ÉVÉNEMENT',
    opportunity: 'OPPORTUNITÉ',
    profile: 'ISE DU JOUR',
    call: 'APPEL AU RÉSEAU',
  } as Record<string, string>,

  cards: {
    /** Aucune route membre n'existe encore pour cette nature de contenu. */
    availableAfterSignIn: 'Consultable depuis l’espace membre.',
    readNews: 'Lire l’actualité',
    seeEvent: 'Voir l’événement',
    seeOpportunity: 'Voir l’opportunité',
    seeProfile: 'Découvrir le profil',
    /** Promotion, quand la base ne fournit qu'une année de sortie. */
    promotion: 'ISE {year}',
    remote: 'À distance',
    deadline: 'Candidatures jusqu’au {date}',
  },

  news: {
    emptyTitle: 'Aucune actualité publiée.',
    emptyBody: 'Les actualités du réseau apparaîtront ici dès leur publication.',
  },

  events: {
    emptyTitle: 'Aucun événement à venir.',
    emptyBody: 'Les prochains événements du réseau apparaîtront ici.',
  },

  opportunities: {
    emptyTitle: 'Aucune opportunité ouverte.',
    emptyBody: 'Les opportunités ouvertes apparaîtront ici pendant leur période de diffusion.',
  },

  /** ADDENDUM §21 — replis de l’« ISE du jour ». */
  featuredProfile: {
    label: 'ISE du jour',
    /** Repli éditorial : aucune identité n’est inventée. */
    fallbackTitle: 'L’ISE du jour sera publié prochainement.',
    fallbackBody: 'Votre profil peut y figurer : réclamez-le pour rendre votre expertise visible.',
    fallbackCta: 'Réclamer mon profil',
    /** Servi quand la projection est en panne et qu’aucune version n’est connue. */
    unavailable: 'La mise en avant du jour est momentanément indisponible.',
  },

  expertises: {
    /** Nombre de profils par expertise, uniquement quand il est mesuré. */
    profileCount: '{count} profil référencé',
    profileCountPlural: '{count} profils référencés',
    explore: 'Explorer l’expertise {name}',
  },

  stats: {
    labels: {
      profiles: 'profils référencés',
      promotions: 'promotions',
      countries: 'pays',
      organizations: 'organisations',
    } as Record<string, string>,
    shortLabels: {
      profiles: 'profils',
      promotions: 'promos',
      countries: 'pays',
      organizations: 'org.',
    } as Record<string, string>,
    /**
     * ADDENDUM §23 : la base mesure aujourd’hui zéro partout, l’annuaire
     * n’étant pas importé. Le bloc est alors masqué plutôt que d’afficher
     * quatre zéros — mais rien n’est inventé pour autant.
     */
    notYetMeasured: 'Les chiffres du réseau seront publiés dès le premier import de l’annuaire.',
    computedAt: 'Chiffres calculés le {date}.',
  },

  partners: {
    /** Titre de section, affiché seulement quand une campagne est diffusée. */
    title: 'Entreprises & partenaires',
    /** ADDENDUM §26 — la mention est toujours associée au nom du partenaire. */
    transparency: '{label} — {partner}',
    externalHint: 'Ouvre le site du partenaire dans un nouvel onglet',
  },

  /** États dégradés, ADDENDUM §47. Formulés côté visiteur, sans jargon. */
  degraded: {
    sectionUnavailable: 'Cette section est momentanément indisponible.',
    sectionUnavailableBody: 'Le reste de la page reste consultable ; réessayez dans un instant.',
  },
} as const;
