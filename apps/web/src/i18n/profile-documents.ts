/**
 * Chaînes de « Mes documents » — dépôt de CV et de pièces de profil
 * (migration 0127).
 *
 * Fichier distinct de `src/i18n/profile.ts`, comme `profile-showcase.ts` :
 * plusieurs lots avancent en parallèle sur ce dépôt et un seul gros fichier
 * de chaînes devient un point de collision.
 *
 * Deux libellés ne minimisent rien, et c'est délibéré :
 *   · `noScanNotice` dit qu'AUCUNE analyse antivirale n'est faite — parce
 *     qu'aucun antivirus n'est disponible dans ce déploiement. Écrire
 *     « fichier vérifié » serait une capacité simulée ;
 *   · `deleteWarning` dit qu'une suppression détache le document des
 *     candidatures déjà envoyées, ce qui est la conséquence réelle des
 *     clés étrangères de la migration 0008.
 */
export const frDocuments = {
  title: 'Mes documents',
  subtitle: 'Votre CV et les pièces que vous pouvez joindre à une candidature.',
  navLabel: 'Mes documents',
  navHint: 'Déposer un CV, une lettre, un diplôme.',
  manage: 'Gérer mes documents',

  contextTitle: 'Qui peut voir ces fichiers',
  contextBody:
    'Vos documents sont rangés dans un espace privé. Vous seul y accédez, sauf lorsqu’un document est joint à une candidature : le responsable de l’offre concernée peut alors le consulter, et uniquement dans ce cadre.',

  noScanTitle: 'Aucune analyse automatique des fichiers',
  noScanBody:
    'Les fichiers déposés ne sont pas analysés par un antivirus : aucun n’est disponible sur cette plateforme. Ne déposez que des documents dont vous connaissez l’origine.',

  listTitle: 'Documents déposés',
  emptyTitle: 'Aucun document déposé',
  emptyBody:
    'Déposez votre CV pour pouvoir le joindre à vos candidatures en un clic. Vous pouvez aussi ajouter une lettre, un diplôme ou une attestation.',

  colName: 'Document',
  colType: 'Type',
  colSize: 'Taille',
  colDate: 'Déposé le',
  primaryBadge: 'Principal',
  download: 'Télécharger',
  downloadUnavailable: 'Lien indisponible',
  makePrimary: 'Définir comme principal',
  makePrimaryPending: 'Enregistrement…',
  delete: 'Supprimer',
  deletePending: 'Suppression…',
  deleteWarning:
    'Supprimer un document l’efface définitivement et le retire des candidatures auxquelles il était joint.',

  uploadTitle: 'Déposer un document',
  uploadIntro:
    'Formats acceptés : PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), PNG, JPEG ou WebP. 10 Mo au maximum par fichier.',
  fileLabel: 'Choisir un fichier',
  typeLabel: 'Type de document',
  typePlaceholder: 'Choisir un type',
  titleLabel: 'Intitulé (facultatif)',
  titleHint: 'Ce que vous verrez dans la liste. À défaut, le nom du fichier est utilisé.',
  titlePlaceholder: 'Ex. CV — chargé d’études statistiques',
  primaryLabel: 'Faire de ce document le document principal de son type',
  primaryDescription:
    'Un seul document principal par type. Le CV principal est celui qui vous est proposé en premier lors d’une candidature.',
  submit: 'Déposer ce document',
  submitPending: 'Dépôt…',

  saved: 'Votre document a été déposé.',
  removed: 'Le document a été supprimé.',
  removedDetached:
    'Le document a été supprimé. Il a également été retiré de {count} candidature(s) déjà envoyée(s).',
  primarySet: 'Ce document est désormais le document principal de son type.',

  fileRequired: 'Choisissez un fichier.',
  fileTooLarge: 'Ce fichier dépasse 10 Mo.',
  fileTypeInvalid:
    'Ce format n’est pas accepté. Utilisez un PDF, un .docx, un .xlsx, un .pptx, un PNG, un JPEG ou un WebP.',
  fileContentMismatch:
    'Le contenu du fichier ne correspond pas à son extension. Renommer un fichier ne change pas son format.',
  typeRequired: 'Choisissez un type de document.',
  titleTooLong: 'L’intitulé ne peut pas dépasser 200 caractères.',
  uploadFailed: 'Le dépôt du fichier a échoué. Réessayez dans un instant.',
  documentMissing: 'Ce document n’existe plus.',

  /** Libellés des neuf types autorisés par la contrainte CHECK de 0008. */
  types: {
    cv: 'CV',
    cover_letter: 'Lettre de motivation',
    certificate: 'Attestation ou certificat',
    diploma: 'Diplôme',
    portfolio: 'Portfolio',
    publication: 'Publication',
    technical_proposal: 'Proposition technique',
    financial_proposal: 'Proposition financière',
    other: 'Autre document',
  } as Record<string, string>,
} as const;

/** Remplace les jetons `{cle}` d'un libellé. */
export function fillDocuments(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

/** Taille lisible, en français (espace insécable avant l'unité). */
export function frenchFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
