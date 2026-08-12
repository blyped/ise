import { RELEVANCE_LABELS, type RelevanceLabel } from '@ise/domain';

import { getSupabaseClient } from '../supabase/client';

/**
 * ISE-034 -> ISE-037 — Recherche & decouverte (coquille mobile).
 *
 * Portage direct des lectures/ecritures RPC de la tranche web :
 *   - `apps/web/src/lib/queries/search.ts`        -> `search_profiles`, `match_profiles`
 *   - `apps/web/src/lib/queries/saved-search.ts`  -> `save_search_with_alert`,
 *     `set_search_alert_status`, `delete_saved_search`, `list_saved_searches`
 *   - `apps/web/src/lib/queries/member-profile.ts`-> `get_member_profile`
 * Ce sont EXACTEMENT les memes fonctions Postgres, appelees avec les
 * memes noms de parametres `p_*` — aucune n'est reecrite ni contournee.
 *
 * DEUX ECARTS DELIBERES PAR RAPPORT AU WEB, documentes ici plutot que
 * dans `docs/` (meme regle que `docs/screen-traceability-matrix.md` pour
 * la tranche Recherche, E-01 -> E-07) :
 *
 *  1. Pas de scellement de curseur cote client (`sealCursor`/`unsealCursor`
 *     n'existent pas ici) : comme `queries/network.ts`, il n'y a pas de
 *     serveur Next.js intercale entre l'app et Supabase sur mobile — le
 *     curseur garde retourne par la RPC (`page_cursor`) transite tel
 *     quel, sous le meme RLS que toute autre requete authentifiee.
 *
 *  2. Le formulaire mobile (`SearchScreen`) ne pilote que QUATRE
 *     dimensions de `searchCriteriaSchema` (secteur, pays, type de
 *     disponibilite, annees d'experience minimum), chacune a valeur
 *     UNIQUE plutot que multivaluee. Batir les 8 selecteurs multivalues
 *     du formulaire web (dont un referentiel de 543 competences) sur un
 *     clavier mobile depasse le perimetre de cette premiere livraison ;
 *     ce n'est pas un contournement des RPC — `search_profiles` et
 *     `match_profiles` recoivent toujours des tableaux (a 0 ou 1 element)
 *     dans les memes parametres `p_*`, et les criteres persistes par
 *     `save_search_with_alert` respectent integralement
 *     `searchCriteriaSchema` (les dimensions non pilotees ici sont
 *     simplement des tableaux vides), donc relisibles tels quels par le
 *     web. Seule l'AMPLEUR de ce qui est proposable a l'ecran est reduite.
 */

const PAGE_SIZE = 15; // packages/config/src/limits.ts : limits.pageSize.mobile

/* ------------------------------------------------------------------ */
/* Types communs                                                       */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown): boolean => value === true;
const asStrings = (value: unknown): string[] =>
  asArray(value).filter((entry): entry is string => typeof entry === 'string');

const nullable = <T>(values: readonly T[]): T[] | null => (values.length > 0 ? [...values] : null);
const first = <T>(values: readonly T[]): T | null => (values.length > 0 ? (values[0] ?? null) : null);

/**
 * Sous-ensemble de `SearchCriteriaInput` (`@ise/validation`) pilotable
 * depuis le formulaire mobile. Les tableaux sont toujours a 0 ou 1
 * element ici (voir note d'en-tete), mais restent des tableaux : la
 * forme reste celle du schema partage.
 */
export interface SearchCriteria {
  readonly query: string;
  readonly sectorIds: readonly number[];
  readonly countryCodes: readonly string[];
  readonly availabilityTypes: readonly string[];
  readonly minYearsOfExperience: number | null;
}

export const EMPTY_CRITERIA: SearchCriteria = {
  query: '',
  sectorIds: [],
  countryCodes: [],
  availabilityTypes: [],
  minYearsOfExperience: null,
};

export function hasAnyCriteria(criteria: SearchCriteria): boolean {
  return (
    criteria.query.trim().length > 0 ||
    criteria.sectorIds.length > 0 ||
    criteria.countryCodes.length > 0 ||
    criteria.availabilityTypes.length > 0 ||
    typeof criteria.minYearsOfExperience === 'number'
  );
}

