/**
 * Mise en forme des donnees de PUB-001.
 *
 * Module **pur** : aucune chaine editoriale, aucun acces reseau. Il ne fait
 * que rendre lisible ce que la base a renvoye. Les libelles (« Le », « a »,
 * separateurs) viennent de `src/i18n/public.ts` et sont passes en argument
 * quand ils sont necessaires, ce qui garde ce fichier testable sans i18n.
 */

const DATE_STYLE: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

/**
 * Fuseau de rendu par defaut.
 *
 * PUB-001 est rendue cote serveur : sans fuseau explicite, la date dependrait
 * du fuseau de la machine et changerait entre le serveur et le navigateur.
 * UTC est donc impose, sauf quand l'entite porte son propre fuseau.
 */
export const DEFAULT_TIME_ZONE = 'UTC';

function safeTimeZone(timeZone: string | null): string {
  if (timeZone === null || timeZone.trim().length === 0) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone });
    return timeZone;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Date longue en francais, ou `null` si l'horodatage n'est pas exploitable. */
export function formatLongDate(iso: string | null, timeZone: string | null = null): string | null {
  if (iso === null) return null;
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return null;
  return new Intl.DateTimeFormat('fr-FR', {
    ...DATE_STYLE,
    timeZone: safeTimeZone(timeZone),
  }).format(new Date(time));
}

/** Nombre en francais (espace insecable comme separateur de milliers). */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

/**
 * Assemble des fragments en une ligne de contexte, en ecartant ce qui manque.
 * Rien n'est invente : une ville absente ne devient pas « Lieu a preciser ».
 */
export function joinMeta(
  parts: readonly (string | null | undefined)[],
  separator = ' · ',
): string | null {
  const kept = parts
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter((part) => part.length > 0);
  return kept.length === 0 ? null : kept.join(separator);
}
