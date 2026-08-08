/**
 * Chaines de la tranche MESSAGERIE (ISE-097).
 *
 * Fichier dedie : `fr.ts` reste le socle transverse, chaque tranche
 * apporte son vocabulaire.
 *
 * Regle appliquee partout ici — D-83 et MASTER PROMPT §34 : aucune
 * chaine n'affirme « envoye » avant l'accuse de reception serveur.
 * L'etat local s'appelle « Envoi en cours… », jamais « Envoyé ».
 */
export const frMessaging = {
  common: {
    back: 'Retour',
    cancel: 'Annuler',
    retry: 'Réessayer',
    loadMore: 'Charger les conversations plus anciennes',
    loadOlder: 'Charger les messages plus anciens',
    correlationLabel: 'Référence à communiquer à l’assistance',
  },

  inbox: {
    title: 'Messages',
    subtitle: 'Conversations professionnelles',
    searchLabel: 'Rechercher une conversation',
    searchPlaceholder: 'Nom, contexte ou objet de la conversation',
    searchSubmit: 'Rechercher',
    searchClear: 'Effacer la recherche',
    filterAll: 'Toutes',
    filterUnread: 'Non lues',
    filterArchived: 'Archivées',
    unreadBadge: '{count} non lu',
    unreadBadgePlural: '{count} non lus',
    emptyTitle: 'Vos conversations apparaîtront ici',
    emptyBody:
      'Lorsque vous répondrez à un appel, contacterez un ISE ou rejoindrez un projet, l’échange conservera automatiquement son contexte.',
    emptyAction: 'Trouver un ISE',
    emptyUnreadTitle: 'Aucun message non lu',
    emptyUnreadBody: 'Toutes vos conversations sont à jour.',
    emptyArchivedTitle: 'Aucune conversation archivée',
    emptyArchivedBody:
      'Archiver une conversation la retire de votre liste, sans la supprimer et sans rien changer pour votre interlocuteur.',
    errorTitle: 'Impossible de charger vos conversations.',
    selectPrompt: 'Sélectionnez une conversation',
    selectPromptBody: 'Le fil de l’échange s’affichera ici, avec son contexte d’origine.',
    deletedMessage: 'Message supprimé par son auteur.',
    noMessageYet: 'Aucun message pour le moment.',
    systemMessage: 'Message du système',
  },

  thread: {
    ariaLabel: 'Fil de la conversation',
    liveLabel: 'Nouveaux messages',
    composerLabel: 'Votre message',
    composerPlaceholder: 'Écrivez votre message…',
    send: 'Envoyer',
    sending: 'Envoi en cours…',
    statusPending: 'Envoi en cours…',
    statusSent: 'Envoyé',
    statusRead: 'Lu',
    statusFailed: 'Échec de l’envoi',
    retrySend: 'Réessayer l’envoi',
    contextPrefix: 'Concernant',
    seeProfile: 'Voir le profil',
    archive: 'Archiver la conversation',
    unarchive: 'Sortir de l’archive',
    archived: 'Conversation archivée',
    archivedBody:
      'Elle reste visible ici et chez votre interlocuteur. Un nouveau message la remettra dans votre liste.',
    block: 'Bloquer ce membre',
    blockConfirm:
      'Ce membre ne pourra plus vous écrire, vous inviter ni vous solliciter. Il n’en est pas informé.',
    blocked: 'Échange interrompu',
    blockedBody:
      'Vous ne pouvez plus écrire dans cette conversation. Les messages déjà échangés restent visibles.',
    report: 'Signaler ce message',
    privacyNote: 'Message privé : visible uniquement par les participants de cette conversation.',
    noAdminAccess:
      'Aucune administration de la plateforme ne peut lire cette conversation. Un signalement est le seul élément transmis, et c’est vous qui décidez de son contenu.',
    attachmentsUnavailable:
      'Les pièces jointes ne sont pas encore livrées sur le web : le téléversement et l’analyse antivirus ne sont pas en place. Aucun bouton ne le laisse croire.',
    errorTitle: 'Impossible d’ouvrir cette conversation.',
    notFound: 'Cette conversation n’existe pas ou ne vous est pas accessible.',
  },

  compose: {
    title: 'Nouveau message',
    subtitle: 'Indiquez pourquoi vous écrivez : le contexte évite les échanges sans suite.',
    recipientLabel: 'Destinataire',
    reasonLabel: 'Pourquoi contactez-vous cette personne ?',
    reasonHint: 'Ce motif est enregistré avec la conversation et reste visible des deux côtés.',
    bodyLabel: 'Votre message',
    bodyPlaceholder: 'Présentez votre demande en quelques lignes.',
    submit: 'Envoyer le message',
    submitting: 'Envoi en cours…',
    missingRecipient: 'Aucun destinataire n’a été indiqué.',
    successOpened: 'Votre message est enregistré.',
  },

  /** Codes de `conversations.initiation_reason`, alignes sur la base. */
  reason: {
    expertise: 'Échanger sur une expertise',
    opportunity: 'Une opportunité ou une mission',
    introduction: 'Une mise en relation',
    mentorship: 'Un mentorat',
    project: 'Un projet ou un consortium',
    other: 'Autre motif',
  } as Record<string, string>,

  /** Codes de `conversations.context_type`, alignes sur la base. */
  context: {
    profile: 'Profil',
    network_call: 'Appel au réseau',
    opportunity: 'Opportunité',
    internship: 'Stage',
    mentorship: 'Mentorat',
    project: 'Projet',
    introduction: 'Introduction',
    community: 'Communauté',
    event: 'Événement',
    support: 'Support',
  } as Record<string, string>,
} as const;

/** Interpolation minimale `{cle}` — meme convention que `i18n/network.ts`. */
export function tm(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