/**
 * Meme bascule mecanique que `apps/web/src/lib/search-criteria.ts#resolveSearchMode`
 * (D-152/E-02) : du texte libre l'emporte toujours ; sinon, au moins un
 * critere de score fait basculer en mode pertinence. Le "scalarOverflow"
 * du web (plusieurs valeurs sur une dimension scalaire du matching) ne
 * peut pas se produire ici : le formulaire mobile ne permet qu'une seule
 * valeur par dimension.
 */
export type SearchMode = 'relevance' | 'directory';

export function resolveSearchMode(criteria: SearchCriteria): SearchMode {
  if (criteria.query.trim().length > 0) return 'directory';

  const hasScoringCriterion =
    criteria.sectorIds.length > 0 ||
    criteria.countryCodes.length > 0 ||
    criteria.availabilityTypes.length > 0 ||
    typeof criteria.minYearsOfExperience === 'number';

  return hasScoringCriterion ? 'relevance' : 'directory';
}

/** Puce de rappel d'un critere applique (ISE-035/036), meme forme que `CriterionChip` cote web. */
export interface CriterionChip {
  readonly dimension: 'query' | 'sectors' | 'countries' | 'availability' | 'experience';
  readonly value: string;
  readonly label: string;
}

export function criteriaChips(
  criteria: SearchCriteria,
  labels: { sectorLabel: string | null; countryLabel: string | null; availabilityLabel: string | null },
): CriterionChip[] {
  const chips: CriterionChip[] = [];
  if (criteria.query.trim().length > 0) {
    chips.push({ dimension: 'query', value: criteria.query, label: criteria.query });
  }
  if (criteria.sectorIds.length > 0 && labels.sectorLabel !== null) {
    chips.push({ dimension: 'sectors', value: String(criteria.sectorIds[0]), label: labels.sectorLabel });
  }
  if (criteria.countryCodes.length > 0 && labels.countryLabel !== null) {
    chips.push({ dimension: 'countries', value: String(criteria.countryCodes[0]), label: labels.countryLabel });
  }
  if (criteria.availabilityTypes.length > 0 && labels.availabilityLabel !== null) {
    chips.push({
      dimension: 'availability',
      value: String(criteria.availabilityTypes[0]),
      label: labels.availabilityLabel,
    });
  }
  if (typeof criteria.minYearsOfExperience === 'number') {
    chips.push({
      dimension: 'experience',
      value: String(criteria.minYearsOfExperience),
      label: `${criteria.minYearsOfExperience} ans minimum`,
    });
  }
  return chips;
}

/**
 * Forme persistee par `save_search_with_alert` (`p_criteria: jsonb`) :
 * le schema complet `searchCriteriaSchema`, dimensions non pilotees par
 * le mobile a `[]`. Une recherche enregistree depuis mobile se relit
 * donc sans erreur cote web.
 */
export function toPersistedCriteria(criteria: SearchCriteria): Json {
  return {
    ...(criteria.query.trim().length > 0 ? { query: criteria.query.trim() } : {}),
    skillIds: [],
    sectorIds: [...criteria.sectorIds],
    jobFunctionIds: [],
    countryCodes: [...criteria.countryCodes],
    subregionCodes: [],
    promotionIds: [],
    languageCodes: [],
    availabilityTypes: [...criteria.availabilityTypes],
    ...(typeof criteria.minYearsOfExperience === 'number'
      ? { minYearsOfExperience: criteria.minYearsOfExperience }
      : {}),
  };
}

function fromPersistedCriteria(value: unknown): SearchCriteria | null {
  const raw = asObject(value);
  if (Object.keys(raw).length === 0) return null;
  return {
    query: str(raw['query']) ?? '',
    sectorIds: asArray(raw['sectorIds']).flatMap((v) => (typeof v === 'number' ? [v] : [])),
    countryCodes: asStrings(raw['countryCodes']),
    availabilityTypes: asStrings(raw['availabilityTypes']),
    minYearsOfExperience: num(raw['minYearsOfExperience']),
  };
}

/* ------------------------------------------------------------------ */
/* Referentiels d'ISE-034 (sous-ensemble mobile : secteurs, pays,      */
/* types de disponibilite — meme lecture directe que le web, memes     */
/* tables, memes politiques `<table>_read_authenticated`, 0020).       */
/* ------------------------------------------------------------------ */

