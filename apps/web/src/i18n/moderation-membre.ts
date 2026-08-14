/**
 * MODERATION D'UN MEMBRE — libelles francais.
 *
 * Fichier i18n DEDIE a la reouverture du blocage (decision C-08 avait
 * emporte le seul point d'entree existant, celui de la messagerie) et a
 * la suppression d'un compte par la moderation (migration 0130).
 *
 * Il ne duplique pas `i18n/settings.ts` (deblocage) ni `i18n/support.ts`
 * (signalement) ni `i18n/admin.ts` (sanctions de statut) : ces trois
 * surfaces existaient deja et gardent leurs libelles. Ce fichier ne
 * porte que ce qui est NOUVEAU.
 *
 * PRINCIPE DE REDACTION : un blocage dont l'effet n'est pas explicite
 * est un piege. Les listes ci-dessous enumerent ce que le blocage
 * empeche REELLEMENT en base — elles sont tirees de
 * `private.is_blocked_between()` et des politiques qui l'appellent, pas
 * d'une promesse d'interface.
 */

export const frMemberModeration = {
  /** Encart « Sécurité » de la fiche profil d'un autre ISE. */
  safety: {
    title: 'Signaler ou bloquer',
    intro:
      'Deux gestes distincts. Bloquer est une mesure personnelle, immédiate, réversible. Signaler alerte l’administration, qui examine et décide.',

    reportAction: 'Signaler ce membre',
    reportHint:
      'Le signalement part vers l’administration avec un motif. Il ne bloque rien de lui-même et n’est pas visible du membre signalé.',

    blockAction: 'Bloquer ce membre',
    blockTitle: 'Bloquer ce membre',
    blockDescription:
      'Le blocage prend effet immédiatement, dans les deux sens : ni vous ni cette personne ne pourrez plus vous atteindre sur la plateforme.',

    blockEffectsTitle: 'Ce que le blocage empêche, concrètement',
    blockEffects: [
      'Son profil disparaît de votre vue, et le vôtre de la sienne — dans les deux sens.',
      'Plus aucune demande de mise en relation, ni dans un sens ni dans l’autre.',
      'Plus aucune demande d’introduction, ni de recommandation.',
      'Plus aucune demande de mentorat, ni d’intérêt pour une offre de stage.',
      'Plus aucune invitation à une communauté, un projet ou une opportunité.',
      'Ses commentaires de communauté et ses inscriptions à des événements ne vous sont plus visibles.',
    ],

    blockPreservedTitle: 'Ce que le blocage ne fait pas',
    blockPreserved: [
      'Il n’alerte pas l’administration : pour cela, il faut signaler.',
      'Il ne prévient pas la personne bloquée.',
      'Il n’efface pas ce qui a déjà été échangé ou publié.',
      'Il ne retire pas cette personne de l’annuaire ISE.',
    ],

    blockNoticeTitle: 'À savoir',
    blockNotice:
      'Après le blocage, cette fiche ne vous sera plus accessible. Le déblocage se fait depuis « Membres bloqués », dans vos paramètres.',

    blockConfirm: 'Bloquer',
    blockDone: 'Ce membre est bloqué. Vous le retrouvez dans « Membres bloqués ».',
    blockedListLink: 'Voir mes membres bloqués',
    self: 'Vous consultez votre propre fiche.',
  },

  /** Fiche administrative d'un membre — suppression du compte (0130). */
  adminDelete: {
    sectionTitle: 'Suppression du compte',
    intro:
      'Mesure ultime, distincte de la suspension. La suspension ferme l’accès sans détruire le compte ; la suppression dissocie définitivement le compte du profil.',

    action: 'Supprimer le compte',
    title: 'Supprimer le compte de ce membre',
    description:
      'Le compte d’authentification est supprimé. Le PROFIL ISE, lui, est conservé : il redevient un profil référencé non réclamé de l’annuaire, réclamable à nouveau plus tard (décision D-19).',

    effectsTitle: 'Ce qui est supprimé',
    effects: [
      'Le compte d’authentification et la session de la personne.',
      'Ses préférences de notification, ses recherches enregistrées et ses jetons d’appareil.',
      'Ses rôles administratifs, s’il en avait.',
      'Son portrait public : l’image est purgée du stockage public au moment de la suppression.',
    ],

    preservedTitle: 'Ce qui est conservé',
    preserved: [
      'Le profil ISE lui-même, remis en « référencé, non réclamé ».',
      'L’archivage du profil, s’il avait été archivé : la suppression ne le désarchive pas.',
      'Ses documents de profil, qui restent dans le stockage privé attaché au profil.',
      'Le journal d’audit et le registre de modération, qui gardent trace de cette décision.',
    ],

    noticeTitle: 'Irréversible',
    notice:
      'Aucune restauration n’est prévue. La personne devra réclamer son profil à nouveau, depuis zéro, si elle revient.',

    confirmationLabel: 'Pour confirmer, saisissez SUPPRIMER',
    confirmationHint: 'En majuscules, sans accent. La base revalide cette saisie de son côté.',
    confirmationPlaceholder: 'SUPPRIMER',

    reasonLabel: 'Motif (obligatoire, 10 caractères minimum)',
    reasonPlaceholder: 'Ex. : faux profil confirmé après examen du signalement du 12/08…',

    confirm: 'Supprimer définitivement le compte',
    done: 'Le compte est supprimé. Le profil est conservé et redevient réclamable.',
    wrongConfirmation: 'La confirmation ne correspond pas. Saisissez exactement SUPPRIMER.',

    /** Le profil n'a pas de compte : il n'y a rien a supprimer. */
    noAccount:
      'Ce profil n’a aucun compte associé : il est déjà référencé, non réclamé. Il n’y a rien à supprimer.',
  },

  /** Complement de `frAdmin.members.actionType` pour le type ajoute en 0130. */
  actionType: {
    account_deletion: 'Suppression du compte',
  } as Record<string, string>,
} as const;
