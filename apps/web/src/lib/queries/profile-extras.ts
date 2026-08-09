import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VisibilityLevel } from '@/lib/queries/reference';

/**
 * Lectures des ecrans de profil ISE-024 -> ISE-033.
 *
 * Memes regles que `profile-sections.ts` :
 *  · jamais de `select('*')` sur `ise_profiles` (0028) ;
 *  · la securite est la RLS de 0021/0085, le filtre `profile_id` n'est
 *    qu'une precision de requete ;
 *  · aucune liste de secours inventee : une lecture en echec produit un
 *    `ErrorState` avec `correlation_id` (D-93, D-102).
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string): Result<T> {
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

/* ------------------------------------------------------------------ */
/* Referentiels supplementaires (langues, outils, domaines)             */
/* ------------------------------------------------------------------ */

export interface LanguageOption {
  code: string;
  name: string;
}

export async function loadLanguageOptions(
  correlationId: string,
): Promise<Result<LanguageOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('languages')
    .select('code, name_fr, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name_fr');

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{ code: string; name_fr: string }>;
  return { ok: true, data: rows.map((row) => ({ code: row.code, name: row.name_fr })) };
}

export interface ToolOption {
  id: number;
  name: string;
  category: string | null;
}

export async function loadToolOptions(correlationId: string): Promise<Result<ToolOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tools')
    .select('id, name, category, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    id: number;
    name: string;
    category: string | null;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({ id: row.id, name: row.name, category: row.category })),
  };
}

export interface ExpertiseAreaOption {
  id: number;
  name: string;
  description: string | null;
}

export async function loadExpertiseAreaOptions(
  correlationId: string,
): Promise<Result<ExpertiseAreaOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('expertise_areas')
    .select('id, name, description, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    id: number;
    name: string;
    description: string | null;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({ id: row.id, name: row.name, description: row.description })),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-024 — positionnement declare                                     */
/* ------------------------------------------------------------------ */

export interface PositioningState {
  sectors: Array<{ sectorId: number; name: string; isPrimary: boolean }>;
  functions: Array<{ jobFunctionId: number; name: string }>;
  expertiseAreas: Array<{ expertiseAreaId: number; name: string }>;
}