export interface ReferenceOption {
  readonly value: string;
  readonly label: string;
}

export interface SearchReferentials {
  readonly sectors: ReferenceOption[];
  readonly countries: ReferenceOption[];
  readonly availabilityTypes: ReferenceOption[];
  readonly failed: boolean;
}

const REFERENTIAL_LIMIT = 500;

export async function loadSearchReferentials(): Promise<SearchReferentials> {
  const supabase = getSupabaseClient();
  let failed = false;

  const [sectors, countries, availability] = await Promise.all([
    supabase.from('sectors').select('id, name').eq('is_active', true).order('sort_order').order('name').limit(REFERENTIAL_LIMIT),
    supabase.from('countries').select('code, name_fr').eq('is_active', true).order('name_fr').limit(REFERENTIAL_LIMIT),
    supabase.from('availability_types').select('code, name').eq('is_active', true).order('sort_order').limit(REFERENTIAL_LIMIT),
  ]);

  const rowsOf = <T>(result: { data: unknown; error: unknown }): T[] => {
    if (result.error || !Array.isArray(result.data)) {
      failed = failed || Boolean(result.error);
      return [];
    }
    return result.data as T[];
  };

  const sectorRows = rowsOf<{ id: number; name: string }>(sectors);
  const countryRows = rowsOf<{ code: string; name_fr: string }>(countries);
  const availabilityRows = rowsOf<{ code: string; name: string }>(availability);

  return {
    sectors: sectorRows.map((row) => ({ value: String(row.id), label: row.name })),
    countries: countryRows.map((row) => ({ value: row.code, label: row.name_fr })),
    availabilityTypes: availabilityRows.map((row) => ({ value: row.code, label: row.name })),
    failed,
  };
}

/* ------------------------------------------------------------------ */
/* Resultats d'ISE-035                                                 */
/* ------------------------------------------------------------------ */

export interface MatchReasonView {
  readonly criterion: string;
  readonly label: string;
  readonly evidence: readonly string[];
}

/**
 * MASTER PROMPT §15 : ni score, ni pourcentage, ni rang. `relevanceLabel`
 * est le seul indicateur de pertinence (D-42), et `null` en mode annuaire
 * (D-152/E-02) — jamais fabrique cote client.
 */
export interface SearchResultRow {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly currentPosition: string | null;
  readonly currentOrganization: string | null;
  readonly currentCity: string | null;
  readonly currentCountryCode: string | null;
  readonly promotionLabel: string | null;
  readonly verificationStatus: string | null;
  readonly topSkills: readonly string[];
  readonly openAvailabilityTypes: readonly string[];
  readonly relevanceLabel: RelevanceLabel | null;
  readonly reasons: readonly MatchReasonView[];
}

export interface SearchPage {
  readonly rows: readonly SearchResultRow[];
  readonly nextCursor: string | null;
  readonly mode: SearchMode;
}

const RELEVANCE_VALUES: readonly RelevanceLabel[] = Object.keys(RELEVANCE_LABELS) as RelevanceLabel[];

function toRelevanceLabel(value: unknown): RelevanceLabel | null {
  return typeof value === 'string' && (RELEVANCE_VALUES as readonly string[]).includes(value)
    ? (value as RelevanceLabel)
    : null;
}

function toReasons(value: unknown): MatchReasonView[] {
  return asArray(value).flatMap((raw) => {
    const item = asObject(raw);
    const label = str(item['label']);
    if (label === null || label.length === 0) return [];
    return [
      {
        criterion: str(item['criterion']) ?? 'unknown',
        label,
        evidence: asStrings(item['evidence']),
      },
    ];
  });
}

function nextCursorOf(rows: readonly { page_cursor: string }[]): string | null {
  return rows.length < PAGE_SIZE ? null : (rows[rows.length - 1]?.page_cursor ?? null);
}

export interface SearchResult {
  readonly page: SearchPage | null;
  readonly failed: boolean;
}

