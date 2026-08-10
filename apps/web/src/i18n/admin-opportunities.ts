/**
 * Chaines SA-021 (candidatures recues, supervision) et SA-022 (cloture
 * + bilan d'impact) d'une opportunite. Reutilise le vocabulaire ferme
 * de `i18n/opportunities.ts` (statuts de candidature, resultats,
 * niveaux d'attribution) plutot que de le dupliquer : memes RPC,
 * memes contraintes CHECK (migration 0008), meme sens.
 */
export const frAdminOpportunities = {
  nav: {
    candidates: 'Candidatures reçues',
    closure: 'Clôturer et bilan',
  },
  candidates: {
    title: 'Candidatures reçues',
    subtitle: 'Toutes les candidatures reçues pour cette opportunité, tous canaux confondus.',
    empty: 'Aucune candidature pour cette opportunité.',
    emptyBody:
      'Les candidatures déposées sur la plateforme ou déclarées par les membres apparaîtront ici.',
    filterStatus: 'Statut',
    external: 'Candidature déclarée (hors plateforme)',
    internal: 'Candidature via la plateforme',
  },
  closure: {
    title: 'Clôturer l’opportunité',
    subtitle: 'Le résultat déclaré alimente les indicateurs d’impact. Il n’est jamais déduit.',
    doneTitle: 'Opportunité clôturée.',
    notClosable:
      'Cette opportunité n’est pas dans un état permettant une clôture (brouillon, déjà clôturée ou annulée).',
    noCandidates:
      'Aucun candidat réel n’a postulé à cette offre : aucun bénéficiaire ne peut être désigné.',
  },
  detail: {
    manageTitle: 'Suivi et clôture',
  },
} as const;
