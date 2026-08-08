import { searchCriteriaSchema, type SearchCriteriaInput } from '@ise/validation';

/**
 * Serialisation des criteres de recherche (ISE-034 -> ISE-036).
 *
 * L'URL est la source de verite : un resultat de recherche se partage, se
 * met en favori et se recharge. Aucun etat de recherche n'est stocke en
 * session, aucun annuaire n'est charge cote client (MASTER PROMPT §21).
 *
 * Le MEME `searchCriteriaSchema` est applique ici — donc cote client au
 * moment de la soumission — et de nouveau dans chaque Server Action et
 * Server Component. Le serveur reste seul juge (MASTER PROMPT §62).
 *
 * Ce module ne doit rien importer de specifique au serveur : il est
 * partage par les composants client.
 */

/** Noms de parametres d'URL, en francais (MASTER PROMPT §66). */
export const PARAM = {
  query: 'q',
  skills: 'competence',
  sectors: 'secteur',
  functions: 'fonction',
  countries: 'pays',
  subregions: 'zone',
  promotions: 'promotion',
  languages: 'langue',
  availability: 'disponibilite',
  experience: 'experience',
} as const;

/** Vue « lecture seule » d'un jeu de parametres, cote serveur comme client. */
export interface ReadableParams {
  getAll(name: string): string[];
  get(name: string): string | null;
}

export type SearchCriteria = SearchCriteriaInput;

export type CriteriaParseResult =
  { ok: true; criteria: SearchCriteria } | { ok: false; fieldErrors: Record<string, string> };

const toInts = (values: readonly string[]): number[] =>
  values
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0);

const toTrimmed = (values: readonly string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value.length > 0);

/** Entree brute, avant validation Zod. Utilisee aussi par `useZodForm`. */
export function rawCriteriaFromParams(params: ReadableParams): unknown {
  const query = (params.get(PARAM.query) ?? '').trim();
  const experience = params.get(PARAM.experience);
  const parsedExperience =
    experience === null || experience.trim() === '' ? undefined : Number.parseInt(experience, 10);

  return {
    ...(query.length > 0 ? { query } : {}),
    skillIds: toInts(params.getAll(PARAM.skills)),
    sectorIds: toInts(params.getAll(PARAM.sectors)),
    jobFunctionIds: toInts(params.getAll(PARAM.functions)),
    countryCodes: toTrimmed(params.getAll(PARAM.countries)).map((code) => code.toUpperCase()),
    subregionCodes: toTrimmed(params.getAll(PARAM.subregions)),
    promotionIds: toInts(params.getAll(PARAM.promotions)),
    languageCodes: toTrimmed(params.getAll(PARAM.languages)),
    availabilityTypes: toTrimmed(params.getAll(PARAM.availability)),
    ...(parsedExperience !== undefined && Number.isInteger(parsedExperience)
      ? { minYearsOfExperience: parsedExperience }
      : {}),
  };
}

/** Entree brute a partir d'un `FormData` (formulaire ISE-034). */
export function rawCriteriaFromFormData(formData: FormData): unknown {
  const params = new URLSearchParams();
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') params.append(key, value);
  }
  return rawCriteriaFromParams(params);
}

/**
 * Valide un jeu de parametres. Toute valeur hors bornes fait echouer la
 * lecture : on ne « corrige » pas silencieusement une URL forgee.
 */
export function parseCriteria(input: unknown): CriteriaParseResult {
  const parsed = searchCriteriaSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, criteria: parsed.data };
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { ok: false, fieldErrors };
}

export function parseCriteriaFromParams(params: ReadableParams): CriteriaParseResult {
  return parseCriteria(rawCriteriaFromParams(params));
}

export function parseCriteriaFromQueryString(queryString: string): CriteriaParseResult {
  return parseCriteriaFromParams(new URLSearchParams(queryString));
}

