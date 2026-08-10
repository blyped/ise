/**
 * Chaines SA-005 (fusion de doublons) et SA-007 (creation de profil
 * reference). Fichier separe plutot qu'ajout dans `admin.ts` : ce
 * dernier n'a pas ete relu integralement avant cette livraison, un
 * ajout "a l'aveugle" dans son arbre imbrique aurait ete risque.
 */
export const frAdminDedup = {
  nav: {
    newProfile: 'Nouveau profil référencé',
    duplicates: 'Doublons potentiels',
  },
  duplicates: {
    title: 'Doublons potentiels',
    subtitle:
      'Paires de profils qui se ressemblent fortement (nom, email, téléphone, promotion, organisation, pays). Aucune fusion n’est automatique : chaque décision est motivée.',
    empty: 'Aucun doublon potentiel détecté.',
    emptyBody: 'Les nouvelles paires apparaîtront ici au fur et à mesure des créations et mises à jour de profils.',
    score: 'Score de correspondance',
    signals: {
      email_exact: 'Email identique',
      phone_exact: 'Téléphone identique',
      name_close: 'Nom très proche',
      promotion_exact: 'Promotion identique',
      organization_same: 'Organisation identique',
      country_same: 'Pays identique',
    } as Record<string, string>,
    keep: (name: string) => `Conserver « ${name} »`,
    mergeTitle: 'Fusionner ces deux profils',
    mergeBody:
      'Le second profil sera archivé et pointera vers celui-ci. Ses coordonnées manquantes seront reprises. Aucune autre donnée n’est déplacée : si l’un des deux profils a une activité propre (candidatures, appels, messages…), ne fusionnez pas — traitez le cas manuellement.',
    dismissTitle: 'Ce n’est pas un doublon',
    dismissBody: 'Cette paire ne sera plus proposée.',
    dismiss: 'Pas un doublon',
    reasonPlaceholder: 'Pourquoi cette décision ?',
    merged: 'Profils fusionnés.',
    dismissed: 'Paire écartée.',
    nextPage: 'Page suivante',
  },
  create: {
    title: 'Créer un profil référencé',
    subtitle:
      'Crée un profil individuel non réclamé (SA-007), sur le même modèle que le recensement importé (décision C-06). Aucun compte n’est créé : le membre pourra réclamer ce profil plus tard.',
    firstName: 'Prénom',
    lastName: 'Nom',
    middleNames: 'Autres prénoms',
    promotion: 'ID de promotion',
    promotionHelp: 'Laisser vide si la promotion est inconnue.',
    position: 'Poste actuel',
    organization: 'Organisation',
    country: 'Pays (code à 2 lettres)',
    city: 'Ville',
    primaryEmail: 'Email principal',
    secondaryEmail: 'Email secondaire',
    phone: 'Téléphone',
    secondaryPhone: 'Téléphone secondaire',
    submit: 'Créer le profil',
    created: 'Profil créé.',
    duplicateWarning: 'Profils qui ressemblent à celui-ci :',
  },
} as const;
