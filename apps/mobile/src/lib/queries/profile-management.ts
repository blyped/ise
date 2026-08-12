import {
  availabilitySettingsSchema,
  educationSchema,
  experienceSchema,
  positioningSchema,
  profileGeographiesSchema,
  profileHeaderSchema,
  profileLanguagesSchema,
  profileProjectSchema,
  profileSkillSchema,
  profileToolsSchema,
  profileVisibilityBatchSchema,
  recommendationAcceptSchema,
  recommendationRequestSchema,
} from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';

import { newCorrelationId } from '../correlation';
import { getSupabaseClient } from '../supabase/client';

/**
 * Lectures et ecritures des ecrans de gestion de profil ISE-017 -> ISE-033
 * (coquilles mobile).
 *
 * Portage direct de `apps/web/src/lib/queries/profile-sections.ts`,
 * `profile-extras.ts`, `reference.ts` et des Server Actions
 * `apps/web/src/app/mon-profil/actions.ts` / `actions-extras.ts` /
 * `apps/web/src/app/ma-disponibilite/actions.ts`.
 *
 * Regles reprises telles quelles (MASTER PROMPT, docs/decisions.md) :
 *  - jamais de `select('*')` sur `ise_profiles` (migration 0028) ;
 *  - la securite est la RLS des migrations 0021/0085 ; les filtres
 *    `profile_id = <le mien>` presents ici ne sont qu'une precision de
 *    requete, pas la mesure de securite ;
 *  - le MEME schema Zod que le web est rejoue ici avant toute ecriture
 *    (MASTER PROMPT §62) — il n'y a pas de Server Action intercalee cote
 *    mobile, ce module en tient donc le role de garde-fou client ;
 *  - `profile_completion` (score, D-72) n'est jamais lu par une colonne,
 *    uniquement par la RPC `my_profile_completion`, et n'est jamais montre
 *    a un tiers ;
 *  - le niveau de competence declare reste DECLARATIF (D-75) : aucun texte
 *    ne doit suggerer une validation ou une certification tierce ;
 *  - la visibilite par champ suit l'echelle a quatre niveaux (D-73) :
 *    'private' | 'connections' | 'promotion' | 'members'.
 */

export type VisibilityLevel = 'private' | 'connections' | 'promotion' | 'members';

export type Result<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly message: string; readonly correlationId: string };

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string; readonly correlationId: string };

function fail<T>(raw: unknown): Result<T> {
  const correlationId = newCorrelationId();
  return { ok: false, message: toBusinessError(raw, correlationId).userMessage, correlationId };
}

function failWrite(raw: unknown): WriteResult {
  const correlationId = newCorrelationId();
  return { ok: false, message: toBusinessError(raw, correlationId).userMessage, correlationId };
}

function validationFailure(): WriteResult {
  const correlationId = newCorrelationId();
  return { ok: false, message: BUSINESS_ERRORS.validation_failed, correlationId };
}

type Json = Record<string, unknown>;
const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/* ==================================================================== */
/* Referentiels partages                                                 */
/* ==================================================================== */

export interface CountryOption {
  readonly code: string;
  readonly name: string;
}

export async function loadCountries(): Promise<Result<CountryOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('countries')
    .select('code, name_fr')
    .eq('is_active', true)
    .order('name_fr');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ code: string; name_fr: string }>;
  return { ok: true, data: rows.map((row) => ({ code: row.code.trim(), name: row.name_fr })) };
}

export interface SectorOption {
  readonly id: number;
  readonly name: string;
}

export async function loadSectors(): Promise<Result<SectorOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface JobFunctionOption {
  readonly id: number;
  readonly name: string;
}

export async function loadJobFunctions(): Promise<Result<JobFunctionOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('job_functions')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface ExpertiseAreaOption {
  readonly id: number;
  readonly name: string;
}

export async function loadExpertiseAreas(): Promise<Result<ExpertiseAreaOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('expertise_areas')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface LanguageOption {
  readonly code: string;
  readonly name: string;
}

export async function loadLanguages(): Promise<Result<LanguageOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('languages')
    .select('code, name_fr, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name_fr');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ code: string; name_fr: string }>;
  return { ok: true, data: rows.map((row) => ({ code: row.code, name: row.name_fr })) };
}

export interface ToolOption {
  readonly id: number;
  readonly name: string;
}

export async function loadTools(): Promise<Result<ToolOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tools')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface AvailabilityTypeOption {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

export async function loadAvailabilityTypes(): Promise<Result<AvailabilityTypeOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('availability_types')
    .select('code, name, description, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{
    code: string;
    name: string;
    description: string | null;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({ code: row.code, name: row.name, description: row.description })),
  };
}

export interface VisibilityFieldRule {
  readonly fieldKey: string;
  readonly label: string;
  readonly defaultVisibility: VisibilityLevel;
  readonly allowedLevels: VisibilityLevel[];
}

/** Regles de visibilite par champ (D-73/D-74) : borne les choix proposes ET acceptes. */
export async function loadVisibilityRules(): Promise<Result<VisibilityFieldRule[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_visibility_defaults')
    .select('field_key, label, default_visibility, allowed_levels, sort_order')
    .order('sort_order');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{
    field_key: string;
    label: string;
    default_visibility: VisibilityLevel;
    allowed_levels: VisibilityLevel[];
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({
      fieldKey: row.field_key,
      label: row.label,
      defaultVisibility: row.default_visibility,
      allowedLevels: row.allowed_levels,
    })),
  };
}

async function applyVisibility(
  profileId: string,
  entries: ReadonlyArray<{ fieldKey: string; visibility: VisibilityLevel }>,
): Promise<WriteResult> {
  if (entries.length === 0) return { ok: true };

  const parsed = profileVisibilityBatchSchema.safeParse({ entries });
  if (!parsed.success) return validationFailure();

  const rules = await loadVisibilityRules();
  if (!rules.ok) return rules;

  const allowed = new Map(rules.data.map((rule) => [rule.fieldKey, rule.allowedLevels]));
  for (const entry of parsed.data.entries) {
    const levels = allowed.get(entry.fieldKey);
    if (!levels || !levels.includes(entry.visibility)) {
      const correlationId = newCorrelationId();
      return { ok: false, message: BUSINESS_ERRORS.not_authorized, correlationId };
    }
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profile_visibility').upsert(
    parsed.data.entries.map((entry) => ({
      profile_id: profileId,
      field_key: entry.fieldKey,
      visibility: entry.visibility,
    })),
    { onConflict: 'profile_id,field_key' },
  );
  if (error) return failWrite(error);
  return { ok: true };
}

