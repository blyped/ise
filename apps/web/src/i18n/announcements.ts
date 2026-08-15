/**
 * Chaines des ANNONCES du tableau de bord membre (0145, tache #188).
 *
 * Diffusion DESCENDANTE (administration -> tous les membres), sans
 * rapport avec le module Communication ASCENDANT (support, remontees
 * d'information, 0131). Voir docs/decisions.md pour le detail du choix.
 */
export const frAnnouncements = {
  admin: {
    navLabel: 'Annonces',

    list: {
      title: 'Annonces',
      subtitle:
        'Messages diffusés en tête du tableau de bord de tous les membres, avec un niveau de gravité normal ou urgent.',
      newAnnouncement: 'Rédiger une annonce',
      empty: 'Aucune annonce pour le moment.',
      emptyBody: 'Rédigez un message pour qu’il apparaisse en tête du tableau de bord des membres.',
      open: 'Ouvrir',
      columns: {
        window: 'Fenêtre de diffusion',
        published: 'Publiée le',
        noWindow: 'Diffusion immédiate, sans expiration',
      },
    },

    status: {
      draft: 'Brouillon',
      published: 'Publiée',
      expired: 'Expirée',
    },

    severity: {
      normal: 'Normal',
      urgent: 'Urgent',
    },

    form: {
      createTitle: 'Nouvelle annonce',
      editTitle: 'Modifier l’annonce',
      bodyLabel: 'Message',
      bodyPlaceholder: 'Le message affiché en tête du tableau de bord des membres…',
      bodyHint: '2000 caractères au maximum.',
      severityLegend: 'Gravité',
      severityHint:
        'Une annonce urgente est mise en avant visuellement et apparaît toujours avant les annonces normales.',
      startsAtLabel: 'Début de diffusion (facultatif)',
      startsAtHint: 'Laissez vide pour une diffusion immédiate dès la publication.',
      endsAtLabel: 'Fin de diffusion (facultatif)',
      endsAtHint: 'Laissez vide pour une annonce sans expiration.',
      submitCreate: 'Créer l’annonce',
      submitUpdate: 'Enregistrer',
      created: 'Annonce créée, en brouillon. Publiez-la pour la diffuser aux membres.',
      updated: 'Annonce mise à jour.',
      invalid: 'Le message est obligatoire (2000 caractères au maximum).',
      invalidWindow: 'La date de fin doit être postérieure à la date de début.',
    },

    detail: {
      back: 'Retour aux annonces',
      contentTitle: 'Contenu',
      lifecycleTitle: 'Diffusion',
      createdAt: 'Créée le',
      publishedAt: 'Publiée le',
      publish: 'Publier',
      unpublish: 'Dépublier',
      publishHint: 'Rend l’annonce visible sur le tableau de bord de tous les membres, dans sa fenêtre de diffusion.',
      unpublishHint: 'Retire l’annonce du tableau de bord membre. Le contenu est conservé, en brouillon.',
      deleteTitle: 'Suppression',
      delete: 'Supprimer définitivement',
      deleteHint: 'Retire l’annonce du back-office. Cette action ne peut pas être annulée depuis l’interface.',
      done: 'Action effectuée.',
    },
  },

  /** Bandeau du tableau de bord membre (`AnnouncementsBanner`). */
  member: {
    urgentPrefix: 'Urgent',
    normalPrefix: 'Information',
  },
} as const;
