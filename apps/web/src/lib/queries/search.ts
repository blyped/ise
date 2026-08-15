import { toBusinessError, type BusinessError, type RelevanceLabel } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import type { SearchCriteria } from '@/lib/search-criteria';

/**
 * Lectures de la tranche RECHERCHE (ISE-034 / ISE-035).
 *
 * Tout passe par les deux RPC deja en place :
 *   - `public.search_profiles(...)`  (migration 0030) ;
 *   - `public.match_profiles(...)`   (migrations 0031, 0033, 0034).
 * Aucune requete d'annuaire n'est ecrite ici, et aucun `select` n'est
 * fait sur `ise_profiles` : depuis 0028 le privilege est retire au
 * niveau table, et de toute facon l'annuaire ne se lit pas ligne a ligne
 * cote application (MASTER PROMPT §21).
 *
 * Les referentiels, eux, sont lus directement : les 25 tables de
 * reference portent la politique `<table>_read_authenticated` (0020).
 * Aucune valeur n'est ecrite en dur dans le code.
 */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

/* ------------------------------------------------------------------ */
/* Referentiels d'ISE-034                                              */
/* ------------------------------------------------------------------ */

export interface ReferenceOption {
  value: string;
  label: string;
  /** Precision affichee sous le libelle (categorie, zone, code…). */
  hint?: string;
}

export interface SearchReferentials {
  skills: ReferenceOption[];
  sectors: ReferenceOption[];
  jobFunctions: ReferenceOption[];
  countries: ReferenceOption[];
  subregions: ReferenceOption[];
  promotions: ReferenceOption[];
  languages: ReferenceOption[];
  availabilityTypes: ReferenceOption[];
  /** `true` si au moins un referentiel n'a pas pu etre lu : l'ecran le dit. */
  failed: boolean;
}

/** Le compteur de lignes de PostgREST est plafonne : on demande explicitement large. */
const REFERENTIAL_LIMIT = 2000;

export async function loadSearchReferentials(): Promise<SearchReferentials> {
  const supabase = await createSupabaseServerClient();
  let failed = false;

  // Deux requetes plates plutot qu'une ressource imbriquee PostgREST : la
  // jointure se fait ici, en memoire, sur 84 categories. Un embed
  // `skill_categories(name)` rendrait le critere « competences » tributaire
  // de la detection de la relation par PostgREST, pour un simple libellé.
  const [
    skills,
    skillCategories,
    sectors,
    functions,
    countries,
    subregions,
    promotions,
    languages,
    availability,
  ] = await Promise.all([
    supabase
      .from('skills')
      .select('id, name, category_id')
      .eq('is_active', true)
      .order('name')
      .limit(REFERENTIAL_LIMIT),
    supabase.from('skill_categories').select('id, name').limit(REFERENTIAL_LIMIT),
    supabase
      .from('sectors')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('job_functions')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('countries')
      .select('code, name_fr, subregion_code')
      .eq('is_active', true)
      .order('name_fr')
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('subregions')
      .select('code, name_fr, region_fr')
      .eq('is_active', true)
      .order('sort_order')
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('promotions')
      .select('id, name, program_code, graduation_year')
      .eq('status', 'active')
      .order('graduation_year', { ascending: false })
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('languages')
      .select('code, name_fr')
      .eq('is_active', true)
      .order('sort_order')
      .limit(REFERENTIAL_LIMIT),
    supabase
      .from('availability_types')
      .select('code, name, description')
      .eq('is_active', true)
      .order('sort_order')
      .limit(REFERENTIAL_LIMIT),
  ]);

  const rowsOf = <T>(result: { data: unknown; error: unknown }): T[] => {
    if (result.error || !Array.isArray(result.data)) {
      failed = failed || Boolean(result.error);
      return [];
    }
    return result.data as T[];
  };

  const skillRows = rowsOf<{ id: number; name: string; category_id: number | null }>(skills);
  const categoryLabels = new Map(
    rowsOf<{ id: number; name: string }>(skillCategories).map((row) => [row.id, row.name]),
  );
  const sectorRows = rowsOf<{ id: number; name: string }>(sectors);
  const functionRows = rowsOf<{ id: number; name: string }>(functions);
  const countryRows = rowsOf<{ code: string; name_fr: string; subregion_code: string | null }>(
    countries,
  );
  const subregionRows = rowsOf<{ code: string; name_fr: string; region_fr: string | null }>(
    subregions,
  );
  const promotionRows = rowsOf<{
    id: number;
    name: string;
    program_code: string;
    graduation_year: number;
  }>(promotions);
  const languageRows = rowsOf<{ code: string; name_fr: string }>(languages);
  const availabilityRows = rowsOf<{ code: string; name: string; description: string | null }>(
    availability,
  );

  const subregionLabels = new Map(subregionRows.map((row) => [row.code, row.name_fr]));

  const withHint = (label: string, hint: string | null | undefined): ReferenceOption =>
    hint ? { value: '', label, hint } : { value: '', label };

  return {
    skills: skillRows.map((row) => ({
      ...withHint(row.name, row.category_id === null ? null : categoryLabels.get(row.category_id)),
      value: String(row.id),
    })),
    sectors: sectorRows.map((row) => ({ value: String(row.id), label: row.name })),
    jobFunctions: functionRows.map((row) => ({ value: String(row.id), label: row.name })),
    countries: countryRows.map((row) => ({
      ...withHint(row.name_fr, subregionLabels.get(row.subregion_code ?? '') ?? null),
      value: row.code,
    })),
    subregions: subregionRows.map((row) => ({
      ...withHint(row.name_fr, row.region_fr),
      value: row.code,
    })),
    promotions: promotionRows.map((row) => ({
      ...withHint(row.name, `${row.program_code} ${row.graduation_year}`),
      value: String(row.id),
    })),
    languages: languageRows.map((row) => ({ value: row.code, label: row.name_fr })),
    availabilityTypes: availabilityRows.map((row) => ({
      ...withHint(row.name, row.description),
      value: row.code,
    })),
    failed,
  };
}

