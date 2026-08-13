/**
 * Chaines SA-011 (suivi des invitations d'une promotion) et SA-012->015
 * (campagnes d'invitation en masse). Fichier separe de `admin.ts`, meme
 * discipline que `admin-dedup.ts` (SA-005/SA-007).
 */
export const frAdminCampaigns = {
  nav: {
    invitations: 'Invitations (suivi)',
    campaigns: "Campagnes d'invitation",
  },
  invitations: {
    title: 'Invitations de la promotion',
    subtitle:
      "Vue d'ensemble de toutes les invitations envoyées pour cette promotion, tous émetteurs confondus.",
    empty: 'Aucune invitation pour cette promotion.',
    emptyBody: "Les invitations envoyées individuellement (ISE-070) ou par campagne apparaîtront ici.",
    columns: {
      member: 'Profil',
      status: 'Statut',
      inviter: 'Émetteur',
      created: 'Envoyée le',
      origin: 'Origine',
    },
    status: {
      sent: 'Envoyée',
      opened: 'Ouverte',
      claimed: 'Réclamée',
      expired: 'Expirée',
      revoked: 'Révoquée',
    } as Record<string, string>,
    campaignOrigin: 'Campagne',
    individualOrigin: 'Individuelle',
  },
  list: {
    title: "Campagnes d'invitation",
    subtitle: "Envoi en masse d'invitations à réclamer un profil, avec quotas anti-spam obligatoires.",
    empty: 'Aucune campagne pour cette promotion.',
    emptyBody:
      "Créez une campagne pour inviter plusieurs profils référencés en une fois, dans la limite d'un quota quotidien.",
    newCampaign: 'Nouvelle campagne',
    status: {
      draft: 'Brouillon',
      scheduled: 'Planifiée',
      running: 'En cours',
      paused: 'En pause',
      completed: 'Terminée',
      cancelled: 'Annulée',
    } as Record<string, string>,
    channel: { email: 'E-mail', in_app: "Dans l'application" } as Record<string, string>,
  },
  create: {
    title: "Nouvelle campagne d'invitation",
    subtitle:
      "Le lancement effectif (envoi des invitations) se fait ensuite, par lots, dans la limite du quota quotidien.",
    name: 'Nom de la campagne',
    namePlaceholder: 'Ex. : Relance rentrée 2026',
    objective: 'Objectif (facultatif)',
    channel: 'Canal',
    channelHelp:
      "Seul le canal e-mail peut être lancé en masse pour le moment ; « dans l'application » reste réservé à un usage individuel (ISE-070).",
    dailyQuota: 'Quota quotidien',
    dailyQuotaHelp: 'Entre 1 et 200 invitations envoyées par jour, maximum.',
    totalQuota: 'Quota total (facultatif)',
    totalQuotaHelp: 'Laisser vide pour ne pas plafonner le nombre total.',
    submit: 'Créer la campagne',
    invalid: 'Vérifiez le nom (3 caractères minimum) et les quotas.',
  },
  detail: {
    overview: 'Aperçu',
    objective: 'Objectif',
    channel: 'Canal',
    dailyQuota: 'Quota quotidien',
    totalQuota: 'Quota total',
    sentSoFar: 'Envoyées à ce jour',
    eligibleTargets: 'Profils encore éligibles',
    launch: "Lancer un lot d'invitations",
    launchHelp:
      'Envoie un lot (jusqu’à 50) dans la limite du quota quotidien restant. Les jetons ne sont jamais journalisés.',
    pauseTitle: 'Mettre en pause la campagne',
    pauseBody: "Aucun nouveau lot ne pourra être lancé tant que la campagne est en pause.",
    pause: 'Mettre en pause',
    resume: 'Reprendre',
    closeTitle: 'Clôturer la campagne',
    closeBody:
      'Action définitive : une campagne clôturée ne peut plus être relancée. Le bilan reste consultable.',
    close: 'Clôturer la campagne',
    statsTitle: 'Statistiques',
    stats: {
      sent: 'Envoyées',
      opened: 'Ouvertes',
      claimed: 'Réclamées',
      expired: 'Expirées',
      revoked: 'Révoquées',
    },
    bilanTitle: 'Bilan de la campagne',
    conversionRate: 'Taux de réclamation',
    reasonPlaceholder: 'Pourquoi cette décision ?',
    paused: 'Campagne mise en pause.',
    resumed: 'Campagne reprise.',
    closed: 'Campagne clôturée.',
    channelNotEmail:
      "Cette campagne utilise le canal « dans l'application » : le lancement en masse n'est pas disponible pour ce canal.",
  },
  /**
   * Suivi des clics sur les liens d'e-mail Supabase (D-173) — resume
   * GLOBAL plateforme (toutes promotions confondues), pas le detail d'une
   * campagne. Regroupe ici faute d'un meilleur emplacement, cf. le
   * commentaire en tete de `promotions/liens/page.tsx`.
   */
  authLinks: {
    navLink: "Clics sur les liens d'e-mail",
    title: "Clics sur les liens d'e-mail (30 derniers jours)",
    subtitle:
      "Chaque atterrissage sur le lien d'un e-mail Supabase (activation, confirmation, réinitialisation), succès ET échec — vue globale de la plateforme, pas filtrée par promotion ni par campagne.",
    empty: 'Aucun clic enregistré sur la période.',
    emptyBody:
      "Soit aucun lien n'a encore été envoyé, soit aucun destinataire n'a encore cliqué depuis la mise en place de ce suivi.",
    columns: {
      linkType: 'Type de lien',
      success: 'Succès',
      error: 'Échec (lien invalide/expiré)',
      distinctUsers: 'Comptes distincts activés',
    },
    linkType: {
      signup: 'Confirmation de compte',
      invite: 'Invitation (D-161)',
      magiclink: 'Lien magique',
      recovery: 'Réinitialisation de mot de passe',
      email_change: "Changement d'adresse e-mail",
      email: 'E-mail (générique)',
      code: 'Code PKCE (sans type explicite)',
    } as Record<string, string>,
    limitNote:
      "Ce suivi capture le clic à partir du moment où Supabase valide le jeton (ou refuse de le faire) — pas les ouvertures ou clics mesurés par Resend avant cette étape, faute d'accès aux réglages du compte Resend (webhook) à ce jour.",
  },
} as const;

export function batchSentMessage(sentCount: number, emailFailures: number): string {
  const base = `${sentCount} invitation${sentCount > 1 ? 's' : ''} envoyée${sentCount > 1 ? 's' : ''}.`;
  if (emailFailures === 0) return base;
  return `${base} ${emailFailures} e-mail${emailFailures > 1 ? 's' : ''} n'${emailFailures > 1 ? 'ont' : 'a'} pas pu être envoyé${emailFailures > 1 ? 's' : ''} (lien conservé côté profil, à relancer plus tard).`;
}
