import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lecture des REFERENTIELS de la base : promotions (72), secteurs (35),
 * pays (249), types de disponibilite (14), niveaux de visibilite
 * autorises par champ.
 *
 * Aucune de ces listes n'est ecrite dans le code. Si une lecture echoue,
 * l'ecran affiche un `ErrorState` avec son `correlation_id` (D-93,
 * D-102) : il n'affiche jamais une liste de secours inventee.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string): Result<T> {
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

export interface PromotionOption {
  id: number;
  name: string;
  graduationYear: number;
  programCode: string;
}

export async function loadPromotions(correlationId: string): Promise<Result<PromotionOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('promotions')
    .select('id, name, graduation_year, program_code')
    .eq('status', 'active')
    .order('graduation_year', { ascending: false });

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    name: string;
    graduation_year: number;
    program_code: string;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      graduationYear: row.graduation_year,
      programCode: row.program_code,
    })),
  };
}

export interface SectorOption {
  id: number;
  name: string;
  parentId: number | null;
}

export async function loadSectors(correlationId: string): Promise<Result<SectorOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('sectors')
    .select('id, name, parent_id, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    id: number;
    name: string;
    parent_id: number | null;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id })),
  };
}

export interface CountryOption {
  code: string;
  name: string;
  subregionCode: string | null;
}

export async function loadCountries(correlationId: string): Promise<Result<CountryOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('countries')
    .select('code, name_fr, subregion_code')
    .eq('is_active', true)
    .order('name_fr');

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    code: string;
    name_fr: string;
    subregion_code: string | null;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      code: row.code.trim(),
      name: row.name_fr,
      subregionCode: row.subregion_code,
    })),
  };
}

export interface AvailabilityTypeOption {
  code: string;
  name: string;
  description: string | null;
}

export async function loadAvailabilityTypes(
  correlationId: string,
): Promise<Result<AvailabilityTypeOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('availability_types')
    .select('code, name, description, sort_order')
    .eq('is_active', true)
    .order('sort_order');

  if (error) return fail(error, correlationId);

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

export interface JobFunctionOption {
  id: number;
  name: string;
}

export async function loadJobFunctions(
  correlationId: string,
): Promise<Result<JobFunctionOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('job_functions')
    .select('id, name, sort_order')
    .eq('is_active', true)
    .order('sort_order')
    .order('name');

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{ id: number; name: string }>;
  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name })) };
}

export interface OrganizationOption {
  id: string;
  name: string;
  isVerified: boolean;
}

/**
 * Référentiel `public.organizations` (D-166) : alimente la liste déroulante
 * « Organisation » des écrans de profil (en-tête, expériences), pour que
 * `current_organization_id` / `experiences.organization_id` soient réellement
 * renseignés plutôt que devinés depuis du texte libre. Le texte libre reste
 * un repli pour une organisation absente de la liste (D-164, D-166) : cet
 * écran ne crée jamais d'organisation lui-même.
 */
export async function loadOrganizations(
  correlationId: string,
): Promise<Result<OrganizationOption[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('organizations')
    .select('id, canonical_name, is_verified')
    .order('canonical_name')
    .limit(500);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    canonical_name: string;
    is_verified: boolean;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      name: row.canonical_name,
      isVerified: row.is_verified,
    })),
  };
}

export type VisibilityLevel = 'private' | 'connections' | 'promotion' | 'members';

export interface VisibilityFieldRule {
  fieldKey: string;
  label: string;
  defaultVisibility: VisibilityLevel;
  allowedLevels: VisibilityLevel[];
}

/**
 * Regles de visibilite par champ (D-73, D-74). `allowed_levels` est la
 * source qui interdit, par exemple, d'exposer un telephone a « tous les
 * membres » : la liste deroulante ne le propose pas, ET la Server Action
 * le refuse.
 */
export async function loadVisibilityRules(
  correlationId: string,
): Promise<Result<VisibilityFieldRule[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_visibility_defaults')
    .select('field_key, label, default_visibility, allowed_levels, sort_order')
    .order('sort_order');

  if (error) return fail(error, correlationId);

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

export interface SkillSearchResult {
  skillId: number;
  name: string;
  categoryName: string;
  domainName: string;
  matchedAlias: string | null;
}

/**
 * ISE-010 / ISE-022 — recherche incrementale sur les 543 competences.
 * Alias resolus EN BASE (D-46) : l'application ne connait aucun alias.
 */
export async function searchSkills(
  query: string | null,
  limit: number,
  correlationId: string,
): Promise<Result<SkillSearchResult[]>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('search_skills', {
    p_query: query && query.trim().length > 0 ? query : null,
    p_limit: limit,
  });

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    skill_id: number;
    skill_name: string;
    category_name: string;
    domain_name: string;
    matched_alias: string | null;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      skillId: row.skill_id,
      name: row.skill_name,
      categoryName: row.category_name,
      domainName: row.domain_name,
      matchedAlias: row.matched_alias,
    })),
  };
}