/* ------------------------------------------------------------------ */
/* Libelles des criteres appliques (rappel en puces, ISE-035/036)      */
/* ------------------------------------------------------------------ */

export interface CriterionChip {
  /** Cle i18n de la dimension : `skills`, `sectors`, `countries`… */
  dimension: string;
  /** Valeur brute, telle qu'elle figure dans l'URL. */
  value: string;
  /** Libelle lisible, lu en base. Retombe sur la valeur brute si introuvable. */
  label: string;
}

/**
 * Resout UNIQUEMENT les entrees selectionnees, par identifiant.
 * On ne recharge pas les 543 competences pour en nommer deux
 * (MASTER PROMPT §21 : jamais plus de donnees que necessaire).
 */
export async function loadCriteriaLabels(criteria: SearchCriteria): Promise<CriterionChip[]> {
  const supabase = await createSupabaseServerClient();
  const chips: CriterionChip[] = [];

  const push = (
    dimension: string,
    values: readonly (string | number)[],
    labels: Map<string, string>,
  ) => {
    for (const value of values) {
      const key = String(value);
      chips.push({ dimension, value: key, label: labels.get(key) ?? key });
    }
  };

  const mapOf = (
    result: { data: unknown; error: unknown },
    keyField: string,
    labelOf: (row: Record<string, unknown>) => string,
  ): Map<string, string> => {
    const map = new Map<string, string>();
    if (result.error || !Array.isArray(result.data)) return map;
    for (const raw of result.data as Record<string, unknown>[]) {
      map.set(String(raw[keyField]), labelOf(raw));
    }
    return map;
  };

  const [skills, sectors, functions, countries, subregions, promotions, languages, availability] =
    await Promise.all([
      criteria.skillIds.length > 0
        ? supabase.from('skills').select('id, name').in('id', criteria.skillIds)
        : Promise.resolve({ data: [], error: null }),
      criteria.sectorIds.length > 0
        ? supabase.from('sectors').select('id, name').in('id', criteria.sectorIds)
        : Promise.resolve({ data: [], error: null }),
      criteria.jobFunctionIds.length > 0
        ? supabase.from('job_functions').select('id, name').in('id', criteria.jobFunctionIds)
        : Promise.resolve({ data: [], error: null }),
      criteria.countryCodes.length > 0
        ? supabase.from('countries').select('code, name_fr').in('code', criteria.countryCodes)
        : Promise.resolve({ data: [], error: null }),
      criteria.subregionCodes.length > 0
        ? supabase.from('subregions').select('code, name_fr').in('code', criteria.subregionCodes)
        : Promise.resolve({ data: [], error: null }),
      criteria.promotionIds.length > 0
        ? supabase
            .from('promotions')
            .select('id, program_code, graduation_year')
            .in('id', criteria.promotionIds)
        : Promise.resolve({ data: [], error: null }),
      criteria.languageCodes.length > 0
        ? supabase.from('languages').select('code, name_fr').in('code', criteria.languageCodes)
        : Promise.resolve({ data: [], error: null }),
      criteria.availabilityTypes.length > 0
        ? supabase
            .from('availability_types')
            .select('code, name')
            .in('code', criteria.availabilityTypes)
        : Promise.resolve({ data: [], error: null }),
    ]);

  const name = (row: Record<string, unknown>) => String(row['name'] ?? '');
  const nameFr = (row: Record<string, unknown>) => String(row['name_fr'] ?? '');

  push('skills', criteria.skillIds, mapOf(skills, 'id', name));
  push('sectors', criteria.sectorIds, mapOf(sectors, 'id', name));
  push('functions', criteria.jobFunctionIds, mapOf(functions, 'id', name));
  push('countries', criteria.countryCodes, mapOf(countries, 'code', nameFr));
  push('subregions', criteria.subregionCodes, mapOf(subregions, 'code', nameFr));
  push(
    'promotions',
    criteria.promotionIds,
    mapOf(promotions, 'id', (row) =>
      `${row['program_code'] ?? ''} ${row['graduation_year'] ?? ''}`.trim(),
    ),
  );
  push('languages', criteria.languageCodes, mapOf(languages, 'code', nameFr));
  push('availability', criteria.availabilityTypes, mapOf(availability, 'code', name));

  return chips;
}