/** Re-serialise des criteres valides. Ordre stable : deux jeux egaux donnent la meme chaine. */
export function criteriaToQueryString(criteria: SearchCriteria): string {
  const params = new URLSearchParams();
  if (criteria.query && criteria.query.length > 0) params.set(PARAM.query, criteria.query);
  for (const id of criteria.skillIds) params.append(PARAM.skills, String(id));
  for (const id of criteria.sectorIds) params.append(PARAM.sectors, String(id));
  for (const id of criteria.jobFunctionIds) params.append(PARAM.functions, String(id));
  for (const code of criteria.countryCodes) params.append(PARAM.countries, code);
  for (const code of criteria.subregionCodes) params.append(PARAM.subregions, code);
  for (const id of criteria.promotionIds) params.append(PARAM.promotions, String(id));
  for (const code of criteria.languageCodes) params.append(PARAM.languages, code);
  for (const code of criteria.availabilityTypes) params.append(PARAM.availability, code);
  if (typeof criteria.minYearsOfExperience === 'number') {
    params.set(PARAM.experience, String(criteria.minYearsOfExperience));
  }
  return params.toString();
}

/** Un critere quelconque est-il renseigne ? */
export function hasAnyCriteria(criteria: SearchCriteria): boolean {
  return (
    (criteria.query ?? '').length > 0 ||
    criteria.skillIds.length > 0 ||
    criteria.sectorIds.length > 0 ||
    criteria.jobFunctionIds.length > 0 ||
    criteria.countryCodes.length > 0 ||
    criteria.subregionCodes.length > 0 ||
    criteria.promotionIds.length > 0 ||
    criteria.languageCodes.length > 0 ||
    criteria.availabilityTypes.length > 0 ||
    typeof criteria.minYearsOfExperience === 'number'
  );
}

/**
 * Deux moteurs, deux usages — le choix est explique a l'utilisateur.
 *
 * `relevance` : `public.match_profiles()`. Il seul renvoie le libelle
 *   qualitatif (D-42) et les raisons (D-43). Il raisonne sur UN secteur,
 *   UN pays, UNE zone, UN type de disponibilite et UNE promotion.
 *
 * `directory` : `public.search_profiles()`. Il gere le texte libre
 *   (plein texte, trigramme, alias D-45/D-46) et les listes multivaluees,
 *   mais ne calcule aucun score : il n'y a donc pas de libelle a afficher,
 *   et l'ecran le dit au lieu d'en inventer un.
 *
 * La bascule est mecanique, jamais devinee :
 *   - du texte libre    -> `directory` (lui seul sait l'interpreter) ;
 *   - plusieurs valeurs sur une dimension scalaire du matching
 *                       -> `directory` (sinon il faudrait en ignorer) ;
 *   - sinon, au moins un critere de score -> `relevance`.
 */
export type SearchMode = 'relevance' | 'directory';

export function resolveSearchMode(criteria: SearchCriteria): SearchMode {
  if ((criteria.query ?? '').length > 0) return 'directory';

  const scalarOverflow =
    criteria.sectorIds.length > 1 ||
    criteria.countryCodes.length > 1 ||
    criteria.subregionCodes.length > 1 ||
    criteria.availabilityTypes.length > 1 ||
    criteria.promotionIds.length > 1;
  if (scalarOverflow) return 'directory';

  // `jobFunctionIds` n'est pas un critere du bareme D-40 : il ne suffit
  // pas a lui seul a declencher un classement par pertinence.
  const hasScoringCriterion =
    criteria.skillIds.length > 0 ||
    criteria.sectorIds.length > 0 ||
    criteria.countryCodes.length > 0 ||
    criteria.subregionCodes.length > 0 ||
    criteria.availabilityTypes.length > 0 ||
    criteria.promotionIds.length > 0 ||
    criteria.languageCodes.length > 0 ||
    typeof criteria.minYearsOfExperience === 'number';

  return hasScoringCriterion ? 'relevance' : 'directory';
}