export async function loadProfileVisibility(
  profileId: string,
): Promise<Result<Record<string, VisibilityLevel>>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_visibility')
    .select('field_key, visibility')
    .eq('profile_id', profileId);
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{ field_key: string; visibility: VisibilityLevel }>;
  const map: Record<string, VisibilityLevel> = {};
  for (const row of rows) map[row.field_key] = row.visibility;
  return { ok: true, data: map };
}

/**
 * Synchronise une table de liaison « (profile_id, cle) » avec la selection
 * recue : suppression de ce qui n'est plus choisi, upsert du reste. Portage
 * direct de `syncJunction` (web `actions-extras.ts`).
 */
async function syncJunction(
  table: string,
  keyColumn: string,
  profileId: string,
  rows: ReadonlyArray<Record<string, unknown>>,
): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const keys = rows.map((row) => row[keyColumn]);

  let deletion = supabase.from(table).delete().eq('profile_id', profileId);
  if (keys.length > 0) {
    const list = keys
      .map((key) => (typeof key === 'number' ? String(key) : `"${String(key)}"`))
      .join(',');
    deletion = deletion.not(keyColumn, 'in', `(${list})`);
  }
  const { error: deleteError } = await deletion;
  if (deleteError) return failWrite(deleteError);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(
        rows.map((row) => ({ ...row, profile_id: profileId })),
        { onConflict: `profile_id,${keyColumn}` },
      );
    if (upsertError) return failWrite(upsertError);
  }
  return { ok: true };
}

/* ==================================================================== */
/* ISE-017 — En-tete et A propos                                        */
/* ==================================================================== */

const HEADER_COLUMNS =
  'id, first_name, last_name, display_name, headline, bio, avatar_path, ' +
  'linkedin_url, website_url, current_position, current_organization_id, ' +
  'current_organization_raw, current_country_code, current_city, ' +
  'promotion_id, claim_status, verification_status, onboarding_completed_at, updated_at';

export interface ProfileHeader {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string | null;
  readonly headline: string | null;
  readonly bio: string | null;
  readonly linkedinUrl: string | null;
  readonly websiteUrl: string | null;
  readonly currentPosition: string | null;
  readonly currentOrganizationRaw: string | null;
  readonly currentCountryCode: string | null;
  readonly currentCity: string | null;
  readonly updatedAt: string;
}

export async function loadProfileHeader(userId: string): Promise<Result<ProfileHeader | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ise_profiles')
    .select(HEADER_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) return fail(error);

  const row = (data ?? null) as unknown as Record<string, unknown> | null;
  if (!row) return { ok: true, data: null };

  return {
    ok: true,
    data: {
      id: String(row['id']),
      firstName: String(row['first_name'] ?? ''),
      lastName: String(row['last_name'] ?? ''),
      displayName: (row['display_name'] as string | null) ?? null,
      headline: (row['headline'] as string | null) ?? null,
      bio: (row['bio'] as string | null) ?? null,
      linkedinUrl: (row['linkedin_url'] as string | null) ?? null,
      websiteUrl: (row['website_url'] as string | null) ?? null,
      currentPosition: (row['current_position'] as string | null) ?? null,
      currentOrganizationRaw: (row['current_organization_raw'] as string | null) ?? null,
      currentCountryCode: ((row['current_country_code'] as string | null) ?? null)?.trim() ?? null,
      currentCity: (row['current_city'] as string | null) ?? null,
      updatedAt: String(row['updated_at'] ?? ''),
    },
  };
}

export interface SaveHeaderInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly headline: string;
  readonly bio: string;
  readonly currentPosition: string;
  readonly currentOrganizationRaw: string;
  readonly currentCountryCode: string;
  readonly currentCity: string;
  readonly linkedinUrl: string;
  readonly websiteUrl: string;
  readonly visibility: Readonly<Record<string, VisibilityLevel>>;
}

export async function saveProfileHeader(
  profileId: string,
  input: SaveHeaderInput,
): Promise<WriteResult> {
  const parsed = profileHeaderSchema.safeParse({
    firstName: input.firstName,
    lastName: input.lastName,
    headline: input.headline || undefined,
    bio: input.bio || undefined,
    currentPosition: input.currentPosition || undefined,
    currentOrganizationRaw: input.currentOrganizationRaw || undefined,
    currentCountryCode: input.currentCountryCode || undefined,
    currentCity: input.currentCity || undefined,
    linkedinUrl: input.linkedinUrl,
    websiteUrl: input.websiteUrl,
  });
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ise_profiles')
    .update({
      first_name: value.firstName,
      last_name: value.lastName,
      headline: value.headline ?? null,
      bio: value.bio ?? null,
      current_position: value.currentPosition ?? null,
      current_organization_raw: value.currentOrganizationRaw ?? null,
      current_country_code: value.currentCountryCode ?? null,
      current_city: value.currentCity ?? null,
      linkedin_url: value.linkedinUrl === '' ? null : (value.linkedinUrl ?? null),
      website_url: value.websiteUrl === '' ? null : (value.websiteUrl ?? null),
    })
    .eq('id', profileId);
  if (error) return failWrite(error);

  const entries = Object.entries(input.visibility).map(([fieldKey, visibility]) => ({
    fieldKey,
    visibility,
  }));
  return applyVisibility(profileId, entries);
}

/* ==================================================================== */
/* ISE-018 / ISE-019 — experiences                                      */
/* ==================================================================== */

export interface ExperienceRow {
  readonly id: string;
  readonly organizationName: string;
  readonly positionTitle: string;
  readonly sectorId: number | null;
  readonly sectorName: string | null;
  readonly jobFunctionId: number | null;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly city: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isCurrent: boolean;
  readonly description: string | null;
  readonly visibility: VisibilityLevel;
}

const EXPERIENCE_SELECT =
  'id, organization_name_raw, position_title, sector_id, job_function_id, ' +
  'country_code, city, start_date, end_date, is_current, description, visibility, ' +
  'sectors(name), countries(name_fr)';