/** ISE-035, mode `directory` — `public.search_profiles()`. */
async function runDirectorySearch(criteria: SearchCriteria, cursor: string | null): Promise<SearchResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('search_profiles', {
    p_query: criteria.query.trim().length > 0 ? criteria.query.trim() : null,
    p_skill_ids: null,
    p_sector_ids: nullable(criteria.sectorIds),
    p_job_function_ids: null,
    p_country_codes: nullable(criteria.countryCodes),
    p_subregion_codes: null,
    p_promotion_ids: null,
    p_language_codes: null,
    p_availability_types: nullable(criteria.availabilityTypes),
    p_min_years_experience: criteria.minYearsOfExperience,
    p_cursor: cursor,
    p_page_size: PAGE_SIZE,
  });

  if (error) return { page: null, failed: true };

  const rows = (data ?? []) as Array<{
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
  }>;

  return {
    failed: false,
    page: {
      mode: 'directory',
      nextCursor: nextCursorOf(rows),
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
    },
  };
}

/** ISE-035, mode `relevance` — `public.match_profiles()`. */
async function runRelevanceSearch(criteria: SearchCriteria, cursor: string | null): Promise<SearchResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('match_profiles', {
    p_skill_ids: null,
    p_sector_id: first(criteria.sectorIds),
    p_country_code: first(criteria.countryCodes),
    p_subregion_code: null,
    p_availability_type: first(criteria.availabilityTypes),
    p_min_years_experience: criteria.minYearsOfExperience,
    p_language_codes: null,
    p_promotion_id: null,
    p_exclude_profile_ids: null,
    p_cursor: cursor,
    p_page_size: PAGE_SIZE,
  });

  if (error) return { page: null, failed: true };

  const rows = (data ?? []) as Array<{
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
  }>;

  return {
    failed: false,
    page: {
      mode: 'relevance',
      nextCursor: nextCursorOf(rows),
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
    },
  };
}

/** Point d'entree unique d'ISE-035 : choisit la RPC selon `resolveSearchMode`. */
export async function runSearch(criteria: SearchCriteria, cursor: string | null): Promise<SearchResult> {
  const mode = resolveSearchMode(criteria);
  return mode === 'relevance' ? runRelevanceSearch(criteria, cursor) : runDirectorySearch(criteria, cursor);
}

/* ------------------------------------------------------------------ */
/* ISE-037 — profil d'un autre ISE (`get_member_profile`)              */
/* ------------------------------------------------------------------ */

export interface ProfileSkillView {
  readonly id: number;
  readonly name: string;
  readonly level: 'notion' | 'intermediate' | 'advanced' | 'expert' | null;
  readonly yearsExperience: number | null;
}

export interface NamedRef {
  readonly id: number;
  readonly name: string;
}

export interface ProfileLanguageView {
  readonly code: string;
  readonly name: string;
}

export interface ProfileAvailabilityView {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

export interface ProfileExperienceView {
  readonly id: string;
  readonly positionTitle: string;
  readonly organization: string | null;
  readonly country: string | null;
  readonly city: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly isCurrent: boolean;
}

export interface ProfileEducationView {
  readonly id: string;
  readonly institution: string;
  readonly degree: string | null;
  readonly fieldOfStudy: string | null;
  readonly startYear: number | null;
  readonly endYear: number | null;
}

export interface ProfilePromotionView {
  readonly id: number;
  readonly name: string;
  readonly label: string;
  readonly graduationYear: number | null;
}

/** Contexte relationnel (D-51 : degre 1 uniquement, signaux explicites). */
export interface ProfileRelationship {
  readonly isConnected: boolean;
  readonly sharesPromotion: boolean;
  readonly sharesOrganization: boolean;
  readonly sharedOrganizationName: string | null;
  readonly mutualConnectionCount: number;
}

export interface MemberProfileView {
  readonly profileId: string;
  readonly displayName: string;
  readonly verificationStatus: string;
  readonly profileStatus: string;
  readonly claimStatus: string;
  readonly isSelf: boolean;

  readonly headline: string | null;
  readonly bio: string | null;
  readonly currentPosition: string | null;
  readonly currentOrganization: string | null;
  readonly currentCity: string | null;
  readonly currentCountry: string | null;
  readonly linkedinUrl: string | null;
  readonly websiteUrl: string | null;

  readonly promotion: ProfilePromotionView | null;
  readonly skills: readonly ProfileSkillView[];
  readonly sectors: readonly NamedRef[];
  readonly languages: readonly ProfileLanguageView[];
  readonly experiences: readonly ProfileExperienceView[];
  readonly educations: readonly ProfileEducationView[];
  readonly availabilities: readonly ProfileAvailabilityView[];

