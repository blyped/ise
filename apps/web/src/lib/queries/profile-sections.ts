import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { VisibilityLevel } from '@/lib/queries/reference';

/**
 * Lectures des sections de profil ISE-016 -> ISE-023.
 *
 * `ise_profiles` : colonnes enumerees, jamais `select('*')` (0028).
 * Toutes les autres tables sont filtrees par la RLS de 0021 : le filtre
 * `profile_id = <le mien>` present ici est une precision de requete, pas
 * la mesure de securite — celle-ci est en base.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string): Result<T> {
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

/* ------------------------------------------------------------------ */
/* ISE-016 / ISE-017 — en-tete du profil                               */
/* ------------------------------------------------------------------ */

const HEADER_COLUMNS =
  'id, first_name, last_name, display_name, headline, bio, avatar_path, ' +
  'linkedin_url, website_url, current_position, current_organization_id, ' +
  'current_organization_raw, current_country_code, current_city, ' +
  'promotion_id, claim_status, verification_status, onboarding_completed_at, updated_at';

export interface ProfileHeader {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  headline: string | null;
  bio: string | null;
  avatarPath: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  currentPosition: string | null;
  currentOrganizationId: string | null;
  currentOrganizationRaw: string | null;
  currentCountryCode: string | null;
  currentCity: string | null;
  promotionId: number | null;
  claimStatus: string;
  verificationStatus: string;
  onboardingCompletedAt: string | null;
  updatedAt: string;
}

export async function loadProfileHeader(
  userId: string,
  correlationId: string,
): Promise<Result<ProfileHeader | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('ise_profiles')
    .select(HEADER_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return fail(error, correlationId);

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
      avatarPath: (row['avatar_path'] as string | null) ?? null,
      linkedinUrl: (row['linkedin_url'] as string | null) ?? null,
      websiteUrl: (row['website_url'] as string | null) ?? null,
      currentPosition: (row['current_position'] as string | null) ?? null,
      currentOrganizationId: (row['current_organization_id'] as string | null) ?? null,
      currentOrganizationRaw: (row['current_organization_raw'] as string | null) ?? null,
      currentCountryCode: ((row['current_country_code'] as string | null) ?? null)?.trim() ?? null,
      currentCity: (row['current_city'] as string | null) ?? null,
      promotionId: (row['promotion_id'] as number | null) ?? null,
      claimStatus: String(row['claim_status'] ?? ''),
      verificationStatus: String(row['verification_status'] ?? ''),
      onboardingCompletedAt: (row['onboarding_completed_at'] as string | null) ?? null,
      updatedAt: String(row['updated_at'] ?? ''),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Visibilite par champ (D-73)                                          */
/* ------------------------------------------------------------------ */

/**
 * Choix de visibilite reellement enregistres par le membre.
 * Les champs absents suivent la valeur par defaut de
 * `profile_visibility_defaults` (D-74) : l'absence de ligne n'est pas une
 * visibilite « inconnue », c'est le defaut documente.
 */
export async function loadProfileVisibility(
  profileId: string,
  correlationId: string,
): Promise<Result<Record<string, VisibilityLevel>>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_visibility')
    .select('field_key, visibility')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    field_key: string;
    visibility: VisibilityLevel;
  }>;

  const map: Record<string, VisibilityLevel> = {};
  for (const row of rows) map[row.field_key] = row.visibility;
  return { ok: true, data: map };
}

/* ------------------------------------------------------------------ */
/* ISE-018 / ISE-019 — experiences                                      */
/* ------------------------------------------------------------------ */

export interface ExperienceRow {
  id: string;
  organizationId: string | null;
  organizationName: string;
  positionTitle: string;
  sectorId: number | null;
  sectorName: string | null;
  jobFunctionId: number | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  visibility: VisibilityLevel;
}

const EXPERIENCE_SELECT =
  'id, organization_id, organization_name_raw, position_title, sector_id, job_function_id, ' +
  'country_code, city, start_date, end_date, is_current, description, visibility, ' +
  'organizations(canonical_name), sectors(name), countries(name_fr)';

interface RawExperience {
  id: string;
  organization_id: string | null;
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
  organizations: { canonical_name: string } | null;
  sectors: { name: string } | null;
  countries: { name_fr: string } | null;
}

function toExperience(row: RawExperience): ExperienceRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organizations?.canonical_name ?? row.organization_name_raw ?? '',
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

export async function loadExperiences(
  profileId: string,
  correlationId: string,
): Promise<Result<ExperienceRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('profile_id', profileId)
    .order('is_current', { ascending: false })
    .order('start_date', { ascending: false });

  if (error) return fail(error, correlationId);
  return { ok: true, data: ((data ?? []) as unknown as RawExperience[]).map(toExperience) };
}

export async function loadExperience(
  profileId: string,
  experienceId: string,
  correlationId: string,
): Promise<Result<ExperienceRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('experiences')
    .select(EXPERIENCE_SELECT)
    .eq('profile_id', profileId)
    .eq('id', experienceId)
    .maybeSingle();

  if (error) return fail(error, correlationId);
  const row = (data ?? null) as unknown as RawExperience | null;
  return { ok: true, data: row ? toExperience(row) : null };
}

/* ------------------------------------------------------------------ */
/* ISE-020 / ISE-021 — formations                                       */
/* ------------------------------------------------------------------ */

export interface EducationRow {
  id: string;
  educationType: 'academic' | 'certification';
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  countryCode: string | null;
  countryName: string | null;
  city: string | null;
  startYear: number | null;
  endYear: number | null;
  credentialUrl: string | null;
  description: string | null;
  visibility: VisibilityLevel;
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

export async function loadEducations(
  profileId: string,
  correlationId: string,
): Promise<Result<EducationRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('educations')
    .select(EDUCATION_SELECT)
    .eq('profile_id', profileId)
    .order('end_year', { ascending: false, nullsFirst: true });

