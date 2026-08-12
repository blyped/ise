import { toBusinessError, type BusinessError } from '@ise/domain';
import {
  AVAILABILITY_INTENSITY_MAX_PER_MONTH,
  claimSubmitSchema,
  onboardingStepNumber,
  signUpSchema,
  type AvailabilityIntensity,
  type ClaimMethod,
  type OnboardingStepSlug,
} from '@ise/validation';
import { z } from 'zod';

import { authErrorMessage } from '../auth-errors';
import { getSupabaseClient } from '../supabase/client';

/**
 * Onboarding mobile ISE-002 -> ISE-014.
 *
 * Portage direct des Server Actions et lectures de :
 *  - `apps/web/src/app/(auth)/creer-compte|mot-de-passe-oublie|reinitialiser-mot-de-passe`
 *  - `apps/web/src/app/reclamer-mon-profil/[profileId]`
 *  - `apps/web/src/lib/queries/claim.ts`, `onboarding.ts`, `reference.ts`,
 *    `profile-sections.ts` (extraits ISE-012/ISE-013 : `loadProfileVisibility`,
 *    ISE-014 : `loadPromotionById`)
 *  - `apps/web/src/app/bienvenue/actions.ts`
 *
 * MEMES RPC, MEMES tables, MEMES noms de colonnes. Aucun `select('*')` sur
 * `ise_profiles` (D-71/D-72 : privilege SELECT retire depuis la migration
 * 0028), score de completion et manques lus UNIQUEMENT par
 * `my_profile_completion()` / `my_profile_missing_items()`, jamais par
 * colonne. La progression est persistee dans
 * `profile_onboarding_progress` (D-112) a chaque etape.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string): Result<T> {
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

/* ------------------------------------------------------------------ */
/* ISE-002 — Creer un compte                                           */
/* ------------------------------------------------------------------ */

/**
 * Le prenom et le nom n'appartiennent pas au compte d'authentification :
 * ils sont conserves dans les metadonnees en attendant la reclamation de
 * profil (ISE-005 / ISE-006), exactement comme
 * `apps/web/src/app/(auth)/creer-compte/schema.ts`.
 */
export const signUpFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Renseignez votre prénom.'),
    lastName: z.string().trim().min(1, 'Renseignez votre nom.'),
  })
  .and(signUpSchema);
export type SignUpFormInput = z.infer<typeof signUpFormSchema>;

export interface AuthActionResult {
  readonly ok: boolean;
  readonly message?: string;
  readonly correlationId?: string;
  readonly fieldErrors?: Record<string, string>;
  /** `true` si la confirmation d'e-mail est desactivee et la session ouverte immediatement. */
  readonly hasSession?: boolean;
}

function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export async function signUp(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  acceptsTerms: boolean;
}): Promise<AuthActionResult> {
  const correlationId = newCorrelationIdLocal();
  const parsed = signUpFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, correlationId, fieldErrors: fieldErrorsFromZod(parsed.error) };
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { first_name: parsed.data.firstName, last_name: parsed.data.lastName },
    },
  });

  if (error) {
    console.error('[ISE mobile] création de compte refusée', { correlationId, code: error.code });
    return { ok: false, message: authErrorMessage(error), correlationId };
  }

  return { ok: true, hasSession: data.session !== null };
}

/* ------------------------------------------------------------------ */
/* ISE-003 — Mot de passe oublié                                       */
/* ------------------------------------------------------------------ */

/**
 * La reponse est volontairement identique que l'adresse existe ou non
 * (meme regle que le web) : reveler l'existence d'un compte permettrait
 * d'enumerer les membres.
 *
 * `redirectTo` utilise le schema d'URL Expo (`app.json` -> `expo.scheme`,
 * "competences-ise") : contrairement au web, il n'y a pas de domaine HTTPS
 * de retour. Le lien recu par e-mail ouvre l'app sur cet ecran si le deep
 * link est configure cote navigation (voir README d'integration).
 */