interface RawExperience {
  id: string;
  organization_name_raw: string | null;
  position_title: string;
  sector_id: number | null;
  job_function_id: number | null;
  country_code: string | null;
  city: string | null;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  visibility: VisibilityLevel;
  sectors: { name: string } | null;
  countries: { name_fr: string } | null;
}

function toExperience(row: RawExperience): ExperienceRow {
  return {
    id: row.id,
    organizationName: row.organization_name_raw ?? '',
    positionTitle: row.position_title,
    sectorId: row.sector_id,
    sectorName: row.sectors?.name ?? null,
    jobFunctionId: row.job_function_id,
    countryCode: row.country_code?.trim() ?? null,
    countryName: row.countries?.name_fr ?? null,
    city: row.city,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    description: row.description,
    visibility: row.visibility,
  };
}

export async function loadExperiences(profileId: string): Promise<Result<ExperienceRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('profile_id', profileId)
    .order('is_current', { ascending: false })
    .order('start_date', { ascending: false });
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as unknown as RawExperience[]).map(toExperience) };
}

export async function loadExperience(
  profileId: string,
  experienceId: string,
): Promise<Result<ExperienceRow | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('profile_id', profileId)
    .eq('id', experienceId)
    .maybeSingle();
  if (error) return fail(error);
  const row = (data ?? null) as unknown as RawExperience | null;
  return { ok: true, data: row ? toExperience(row) : null };
}

export interface SaveExperienceInput {
  readonly experienceId?: string | undefined;
  readonly organizationNameRaw: string;
  readonly positionTitle: string;
  readonly sectorId?: number | undefined;
  readonly jobFunctionId?: number | undefined;
  readonly countryCode?: string | undefined;
  readonly city?: string | undefined;
  readonly startDate: string;
  readonly endDate?: string | undefined;
  readonly isCurrent: boolean;
  readonly description?: string | undefined;
  readonly visibility: VisibilityLevel;
}

export async function saveExperience(
  profileId: string,
  input: SaveExperienceInput,
): Promise<WriteResult> {
  const parsed = experienceSchema.safeParse({
    organizationNameRaw: input.organizationNameRaw || undefined,
    positionTitle: input.positionTitle,
    sectorId: input.sectorId,
    jobFunctionId: input.jobFunctionId,
    countryCode: input.countryCode || undefined,
    city: input.city || undefined,
    startDate: input.startDate,
    endDate: input.endDate || undefined,
    isCurrent: input.isCurrent,
    description: input.description || undefined,
    visibility: input.visibility,
  });
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const row = {
    profile_id: profileId,
    organization_name_raw: value.organizationNameRaw ?? null,
    position_title: value.positionTitle,
    sector_id: value.sectorId ?? null,
    job_function_id: value.jobFunctionId ?? null,
    country_code: value.countryCode ?? null,
    city: value.city ?? null,
    start_date: value.startDate,
    end_date: value.isCurrent ? null : (value.endDate ?? null),
    is_current: value.isCurrent,
    description: value.description ?? null,
    visibility: value.visibility,
  };

  const supabase = getSupabaseClient();
  if (input.experienceId) {
    const { error } = await supabase
      .from('experiences')
      .update(row)
      .eq('id', input.experienceId)
      .eq('profile_id', profileId);
    if (error) return failWrite(error);
  } else {
    const { error } = await supabase.from('experiences').insert(row);
    if (error) return failWrite(error);
  }
  return { ok: true };
}

export async function deleteExperience(
  profileId: string,
  experienceId: string,
): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('experiences')
    .delete()
    .eq('id', experienceId)
    .eq('profile_id', profileId);
  if (error) return failWrite(error);
  return { ok: true };
}

/* ==================================================================== */
/* ISE-020 / ISE-021 — formations                                       */
/* ==================================================================== */

export interface EducationRow {
  readonly id: string;
  readonly educationType: 'academic' | 'certification';
  readonly institution: string;
  readonly degree: string | null;
  readonly fieldOfStudy: string | null;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly city: string | null;
  readonly startYear: number | null;
  readonly endYear: number | null;
  readonly credentialUrl: string | null;
  readonly description: string | null;
  readonly visibility: VisibilityLevel;
}

const EDUCATION_SELECT =
  'id, education_type, institution, degree, field_of_study, country_code, city, ' +
  'start_year, end_year, credential_url, description, visibility, countries(name_fr)';

interface RawEducation {
  id: string;
  education_type: 'academic' | 'certification';
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  country_code: string | null;
  city: string | null;
  start_year: number | null;
  end_year: number | null;
  credential_url: string | null;
  description: string | null;
  visibility: VisibilityLevel;
  countries: { name_fr: string } | null;
}

function toEducation(row: RawEducation): EducationRow {
  return {
    id: row.id,
    educationType: row.education_type,
    institution: row.institution,
    degree: row.degree,
    fieldOfStudy: row.field_of_study,
    countryCode: row.country_code?.trim() ?? null,
    countryName: row.countries?.name_fr ?? null,
    city: row.city,
    startYear: row.start_year,
    endYear: row.end_year,
    credentialUrl: row.credential_url,
    description: row.description,
    visibility: row.visibility,
  };
}

export async function loadEducations(profileId: string): Promise<Result<EducationRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('educations')
    .select(EDUCATION_SELECT)
    .eq('profile_id', profileId)
    .order('end_year', { ascending: false, nullsFirst: true });
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as unknown as RawEducation[]).map(toEducation) };
}

export async function loadEducation(
  profileId: string,
  educationId: string,
): Promise<Result<EducationRow | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('educations')
    .select(EDUCATION_SELECT)
    .eq('profile_id', profileId)
    .eq('id', educationId)
    .maybeSingle();
  if (error) return fail(error);
  const row = (data ?? null) as unknown as RawEducation | null;
  return { ok: true, data: row ? toEducation(row) : null };
}

export interface SaveEducationInput {
  readonly educationId?: string | undefined;
  readonly educationType: 'academic' | 'certification';
  readonly institution: string;
  readonly degree: string;
  readonly fieldOfStudy?: string | undefined;
  readonly countryCode?: string | undefined;
  readonly city?: string | undefined;
  readonly startYear?: string | undefined;
  readonly endYear?: string | undefined;
  readonly credentialUrl?: string | undefined;
  readonly description?: string | undefined;
  readonly visibility: VisibilityLevel;
}

