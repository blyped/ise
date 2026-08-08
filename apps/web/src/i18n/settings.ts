/**
 * Chaines des PARAMETRES, de la CONFIDENTIALITE et des PREFERENCES
 * (ISE-099, SYS-008, SYS-009).
 *
 * Regle 6 des regles UX du bloc [14 §135] : toute action de
 * confidentialite doit etre comprehensible sans connaissance technique.
 * Les quatre niveaux de D-73 sont donc nommes en clair — jamais
 * « visibility_level_2 ».
 */
export const frSettings = {
  title: 'Paramètres',
  subtitle: 'Contrôlez votre présence dans le réseau, vos sollicitations et vos notifications.',
  save: 'Enregistrer',
  saving: 'Enregistrement…',
  saved: 'Vos préférences sont enregistrées.',
  cancel: 'Annuler',
  errorTitle: 'Impossible de charger vos paramètres.',
  correlationLabel: 'Référence à communiquer à l’assistance',

  sections: {
    privacy: 'Profil & visibilité',
    privacyBody: 'Choisissez, champ par champ, qui voit quoi.',
    notifications: 'Notifications',
    notificationsBody: 'Recevez d’abord ce qui demande réellement votre attention.',
    account: 'Compte & sollicitations',
    accountBody: 'Qui peut vous écrire, et comment vous apparaissez dans le réseau.',
    blocked: 'Membres bloqués',
    blockedBody: 'Les membres que vous avez bloqués et le moyen de les débloquer.',
    data: 'Mes données & mon compte',
    dataBody: 'Consentements, export, suppression du compte.',
  },

  /** Les 4 niveaux de D-73. */
  visibility: {
    private: 'Moi uniquement',
    connections: 'Mes relations',
    promotion: 'Ma promotion',
    members: 'Tous les membres ISE',
  } as Record<string, string>,

  privacy: {
    title: 'Confidentialité — visibilité par champ',
    subtitle:
      'Chaque champ a ses propres niveaux autorisés. Un niveau non proposé n’est pas un oubli : il est refusé par la plateforme elle-même.',
    fieldColumn: 'Information',
    levelColumn: 'Visible par',
    defaultSuffix: 'valeur par défaut',
    serverEnforced:
      'Ces règles sont appliquées côté serveur : une information masquée n’est pas envoyée à votre navigateur, elle n’est pas simplement cachée à l’affichage.',
    noPublicLevel:
      'Aucun niveau « web public » n’existe : les profils ISE ne sont jamais exposés en dehors des membres authentifiés.',
    updated: 'La visibilité de « {field} » est maintenant : {level}.',
  },

  notifications: {
    title: 'Préférences de notification',
    subtitle:
      'Un réglage par type d’événement. Les valeurs affichées sont celles du catalogue tant que vous ne les avez pas modifiées.',
    inApp: 'Dans l’application',
    email: 'E-mail',
    push: 'Notification mobile',
    emailModes: {
      immediate: 'Immédiat',
      daily_digest: 'Résumé quotidien',
      weekly_digest: 'Résumé hebdomadaire',
      off: 'Désactivé',
    } as Record<string, string>,
    notConfigurable: 'Non désactivable',
    notConfigurableHint:
      'Sécurité du compte, annulation ou changement d’événement : ces alertes ne peuvent pas être coupées.',
    pushNotAllowed: 'Push non disponible pour ce type',
    emailNotAllowed: 'E-mail non disponible pour ce type',
    isDefault: 'Valeur par défaut',
    presetLabel: 'Réglage courant',
    preset: {
      recommended: 'Recommandé',
      minimal: 'Minimal',
      all: 'Tout recevoir',
      custom: 'Personnalisé',
    } as Record<string, string>,
    deliveryNotice:
      'Seules les notifications dans l’application sont émises aujourd’hui. Les envois par e-mail et par notification push ne partent pas encore : aucun service d’envoi n’est déployé.',
  },

  account: {
    title: 'Compte & sollicitations',
    directMessagePolicy: 'Qui peut m’écrire',
    directMessagePolicyHint:
      'Appliqué par la plateforme : un membre non autorisé ne peut pas ouvrir de conversation avec vous.',
    policy: {
      members: 'Tous les membres ISE',
      connections: 'Mes relations uniquement',
      none: 'Personne pour le moment',
    } as Record<string, string>,
    readReceipts: 'Indiquer à mes interlocuteurs que j’ai lu leurs messages',
    readReceiptsHint: 'Si vous le désactivez, la mention « Lu » n’est plus transmise.',
    appearInMatching: 'Apparaître dans les recommandations et le matching',
    appearInAttendeeLists: 'Apparaître dans les listes de participants aux événements',
    digestFrequency: 'Fréquence du résumé par e-mail',
    digest: {
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      off: 'Aucun',
    } as Record<string, string>,
    pause: 'Mettre mon profil en pause',
    pauseHint:
      'Votre profil n’est plus proposé dans le matching. Votre compte, vos conversations et vos données sont conservés. C’est réversible à tout moment.',
    pauseReasonLabel: 'Motif (facultatif)',
    paused: 'Votre profil est en pause depuis le {date}.',
    resume: 'Réactiver mon profil',
    notInScope:
      'Le changement d’adresse de connexion, le mot de passe, la double authentification et les sessions actives ne sont pas livrés dans cet écran.',
  },

  blocked: {
    title: 'Membres bloqués',
    subtitle:
      'Un membre bloqué ne peut plus vous écrire ni vous solliciter. Il n’en est jamais informé.',
    unblock: 'Débloquer',
    unblocked: 'Ce membre n’est plus bloqué.',
    blockedOn: 'Bloqué le {date}',
    emptyTitle: 'Aucun membre bloqué',
    emptyBody: 'Vous pouvez bloquer un membre depuis une conversation.',
  },

  data: {
    title: 'Mes données, mes consentements et mon compte',
    subtitle:
      'Accès, rectification, export, suppression et révocation du consentement — et ce qui n’est pas encore disponible.',

    consentsTitle: 'Mes consentements',
    consentsBody:
      'Chaque décision est conservée : révoquer n’efface pas la trace précédente, cela en ajoute une nouvelle.',
    consentGranted: 'Accordé le {date}',
    consentRevoked: 'Révoqué le {date}',
    consentNever: 'Jamais renseigné',
    grant: 'Accorder',
    revoke: 'Révoquer',
    consentType: {
      terms_of_service: 'Conditions générales d’utilisation',
      privacy_policy: 'Politique de confidentialité',
      marketing_communication: 'Communications marketing',
      testimonial_use: 'Utilisation de mes témoignages',
      public_profile: 'Profil public',
      data_processing: 'Traitement de mes données',
    } as Record<string, string>,
    termsTitle: 'Documents acceptés',
    termsNone: 'Aucune acceptation enregistrée.',
    documentType: {
      terms_of_service: 'Conditions générales d’utilisation',
      privacy_policy: 'Politique de confidentialité',
      code_of_conduct: 'Charte de bonne conduite',
      cookie_policy: 'Politique de cookies',
    } as Record<string, string>,
    acceptedOn: 'Version {version}, acceptée le {date}',

    accessTitle: 'Accéder à mes données et les rectifier',
    accessBody:
      'Vos informations de profil se consultent et se corrigent depuis « Mon profil ». La visibilité de chaque champ se règle dans « Confidentialité ».',
    accessLink: 'Ouvrir mon profil',

    exportTitle: 'Exporter mes données',
    exportBody:
      'L’export de vos données n’est pas encore disponible : la génération du fichier n’est pas implémentée. Aucun bouton d’export n’est affiché tant qu’il ne produirait rien. Pour obtenir une copie de vos données, adressez une demande à l’assistance.',
    exportAction: 'Demander mes données à l’assistance',

    deleteTitle: 'Supprimer mon compte',
    deleteWhatHappens: 'Ce qui est supprimé',
    deleteWhatHappensBody:
      'Votre compte de connexion, vos coordonnées privées, vos réglages, vos préférences de notification et vos recherches enregistrées.',
    deleteWhatRemains: 'Ce qui n’est pas supprimé',
    deleteWhatRemainsBody:
      'Votre profil ISE référencé subsiste. Il n’appartient pas au compte : il fait partie de l’annuaire des ISE. Il redevient simplement un profil non réclamé, que vous — ou une vérification ultérieure — pourrez réclamer à nouveau. Les preuves de consentement sont conservées, comme la loi l’exige.',
    deleteNotProfileDeletion:
      'Supprimer mon compte n’est donc pas supprimer mon profil référencé. La suppression d’un profil de l’annuaire relève de l’administration ISE et se demande à l’assistance.',
    deleteAction: 'Supprimer mon compte',
    deleteDialogTitle: 'Supprimer définitivement votre compte ?',
    deleteConfirmLabel: 'Pour confirmer, saisissez SUPPRIMER',
    deleteConfirmPlaceholder: 'SUPPRIMER',
    deleteConfirmHint: 'Saisissez le mot exactement, en majuscules.',
    deleteConfirmAction: 'Supprimer définitivement',
    deleteIrreversible: 'Cette action est immédiate et irréversible.',
    deleteOnlineOnly:
      'Cette action exige une connexion : elle n’est jamais mise en file d’attente hors ligne.',
    deleteWrongConfirmation: 'La confirmation saisie ne correspond pas.',
  },
} as const;

export function ts(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