export async function forgotPassword(email: string): Promise<AuthActionResult> {
  const correlationId = newCorrelationIdLocal();
  const supabase = getSupabaseClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'competences-ise://reinitialiser-mot-de-passe',
  });

  if (error) {
    console.error('[ISE mobile] envoi du lien de réinitialisation', {
      correlationId,
      code: error.code,
    });
  }

  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* ISE-004 — Réinitialiser le mot de passe                             */
/* ------------------------------------------------------------------ */

/**
 * Suppose une session de recuperation deja ouverte (lien e-mail -> deep
 * link -> `supabase.auth.setSession`, a brancher lors de l'integration du
 * deep linking, hors de cette tranche). Le compte est deconnecte apres
 * mise a jour pour forcer une reconnexion avec le nouveau mot de passe,
 * comme `apps/web/src/app/(auth)/reinitialiser-mot-de-passe/actions.ts`.
 */
export async function resetPassword(password: string): Promise<AuthActionResult> {
  const correlationId = newCorrelationIdLocal();
  const supabase = getSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, correlationId, message: 'Votre session a expiré. Reconnectez-vous pour continuer.' };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    console.error('[ISE mobile] réinitialisation refusée', { correlationId, code: error.code });
    return { ok: false, message: authErrorMessage(error), correlationId };
  }

  await supabase.auth.signOut();
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* ISE-006 — Confirmer l'association du profil                         */
/* ------------------------------------------------------------------ */

export interface ClaimableProfileDetail {
  readonly profileId: string;
  readonly displayName: string;
  readonly graduationYear: number | null;
  readonly currentOrganization: string | null;
  readonly emailHint: string | null;
  readonly headline: string | null;
  readonly promotionName: string | null;
  readonly currentPosition: string | null;
  readonly currentCity: string | null;
  readonly currentCountry: string | null;
  readonly hasHistoricalEmail: boolean;
}

interface RawDetail {
  profile_id: string;
  display_name: string | null;
  graduation_year: number | null;
  current_organization: string | null;
  email_hint: string | null;
  headline: string | null;
  promotion_name: string | null;
  current_position: string | null;
  current_city: string | null;
  current_country: string | null;
  has_historical_email: boolean | null;
}

/**
 * `public.get_claimable_profile` (migration 0029) — aucun `select` direct
 * n'est fait sur `ise_profiles` : le compte n'est pas encore rattache.
 */
export async function getClaimableProfile(
  profileId: string,
  correlationId: string,
): Promise<Result<ClaimableProfileDetail | null>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_claimable_profile', { p_profile_id: profileId });

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as RawDetail[];
  const row = rows[0];
  if (!row) return { ok: true, data: null };

  return {
    ok: true,
    data: {
      profileId: row.profile_id,
      displayName: row.display_name ?? '',
      graduationYear: row.graduation_year,
      currentOrganization: row.current_organization,
      emailHint: row.email_hint,
      headline: row.headline,
      promotionName: row.promotion_name,
      currentPosition: row.current_position,
      currentCity: row.current_city,
      currentCountry: row.current_country,
      hasHistoricalEmail: row.has_historical_email === true,
    },
  };
}