export async function saveEducation(
  profileId: string,
  input: SaveEducationInput,
): Promise<WriteResult> {
  const parsed = educationSchema.safeParse({
    educationType: input.educationType,
    institution: input.institution,
    degree: input.degree,
    fieldOfStudy: input.fieldOfStudy ?? '',
    countryCode: input.countryCode ?? '',
    city: input.city ?? '',
    startYear: input.startYear ?? '',
    endYear: input.endYear ?? '',
    credentialUrl: input.credentialUrl ?? '',
    description: input.description ?? '',
    visibility: input.visibility,
  });
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const row = {
    profile_id: profileId,
    education_type: value.educationType,
    institution: value.institution,
    degree: value.degree,
    field_of_study: value.fieldOfStudy === '' ? null : (value.fieldOfStudy ?? null),
    country_code: value.countryCode === '' ? null : (value.countryCode ?? null),
    city: value.city === '' ? null : (value.city ?? null),
    start_year:
      value.startYear === '' || value.startYear === undefined ? null : Number(value.startYear),
    end_year: value.endYear === '' || value.endYear === undefined ? null : Number(value.endYear),
    credential_url: value.credentialUrl === '' ? null : (value.credentialUrl ?? null),
    description: value.description === '' ? null : (value.description ?? null),
    visibility: value.visibility,
  };

  const supabase = getSupabaseClient();
  if (input.educationId) {
    const { error } = await supabase
      .from('educations')
      .update(row)
      .eq('id', input.educationId)
      .eq('profile_id', profileId);
    if (error) return failWrite(error);
  } else {
    const { error } = await supabase.from('educations').insert(row);
    if (error) return failWrite(error);
  }
  return { ok: true };
}

export async function deleteEducation(
  profileId: string,
  educationId: string,
): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('educations')
    .delete()
    .eq('id', educationId)
    .eq('profile_id', profileId);
  if (error) return failWrite(error);
  return { ok: true };
}

/* ==================================================================== */
/* ISE-022 / ISE-023 — competences declarees (D-75 : niveau DECLARATIF)  */
/* ==================================================================== */

export type SkillLevel = 'notion' | 'intermediate' | 'advanced' | 'expert';

export interface ProfileSkillRow {
  readonly skillId: number;
  readonly name: string;
  readonly categoryName: string;
  readonly level: SkillLevel | null;
  readonly yearsExperience: number | null;
  readonly isPrimary: boolean;
  readonly context: string | null;
}

const PROFILE_SKILL_SELECT =
  'skill_id, level, years_experience, is_primary, context, skills(name, skill_categories(name))';

interface RawProfileSkill {
  skill_id: number;
  level: SkillLevel | null;
  years_experience: number | string | null;
  is_primary: boolean;
  context: string | null;
  skills: { name: string; skill_categories: { name: string } | null } | null;
}

function toProfileSkill(row: RawProfileSkill): ProfileSkillRow {
  return {
    skillId: row.skill_id,
    name: row.skills?.name ?? '',
    categoryName: row.skills?.skill_categories?.name ?? '',
    level: row.level,
    yearsExperience: row.years_experience === null ? null : Number(row.years_experience),
    isPrimary: row.is_primary,
    context: row.context,
  };
}

export async function loadProfileSkills(profileId: string): Promise<Result<ProfileSkillRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_skills')
    .select(PROFILE_SKILL_SELECT)
    .eq('profile_id', profileId)
    .order('is_primary', { ascending: false });
  if (error) return fail(error);
  const rows = ((data ?? []) as unknown as RawProfileSkill[]).map(toProfileSkill);
  rows.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.name.localeCompare(b.name, 'fr');
  });
  return { ok: true, data: rows };
}

export async function loadProfileSkill(
  profileId: string,
  skillId: number,
): Promise<Result<ProfileSkillRow | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_skills')
    .select(PROFILE_SKILL_SELECT)
    .eq('profile_id', profileId)
    .eq('skill_id', skillId)
    .maybeSingle();
  if (error) return fail(error);
  const row = (data ?? null) as unknown as RawProfileSkill | null;
  return { ok: true, data: row ? toProfileSkill(row) : null };
}

export interface SkillSearchResult {
  readonly skillId: number;
  readonly name: string;
  readonly categoryName: string;
}

/** ISE-023 — recherche incrementale sur le referentiel de competences (alias resolus en base, D-46). */
export async function searchSkills(query: string): Promise<Result<SkillSearchResult[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('search_skills', {
    p_query: query.trim().length > 0 ? query.trim() : null,
    p_limit: 20,
  });
  if (error) return fail(error);
  const rows = asArray(data).map((entry) => {
    const raw = asObject(entry);
    return {
      skillId: num(raw['skill_id']) ?? 0,
      name: str(raw['skill_name']) ?? '',
      categoryName: str(raw['category_name']) ?? '',
    };
  });
  return { ok: true, data: rows.filter((row) => row.skillId > 0) };
}

export interface SaveSkillInput {
  readonly skillId: number;
  readonly level?: SkillLevel | undefined;
  readonly yearsExperience?: number | undefined;
  readonly isPrimary: boolean;
  readonly context?: string | undefined;
}

export async function saveProfileSkill(
  profileId: string,
  input: SaveSkillInput,
): Promise<WriteResult> {
  const parsed = profileSkillSchema.safeParse({
    skillId: input.skillId,
    level: input.level,
    yearsExperience: input.yearsExperience,
    isPrimary: input.isPrimary,
    context: input.context || undefined,
  });
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profile_skills').upsert(
    {
      profile_id: profileId,
      skill_id: value.skillId,
      level: value.level ?? null,
      years_experience: value.yearsExperience ?? null,
      is_primary: value.isPrimary,
      context: value.context ?? null,
    },
    { onConflict: 'profile_id,skill_id' },
  );
  if (error) return failWrite(error);
  return { ok: true };
}

export async function deleteProfileSkill(profileId: string, skillId: number): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('profile_skills')
    .delete()
    .eq('skill_id', skillId)
    .eq('profile_id', profileId);
  if (error) return failWrite(error);
  return { ok: true };
}