/* ------------------------------------------------------------------ */
/* Resultats d'ISE-035                                                 */
/* ------------------------------------------------------------------ */

/**
 * Ligne de resultat telle qu'elle est envoyee au navigateur.
 *
 * MASTER PROMPT §15 : cette interface ne comporte NI score, NI pourcentage,
 * NI rang. `relevanceLabel` est le seul indicateur de pertinence, et c'est
 * un libelle qualitatif (D-42). Le curseur de pagination, qui contient le
 * score cote base, est scelle par `sealCursor()` avant de sortir d'ici.
 */
export interface SearchResultRow {
  profileId: string;
  displayName: string;
  headline: string | null;
  currentPosition: string | null;
  currentOrganization: string | null;
  currentCity: string | null;
  currentCountryCode: string | null;
  promotionLabel: string | null;
  verificationStatus: string | null;
  topSkills: string[];
  openAvailabilityTypes: string[];
  /** Present uniquement en mode `relevance` (D-42, D-43). */
  relevanceLabel: RelevanceLabel | null;
  reasons: MatchReasonView[];
}

export interface MatchReasonView {
  criterion: string;
  label: string;
  evidence: string[];
}

export interface SearchPage {
  rows: SearchResultRow[];
  /** Jeton scelle de la page suivante, ou `null` s'il n'y en a pas. */
  nextCursor: string | null;
}

const RELEVANCE_LABELS: readonly RelevanceLabel[] = ['very_relevant', 'relevant', 'close'];

function toRelevanceLabel(value: unknown): RelevanceLabel | null {
  return typeof value === 'string' && RELEVANCE_LABELS.includes(value as RelevanceLabel)
    ? (value as RelevanceLabel)
    : null;
}

function toReasons(value: unknown): MatchReasonView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw): MatchReasonView[] => {
    if (typeof raw !== 'object' || raw === null) return [];
    const item = raw as { criterion?: unknown; label?: unknown; evidence?: unknown };
    if (typeof item.label !== 'string' || item.label.length === 0) return [];
    return [
      {
        criterion: typeof item.criterion === 'string' ? item.criterion : 'unknown',
        label: item.label,
        evidence: Array.isArray(item.evidence)
          ? item.evidence.filter((entry): entry is string => typeof entry === 'string')
          : [],
      },
    ];
  });
}

const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

interface RawSearchRow {
  profile_id: string;
  display_name: string | null;
  headline: string | null;
  current_position: string | null;
  current_organization: string | null;
  current_city: string | null;
  current_country_code: string | null;
  promotion_label: string | null;
  verification_status: string | null;
  top_skills: unknown;
  open_availability_types: unknown;
  page_cursor: string;
}

interface RawMatchRow {
  profile_id: string;
  display_name: string | null;
  headline: string | null;
  current_position: string | null;
  current_organization: string | null;
  current_country_code: string | null;
  promotion_label: string | null;
  relevance_label: string | null;
  reasons: unknown;
  page_cursor: string;
}

const nullable = <T>(values: readonly T[]): T[] | null => (values.length > 0 ? [...values] : null);
const first = <T>(values: readonly T[]): T | null => values[0] ?? null;

function logFailure(what: string, correlationId: string, error: { code?: string }): void {
  // Le message brut de PostgreSQL ne sort jamais d'ici (D-102).
  console.error(`[ISE] ${what}`, { correlationId, code: error.code });
}