export async function submitClaim(
  profileId: string,
  claimMethod: ClaimMethod,
  confirmsIdentity: boolean,
  correlationId: string,
): Promise<Result<null>> {
  const parsed = claimSubmitSchema.safeParse({
    profileId,
    claimMethod,
    confirmsIdentity,
    declaredDetails: {},
  });
  if (!parsed.success) {
    return fail({ message: 'validation_failed' }, correlationId);
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('submit_profile_claim', {
    p_profile_id: parsed.data.profileId,
    p_claim_method: parsed.data.claimMethod,
    p_declared_details: parsed.data.declaredDetails,
  });

  if (error) {
    console.error('[ISE mobile] soumission de réclamation en échec', { correlationId, code: error.code });
    return fail(error, correlationId);
  }

  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Session d'onboarding (etapes 1 -> 7)                                 */
/* ------------------------------------------------------------------ */

export interface OnboardingProfile {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string | null;
  readonly headline: string | null;
  readonly promotionId: number | null;
  readonly currentCountryCode: string | null;
  readonly currentCity: string | null;
  readonly claimStatus: string;
  readonly verificationStatus: string;
  readonly onboardingCompletedAt: string | null;
}

export interface OnboardingProgress {
  readonly currentStep: number;
  readonly furthestStep: number;
  readonly skippedSteps: readonly number[];
  readonly completedAt: string | null;
}

export interface OnboardingSession {
  readonly profile: OnboardingProfile;
  readonly progress: OnboardingProgress;
}

const INITIAL_PROGRESS: OnboardingProgress = {
  currentStep: 1,
  furthestStep: 1,
  skippedSteps: [],
  completedAt: null,
};

const PROFILE_COLUMNS =
  'id, first_name, last_name, display_name, headline, promotion_id, ' +
  'current_country_code, current_city, claim_status, verification_status, ' +
  'onboarding_completed_at';

/**
 * `profile === null` -> compte non rattache a un profil : l'appelant doit
 * renvoyer vers la reclamation (ISE-005/ISE-006), jamais inventer un profil.
 */
export async function loadOnboardingSession(
  userId: string,
  correlationId: string,
): Promise<Result<OnboardingSession | null>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ise_profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) return fail(error, correlationId);

  const row = (data ?? null) as unknown as {
    id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
    headline: string | null;
    promotion_id: number | null;
    current_country_code: string | null;
    current_city: string | null;
    claim_status: string;
    verification_status: string;
    onboarding_completed_at: string | null;
  } | null;

  if (!row) return { ok: true, data: null };

  const profile: OnboardingProfile = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    headline: row.headline,
    promotionId: row.promotion_id,
    currentCountryCode: row.current_country_code?.trim() ?? null,
    currentCity: row.current_city,
    claimStatus: row.claim_status,
    verificationStatus: row.verification_status,
    onboardingCompletedAt: row.onboarding_completed_at,
  };

  const { data: progressRow, error: progressError } = await supabase
    .from('profile_onboarding_progress')
    .select('current_step, furthest_step, skipped_steps, completed_at')
    .eq('profile_id', profile.id)
    .maybeSingle();

  if (progressError) return fail(progressError, correlationId);

  const raw = (progressRow ?? null) as unknown as {
    current_step: number;
    furthest_step: number;
    skipped_steps: number[] | null;
    completed_at: string | null;
  } | null;

  const progress: OnboardingProgress = raw
    ? {
        currentStep: raw.current_step,
        furthestStep: raw.furthest_step,
        skippedSteps: raw.skipped_steps ?? [],
        completedAt: raw.completed_at,
      }
    : INITIAL_PROGRESS;

  return { ok: true, data: { profile, progress } };
}

/**
 * Enregistre la position (D-112). `furthest_step` ne recule jamais.
 * MEME logique que `apps/web/src/lib/queries/onboarding.ts::saveOnboardingProgress`.
 */
export async function saveOnboardingProgress(
  profileId: string,
  nextStep: number,
  options: { skipped?: number | undefined; furthestSeen: number },
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const furthest = Math.max(options.furthestSeen, nextStep);

  const { data: existing, error: readError } = await supabase
    .from('profile_onboarding_progress')
    .select('skipped_steps')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (readError) return fail(readError, correlationId);

  const currentSkipped = new Set<number>(
    ((existing as unknown as { skipped_steps: number[] | null } | null)?.skipped_steps ?? []).map(
      Number,
    ),
  );
  if (options.skipped !== undefined) currentSkipped.add(options.skipped);
  else currentSkipped.delete(nextStep - 1);

  const { error } = await supabase.from('profile_onboarding_progress').upsert(
    {
      profile_id: profileId,
      current_step: nextStep,
      furthest_step: furthest,
      skipped_steps: [...currentSkipped].sort((a, b) => a - b),
    },
    { onConflict: 'profile_id' },
  );

  if (error) return fail(error, correlationId);
  return { ok: true, data: null };
}