export async function saveSkillsVisibility(
  profileId: string,
  visibility: VisibilityLevel,
): Promise<WriteResult> {
  return applyVisibility(profileId, [{ fieldKey: 'skills', visibility }]);
}

/* ==================================================================== */
/* ISE-024 — Secteurs, fonctions & expertises (positionnement declare)  */
/* ==================================================================== */

export interface PositioningState {
  readonly sectors: Array<{ sectorId: number; name: string; isPrimary: boolean }>;
  readonly functions: Array<{ jobFunctionId: number; name: string }>;
  readonly expertiseAreas: Array<{ expertiseAreaId: number; name: string }>;
}

export async function loadPositioning(profileId: string): Promise<Result<PositioningState>> {
  const supabase = getSupabaseClient();
  const [sectors, functions, areas] = await Promise.all([
    supabase.from('profile_sectors').select('sector_id, is_primary, sectors(name)').eq('profile_id', profileId),
    supabase.from('profile_functions').select('job_function_id, job_functions(name)').eq('profile_id', profileId),
    supabase
      .from('profile_expertise_areas')
      .select('expertise_area_id, expertise_areas(name)')
      .eq('profile_id', profileId),
  ]);

  const firstError = sectors.error ?? functions.error ?? areas.error;
  if (firstError) return fail(firstError);

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
        .map((row) => ({ sectorId: row.sector_id, name: row.sectors?.name ?? '', isPrimary: row.is_primary }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      functions: functionRows
        .map((row) => ({ jobFunctionId: row.job_function_id, name: row.job_functions?.name ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      expertiseAreas: areaRows
        .map((row) => ({ expertiseAreaId: row.expertise_area_id, name: row.expertise_areas?.name ?? '' }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    },
  };
}

export interface SavePositioningInput {
  readonly sectorIds: number[];
  readonly primarySectorId?: number | undefined;
  readonly functionIds: number[];
  readonly expertiseAreaIds: number[];
}

export async function savePositioning(
  profileId: string,
  input: SavePositioningInput,
): Promise<WriteResult> {
  const parsed = positioningSchema.safeParse(input);
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const steps: Array<[string, string, Array<Record<string, unknown>>]> = [
    [
      'profile_sectors',
      'sector_id',
      value.sectorIds.map((sectorId) => ({ sector_id: sectorId, is_primary: sectorId === value.primarySectorId })),
    ],
    ['profile_functions', 'job_function_id', value.functionIds.map((jobFunctionId) => ({ job_function_id: jobFunctionId }))],
    [
      'profile_expertise_areas',
      'expertise_area_id',
      value.expertiseAreaIds.map((expertiseAreaId) => ({ expertise_area_id: expertiseAreaId })),
    ],
  ];

  for (const [table, keyColumn, rows] of steps) {
    const result = await syncJunction(table, keyColumn, profileId, rows);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/* ==================================================================== */
/* ISE-025 / ISE-026 — projets & realisations (visibilite PAR ENTREE)   */
/* ==================================================================== */

export interface ProjectRow {
  readonly id: string;
  readonly title: string;
  readonly organizationNameRaw: string | null;
  readonly role: string | null;
  readonly sectorId: number | null;
  readonly sectorName: string | null;
  readonly countryCode: string | null;
  readonly countryName: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly summary: string | null;
  readonly outcome: string | null;
  readonly linkUrl: string | null;
  readonly visibility: VisibilityLevel;
}

const PROJECT_SELECT =
  'id, title, organization_name_raw, role, sector_id, country_code, start_date, end_date, ' +
  'summary, outcome, link_url, visibility, sectors(name), countries(name_fr)';

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
  };
}

export async function loadProjects(profileId: string): Promise<Result<ProjectRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_projects')
    .select(PROJECT_SELECT)
    .eq('profile_id', profileId)
    .order('start_date', { ascending: false, nullsFirst: false });
  if (error) return fail(error);
  return { ok: true, data: ((data ?? []) as unknown as RawProject[]).map(toProject) };
}

export async function loadProject(profileId: string, projectId: string): Promise<Result<ProjectRow | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_projects')
    .select(PROJECT_SELECT)
    .eq('profile_id', profileId)
    .eq('id', projectId)
    .maybeSingle();
  if (error) return fail(error);
  const row = (data ?? null) as unknown as RawProject | null;
  return { ok: true, data: row ? toProject(row) : null };
}

export interface SaveProjectInput {
  readonly projectId?: string | undefined;
  readonly title: string;
  readonly organizationNameRaw?: string | undefined;
  readonly role?: string | undefined;
  readonly sectorId?: number | undefined;
  readonly countryCode?: string | undefined;
  readonly startDate?: string | undefined;
  readonly endDate?: string | undefined;
  readonly summary?: string | undefined;
  readonly outcome?: string | undefined;
  readonly linkUrl?: string | undefined;
  readonly visibility: VisibilityLevel;
}

export async function saveProject(profileId: string, input: SaveProjectInput): Promise<WriteResult> {
  const parsed = profileProjectSchema.safeParse({
    title: input.title,
    organizationNameRaw: input.organizationNameRaw || undefined,
    role: input.role || undefined,
    sectorId: input.sectorId,
    countryCode: input.countryCode || undefined,
    startDate: input.startDate || undefined,
    endDate: input.endDate || undefined,
    summary: input.summary || undefined,
    outcome: input.outcome || undefined,
    linkUrl: input.linkUrl || undefined,
    visibility: input.visibility,
  });
  if (!parsed.success) return validationFailure();

  const value = parsed.data;
  const row = {
    profile_id: profileId,
    title: value.title,
    organization_name_raw: value.organizationNameRaw ?? null,
    role: value.role ?? null,
    sector_id: value.sectorId ?? null,
    country_code: value.countryCode ?? null,
    start_date: value.startDate ?? null,
    end_date: value.endDate ?? null,
    summary: value.summary ?? null,
    outcome: value.outcome ?? null,
    link_url: value.linkUrl ?? null,
    visibility: value.visibility,
  };

  const supabase = getSupabaseClient();
  if (input.projectId) {
    const { error } = await supabase.from('profile_projects').update(row).eq('id', input.projectId).eq('profile_id', profileId);
    if (error) return failWrite(error);
  } else {
    const { error } = await supabase.from('profile_projects').insert(row);
    if (error) return failWrite(error);
  }
  return { ok: true };
}

export async function deleteProject(profileId: string, projectId: string): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('profile_projects').delete().eq('id', projectId).eq('profile_id', profileId);
  if (error) return failWrite(error);
  return { ok: true };
}

/* ==================================================================== */
/* ISE-027 — langues, zones d'experience, outils declares               */
/* ==================================================================== */

export type LanguageProficiency = 'basic' | 'intermediate' | 'professional' | 'fluent' | 'native';
export type ToolProficiency = 'notion' | 'intermediate' | 'advanced' | 'expert';

export interface ProfileLanguageRow {
  readonly languageCode: string;
  readonly name: string;
  readonly proficiency: LanguageProficiency;
}

export interface ProfileGeographyRow {
  readonly countryCode: string;
  readonly name: string;
}

export interface ProfileToolRow {
  readonly toolId: number;
  readonly name: string;
  readonly proficiency: ToolProficiency | null;
}

export interface LanguagesZonesState {
  readonly languages: ProfileLanguageRow[];
  readonly geographies: ProfileGeographyRow[];
  readonly tools: ProfileToolRow[];
}

export async function loadLanguagesZones(profileId: string): Promise<Result<LanguagesZonesState>> {
  const supabase = getSupabaseClient();
  const [languages, geographies, tools] = await Promise.all([
    supabase.from('profile_languages').select('language_code, proficiency, languages(name_fr)').eq('profile_id', profileId),
    supabase.from('profile_geographies').select('country_code, countries(name_fr)').eq('profile_id', profileId),
    supabase.from('profile_tools').select('tool_id, proficiency, tools(name)').eq('profile_id', profileId),
  ]);

  const firstError = languages.error ?? geographies.error ?? tools.error;
  if (firstError) return fail(firstError);

  const languageRows = (languages.data ?? []) as unknown as Array<{
    language_code: string;
    proficiency: LanguageProficiency;
    languages: { name_fr: string } | null;
  }>;
  const geographyRows = (geographies.data ?? []) as unknown as Array<{
    country_code: string;
    countries: { name_fr: string } | null;
  }>;
  const toolRows = (tools.data ?? []) as unknown as Array<{
    tool_id: number;
    proficiency: ToolProficiency | null;
    tools: { name: string } | null;
  }>;

  return {
    ok: true,
    data: {
      languages: languageRows
        .map((row) => ({ languageCode: row.language_code, name: row.languages?.name_fr ?? row.language_code, proficiency: row.proficiency }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      geographies: geographyRows
        .map((row) => ({ countryCode: row.country_code.trim(), name: row.countries?.name_fr ?? row.country_code }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      tools: toolRows
        .map((row) => ({ toolId: row.tool_id, name: row.tools?.name ?? '', proficiency: row.proficiency }))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    },
  };
}

export interface SaveLanguagesZonesInput {
  readonly languages: Array<{ languageCode: string; proficiency: LanguageProficiency }>;
  readonly countryCodes: string[];
  readonly tools: Array<{ toolId: number; proficiency?: ToolProficiency | undefined }>;
}

export async function saveLanguagesZones(
  profileId: string,
  input: SaveLanguagesZonesInput,
): Promise<WriteResult> {
  const languages = profileLanguagesSchema.safeParse({ entries: input.languages });
  const geographies = profileGeographiesSchema.safeParse({ countryCodes: input.countryCodes });
  const tools = profileToolsSchema.safeParse({ entries: input.tools });
  if (!languages.success || !geographies.success || !tools.success) return validationFailure();

  const steps: Array<[string, string, Array<Record<string, unknown>>]> = [
    [
      'profile_languages',
      'language_code',
      languages.data.entries.map((entry) => ({ language_code: entry.languageCode, proficiency: entry.proficiency })),
    ],
    ['profile_geographies', 'country_code', geographies.data.countryCodes.map((countryCode) => ({ country_code: countryCode }))],
    [
      'profile_tools',
      'tool_id',
      tools.data.entries.map((entry) => ({ tool_id: entry.toolId, proficiency: entry.proficiency ?? null })),
    ],
  ];

  for (const [table, keyColumn, rows] of steps) {
    const result = await syncJunction(table, keyColumn, profileId, rows);
    if (!result.ok) return result;
  }
  return { ok: true };
}

/* ==================================================================== */
/* ISE-028 / ISE-029 — recommandations                                  */
/* ==================================================================== */

export type RecommendationStatus = 'draft' | 'published' | 'hidden' | 'removed';

export interface RecommendationRow {
  readonly id: string;
  readonly status: RecommendationStatus;
  readonly visibility: VisibilityLevel;
  readonly body: string;
  readonly relationshipContext: string;
  readonly skillName: string | null;
  readonly authorName: string;
  readonly authorHeadline: string | null;
  readonly createdAt: string;
}

const RECOMMENDATION_SELECT =
  'id, status, visibility, body, relationship_context, skill_id, created_at, skills(name), ' +
  'author:ise_profiles!recommendations_author_profile_id_fkey(first_name, last_name, display_name, headline)';

interface RawRecommendation {
  id: string;
  status: RecommendationStatus;
  visibility: VisibilityLevel;
  body: string;
  relationship_context: string;
  created_at: string;
  skills: { name: string } | null;
  author: { first_name: string; last_name: string; display_name: string | null; headline: string | null } | null;
}

function authorName(row: RawRecommendation): string {
  if (row.author === null) return 'Membre du réseau';
  return row.author.display_name ?? `${row.author.first_name} ${row.author.last_name}`.trim();
}

/** Recommandations dont JE suis le sujet. Jamais celles d'un tiers. */
export async function loadReceivedRecommendations(profileId: string): Promise<Result<RecommendationRow[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('recommendations')
    .select(RECOMMENDATION_SELECT)
    .eq('subject_profile_id', profileId)
    .neq('status', 'removed')
    .order('created_at', { ascending: false });
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as RawRecommendation[];
  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      status: row.status,
      visibility: row.visibility,
      body: row.body,
      relationshipContext: row.relationship_context,
      skillName: row.skills?.name ?? null,
      authorName: authorName(row),
      authorHeadline: row.author?.headline ?? null,
      createdAt: row.created_at,
    })),
  };
}

export type RecommendationRequestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';

export interface RecommendationRequestRow {
  readonly id: string;
  readonly status: RecommendationRequestStatus;
  readonly skillName: string | null;
  readonly context: string | null;
  readonly message: string | null;
  readonly createdAt: string;
  readonly otherName: string;
  readonly otherHeadline: string | null;
}

interface RawRecommendationRequest {
  id: string;
  status: RecommendationRequestStatus;
  context: string | null;
  message: string | null;
  created_at: string;
  skills: { name: string } | null;
  requester: { first_name: string; last_name: string; display_name: string | null; headline: string | null } | null;
  recipient: { first_name: string; last_name: string; display_name: string | null; headline: string | null } | null;
}

const REQUEST_SELECT =
  'id, status, context, message, created_at, skills(name), ' +
  'requester:ise_profiles!recommendation_requests_requester_profile_id_fkey(first_name, last_name, display_name, headline), ' +
  'recipient:ise_profiles!recommendation_requests_recipient_profile_id_fkey(first_name, last_name, display_name, headline)';

function personName(person: { first_name: string; last_name: string; display_name: string | null } | null): string {
  if (person === null) return 'Membre du réseau';
  return person.display_name ?? `${person.first_name} ${person.last_name}`.trim();
}

export async function loadRecommendationRequests(
  profileId: string,
  direction: 'received' | 'sent',
): Promise<Result<RecommendationRequestRow[]>> {
  const supabase = getSupabaseClient();
  const column = direction === 'received' ? 'recipient_profile_id' : 'requester_profile_id';
  const { data, error } = await supabase
    .from('recommendation_requests')
    .select(REQUEST_SELECT)
    .eq(column, profileId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as RawRecommendationRequest[];
  return {
    ok: true,
    data: rows.map((row) => {
      const other = direction === 'received' ? row.requester : row.recipient;
      return {
        id: row.id,
        status: row.status,
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

export interface ConnectionOption {
  readonly profileId: string;
  readonly displayName: string;
  readonly headline: string | null;
}

/** ISE-029 — recherche d'un membre parmi mes relations reelles (`list_my_connections`). */
export async function searchConnections(query: string): Promise<Result<ConnectionOption[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_my_connections', {
    p_query: query.trim().length > 0 ? query.trim() : null,
    p_cursor: null,
    p_limit: 20,
  });
  if (error) return fail(error);
  const raw = asObject(data);
  const rows = asArray(raw['rows']).flatMap((entry) => {
    const item = asObject(entry);
    const profileId = str(item['profile_id']);
    if (profileId === null) return [];
    return [{ profileId, displayName: str(item['display_name']) ?? '', headline: str(item['headline']) }];
  });
  return { ok: true, data: rows };
}

export interface RequestRecommendationInput {
  readonly recipientProfileId: string;
  readonly skillId?: number | undefined;
  readonly relationship: 'project' | 'mission' | 'management' | 'other';
  readonly context?: string | undefined;
  readonly message: string;
}

const RELATIONSHIP_LABELS: Record<RequestRecommendationInput['relationship'], string> = {
  project: 'Collaboration sur un projet',
  mission: 'Mission commune',
  management: 'Lien hiérarchique',
  other: 'Autre contexte professionnel',
};

export async function requestRecommendation(
  profileId: string,
  input: RequestRecommendationInput,
): Promise<WriteResult> {
  const parsed = recommendationRequestSchema.safeParse({
    recipientProfileId: input.recipientProfileId,
    skillId: input.skillId,
    relationship: input.relationship,
    context: input.context || undefined,
    message: input.message,
  });
  if (!parsed.success) return validationFailure();
  const value = parsed.data;

  const supabase = getSupabaseClient();

  // Une seule demande en attente par destinataire : pas de relance en rafale.
  const { data: existing, error: existingError } = await supabase
    .from('recommendation_requests')
    .select('id')
    .eq('requester_profile_id', profileId)
    .eq('recipient_profile_id', value.recipientProfileId)
    .eq('status', 'pending')
    .limit(1);
  if (existingError) return failWrite(existingError);
  if ((existing ?? []).length > 0) {
    const correlationId = newCorrelationId();
    return {
      ok: false,
      message:
        'Une demande est déjà en attente auprès de ce membre. Attendez sa réponse avant d’en envoyer une autre.',
      correlationId,
    };
  }

  const relationshipLabel = RELATIONSHIP_LABELS[value.relationship];
  const contextText = [relationshipLabel, value.context].filter(Boolean).join(' — ');

  const { error } = await supabase.from('recommendation_requests').insert({
    requester_profile_id: profileId,
    recipient_profile_id: value.recipientProfileId,
    skill_id: value.skillId ?? null,
    context: contextText,
    message: value.message,
  });
  if (error) return failWrite(error);
  return { ok: true };
}

export interface AcceptRecommendationInput {
  readonly requestId: string;
  readonly relationshipContext: string;
  readonly engagementContext?: string | undefined;
  readonly skillId?: number | undefined;
  readonly body: string;
  readonly visibility: VisibilityLevel;
}

export async function acceptRecommendationRequest(input: AcceptRecommendationInput): Promise<WriteResult> {
  const parsed = recommendationAcceptSchema.safeParse({
    requestId: input.requestId,
    relationshipContext: input.relationshipContext,
    engagementContext: input.engagementContext || undefined,
    skillId: input.skillId,
    body: input.body,
    visibility: input.visibility,
  });
  if (!parsed.success) return validationFailure();
  const value = parsed.data;

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: value.requestId,
    p_action: 'accept',
    p_body: value.body,
    p_relationship_context: value.relationshipContext,
    p_engagement_context: value.engagementContext ?? null,
    p_skill_id: value.skillId ?? null,
    p_visibility: value.visibility,
  });
  if (error) return failWrite(error);
  return { ok: true };
}

export async function declineRecommendationRequest(requestId: string): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: requestId,
    p_action: 'decline',
  });
  if (error) return failWrite(error);
  return { ok: true };
}

export async function withdrawRecommendationRequest(requestId: string): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('respond_recommendation_request', {
    p_request_id: requestId,
    p_action: 'withdraw',
  });
  if (error) return failWrite(error);
  return { ok: true };
}

