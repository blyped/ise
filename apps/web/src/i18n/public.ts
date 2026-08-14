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
    /**
     * Repli honnête d'une carte sans route : identifiant inexploitable, ou
     * nature de contenu dont l'écran membre n'existe réellement pas. Depuis
     * le 2026-08-14, les actualités et les événements n'en relèvent plus —
     * leurs pages de détail existent et la carte est cliquable.
     */
    availableAfterSignIn: 'Consultable depuis l’espace membre.',
    readNews: 'Lire l’actualité',
    seeEvent: 'Voir l’événement',
    seeOpportunity: 'Voir l’opportunité',
    seeProfile: 'Découvrir le profil',
    /**
     * Nom accessible du lien qui couvre toute la carte de « À la une du
     * réseau ». Le texte visible du lien ne dit que l'action (« Lire
     * l'actualité ») : hors contexte, un lecteur d'écran qui liste les liens
     * de la page en entendrait quatre presque identiques. Le titre du contenu
     * est donc rappelé dans le nom accessible, qui commence par le texte
     * visible (WCAG 2.5.3, « Label in Name »).
     */
    cardLink: '{action} : {title}',
    /** Promotion, quand la base ne fournit qu'une année de sortie. */
    promotion: 'ISE {year}',
    remote: 'À distance',
    deadline: 'Candidatures jusqu’au {date}',
  },

  /**
   * 0122 — libellés des quatre piliers cliquables de « Un réseau conçu pour
   * être utile » : ce que le visiteur ira faire sur l'écran visé, une clé par
   * cible de la liste blanche `cms_pillars.link_target`.
   *
   * Ces libellés-ci restent en i18n et n'iront pas dans le CMS : ils nomment
   * une DESTINATION technique (l'écran /appels, l'écran /projets), pas le
   * discours du pilier. Le titre et le corps du pilier, eux, sont éditables
   * depuis /cms/piliers depuis 0129 ; `fr.public.pillars.defaults` n'en
   * garde plus que les valeurs d'origine.
   *
   * Le texte est visible dans la carte ET repris au début du nom accessible
   * du lien, qui rappelle le pilier concerné : quatre liens de suite nommés
   * « Connecter », « Entraider »… ne diraient pas où ils mènent (WCAG 2.4.4,
   * et 2.5.3 « Label in Name »).
   */
  pillars: {
    linkLabel: '{action} — pilier {title}',
    actions: {
      search: 'Rechercher un ISE',
      calls: 'Voir les appels au réseau',
      projects: 'Voir les projets et consortiums',
      opportunities: 'Voir les opportunités',
      applications: 'Suivre mes candidatures',
    } as Record<string, string>,
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

  /**
   * 0133 — bandeau sponsorisé du bas de page.
   *
   * Aucune de ces chaînes n'est visible à l'écran : le porteur a demandé
   * « pas de bavardages, je ne veux pas de texte ». Elles servent toutes de
   * nom accessible — la région, chaque diapositive, et l'alternative
   * textuelle composée à partir de la mention de transparence, du nom du
   * partenaire et de la description que l'administrateur a saisie dans la
   * médiathèque. Une image sans texte reste une image : elle doit pouvoir
   * être annoncée à qui ne la voit pas.
   */
  sponsorBand: {
    label: 'Nos partenaires et sponsors',
    roleDescription: 'carrousel',
    slideRoleDescription: 'diapositive',
    position: 'Bandeau {index} sur {total}',
    /** ADDENDUM §26 : la mention de transparence voyage dans l'alternative. */
    imageAlt: '{label} — {partner} : {description}',
    externalHint: 'Ouvre le site du partenaire dans un nouvel onglet',
    /**
     * Défilement figé (`prefers-reduced-motion`) : les bandeaux sont alors
     * tous empilés. Personne n'est privé d'un partenaire parce qu'il a
     * demandé moins d'animation.
     */
    staticLabel: 'Nos partenaires et sponsors (liste complète, sans défilement)',
  },

  /**
   * 0133 — « les organisations où travaillent les ISE ».
   *
   * Section de logos, sans une ligne de texte visible : le titre existe
   * uniquement pour les lecteurs d'écran et pour la structure du document.
   * Chaque logo porte l'alternative textuelle saisie dans la médiathèque.
   */
  organizations: {
    label: 'Les organisations où travaillent les ISE',
  },

  /** États dégradés, ADDENDUM §47. Formulés côté visiteur, sans jargon. */
  degraded: {
    sectionUnavailable: 'Cette section est momentanément indisponible.',
    sectionUnavailableBody: 'Le reste de la page reste consultable ; réessayez dans un instant.',
  },
} as const;