export function stepNumber(slug: OnboardingStepSlug): number {
  return onboardingStepNumber(slug);
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Ecrit la position et retourne l'etape suivante (1..7) — jamais > 7. */
export async function advanceOnboarding(
  profileId: string,
  from: Step,
  furthestSeen: number,
  correlationId: string,
  options: { skipped?: boolean } = {},
): Promise<Result<number>> {
  const next = Math.min(from + 1, 7);
  const saved = await saveOnboardingProgress(
    profileId,
    next,
    { furthestSeen, ...(options.skipped === true ? { skipped: from } : {}) },
    correlationId,
  );
  if (!saved.ok) return saved;
  return { ok: true, data: next };
}

/* ------------------------------------------------------------------ */
/* Référentiels (ISE-008, ISE-010, ISE-011, ISE-012, ISE-013)           */
/* ------------------------------------------------------------------ */

export interface PromotionOption {
  readonly id: number;
  readonly name: string;
  readonly graduationYear: number;
  readonly programCode: string;
}

export async function loadPromotions(correlationId: string): Promise<Result<PromotionOption[]>> {
  const supabase = getSupabaseClient();
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

export interface PromotionSummary {
  readonly name: string;
  readonly graduationYear: number;
  readonly programCode: string;
}

export async function loadPromotionById(
  promotionId: number,
  correlationId: string,
): Promise<Result<PromotionSummary | null>> {
  const supabase = getSupabaseClient();
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

export interface SectorOption {
  readonly id: number;
  readonly name: string;
  readonly parentId: number | null;
}

export async function loadSectors(correlationId: string): Promise<Result<SectorOption[]>> {
  const supabase = getSupabaseClient();
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

  return { ok: true, data: rows.map((row) => ({ id: row.id, name: row.name, parentId: row.parent_id })) };
}

export interface CountryOption {
  readonly code: string;
  readonly name: string;
  readonly subregionCode: string | null;
}

export async function loadCountries(correlationId: string): Promise<Result<CountryOption[]>> {
  const supabase = getSupabaseClient();
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
    data: rows.map((row) => ({ code: row.code.trim(), name: row.name_fr, subregionCode: row.subregion_code })),
  };
}

export interface AvailabilityTypeOption {
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
}

export async function loadAvailabilityTypes(
  correlationId: string,
): Promise<Result<AvailabilityTypeOption[]>> {
  const supabase = getSupabaseClient();
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

  return { ok: true, data: rows.map((row) => ({ code: row.code, name: row.name, description: row.description })) };
}

export type VisibilityLevel = 'private' | 'connections' | 'promotion' | 'members';

export interface VisibilityFieldRule {
  readonly fieldKey: string;
  readonly label: string;
  readonly defaultVisibility: VisibilityLevel;
  readonly allowedLevels: readonly VisibilityLevel[];
}

export async function loadVisibilityRules(
  correlationId: string,
): Promise<Result<VisibilityFieldRule[]>> {
  const supabase = getSupabaseClient();
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

export async function loadProfileVisibility(
  profileId: string,
  correlationId: string,
): Promise<Result<Record<string, VisibilityLevel>>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_visibility')
    .select('field_key, visibility')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{ field_key: string; visibility: VisibilityLevel }>;
  const map: Record<string, VisibilityLevel> = {};
  for (const row of rows) map[row.field_key] = row.visibility;
  return { ok: true, data: map };
}

export interface SkillSearchResult {
  readonly skillId: number;
  readonly name: string;
  readonly categoryName: string;
  readonly domainName: string;
  readonly matchedAlias: string | null;
}

/** `public.search_skills` (migration 0035) — alias resolus EN BASE (D-46). */
export async function searchSkills(
  query: string | null,
  limit: number,
  correlationId: string,
): Promise<Result<SkillSearchResult[]>> {
  const supabase = getSupabaseClient();
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

/* ------------------------------------------------------------------ */
/* Sélections déjà enregistrées — pour réafficher les étapes            */
/* ------------------------------------------------------------------ */

export interface SelectedSkill {
  readonly skillId: number;
  readonly name: string;
  readonly domainName: string;
  readonly categoryName: string;
}

export async function loadSelectedSkills(
  profileId: string,
  correlationId: string,
): Promise<Result<SelectedSkill[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_skills')
    .select('skill_id, skills(name, skill_categories(name, skill_domains(name)))')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    skill_id: number;
    skills: {
      name: string;
      skill_categories: { name: string; skill_domains: { name: string } | null } | null;
    } | null;
  }>;

  return {
    ok: true,
    data: rows
      .map((row) => ({
        skillId: row.skill_id,
        name: row.skills?.name ?? '',
        categoryName: row.skills?.skill_categories?.name ?? '',
        domainName: row.skills?.skill_categories?.skill_domains?.name ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
  };
}

export async function loadSelectedSectorIds(
  profileId: string,
  correlationId: string,
): Promise<Result<number[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_sectors')
    .select('sector_id')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{ sector_id: number }>;
  return { ok: true, data: rows.map((row) => row.sector_id) };
}

export async function loadExperienceCountryCodes(
  profileId: string,
  correlationId: string,
): Promise<Result<string[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_geographies')
    .select('country_code')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{ country_code: string }>;
  return { ok: true, data: rows.map((row) => row.country_code.trim()) };
}

export interface DeclaredAvailability {
  readonly availabilityType: string;
  readonly active: boolean;
  readonly maxPerMonth: number | null;
  readonly visibility: string;
}

export async function loadDeclaredAvailabilities(
  profileId: string,
  correlationId: string,
): Promise<Result<DeclaredAvailability[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('profile_availabilities')
    .select('availability_type, active, max_per_month, visibility')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    availability_type: string;
    active: boolean;
    max_per_month: number | null;
    visibility: string;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      availabilityType: row.availability_type,
      active: row.active,
      maxPerMonth: row.max_per_month,
      visibility: row.visibility,
    })),
  };
}

/* ------------------------------------------------------------------ */
/* ISE-009 — signalements de promotion déjà déposés                    */
/* ------------------------------------------------------------------ */

export interface PromotionSuggestion {
  readonly id: string;
  readonly promotionLabel: string;
  readonly institution: string | null;
  readonly approximateYear: number | null;
  readonly status: string;
  readonly createdAt: string;
}

export async function loadMyPromotionSuggestions(
  profileId: string,
  correlationId: string,
): Promise<Result<PromotionSuggestion[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('promotion_suggestions')
    .select('id, promotion_label, institution, approximate_year, status, created_at')
    .eq('submitted_by_profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    promotion_label: string;
    institution: string | null;
    approximate_year: number | null;
    status: string;
    created_at: string;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      id: row.id,
      promotionLabel: row.promotion_label,
      institution: row.institution,
      approximateYear: row.approximate_year,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}

export async function reportMissingPromotion(
  profileId: string,
  input: {
    promotionLabel: string;
    institution?: string | undefined;
    countryCode?: string | undefined;
    approximateYear?: number | undefined;
    comment?: string | undefined;
  },
  correlationId: string,
): Promise<Result<{ duplicate: boolean }>> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('promotion_suggestions').insert({
    submitted_by_profile_id: profileId,
    promotion_label: input.promotionLabel,
    institution: input.institution ?? null,
    country_code: input.countryCode ?? null,
    approximate_year: input.approximateYear ?? null,
    comment: input.comment ?? null,
    status: 'submitted',
  });

  if (error) {
    // Doublon : un signalement identique est deja en attente — ce n'est
    // pas un echec pour l'utilisateur (meme regle que le web).
    const code = (error as { code?: string }).code;
    if (code === '23505') return { ok: true, data: { duplicate: true } };
    return fail(error, correlationId);
  }

  return { ok: true, data: { duplicate: false } };
}

/* ------------------------------------------------------------------ */
/* Étape 2 — Promotion (ISE-008)                                       */
/* ------------------------------------------------------------------ */

export async function savePromotion(
  profileId: string,
  promotionId: number,
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ise_profiles')
    .update({ promotion_id: promotionId })
    .eq('id', profileId);

  if (error) return fail(error, correlationId);
  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Étape 3 — Compétences (ISE-010)                                     */
/* ------------------------------------------------------------------ */

export async function saveSkills(
  profileId: string,
  skillIds: readonly number[],
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const wanted = [...new Set(skillIds)];

  const { error: deleteError } =
    wanted.length > 0
      ? await supabase
          .from('profile_skills')
          .delete()
          .eq('profile_id', profileId)
          .not('skill_id', 'in', `(${wanted.join(',')})`)
      : await supabase.from('profile_skills').delete().eq('profile_id', profileId);

  if (deleteError) return fail(deleteError, correlationId);

  if (wanted.length > 0) {
    const { error } = await supabase.from('profile_skills').upsert(
      wanted.map((skillId) => ({ profile_id: profileId, skill_id: skillId })),
      { onConflict: 'profile_id,skill_id', ignoreDuplicates: true },
    );
    if (error) return fail(error, correlationId);
  }

  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Étape 4 — Secteurs (ISE-011)                                        */
/* ------------------------------------------------------------------ */

export async function saveSectors(
  profileId: string,
  sectorIds: readonly number[],
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const wanted = [...new Set(sectorIds)];

  const deletion = supabase.from('profile_sectors').delete().eq('profile_id', profileId);
  const { error: deleteError } =
    wanted.length > 0 ? await deletion.not('sector_id', 'in', `(${wanted.join(',')})`) : await deletion;

  if (deleteError) return fail(deleteError, correlationId);

  if (wanted.length > 0) {
    const { error } = await supabase.from('profile_sectors').upsert(
      wanted.map((sectorId) => ({ profile_id: profileId, sector_id: sectorId })),
      { onConflict: 'profile_id,sector_id', ignoreDuplicates: true },
    );
    if (error) return fail(error, correlationId);
  }

  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Étape 5 — Localisation (ISE-012)                                    */
/* ------------------------------------------------------------------ */

export async function saveLocation(
  profileId: string,
  input: {
    currentCountryCode: string | null;
    currentCity: string | null;
    experienceCountryCodes: readonly string[];
    cityVisibility: VisibilityLevel;
  },
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();

  const { error: profileError } = await supabase
    .from('ise_profiles')
    .update({
      current_country_code: input.currentCountryCode,
      current_city: input.currentCity,
    })
    .eq('id', profileId);

  if (profileError) return fail(profileError, correlationId);

  const wanted = [...new Set(input.experienceCountryCodes)];
  const deletion = supabase.from('profile_geographies').delete().eq('profile_id', profileId);
  const { error: deleteError } =
    wanted.length > 0
      ? await deletion.not('country_code', 'in', `(${wanted.map((c) => `"${c}"`).join(',')})`)
      : await deletion;

  if (deleteError) return fail(deleteError, correlationId);

  if (wanted.length > 0) {
    const { error } = await supabase.from('profile_geographies').upsert(
      wanted.map((code) => ({ profile_id: profileId, country_code: code })),
      { onConflict: 'profile_id,country_code', ignoreDuplicates: true },
    );
    if (error) return fail(error, correlationId);
  }

  // D-73 : le choix de visibilite de la ville est ENREGISTRE, pas seulement affiche.
  const { error: visibilityError } = await supabase.from('profile_visibility').upsert(
    [
      { profile_id: profileId, field_key: 'city', visibility: input.cityVisibility },
      { profile_id: profileId, field_key: 'country', visibility: input.cityVisibility },
    ],
    { onConflict: 'profile_id,field_key' },
  );

  if (visibilityError) return fail(visibilityError, correlationId);
  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Étape 6 — Disponibilité (ISE-013)                                   */
/* ------------------------------------------------------------------ */

export async function saveAvailability(
  profileId: string,
  input: {
    availabilityTypes: readonly string[];
    intensity: AvailabilityIntensity;
    visibility: VisibilityLevel;
  },
  correlationId: string,
): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const wanted = [...new Set(input.availabilityTypes)];
  const maxPerMonth = AVAILABILITY_INTENSITY_MAX_PER_MONTH[input.intensity];

  const deletion = supabase.from('profile_availabilities').delete().eq('profile_id', profileId);
  const { error: deleteError } =
    wanted.length > 0
      ? await deletion.not('availability_type', 'in', `(${wanted.map((c) => `"${c}"`).join(',')})`)
      : await deletion;

  if (deleteError) return fail(deleteError, correlationId);

  if (wanted.length > 0) {
    const { error } = await supabase.from('profile_availabilities').upsert(
      wanted.map((code) => ({
        profile_id: profileId,
        availability_type: code,
        active: true,
        max_per_month: maxPerMonth,
        visibility: input.visibility,
      })),
      { onConflict: 'profile_id,availability_type' },
    );
    if (error) return fail(error, correlationId);
  }

  const { error: visibilityError } = await supabase
    .from('profile_visibility')
    .upsert([{ profile_id: profileId, field_key: 'availabilities', visibility: input.visibility }], {
      onConflict: 'profile_id,field_key',
    });

  if (visibilityError) return fail(visibilityError, correlationId);
  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Étape 7 — Finalisation (ISE-014)                                    */
/* ------------------------------------------------------------------ */

export interface MissingItem {
  readonly blockKey: string;
  readonly label: string;
  readonly hint: string | null;
  readonly weight: number;
  readonly completionRatio: number;
}

/** `my_profile_missing_items()` — sans parametre, aucun tiers atteignable (D-72). */
export async function loadMissingItems(correlationId: string): Promise<Result<MissingItem[]>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('my_profile_missing_items');

  if (error) return fail(error, correlationId);

  const rows = (data ?? []) as unknown as Array<{
    block_key: string;
    label: string;
    hint: string | null;
    weight: number | string;
    completion_ratio: number | string;
  }>;

  return {
    ok: true,
    data: rows.map((row) => ({
      blockKey: row.block_key,
      label: row.label,
      hint: row.hint,
      weight: Number(row.weight),
      completionRatio: Number(row.completion_ratio),
    })),
  };
}

/** Score de completion prive (D-72). `null` si la lecture echoue. */
export async function loadMyCompletion(): Promise<number | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.rpc('my_profile_completion');
  return typeof data === 'number' ? data : null;
}

export async function completeOnboarding(correlationId: string): Promise<Result<null>> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('complete_onboarding');

  if (error) {
    const message = (error as { message?: string }).message ?? '';
    if (message.includes('onboarding_promotion_required')) {
      return {
        ok: false,
        error: toBusinessError({ message: 'validation_failed' }, correlationId),
      };
    }
    return fail(error, correlationId);
  }

  return { ok: true, data: null };
}

/* ------------------------------------------------------------------ */
/* Utilitaire local — evite une dependance circulaire avec correlation.ts */
/* ------------------------------------------------------------------ */

function newCorrelationIdLocal(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const random =
    typeof cryptoObj?.randomUUID === 'function'
      ? cryptoObj.randomUUID()
      : Math.random().toString(16).slice(2).padEnd(12, '0');
  return `ISE-${random.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}