/** Le SUJET valide ou masque une recommandation reçue : jamais ne la reecrit (garde-fou 0085). */
export async function moderateRecommendation(
  profileId: string,
  recommendationId: string,
  action: 'publish' | 'hide',
): Promise<WriteResult> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('recommendations')
    .update({ status: action === 'publish' ? 'published' : 'hidden' })
    .eq('id', recommendationId)
    .eq('subject_profile_id', profileId);
  if (error) return failWrite(error);
  return { ok: true };
}

/* ==================================================================== */
/* ISE-030 / ISE-031 — completion du profil (D-71, D-72 : score PRIVE)  */
/* ==================================================================== */

export interface CompletionRule {
  readonly blockKey: string;
  readonly label: string;
  readonly hint: string | null;
  readonly weight: number;
}

/** Les regles ACTIVES de `profile_completion_rules` (D-71 : aucune ponderation en dur). */
export async function loadCompletionRules(): Promise<Result<CompletionRule[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_completion_rules')
    .select('block_key, label, hint, weight, sort_order')
    .eq('is_active', true)
    .order('sort_order');
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{
    block_key: string;
    label: string;
    hint: string | null;
    weight: number;
  }>;
  return {
    ok: true,
    data: rows.map((row) => ({ blockKey: row.block_key, label: row.label, hint: row.hint, weight: row.weight })),
  };
}

