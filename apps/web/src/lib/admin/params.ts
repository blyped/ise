/**
 * Lecture des parametres d'URL des listes admin (filtres en francais,
 * curseur scelle sous `curseur`) et construction du lien « page
 * suivante » en conservant les filtres actifs.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export function paramValue(params: SearchParams, key: string): string | null {
  const raw = params[key];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Valeur restreinte a une liste fermee ; hors liste -> null (pas d'erreur). */
export function paramOneOf(
  params: SearchParams,
  key: string,
  allowed: readonly string[],
): string | null {
  const value = paramValue(params, key);
  return value !== null && allowed.includes(value) ? value : null;
}

export function paramInteger(params: SearchParams, key: string): number | null {
  const value = paramValue(params, key);
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

/** URL de la page suivante : filtres conserves, curseur remplace. */
export function nextPageHref(
  basePath: string,
  filters: Readonly<Record<string, string | null>>,
  sealedCursor: string | null,
): string | null {
  if (sealedCursor === null) return null;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value.length > 0) query.set(key, value);
  }
  query.set('curseur', sealedCursor);
  return `${basePath}?${query.toString()}`;
}
