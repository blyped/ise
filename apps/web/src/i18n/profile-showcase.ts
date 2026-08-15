/**
 * Chaînes de « Ma vitrine publique » — brève description et DEUX
 * consentements distincts (révision de D-135, migration 0120), cadrage
 * ajustable du portrait (migration 0141).
 *
 * Fichier distinct de `src/i18n/profile.ts`, comme `admin-*.ts` l'est de
 * `admin.ts` : plusieurs lots avancent en parallèle sur ce dépôt et un seul
 * gros fichier de chaînes devient un point de collision.
 *
 * Les libellés ne minimisent rien. La page d'accueil est servie à des
 * visiteurs ANONYMES : une image publiée y devient copiable et indexable.
 * Le membre doit lire cela avant de cocher, pas après.
 */
export const frShowcase = {
  title: 'Ma vitrine publique',
  subtitle:
    'Ce que la page d’accueil du site — accessible à tous, sans compte — peut montrer de vous.',
  navLabel: 'Ma vitrine publique',
  navHint: 'Brève description et consentements « ISE du jour ».',

  contextTitle: 'À quoi sert cette page',
  contextBody:
    'Chaque jour, la page d’accueil publique met un ISE en avant. Rien n’y paraît sans votre accord : les deux cases ci-dessous sont décochées par défaut et vous pouvez les décocher à tout moment.',

  summaryTitle: 'Brève description publique',
  summaryLabel: 'Décrivez-vous en une phrase',
  summaryPlaceholder: 'Ex. Gille KOUAKOU, l’ISE qui voulait absolument parler l’anglais.',
  summaryHint:
    'Une phrase qui vous résume, écrite en sachant qu’elle peut paraître sur le site public. Entre {min} et {max} caractères.',
  summaryExample: 'Exemple : « Gille KOUAKOU, l’ISE qui voulait absolument parler l’anglais. »',
  summaryCounter: '{count} caractères restants',
  summaryTooShort: 'Encore {count} caractère(s) avant le minimum de {min}.',

  consentTitle: 'Mes consentements',
  consentHint:
    'Deux accords distincts, parce qu’ils n’engagent pas la même chose. Donner l’un ne donne pas l’autre.',

  featureLabel: 'J’accepte de paraître comme « ISE du jour » sur la page d’accueil publique.',
  featureDescription:
    'Y paraîtront : votre nom, votre promotion, votre fonction et votre organisation si vous les avez renseignées, vos expertises et la brève description ci-dessus. Ces informations seront lisibles par n’importe quel visiteur, sans compte.',

  photoLabel: 'J’accepte que ma photo soit publiée sur le site public, en médaillon.',
  photoDescription:
    'Votre photo sera visible par n’importe quel visiteur du site, y compris non connecté. Une image publiée sur le web ouvert peut être enregistrée par les moteurs de recherche, mise en cache et copiée : retirer votre accord la retire du site, mais ne peut pas la reprendre à ceux qui l’auraient déjà récupérée.',
  photoRevokeNote:
    'Si vous retirez cet accord, la photo est immédiatement supprimée du site public et le médaillon revient à vos initiales.',

  photoTitle: 'Ma photo publique',
  photoIntro:
    'Cette photo est distincte de votre photo de profil interne : elle est déposée directement dans l’espace public du site. Formats acceptés : PNG, JPEG, WebP ou AVIF, 5 Mo maximum. Un portrait carré est recommandé.',
  photoConsentRequired:
    'Cochez d’abord le consentement de publication de photo ci-dessus, puis enregistrez : le dépôt sera alors possible.',
  photoFileLabel: 'Choisir une image',
  photoAltLabel: 'Description de l’image (pour les lecteurs d’écran)',
  photoAltPlaceholder: 'Ex. Portrait de Gille KOUAKOU, souriant, en chemise claire.',
  photoAltHint:
    'Obligatoire : une image publiée sans description n’est pas lisible par tout le monde.',
  photoSubmit: 'Publier cette photo',
  photoSubmitPending: 'Publication…',
  photoRemove: 'Retirer ma photo publique',
  photoRemovePending: 'Retrait…',
  photoCurrentTitle: 'Photo actuellement publiée',
  photoNone: 'Aucune photo publique n’est déposée. Le médaillon affiche vos initiales.',
  photoPublished: 'Votre photo publique a été enregistrée.',
  photoRemoved: 'Votre photo publique a été retirée du site.',
  photoInvalid: 'Ce fichier n’est pas une image PNG, JPEG, WebP ou AVIF exploitable.',
  photoTooLarge: 'L’image dépasse 5 Mo.',
  photoAltRequired: 'La description de l’image est obligatoire.',
  photoUploadFailed: 'Le dépôt de l’image a échoué. Réessayez dans un instant.',

  // 0141 — cadrage ajustable (position + zoom), purement d'affichage.
  photoCropTitle: 'Cadrage de la vignette',
  photoCropHint:
    'Ajustez la position et le zoom pour que votre visage reste bien centré dans le médaillon « ISE du jour ». Aucune nouvelle image n’est créée : seul l’affichage change, partout où cette photo apparaît en vignette.',
  photoCropXLabel: 'Position horizontale',
  photoCropYLabel: 'Position verticale',
  photoCropZoomLabel: 'Zoom',
  photoCropSubmit: 'Enregistrer le cadrage',
  photoCropSubmitPending: 'Enregistrement…',
  photoCropReset: 'Réinitialiser',
  photoCropSaved: 'Le cadrage de votre photo a été enregistré.',
  photoCropInvalid: 'Le cadrage envoyé est invalide.',

  saved: 'Votre vitrine publique a été enregistrée.',
} as const;

/** Remplace les jetons `{cle}` d'un libellé. */
export function fillShowcase(
  template: string,
  values: Readonly<Record<string, string | number>>,
): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}