  readonly relationship: ProfileRelationship;
  /** Cles de champ effectivement autorisees par le proprietaire. */
  readonly visibleFields: readonly string[];
}

const LEVELS = ['notion', 'intermediate', 'advanced', 'expert'] as const;
type Level = (typeof LEVELS)[number];
const level = (value: unknown): Level | null =>
  typeof value === 'string' && (LEVELS as readonly string[]).includes(value) ? (value as Level) : null;

function toNamedRefs(value: unknown): NamedRef[] {
  return asArray(value).flatMap((raw) => {
    const item = asObject(raw);
    const id = num(item['id']);
    const name = str(item['name']);
    return id !== null && name !== null ? [{ id, name }] : [];
  });
}

function toMemberProfileView(payload: Json): MemberProfileView {
  const relationship = asObject(payload['relationship']);
  const promotionRaw = asObject(payload['promotion']);
  const promotionId = num(promotionRaw['id']);

  return {
    profileId: str(payload['profile_id']) ?? '',
    displayName: str(payload['display_name']) ?? '',
    verificationStatus: str(payload['verification_status']) ?? 'unverified',
    profileStatus: str(payload['profile_status']) ?? 'referenced',
    claimStatus: str(payload['claim_status']) ?? 'unclaimed',
    isSelf: bool(payload['is_self']),

    headline: str(payload['headline']),
    bio: str(payload['bio']),
    currentPosition: str(payload['current_position']),
    currentOrganization: str(payload['current_organization']),
    currentCity: str(payload['current_city']),
    currentCountry: str(payload['current_country']),
    linkedinUrl: str(payload['linkedin_url']),
    websiteUrl: str(payload['website_url']),

    promotion:
      promotionId === null
        ? null
        : {
            id: promotionId,
            name: str(promotionRaw['name']) ?? '',
            label: str(promotionRaw['label']) ?? '',
            graduationYear: num(promotionRaw['graduation_year']),
          },

    skills: asArray(payload['skills']).flatMap((raw) => {
      const item = asObject(raw);
      const id = num(item['id']);
      const name = str(item['name']);
      if (id === null || name === null) return [];
      return [{ id, name, level: level(item['level']), yearsExperience: num(item['years_experience']) }];
    }),

    sectors: toNamedRefs(payload['sectors']),

    languages: asArray(payload['languages']).flatMap((raw) => {
      const item = asObject(raw);
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null ? [{ code, name }] : [];
    }),

    experiences: asArray(payload['experiences']).flatMap((raw) => {
      const item = asObject(raw);
      const id = str(item['id']);
      const title = str(item['position_title']);
      if (id === null || title === null) return [];
      return [
        {
          id,
          positionTitle: title,
          organization: str(item['organization']),
          country: str(item['country']),
          city: str(item['city']),
          startDate: str(item['start_date']),
          endDate: str(item['end_date']),
          isCurrent: bool(item['is_current']),
        },
      ];
    }),

    educations: asArray(payload['educations']).flatMap((raw) => {
      const item = asObject(raw);
      const id = str(item['id']);
      const institution = str(item['institution']);
      if (id === null || institution === null) return [];
      return [
        {
          id,
          institution,
          degree: str(item['degree']),
          fieldOfStudy: str(item['field_of_study']),
          startYear: num(item['start_year']),
          endYear: num(item['end_year']),
        },
      ];
    }),

    availabilities: asArray(payload['availabilities']).flatMap((raw) => {
      const item = asObject(raw);
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null
        ? [{ code, name, description: str(item['description']) }]
        : [];
    }),

    relationship: {
      isConnected: bool(relationship['is_connected']),
      sharesPromotion: bool(relationship['shares_promotion']),
      sharesOrganization: bool(relationship['shares_organization']),
      sharedOrganizationName: str(relationship['shared_organization_name']),
      mutualConnectionCount: num(relationship['mutual_connection_count']) ?? 0,
    },

    visibleFields: asStrings(payload['visible_fields']),
  };
}

export interface MemberProfileResult {
  readonly profile: MemberProfileView | null;
  readonly failed: boolean;
}

/**
 * `profile: null` couvre indistinctement : profil inexistant, supprime,
 * suspendu, ou bloque dans un sens ou l'autre (meme comportement que le
 * web, delibere : la reponse ne doit pas permettre de distinguer
 * « inexistant » de « ce membre vous a bloque »).
 */
export async function loadMemberProfile(profileId: string): Promise<MemberProfileResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_member_profile', { p_profile_id: profileId });