/**
 * Score prive (D-72) : lu UNIQUEMENT par cette RPC, jamais par une colonne
 * selectionnee, et jamais transmis a un ecran visible d'un tiers.
 */
export async function loadMyCompletionScore(): Promise<Result<number | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('my_profile_completion');
  if (error) return fail(error);
  return { ok: true, data: typeof data === 'number' ? data : null };
}

export interface MissingItem {
  readonly blockKey: string;
  readonly label: string;
  readonly hint: string | null;
  readonly weight: number;
}

/** `my_profile_missing_items()` sans parametre : aucun tiers n'atteint cette lecture (D-72). */
export async function loadMyMissingItems(): Promise<Result<MissingItem[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('my_profile_missing_items');
  if (error) return fail(error);
  const rows = asArray(data).map((entry) => {
    const raw = asObject(entry);
    return {
      blockKey: str(raw['block_key']) ?? '',
      label: str(raw['label']) ?? '',
      hint: str(raw['hint']),
      weight: num(raw['weight']) ?? 0,
    };
  });
  return { ok: true, data: rows.filter((row) => row.blockKey !== '') };
}

/** Etiquette d'impact derivee du POIDS REEL (jamais un classement, E-09 traceability matrix). */
export function missingItemImpact(weight: number): 'fort' | 'moyen' | 'utile' {
  if (weight >= 10) return 'fort';
  if (weight >= 5) return 'moyen';
  return 'utile';
}

