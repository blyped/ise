/**
 * Retour d'action des tranches PROMOTIONS / STAGES / MENTORAT.
 *
 * POURQUOI CE MODULE. Ces trois tranches sont rendues integralement
 * cote serveur : leurs formulaires appellent une Server Action qui
 * `redirect()` vers l'ecran d'origine. Un etat React ne survivrait pas
 * a cette redirection. Le resultat voyage donc dans l'URL, sous une
 * forme volontairement pauvre :
 *   `?etat=erreur&code=<code metier>&ref=<correlation_id>`
 *   `?etat=ok&msg=<cle de message>`
 *
 * Le `code` est un CODE METIER (`not_authorized`, `rate_limited`…), pas
 * un message : la traduction reste dans les catalogues `i18n`. Aucune
 * trace technique, aucun nom de table, aucun SQL (D-102). Le
 * `correlation_id` accompagne toute erreur, exactement comme
 * `ErrorState` l'exige (D-93).
 */

export interface ActionFeedback {
  status: 'error' | 'success';
  /** Code metier pour une erreur, cle de message pour un succes. */
  code: string;
  correlationId: string | null;
}

const ONE = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/** Lit le retour d'action depuis les parametres de recherche d'un ecran. */
export function readFeedback(
  params: Record<string, string | string[] | undefined>,
): ActionFeedback | null {
  const state = ONE(params['etat']);
  if (state !== 'erreur' && state !== 'ok') return null;

  const code = ONE(params['code']) ?? ONE(params['msg']);
  if (code === null) return null;

  return {
    status: state === 'erreur' ? 'error' : 'success',
    code,
    correlationId: ONE(params['ref']),
  };
}

/** Construit l'URL de retour d'une Server Action en erreur. */
export function errorUrl(path: string, code: string, correlationId: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}etat=erreur&code=${encodeURIComponent(code)}&ref=${encodeURIComponent(
    correlationId,
  )}`;
}

/** Construit l'URL de retour d'une Server Action reussie. */
export function successUrl(path: string, message: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}etat=ok&msg=${encodeURIComponent(message)}`;
}

/**
 * Traduit un code metier a l'aide du catalogue de la tranche. Un code
 * inconnu retombe sur `unknown` : jamais de code brut a l'ecran.
 */
export function messageFor(catalog: Record<string, string>, code: string): string {
  return catalog[code] ?? catalog['unknown'] ?? 'Une erreur est survenue.';
}

/** Champ texte d'un formulaire, `null` si vide. */
export function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** Champ obligatoire : chaine vide plutot que `null`, pour la validation. */
export function requiredField(formData: FormData, key: string): string {
  return field(formData, key) ?? '';
}

/** Cases a cocher multiples. */
export function fieldList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .flatMap((value) => (typeof value === 'string' && value.length > 0 ? [value] : []));
}

export function checkbox(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}