/** ISE-035, mode `directory` — `public.search_profiles()` (migration 0030). */
export async function runDirectorySearch(
  criteria: SearchCriteria,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<SearchPage>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('search_profiles', {
    p_query: criteria.query ?? null,
    p_skill_ids: nullable(criteria.skillIds),
    p_sector_ids: nullable(criteria.sectorIds),
    p_job_function_ids: nullable(criteria.jobFunctionIds),
    p_country_codes: nullable(criteria.countryCodes),
    p_subregion_codes: nullable(criteria.subregionCodes),
    p_promotion_ids: nullable(criteria.promotionIds),
    p_language_codes: nullable(criteria.languageCodes),
    p_availability_types: nullable(criteria.availabilityTypes),
    p_min_years_experience: criteria.minYearsOfExperience ?? null,
    p_cursor: rawCursor,
    p_page_size: criteria.pageSize,
  });

  if (error) {
    logFailure('recherche d annuaire en echec', correlationId, error);
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawSearchRow[];
  return {
    ok: true,
    data: {
      rows: rows.map((row) => ({
        profileId: row.profile_id,
        displayName: row.display_name ?? '',
        headline: row.headline,
        currentPosition: row.current_position,
        currentOrganization: row.current_organization,
        currentCity: row.current_city,
        currentCountryCode: row.current_country_code,
        promotionLabel: row.promotion_label,
        verificationStatus: row.verification_status,
        topSkills: asStrings(row.top_skills),
        openAvailabilityTypes: asStrings(row.open_availability_types),
        relevanceLabel: null,
        reasons: [],
      })),
      nextCursor: nextCursorOf(rows, criteria.pageSize),
    },
  };
}

/**
 * ISE-035, mode `relevance` — `public.match_profiles()` (migrations 0031/0033/0034).
 *
 * `excludeProfileIds` (D-199) : reservee au module « ISE que vous pourriez
 * connaitre » du tableau de bord, qui exclut les profils deja en relation.
 * `null` par defaut : le comportement d'ISE-035 (recherche/resultats) est
 * inchange, la RPC decide seule qui exclure (blocages notamment).
 */
export async function runRelevanceSearch(
  criteria: SearchCriteria,
  rawCursor: string | null,
  correlationId: string,
  excludeProfileIds: readonly string[] | null = null,
): Promise<QueryResult<SearchPage>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('match_profiles', {
    p_skill_ids: nullable(criteria.skillIds),
    p_sector_id: first(criteria.sectorIds),
    p_country_code: first(criteria.countryCodes),
    p_subregion_code: first(criteria.subregionCodes),
    p_availability_type: first(criteria.availabilityTypes),
    p_min_years_experience: criteria.minYearsOfExperience ?? null,
    p_language_codes: nullable(criteria.languageCodes),
    p_promotion_id: first(criteria.promotionIds),
    p_exclude_profile_ids:
      excludeProfileIds !== null && excludeProfileIds.length > 0 ? [...excludeProfileIds] : null,
    p_cursor: rawCursor,
    p_page_size: criteria.pageSize,
  });

  if (error) {
    logFailure('matching de profils en echec', correlationId, error);
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  const rows = (data ?? []) as unknown as RawMatchRow[];
  return {
    ok: true,
    data: {
      rows: rows.map((row) => ({
        profileId: row.profile_id,
        displayName: row.display_name ?? '',
        headline: row.headline,
        currentPosition: row.current_position,
        currentOrganization: row.current_organization,
        currentCity: null,
        currentCountryCode: row.current_country_code,
        promotionLabel: row.promotion_label,
        verificationStatus: null,
        topSkills: [],
        openAvailabilityTypes: [],
        relevanceLabel: toRelevanceLabel(row.relevance_label),
        reasons: toReasons(row.reasons),
      })),
      nextCursor: nextCursorOf(rows, criteria.pageSize),
    },
  };
}

/**
 * Curseur de la page suivante : celui de la DERNIERE ligne (D-44, keyset).
 * Une page incomplete signifie qu'il n'y a plus rien apres : on ne propose
 * alors pas un bouton qui ramenerait une page vide.
 * Le curseur brut contient le score : il est scelle avant de sortir d'ici.
 */
function nextCursorOf(rows: readonly { page_cursor: string }[], pageSize: number): string | null {
  if (rows.length < pageSize) return null;
  const last = rows[rows.length - 1];
  return last ? sealCursor(last.page_cursor) : null;
}
