/**
 * Chaînes de « Ma vitrine publique » — brève description et consentement
 * « ISE du jour » (révision de D-135, migration 0120).
 *
 * D-211 (14/08/2026) — tout ce qui concernait la PHOTO (dépôt, consentement
 * dédié, cadrage) a quitté ce fichier : demande du porteur de fusionner en
 * un dépôt UNIQUE, réglé depuis « Photo de profil » (voir i18n/profile.ts,
 * bloc `header`). Ce fichier ne porte plus que le texte.
 *
 * Fichier distinct de `src/i18n/profile.ts`, comme `admin-*.ts` l'est de
 * `admin.ts` : plusieurs lots avancent en parallèle sur ce dépôt et un seul
 * gros fichier de chaînes devient un point de collision.
 */
export const frShowcase = {
  title: 'Ma vitrine publique',
  subtitle:
    'Ce que la page d’accueil du site — accessible à tous, sans compte — peut montrer de vous.',
  navLabel: 'Ma vitrine publique',
  navHint: 'Brève description et consentement « ISE du jour ».',

  contextTitle: 'À quoi sert cette page',
  contextBody:
    'Chaque jour, la page d’accueil publique met un ISE en avant. Rien n’y paraît sans votre accord : la case ci-dessous est décochée par défaut et vous pouvez la décocher à tout moment.',

  photoPointerTitle: 'Votre photo',
  photoPointerHint:
    'La photo qui accompagne votre parution est celle de votre profil : dépôt et cadrage se règlent depuis « Photo de profil ».',
  photoPointerLink: 'Photo de profil',

  summaryTitle: 'Brève description publique',
  summaryLabel: 'Décrivez-vous en une phrase',
  summaryPlaceholder: 'Ex. Gille KOUAKOU, l’ISE qui voulait absolument parler l’anglais.',
  summaryHint:
    'Une phrase qui vous résume, écrite en sachant qu’elle peut paraître sur le site public. Entre {min} et {max} caractères.',
  summaryExample: 'Exemple : « Gille KOUAKOU, l’ISE qui voulait absolument parler l’anglais. »',
  summaryCounter: '{count} caractères restants',
  summaryTooShort: 'Encore {count} caractère(s) avant le minimum de {min}.',

  consentTitle: 'Mon consentement',
  consentHint: 'Donner cet accord ne publie pas votre photo : ce consentement-là se règle séparément, depuis « Photo de profil ».',

  featureLabel: 'J’accepte de paraître comme « ISE du jour » sur la page d’accueil publique.',
  featureDescription:
    'Y paraîtront : votre nom, votre promotion, votre fonction et votre organisation si vous les avez renseignées, vos expertises et la brève description ci-dessus. Ces informations seront lisibles par n’importe quel visiteur, sans compte.',

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