  if (error) return fail(error, correlationId);
  return { ok: true, data: ((data ?? []) as unknown as RawEducation[]).map(toEducation) };
}

export async function loadEducation(
  profileId: string,
  educationId: string,
  correlationId: string,
): Promise<Result<EducationRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('educations')
    .select(EDUCATION_SELECT)
    .eq('profile_id', profileId)
    .eq('id', educationId)
    .maybeSingle();

  if (error) return fail(error, correlationId);
  const row = (data ?? null) as unknown as RawEducation | null;
  return { ok: true, data: row ? toEducation(row) : null };
}

/* ------------------------------------------------------------------ */
/* ISE-022 / ISE-023 — competences declarees                            */
/* ------------------------------------------------------------------ */

export type SkillLevel = 'notion' | 'intermediate' | 'advanced' | 'expert';

export interface ProfileSkillRow {
  skillId: number;
  name: string;
  categoryName: string;
  domainName: string;
  level: SkillLevel | null;
  yearsExperience: number | null;
  isPrimary: boolean;
  context: string | null;
}

const PROFILE_SKILL_SELECT =
  'skill_id, level, years_experience, is_primary, context, ' +
  'skills(name, skill_categories(name, skill_domains(name)))';

interface RawProfileSkill {
  skill_id: number;
  level: SkillLevel | null;
  years_experience: number | string | null;
  is_primary: boolean;
  context: string | null;
  skills: {
    name: string;
    skill_categories: { name: string; skill_domains: { name: string } | null } | null;
  } | null;
}

function toProfileSkill(row: RawProfileSkill): ProfileSkillRow {
  return {
    skillId: row.skill_id,
    name: row.skills?.name ?? '',
    categoryName: row.skills?.skill_categories?.name ?? '',
    domainName: row.skills?.skill_categories?.skill_domains?.name ?? '',
    level: row.level,
    yearsExperience: row.years_experience === null ? null : Number(row.years_experience),
    isPrimary: row.is_primary,
    context: row.context,
  };
}

export async function loadProfileSkills(
  profileId: string,
  correlationId: string,
): Promise<Result<ProfileSkillRow[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_skills')
    .select(PROFILE_SKILL_SELECT)
    .eq('profile_id', profileId)
    .order('is_primary', { ascending: false });

  if (error) return fail(error, correlationId);

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
  correlationId: string,
): Promise<Result<ProfileSkillRow | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_skills')
    .select(PROFILE_SKILL_SELECT)
    .eq('profile_id', profileId)
    .eq('skill_id', skillId)
    .maybeSingle();

  if (error) return fail(error, correlationId);
  const row = (data ?? null) as unknown as RawProfileSkill | null;
  return { ok: true, data: row ? toProfileSkill(row) : null };
}

/**
 * ISE-023 « Preuves associees ». Le decompte porte sur les experiences du
 * membre dont l'intitule ou la description mentionne la competence.
 * Aucun lien n'est invente : quand rien ne correspond, le compte vaut 0
 * et l'ecran le dit.
 */
export function countSkillEvidence(skillName: string, experiences: readonly ExperienceRow[]) {
  const needle = skillName.trim().toLocaleLowerCase('fr-FR');
  if (needle.length < 3) return 0;
  return experiences.filter(
    (experience) =>
      experience.positionTitle.toLocaleLowerCase('fr-FR').includes(needle) ||
      (experience.description ?? '').toLocaleLowerCase('fr-FR').includes(needle),
  ).length;
}

/* ------------------------------------------------------------------ */
/* Secteurs et disponibilites declares — vue d'ensemble ISE-016         */
/* ------------------------------------------------------------------ */

export interface NamedSector {
  sectorId: number;
  name: string;
}

export async function loadProfileSectors(
  profileId: string,
  correlationId: string,
): Promise<Result<NamedSector[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_sectors')
    .select('sector_id, sectors(name)')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    sector_id: number;
    sectors: { name: string } | null;
  }>;

  return {
    ok: true,
    data: rows
      .map((row) => ({ sectorId: row.sector_id, name: row.sectors?.name ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export interface NamedAvailability {
  code: string;
  name: string;
  active: boolean;
  visibility: VisibilityLevel;
}

export async function loadNamedAvailabilities(
  profileId: string,
  correlationId: string,
): Promise<Result<NamedAvailability[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_availabilities')
    .select('availability_type, active, visibility, availability_types(name, sort_order)')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    availability_type: string;
    active: boolean;
    visibility: VisibilityLevel;
    availability_types: { name: string; sort_order: number } | null;
  }>;

  return {
    ok: true,
    data: rows
      .map((row) => ({
        code: row.availability_type,
        name: row.availability_types?.name ?? row.availability_type,
        active: row.active,
        visibility: row.visibility,
        sortOrder: row.availability_types?.sort_order ?? 0,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ code, name, active, visibility }) => ({ code, name, active, visibility })),
  };
}

export interface PromotionSummary {
  name: string;
  graduationYear: number;
  programCode: string;
}

export async function loadPromotionById(
  promotionId: number,
  correlationId: string,
): Promise<Result<PromotionSummary | null>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('promotions')
    .select('name, graduation_year, program_code')
    .eq('id', promotionId)
    .maybeSingle();

  if (error) return fail(error, correlationId);
  const row = (data ?? null) as unknown as {
    name: string;
    graduation_year: number;
    program_code: string;
  } | null;

  return {
    ok: true,
    data: row
      ? { name: row.name, graduationYear: row.graduation_year, programCode: row.program_code }
      : null,
  };
}