export async function loadPositioning(
  profileId: string,
  correlationId: string,
): Promise<Result<PositioningState>> {
  const supabase = await createSupabaseServerClient();

  const [sectors, functions, areas] = await Promise.all([
    supabase
      .from('profile_sectors')
      .select('sector_id, is_primary, sectors(name)')
      .eq('profile_id', profileId),
    supabase
      .from('profile_functions')
      .select('job_function_id, job_functions(name)')
      .eq('profile_id', profileId),
    supabase
      .from('profile_expertise_areas')
      .select('expertise_area_id, expertise_areas(name)')
      .eq('profile_id', profileId),
  ]);

  const firstError = sectors.error ?? functions.error ?? areas.error;
  if (firstError) return fail(firstError, correlationId);

  const sectorRows = (sectors.data ?? []) as unknown as Array<{
    sector_id: number;
    is_primary: boolean;
    sectors: { name: string } | null;
  }>;
  const functionRows = (functions.data ?? []) as unknown as Array<{
    job_function_id: number;
    job_functions: { name: string } | null;
  }>;
  const areaRows = (areas.data ?? []) as unknown as Array<{
    expertise_area_id: number;
    expertise_areas: { name: string } | null;
  }>;

  return {
    ok: true,
    data: {
      sectors: sectorRows
        .map((row) => ({
          sectorId: row.sector_id,
          name: row.sectors?.name ?? '',
          isPrimary: row.is_primary,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      functions: functionRows
        .map((row) => ({ jobFunctionId: row.job_function_id, name: row.job_functions?.name ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      expertiseAreas: areaRows
        .map((row) => ({
          expertiseAreaId: row.expertise_area_id,
          name: row.expertise_areas?.name ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    },
  };
}

/* ------------------------------------------------------------------ */
/* ISE-025 / ISE-026 — projets & realisations                           */
/* ------------------------------------------------------------------ */

export interface ProjectRow {
  id: string;
  title: string;
  organizationNameRaw: string | null;
  role: string | null;
  sectorId: number | null;
  sectorName: string | null;
  countryCode: string | null;
  countryName: string | null;
  startDate: string | null;
  endDate: string | null;
  summary: string | null;
  outcome: string | null;
  linkUrl: string | null;
  visibility: VisibilityLevel;
  updatedAt: string;
}

const PROJECT_SELECT =
  'id, title, organization_name_raw, role, sector_id, country_code, start_date, end_date, ' +
  'summary, outcome, link_url, visibility, updated_at, sectors(name), countries(name_fr)';

interface RawProject {
  id: string;
  title: string;
  organization_name_raw: string | null;
  role: string | null;
  sector_id: number | null;
  country_code: string | null;
  start_date: string | null;
  end_date: string | null;
  summary: string | null;
  outcome: string | null;
  link_url: string | null;
  visibility: VisibilityLevel;
  updated_at: string;
  sectors: { name: string } | null;
  countries: { name_fr: string } | null;
}

function toProject(row: RawProject): ProjectRow {
  return {
    id: row.id,
    title: row.title,
    organizationNameRaw: row.organization_name_raw,
    role: row.role,
    sectorId: row.sector_id,
    sectorName: row.sectors?.name ?? null,
    countryCode: row.country_code?.trim() ?? null,
    countryName: row.countries?.name_fr ?? null,
    startDate: row.start_date,
    endDate: row.end_date,
    summary: row.summary,
    outcome: row.outcome,
    linkUrl: row.link_url,
    visibility: row.visibility,
    updatedAt: row.updated_at,
  };
}

export async function loadProjects(
  profileId: string,
  correlationId: string,
): Promise<Result<ProjectRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_projects')
    .select(PROJECT_SELECT)
    .eq('profile_id', profileId)
    .order('start_date', { ascending: false, nullsFirst: false });

  if (error) return fail(error, correlationId);
  return { ok: true, data: ((data ?? []) as unknown as RawProject[]).map(toProject) };
}

export async function loadProject(
  profileId: string,
  projectId: string,
  correlationId: string,
): Promise<Result<ProjectRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_projects')
    .select(PROJECT_SELECT)
    .eq('profile_id', profileId)
    .eq('id', projectId)
    .maybeSingle();

  if (error) return fail(error, correlationId);
  const row = (data ?? null) as unknown as RawProject | null;
  return { ok: true, data: row ? toProject(row) : null };
}

/* ------------------------------------------------------------------ */
/* ISE-027 — langues, zones d'experience, outils declares               */
/* ------------------------------------------------------------------ */

export type LanguageProficiencyLevel =
  'basic' | 'intermediate' | 'professional' | 'fluent' | 'native';

export interface ProfileLanguageRow {
  languageCode: string;
  name: string;
  proficiency: LanguageProficiencyLevel;
}

export async function loadProfileLanguages(
  profileId: string,
  correlationId: string,
): Promise<Result<ProfileLanguageRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_languages')
    .select('language_code, proficiency, languages(name_fr)')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    language_code: string;
    proficiency: LanguageProficiencyLevel;
    languages: { name_fr: string } | null;
  }>;
  return {
    ok: true,
    data: rows
      .map((row) => ({
        languageCode: row.language_code,
        name: row.languages?.name_fr ?? row.language_code,
        proficiency: row.proficiency,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export interface ProfileGeographyRow {
  countryCode: string;
  name: string;
}

export async function loadProfileGeographies(
  profileId: string,
  correlationId: string,
): Promise<Result<ProfileGeographyRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_geographies')
    .select('country_code, countries(name_fr)')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    country_code: string;
    countries: { name_fr: string } | null;
  }>;
  return {
    ok: true,
    data: rows
      .map((row) => ({
        countryCode: row.country_code.trim(),
        name: row.countries?.name_fr ?? row.country_code,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export type ToolProficiencyLevel = 'notion' | 'intermediate' | 'advanced' | 'expert';

export interface ProfileToolRow {
  toolId: number;
  name: string;
  proficiency: ToolProficiencyLevel | null;
}

export async function loadProfileTools(
  profileId: string,
  correlationId: string,
): Promise<Result<ProfileToolRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_tools')
    .select('tool_id, proficiency, tools(name)')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    tool_id: number;
    proficiency: ToolProficiencyLevel | null;
    tools: { name: string } | null;
  }>;
  return {
    ok: true,
    data: rows
      .map((row) => ({
        toolId: row.tool_id,
        name: row.tools?.name ?? '',
        proficiency: row.proficiency,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-028 / ISE-029 — recommandations                                  */
/* ------------------------------------------------------------------ */

export type RecommendationStatus = 'draft' | 'published' | 'hidden' | 'removed';

export interface RecommendationRow {
  id: string;
  status: RecommendationStatus;
  visibility: VisibilityLevel;
  body: string;
  relationshipContext: string;
  engagementContext: string | null;
  skillId: number | null;
  skillName: string | null;
  authorName: string;
  authorHeadline: string | null;
  createdAt: string;
  publishedAt: string | null;
}

const RECOMMENDATION_SELECT =
  'id, status, visibility, body, relationship_context, engagement_context, skill_id, ' +
  'created_at, published_at, skills(name), ' +
  'author:ise_profiles!recommendations_author_profile_id_fkey(first_name, last_name, display_name, headline)';

interface RawRecommendation {
  id: string;
  status: RecommendationStatus;
  visibility: VisibilityLevel;
  body: string;
  relationship_context: string;
  engagement_context: string | null;
  skill_id: number | null;
  created_at: string;
  published_at: string | null;
  skills: { name: string } | null;
  author: {
    first_name: string;
    last_name: string;
    display_name: string | null;
    headline: string | null;
  } | null;
}

function authorName(row: RawRecommendation): string {
  if (row.author === null) return 'Membre du réseau';
  return row.author.display_name ?? `${row.author.first_name} ${row.author.last_name}`.trim();
}

/** Recommandations dont JE suis le sujet (recu). Jamais celles d'un tiers. */
export async function loadReceivedRecommendations(
  profileId: string,
  correlationId: string,
): Promise<Result<RecommendationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('recommendations')
    .select(RECOMMENDATION_SELECT)
    .eq('subject_profile_id', profileId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as RawRecommendation[];
  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      status: row.status,
      visibility: row.visibility,
      body: row.body,
      relationshipContext: row.relationship_context,
      engagementContext: row.engagement_context,
      skillId: row.skill_id,
      skillName: row.skills?.name ?? null,
      authorName: authorName(row),
      authorHeadline: row.author?.headline ?? null,
      createdAt: row.created_at,
      publishedAt: row.published_at,
    })),
  };
}

export type RecommendationRequestStatus =
  'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

export interface RecommendationRequestRow {
  id: string;
  status: RecommendationRequestStatus;
  skillId: number | null;
  skillName: string | null;
  context: string | null;
  message: string | null;
  createdAt: string;
  otherName: string;
  otherHeadline: string | null;
}

interface RawRecommendationRequest {
  id: string;
  status: RecommendationRequestStatus;
  skill_id: number | null;
  context: string | null;
  message: string | null;
  created_at: string;
  skills: { name: string } | null;
  requester: {
    first_name: string;
    last_name: string;
    display_name: string | null;
    headline: string | null;
  } | null;
  recipient: {
    first_name: string;
    last_name: string;
    display_name: string | null;
    headline: string | null;
  } | null;
}

const REQUEST_SELECT =
  'id, status, skill_id, context, message, created_at, skills(name), ' +
  'requester:ise_profiles!recommendation_requests_requester_profile_id_fkey(first_name, last_name, display_name, headline), ' +
  'recipient:ise_profiles!recommendation_requests_recipient_profile_id_fkey(first_name, last_name, display_name, headline)';

function personName(
  person: {
    first_name: string;
    last_name: string;
    display_name: string | null;
  } | null,
): string {
  if (person === null) return 'Membre du réseau';
  return person.display_name ?? `${person.first_name} ${person.last_name}`.trim();
}

/**
 * Demandes de recommandation. `direction === 'received'` : celles qui me
 * sont adressees (a accepter ou decliner) ; `sent` : celles que j'ai
 * envoyees (a retirer tant qu'elles sont en attente).
 */
export async function loadRecommendationRequests(
  profileId: string,
  direction: 'received' | 'sent',
  correlationId: string,
): Promise<Result<RecommendationRequestRow[]>> {
  const supabase = await createSupabaseServerClient();
  const column = direction === 'received' ? 'recipient_profile_id' : 'requester_profile_id';
  const { data, error } = await supabase
    .from('recommendation_requests')
    .select(REQUEST_SELECT)
    .eq(column, profileId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as RawRecommendationRequest[];
  return {
    ok: true,
    data: rows.map((row) => {
      const other = direction === 'received' ? row.requester : row.recipient;
      return {
        id: row.id,
        status: row.status,
        skillId: row.skill_id,
        skillName: row.skills?.name ?? null,
        context: row.context,
        message: row.message,
        createdAt: row.created_at,
        otherName: personName(other),
        otherHeadline: other?.headline ?? null,
      };
    }),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-030 / ISE-031 — regles de completion                             */
/* ------------------------------------------------------------------ */

export interface CompletionRule {
  blockKey: string;
  label: string;
  hint: string | null;
  weight: number;
  sortOrder: number;
}

/**
 * Les 13 regles ACTIVES de `profile_completion_rules` (D-71 : aucune
 * ponderation en dur). Croisees avec `my_profile_missing_items()` pour
 * distinguer les blocs complets des blocs a renforcer — jamais pour
 * classer des membres entre eux (D-72, MASTER PROMPT §17).
 */
export async function loadCompletionRules(
  correlationId: string,
): Promise<Result<CompletionRule[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_completion_rules')
    .select('block_key, label, hint, weight, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    block_key: string;
    label: string;
    hint: string | null;
    weight: number;
    sort_order: number;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      blockKey: row.block_key,
      label: row.label,
      hint: row.hint,
      weight: row.weight,
      sortOrder: row.sort_order,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-032 / ISE-033 — disponibilite detaillee                          */
/* ------------------------------------------------------------------ */

export type AvailabilityChannelValue = 'message' | 'email' | 'call' | 'video';

export interface AvailabilityDetail {
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  maxPerMonth: number | null;
  idealDelayDays: number | null;
  preferredChannel: AvailabilityChannelValue | null;
  visibility: VisibilityLevel;
  notes: string | null;
  updatedAt: string;
}

export async function loadAvailabilityDetails(
  profileId: string,
  correlationId: string,
): Promise<Result<AvailabilityDetail[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_availabilities')
    .select(
      'availability_type, active, max_per_month, ideal_delay_days, preferred_channel, ' +
        'visibility, notes, updated_at, availability_types(name, description, sort_order)',
    )
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{
    availability_type: string;
    active: boolean;
    max_per_month: number | null;
    ideal_delay_days: number | null;
    preferred_channel: AvailabilityChannelValue | null;
    visibility: VisibilityLevel;
    notes: string | null;
    updated_at: string;
    availability_types: { name: string; description: string | null; sort_order: number } | null;
  }>;

  return {
    ok: true,
    data: rows
      .map((row) => ({
        code: row.availability_type,
        name: row.availability_types?.name ?? row.availability_type,
        description: row.availability_types?.description ?? null,
        active: row.active,
        maxPerMonth: row.max_per_month,
        idealDelayDays: row.ideal_delay_days,
        preferredChannel: row.preferred_channel,
        visibility: row.visibility,
        notes: row.notes,
        updatedAt: row.updated_at,
        sortOrder: row.availability_types?.sort_order ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ sortOrder: _sortOrder, ...detail }) => detail),
  };
}