/* ==================================================================== */
/* ISE-032 / ISE-033 — disponibilite declaree                           */
/* ==================================================================== */

export type AvailabilityChannel = 'message' | 'email' | 'call' | 'video';

export interface AvailabilityDetail {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly active: boolean;
  readonly maxPerMonth: number | null;
  readonly idealDelayDays: number | null;
  readonly preferredChannel: AvailabilityChannel | null;
  readonly visibility: VisibilityLevel;
  readonly notes: string | null;
  readonly updatedAt: string;
}

export async function loadAvailabilityDetails(profileId: string): Promise<Result<AvailabilityDetail[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_availabilities')
    .select(
      'availability_type, active, max_per_month, ideal_delay_days, preferred_channel, ' +
        'visibility, notes, updated_at, availability_types(name, description, sort_order)',
    )
    .eq('profile_id', profileId);
  if (error) return fail(error);
  const rows = (data ?? []) as unknown as Array<{
    availability_type: string;
    active: boolean;
    max_per_month: number | null;
    ideal_delay_days: number | null;
    preferred_channel: AvailabilityChannel | null;
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

/** `true` si la disponibilite n'a pas ete revue depuis plus de 90 jours (seuil documente, E-10). */
export function availabilityNeedsRefresh(updatedAt: string | null): boolean {
  if (!updatedAt) return true;
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return true;
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  return Date.now() - updated > ninetyDaysMs;
}

export interface SaveAvailabilityInput {
  readonly activeTypes: string[];
  readonly maxPerMonth?: number | undefined;
  readonly idealDelayDays?: number | undefined;
  readonly preferredChannel?: AvailabilityChannel | undefined;
  readonly visibility: VisibilityLevel;
  readonly notes?: string | undefined;
}

export async function saveAvailability(
  profileId: string,
  input: SaveAvailabilityInput,
): Promise<WriteResult> {
  const parsed = availabilitySettingsSchema.safeParse({
    activeTypes: input.activeTypes,
    maxPerMonth: input.maxPerMonth,
    idealDelayDays: input.idealDelayDays,
    preferredChannel: input.preferredChannel,
    visibility: input.visibility,
    notes: input.notes || undefined,
  });
  if (!parsed.success) return validationFailure();
  const value = parsed.data;

  const types = await loadAvailabilityTypes();
  if (!types.ok) return types;
  const knownCodes = new Set(types.data.map((type) => type.code));
  if (value.activeTypes.some((code) => !knownCodes.has(code))) return validationFailure();

  const supabase = getSupabaseClient();

  if (value.activeTypes.length > 0) {
    const { error } = await supabase.from('profile_availabilities').upsert(
      value.activeTypes.map((code) => ({
        profile_id: profileId,
        availability_type: code,
        active: true,
        max_per_month: value.maxPerMonth ?? null,
        ideal_delay_days: value.idealDelayDays ?? null,
        preferred_channel: value.preferredChannel ?? null,
        visibility: value.visibility,
        notes: value.notes ?? null,
      })),
      { onConflict: 'profile_id,availability_type' },
    );
    if (error) return failWrite(error);
  }

  // Types decoches : desactivation des lignes existantes, l'historique n'est pas efface.
  let deactivation = supabase.from('profile_availabilities').update({ active: false }).eq('profile_id', profileId);
  if (value.activeTypes.length > 0) {
    deactivation = deactivation.not('availability_type', 'in', `(${value.activeTypes.map((code) => `"${code}"`).join(',')})`);
  }
  const { error: deactivateError } = await deactivation;
  if (deactivateError) return failWrite(deactivateError);

  return { ok: true };
}
