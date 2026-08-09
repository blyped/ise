import { toBusinessError, type BusinessError } from '@ise/domain';
import { onboardingStepNumber, type OnboardingStepSlug } from '@ise/validation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Lectures et ecritures de l'onboarding ISE-008 -> ISE-014.
 *
 * DEUX regles structurent ce fichier :
 *
 *  1. Aucun `select('*')` sur `ise_profiles`. Depuis 0028, `authenticated`
 *     n'a plus de privilege au niveau table sur cette relation : les
 *     colonnes sont enumerees, et le score de completion se lit par
 *     `my_profile_completion()` (D-72).
 *  2. La progression est PERSISTEE EN BASE
 *     (`public.profile_onboarding_progress`, migration 0035). Rien n'est
 *     conserve cote client : fermer l'onglet ne perd ni la position, ni
 *     les saisies, qui vivent deja dans leurs tables metier.
 */

export type Result<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

function fail<T>(raw: unknown, correlationId: string): Result<T> {
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

const PROFILE_COLUMNS =
  'id, first_name, last_name, display_name, headline, promotion_id, ' +
  'current_country_code, current_city, claim_status, verification_status, ' +
  'onboarding_completed_at';

export interface OnboardingProfile {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  headline: string | null;
  promotionId: number | null;
  currentCountryCode: string | null;
  currentCity: string | null;
  claimStatus: string;
  verificationStatus: string;
  onboardingCompletedAt: string | null;
}

export interface OnboardingProgress {
  currentStep: number;
  furthestStep: number;
  skippedSteps: number[];
  completedAt: string | null;
}

export interface OnboardingSession {
  profile: OnboardingProfile;
  progress: OnboardingProgress;
}

/** Progression par defaut d'un membre qui n'a encore rien enregistre. */
const INITIAL_PROGRESS: OnboardingProgress = {
  currentStep: 1,
  furthestStep: 1,
  skippedSteps: [],
  completedAt: null,
};

/**
 * Charge le profil du compte connecte et sa progression.
 * `profile === null` signifie « compte non rattache a un profil » :
 * l'ecran renvoie alors vers la reclamation, il n'invente rien.
 */
export async function loadOnboardingSession(
  userId: string,
  correlationId: string,
): Promise<Result<OnboardingSession | null>> {
  const supabase = await createSupabaseServerClient();

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
 * Enregistre la position dans le parcours. Appelee a CHAQUE etape, dans
 * la meme Server Action que la donnee metier : si la donnee a ete ecrite,
 * la position l'est aussi.
 *
 * `furthest_step` ne recule jamais : revenir en arriere pour corriger une
 * saisie ne fait pas perdre les etapes deja franchies.
 */
export async function saveOnboardingProgress(
  profileId: string,
  nextStep: number,
  options: { skipped?: number | undefined; furthestSeen: number },
  correlationId: string,
): Promise<Result<null>> {
  const supabase = await createSupabaseServerClient();

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

/* ------------------------------------------------------------------ */
/* Selections deja enregistrees — pour reafficher les etapes           */
/* ------------------------------------------------------------------ */

export interface SelectedSkill {
  skillId: number;
  name: string;
  domainName: string;
  categoryName: string;
}

export async function loadSelectedSkills(
  profileId: string,
  correlationId: string,
): Promise<Result<SelectedSkill[]>> {
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
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
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('profile_geographies')
    .select('country_code')
    .eq('profile_id', profileId);

  if (error) return fail(error, correlationId);
  const rows = (data ?? []) as unknown as Array<{ country_code: string }>;
  return { ok: true, data: rows.map((row) => row.country_code.trim()) };
}

export interface DeclaredAvailability {
  availabilityType: string;
  active: boolean;
  maxPerMonth: number | null;
  visibility: string;
}

export async function loadDeclaredAvailabilities(
  profileId: string,
  correlationId: string,
): Promise<Result<DeclaredAvailability[]>> {
  const supabase = await createSupabaseServerClient();
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
/* ISE-009 — signalements de promotion deja deposes par le membre      */
/* ------------------------------------------------------------------ */

export interface PromotionSuggestion {
  id: string;
  promotionLabel: string;
  institution: string | null;
  approximateYear: number | null;
  status: string;
  createdAt: string;
}

export async function loadMyPromotionSuggestions(
  profileId: string,
  correlationId: string,
): Promise<Result<PromotionSuggestion[]>> {
  const supabase = await createSupabaseServerClient();
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

/* ------------------------------------------------------------------ */
/* ISE-014 — recapitulatif de finalisation                              */
/* ------------------------------------------------------------------ */

export interface MissingItem {
  blockKey: string;
  label: string;
  hint: string | null;
  /** Poids reel du bloc dans `profile_completion_rules` (D-71). */
  weight: number;
  completionRatio: number;
}

/**
 * ISE-031 / ISE-014 — manques du membre courant.
 * Lu par `my_profile_missing_items()`, sans parametre : aucun tiers n'est
 * atteignable (D-72). Jamais par lecture directe de la colonne.
 */
export async function loadMissingItems(correlationId: string): Promise<Result<MissingItem[]>> {
  const supabase = await createSupabaseServerClient();
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

/** Score de completion du membre courant. `null` si la lecture echoue. */
export async function loadMyCompletion(): Promise<number | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc('my_profile_completion');
  return typeof data === 'number' ? data : null;
}
