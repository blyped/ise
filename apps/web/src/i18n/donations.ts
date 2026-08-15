/**
 * Chaines de la tranche FAIRE UN DON (0134).
 *
 * DEUX REGLES GOUVERNENT CE CATALOGUE, ET AUCUN TEXTE NE LES ENFREINT.
 *
 * 1. ON N'AFFIRME JAMAIS UN PAIEMENT QUE LE PRESTATAIRE N'A PAS CONFIRME.
 *    La page de retour ne dit pas « merci, votre don est enregistre » tant
 *    que la notification serveur a serveur n'est pas arrivee : elle dit que
 *    la confirmation est en cours. L'URL de retour est falsifiable ; un
 *    remerciement pose la-dessus serait un mensonge poli.
 *
 * 2. AUCUNE PROMESSE FISCALE, AUCUN RECU, AUCUNE DEDUCTION. Rien dans les
 *    documents du projet n'etablit un cadre de recu fiscal, et l'inventer
 *    exposerait le porteur. Le texte reste factuel : un don, une trace.
 */
export const frDonations = {
  /** Libelle de l'entree de navigation membre. */
  navLabel: 'Faire un don',

  title: 'Faire un don',
  subtitle:
    'Compétences ISE n’a pas été conçue pour collecter des fonds : votre contribution sert uniquement à couvrir les frais liés à la plateforme (hébergement des serveurs, développement, maintenance).',

  correlationLabel: 'Référence à communiquer à l’assistance',
  back: 'Retour',

  unavailable: {
    title: 'Le don en ligne n’est pas encore ouvert',
    body: 'Aucun moyen de paiement n’est configuré sur cette plateforme pour le moment. Dès qu’il le sera, cet écran proposera le paiement par mobile money et par carte bancaire. Rien n’est simulé ici en attendant.',
  },

  security: {
    title: 'Comment votre paiement est traité',
    body: 'Vous ne saisissez jamais vos coordonnées bancaires sur Compétences ISE. Vous êtes redirigé vers la page de paiement sécurisée de l’opérateur que vous choisissez, qui seul manipule ces informations. Nous n’en conservons aucune trace.',
  },

  form: {
    providerLegend: 'Comment souhaitez-vous payer ?',
    providerHint:
      'Chaque voie de paiement a sa propre devise. Aucune conversion n’est appliquée : le montant débité est exactement celui que vous choisissez ici.',
    stripeLabel: 'Carte bancaire internationale',
    stripeDescription: 'Paiement en euros, page sécurisée Stripe.',
    cinetpayLabel: 'Mobile money et cartes (Afrique de l’Ouest)',
    cinetpayDescription: 'Paiement en francs CFA (XOF), guichet sécurisé CinetPay.',

    amountLegend: 'Montant de votre don',
    amountHint: 'Choisissez un montant proposé ou saisissez le vôtre.',
    customAmountLabel: 'Autre montant',
    customAmountPlaceholder: 'Montant',
    boundsHint: 'Entre {min} et {max}.',
    stepHint: 'Le montant doit être un multiple de {step}.',

    anonymousLabel: 'Ne pas associer publiquement mon nom à ce don',
    anonymousDescription:
      'Votre don reste rattaché à votre compte pour votre propre suivi, mais votre nom n’est pas montré.',

    messageLabel: 'Un mot à joindre (facultatif)',
    messagePlaceholder: 'Ce que vous souhaitez dire au réseau…',

    submit: 'Continuer vers le paiement',
    submitPending: 'Ouverture du guichet sécurisé…',
    submitHint:
      'Vous serez redirigé vers la page de paiement de l’opérateur. Rien n’est débité avant que vous ne validiez sur cette page.',

    errorAmount: 'Ce montant n’est pas valable. Vérifiez les bornes indiquées.',
    errorProvider: 'Choisissez une voie de paiement.',
    errorProviderUnavailable:
      'Cette voie de paiement n’est pas disponible pour le moment. Essayez l’autre, ou revenez plus tard.',
    errorGateway:
      'Le guichet de paiement n’a pas répondu. Aucun montant n’a été prélevé. Réessayez dans un instant.',
  },

  history: {
    title: 'Mes dons',
    empty: 'Vous n’avez encore fait aucun don.',
    dateLabel: 'Date',
    amountLabel: 'Montant',
    statusLabel: 'État',
    referenceLabel: 'Référence',
  },

  /**
   * Libelles des cinq etats. « En attente de confirmation » couvre
   * `pending` et `processing` : dans les deux cas, RIEN n'est constate.
   */
  status: {
    pending: 'En attente de confirmation',
    processing: 'En attente de confirmation',
    succeeded: 'Confirmé',
    failed: 'Refusé',
    cancelled: 'Annulé',
    unknown: 'État inconnu',
  },

  returnPage: {
    title: 'Retour du guichet de paiement',
    missingReference:
      'Nous n’avons pas retrouvé la référence de ce don. Ouvrez « Mes dons » pour vérifier l’état de vos contributions.',
    notFound:
      'Ce don n’existe pas ou n’est pas le vôtre. Ouvrez « Mes dons » pour retrouver vos contributions.',

    pendingTitle: 'Nous attendons la confirmation de l’opérateur',
    pendingBody:
      'Votre passage au guichet est enregistré. Tant que l’opérateur ne nous a pas confirmé le paiement par son propre canal, nous ne l’affichons pas comme reçu — la page sur laquelle vous êtes ne prouve rien à elle seule. Cette confirmation arrive généralement en quelques instants. Actualisez cette page pour voir l’état réel.',
    refresh: 'Actualiser l’état',

    succeededTitle: 'Merci. Votre don est confirmé.',
    succeededBody:
      'L’opérateur nous a confirmé le paiement. Votre contribution est enregistrée sous la référence ci-dessous.',

    failedTitle: 'Le paiement n’a pas abouti',
    failedBody:
      'L’opérateur nous a indiqué que ce paiement n’a pas été accepté. Aucun montant n’a été prélevé de notre côté. Vous pouvez recommencer.',

    cancelledTitle: 'Paiement annulé',
    cancelledBody: 'Vous avez interrompu le paiement. Rien n’a été prélevé.',

    newDonation: 'Faire un nouveau don',
  },

  failurePage: {
    title: 'Paiement interrompu',
    body: 'Vous avez quitté la page de paiement avant de valider. Aucun montant n’a été prélevé. Si vous avez pourtant validé le paiement, ouvrez « Mes dons » : seul l’état affiché là-bas fait foi.',
    retry: 'Reprendre un don',
  },

  admin: {
    navLabel: 'Dons',
    title: 'Suivi des dons',
    subtitle:
      'Registre des contributions reçues. Seuls les dons CONFIRMÉS par l’opérateur entrent dans les totaux.',
    summaryTitle: 'Dons confirmés',
    summaryEmpty: 'Aucun don confirmé à ce jour.',
    summaryNote:
      'Les totaux sont présentés par devise et jamais additionnés entre elles : aucun taux de change ne fait autorité ici.',
    countLabel: '{count} don(s)',
    statusBreakdown: 'Répartition par état',
    listTitle: 'Derniers dons',
    listEmpty: 'Aucun don enregistré.',
    columnDate: 'Date',
    columnDonor: 'Donateur',
    columnAmount: 'Montant',
    columnProvider: 'Opérateur',
    columnStatus: 'État',
    columnReference: 'Référence',
    anonymous: 'Don anonyme',
    donorUnavailable: 'Nom non accessible',
    loadError: 'Le registre des dons n’a pas pu être lu.',
    providerStripe: 'Stripe',
    providerCinetpay: 'CinetPay',
  },
} as const;

/** Interpolation simple `{cle}`, meme convention que les autres catalogues. */
export function tdon(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}