  if (error) return { profile: null, failed: true };
  if (data === null || data === undefined) return { profile: null, failed: false };

  const payload = asObject(data);
  if (typeof payload['profile_id'] !== 'string') return { profile: null, failed: false };

  return { profile: toMemberProfileView(payload), failed: false };
}

/* ------------------------------------------------------------------ */
/* ISE-036 — recherches enregistrees et alertes                        */
/* ------------------------------------------------------------------ */

export const ALERT_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type AlertFrequency = (typeof ALERT_FREQUENCIES)[number];

export const ALERT_CHANNELS = ['in_app', 'email', 'both'] as const;
export type AlertChannel = (typeof ALERT_CHANNELS)[number];

export type AlertStatus = 'active' | 'paused';

export interface SavedSearchView {
  readonly savedSearchId: string;
  readonly name: string;
  readonly criteria: SearchCriteria | null;
  readonly createdAt: string;
  readonly alertEnabled: boolean;
  readonly alertFrequency: AlertFrequency | null;
  readonly alertChannel: AlertChannel | null;
  readonly alertStatus: AlertStatus | null;
}

const asFrequency = (value: unknown): AlertFrequency | null =>
  typeof value === 'string' && (ALERT_FREQUENCIES as readonly string[]).includes(value)
    ? (value as AlertFrequency)
    : null;
const asChannel = (value: unknown): AlertChannel | null =>
  typeof value === 'string' && (ALERT_CHANNELS as readonly string[]).includes(value)
    ? (value as AlertChannel)
    : null;
const asStatus = (value: unknown): AlertStatus | null =>
  value === 'active' || value === 'paused' ? value : null;

export interface SavedSearchesResult {
  readonly searches: readonly SavedSearchView[];
  readonly failed: boolean;
}

export async function listSavedSearches(): Promise<SavedSearchesResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_saved_searches');

  if (error) return { searches: [], failed: true };

  const rows = (data ?? []) as Array<{
    saved_search_id: string;
    name: string;
    criteria: unknown;
    created_at: string;
    alert_enabled: boolean | null;
    alert_frequency: string | null;
    alert_channel: string | null;
    alert_status: string | null;
  }>;

  return {
    failed: false,
    searches: rows.map((row) => ({
      savedSearchId: row.saved_search_id,
      name: row.name,
      criteria: fromPersistedCriteria(row.criteria),
      createdAt: row.created_at,
      alertEnabled: row.alert_enabled === true,
      alertFrequency: asFrequency(row.alert_frequency),
      alertChannel: asChannel(row.alert_channel),
      alertStatus: asStatus(row.alert_status),
    })),
  };
}

export interface SaveSearchArgs {
  readonly name: string;
  readonly criteria: SearchCriteria;
  readonly alertEnabled: boolean;
  readonly frequency: AlertFrequency;
  readonly channel: AlertChannel;
}

export interface SaveSearchResult {
  readonly savedSearchId: string | null;
  readonly failed: boolean;
}

export async function saveSearchWithAlert(args: SaveSearchArgs): Promise<SaveSearchResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('save_search_with_alert', {
    p_name: args.name,
    p_criteria: toPersistedCriteria(args.criteria),
    p_alert_enabled: args.alertEnabled,
    p_frequency: args.frequency,
    p_channel: args.channel,
    p_saved_search_id: null,
  });

  if (error) return { savedSearchId: null, failed: true };
  return { savedSearchId: typeof data === 'string' ? data : null, failed: false };
}

export async function setSearchAlertStatus(
  savedSearchId: string,
  status: AlertStatus,
): Promise<{ failed: boolean }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('set_search_alert_status', {
    p_saved_search_id: savedSearchId,
    p_status: status,
  });
  return { failed: Boolean(error) };
}

export async function deleteSavedSearch(savedSearchId: string): Promise<{ failed: boolean }> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('delete_saved_search', { p_saved_search_id: savedSearchId });
  return { failed: Boolean(error) };
}
