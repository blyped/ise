'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import {
  AVAILABILITY_INTENSITY_MAX_PER_MONTH,
  onboardingAvailabilitySchema,
  onboardingFinalizeSchema,
  onboardingLocationSchema,
  onboardingPromotionSchema,
  onboardingSectorsSchema,
  onboardingSkillsSchema,
  onboardingVerificationSchema,
  promotionSuggestionSchema,
  type AvailabilityIntensity,
} from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { ROUTES } from '@/lib/routes';
import { ONBOARDING_MISSING_PROMOTION, onboardingRoute } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { currentOnboardingProfile } from '@/lib/onboarding-guard';
import { saveOnboardingProgress } from '@/lib/queries/onboarding';
import { searchSkills } from '@/lib/queries/reference';

/**
 * Server Actions de l'onboarding ISE-008 -> ISE-014.
 *
 * Chaque action :
 *  1. rejoue le MEME schema Zod que le client (MASTER PROMPT §62) ;
 *  2. ecrit la donnee metier dans sa table reelle, sous RLS ;
 *  3. ENREGISTRE LA POSITION en base, dans la foulee ;
 *  4. redirige vers l'etape suivante.
 *
 * Aucune erreur Postgres brute ne remonte : `toBusinessError` la traduit,
 * et l'ecran affiche le message metier avec son `correlation_id` (D-102).
 */

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Contexte commun : profil courant + identifiant de correlation. */
async function begin() {
  const correlationId = newCorrelationId();
  const context = await currentOnboardingProfile(correlationId);
  return { correlationId, context };
}

/** Ecrit la position et part a l'etape suivante. */
async function advance(
  profileId: string,
  from: Step,
  furthestSeen: number,
  correlationId: string,
  options: { skipped?: boolean } = {},
): Promise<FormState | never> {
  const next = Math.min(from + 1, 7);
  const saved = await saveOnboardingProgress(
    profileId,
    next,
    {
      furthestSeen,
      ...(options.skipped === true ? { skipped: from } : {}),
    },
    correlationId,
  );

  if (!saved.ok) return failure(saved.error.userMessage, correlationId);

  revalidatePath(onboardingRoute(next));
  redirect(onboardingRoute(next));
}

/* ------------------------------------------------------------------ */
/* Etape 1 — Verification                                              */
/* ------------------------------------------------------------------ */

export async function confirmVerificationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const parsed = onboardingVerificationSchema.safeParse({
    acknowledged: formData.get('acknowledged'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  return advance(
    context.session.profile.id,
    1,
    context.session.progress.furthestStep,
    correlationId,
  );
}

/* ------------------------------------------------------------------ */
/* Etape 2 — Promotion (ISE-008)                                       */
/* ------------------------------------------------------------------ */

export async function savePromotionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const parsed = onboardingPromotionSchema.safeParse({
    promotionId: formData.get('promotionId'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('ise_profiles')
    .update({ promotion_id: parsed.data.promotionId })
    .eq('id', context.session.profile.id);

  if (error) return failure(toBusinessError(error, correlationId).userMessage, correlationId);

  return advance(
    context.session.profile.id,
    2,
    context.session.progress.furthestStep,
    correlationId,
  );
}

/* ------------------------------------------------------------------ */
/* ISE-009 — Signaler une promotion absente                            */
/* ------------------------------------------------------------------ */

export async function reportMissingPromotionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const parsed = promotionSuggestionSchema.safeParse({
    promotionLabel: formData.get('promotionLabel'),
    institution: formData.get('institution'),
    countryCode: formData.get('countryCode'),
    approximateYear: formData.get('approximateYear'),
    comment: formData.get('comment'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from('promotion_suggestions').insert({
    submitted_by_profile_id: context.session.profile.id,
    promotion_label: input.promotionLabel,
    institution: input.institution === '' ? null : (input.institution ?? null),
    country_code: input.countryCode === '' ? null : (input.countryCode ?? null),
    approximate_year:
      input.approximateYear === '' || input.approximateYear === undefined
        ? null
        : Number(input.approximateYear),
    comment: input.comment === '' ? null : (input.comment ?? null),
    status: 'submitted',
  });

  if (error) {
    // Doublon : un signalement identique est deja en attente. Ce n'est pas
    // un echec pour l'utilisateur, c'est une information.
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      return {
        status: 'success',
        message: frOnboarding.missingPromotion.duplicateTitle,
        correlationId: null,
        fieldErrors: {},
      };
    }
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(ONBOARDING_MISSING_PROMOTION);
  return {
    status: 'success',
    message: frOnboarding.missingPromotion.sentTitle,
    correlationId: null,
    fieldErrors: {},
  };
}

/* ------------------------------------------------------------------ */
/* Etape 3 — Competences (ISE-010)                                     */
/* ------------------------------------------------------------------ */

/** Recherche appelee par le selecteur, cote serveur uniquement. */
export async function searchSkillsAction(
  query: string,
): Promise<Array<{ value: string; label: string; group: string; hint?: string }>> {
  const correlationId = newCorrelationId();
  const result = await searchSkills(query, 40, correlationId);
  if (!result.ok) return [];

  return result.data.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
    ...(skill.matchedAlias ? { hint: `« ${skill.matchedAlias} » · ${skill.categoryName}` } : {}),
  }));
}

export async function saveSkillsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const parsed = onboardingSkillsSchema.safeParse({
    skillIds: formData.getAll('skillIds'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const profileId = context.session.profile.id;
  const wanted = [...new Set(parsed.data.skillIds)];
  const supabase = await createSupabaseServerClient();

  // Les competences retirees de la selection sont supprimees ; celles qui
  // restent ne sont pas reecrites, pour ne pas ecraser un niveau declare
  // depuis ISE-023.
  const { error: deleteError } = await supabase
    .from('profile_skills')
    .delete()
    .eq('profile_id', profileId)
    .not('skill_id', 'in', `(${wanted.join(',')})`);

  if (deleteError) {
    return failure(toBusinessError(deleteError, correlationId).userMessage, correlationId);
  }

  const { error } = await supabase.from('profile_skills').upsert(
    wanted.map((skillId) => ({ profile_id: profileId, skill_id: skillId })),
    { onConflict: 'profile_id,skill_id', ignoreDuplicates: true },
  );

  if (error) return failure(toBusinessError(error, correlationId).userMessage, correlationId);

  return advance(profileId, 3, context.session.progress.furthestStep, correlationId);
}

/* ------------------------------------------------------------------ */
/* Etape 4 — Secteurs (ISE-011)                                        */
/* ------------------------------------------------------------------ */

export async function saveSectorsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const skipped = formData.get('intention') === 'skip';

  const parsed = onboardingSectorsSchema.safeParse({
    sectorIds: skipped ? [] : formData.getAll('sectorIds'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const profileId = context.session.profile.id;
  const supabase = await createSupabaseServerClient();

  if (!skipped) {
    const wanted = [...new Set(parsed.data.sectorIds)];

    const deletion = supabase.from('profile_sectors').delete().eq('profile_id', profileId);
    const { error: deleteError } =
      wanted.length > 0
        ? await deletion.not('sector_id', 'in', `(${wanted.join(',')})`)
        : await deletion;

    if (deleteError) {
      return failure(toBusinessError(deleteError, correlationId).userMessage, correlationId);
    }

    if (wanted.length > 0) {
      const { error } = await supabase.from('profile_sectors').upsert(
        wanted.map((sectorId) => ({ profile_id: profileId, sector_id: sectorId })),
        { onConflict: 'profile_id,sector_id', ignoreDuplicates: true },
      );
      if (error) return failure(toBusinessError(error, correlationId).userMessage, correlationId);
    }
  }

  return advance(profileId, 4, context.session.progress.furthestStep, correlationId, {
    skipped,
  });
}

/* ------------------------------------------------------------------ */
/* Etape 5 — Localisation (ISE-012)                                    */
/* ------------------------------------------------------------------ */

export async function saveLocationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const skipped = formData.get('intention') === 'skip';
  const profileId = context.session.profile.id;

  if (skipped) {
    return advance(profileId, 5, context.session.progress.furthestStep, correlationId, {
      skipped: true,
    });
  }

  const parsed = onboardingLocationSchema.safeParse({
    currentCountryCode: formData.get('currentCountryCode'),
    currentCity: formData.get('currentCity'),
    experienceCountryCodes: formData.getAll('experienceCountryCodes'),
    cityVisibility: formData.get('cityVisibility'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  const { error: profileError } = await supabase
    .from('ise_profiles')
    .update({
      current_country_code: input.currentCountryCode === '' ? null : input.currentCountryCode,
      current_city: input.currentCity === '' ? null : input.currentCity,
    })
    .eq('id', profileId);

  if (profileError) {
    return failure(toBusinessError(profileError, correlationId).userMessage, correlationId);
  }

  const wanted = [...new Set(input.experienceCountryCodes)];
  const deletion = supabase.from('profile_geographies').delete().eq('profile_id', profileId);
  const { error: deleteError } =
    wanted.length > 0
      ? await deletion.not('country_code', 'in', `(${wanted.map((c) => `"${c}"`).join(',')})`)
      : await deletion;

  if (deleteError) {
    return failure(toBusinessError(deleteError, correlationId).userMessage, correlationId);
  }

  if (wanted.length > 0) {
    const { error } = await supabase.from('profile_geographies').upsert(
      wanted.map((code) => ({ profile_id: profileId, country_code: code })),
      { onConflict: 'profile_id,country_code', ignoreDuplicates: true },
    );
    if (error) return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  // D-73 : le choix de visibilite de la ville est ENREGISTRE, pas seulement
  // affiche. `profile_visibility` porte le niveau reellement applique.
  const { error: visibilityError } = await supabase.from('profile_visibility').upsert(
    [
      { profile_id: profileId, field_key: 'city', visibility: input.cityVisibility },
      { profile_id: profileId, field_key: 'country', visibility: input.cityVisibility },
    ],
    { onConflict: 'profile_id,field_key' },
  );

  if (visibilityError) {
    return failure(toBusinessError(visibilityError, correlationId).userMessage, correlationId);
  }

  return advance(profileId, 5, context.session.progress.furthestStep, correlationId);
}

/* ------------------------------------------------------------------ */
/* Etape 6 — Disponibilite (ISE-013)                                   */
/* ------------------------------------------------------------------ */

export async function saveAvailabilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const { correlationId, context } = await begin();
  if (!context.ok) return failure(context.message, correlationId);

  const skipped = formData.get('intention') === 'skip';
  const profileId = context.session.profile.id;

  if (skipped) {
    return advance(profileId, 6, context.session.progress.furthestStep, correlationId, {
      skipped: true,
    });
  }

  const parsed = onboardingAvailabilitySchema.safeParse({
    availabilityTypes: formData.getAll('availabilityTypes'),
    intensity: formData.get('intensity'),
    visibility: formData.get('visibility'),
  });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const wanted = [...new Set(input.availabilityTypes)];
  const maxPerMonth =
    AVAILABILITY_INTENSITY_MAX_PER_MONTH[input.intensity as AvailabilityIntensity];
  const supabase = await createSupabaseServerClient();

  // Une forme d'aide retiree est SUPPRIMEE, pas laissee « inactive » : le
  // membre a dit qu'il ne la propose pas.
  const deletion = supabase.from('profile_availabilities').delete().eq('profile_id', profileId);
  const { error: deleteError } =
    wanted.length > 0
      ? await deletion.not('availability_type', 'in', `(${wanted.map((c) => `"${c}"`).join(',')})`)
      : await deletion;

  if (deleteError) {
    return failure(toBusinessError(deleteError, correlationId).userMessage, correlationId);
  }

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
    if (error) return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const { error: visibilityError } = await supabase
    .from('profile_visibility')
    .upsert(
      [{ profile_id: profileId, field_key: 'availabilities', visibility: input.visibility }],
      {
        onConflict: 'profile_id,field_key',
      },
    );

  if (visibilityError) {
    return failure(toBusinessError(visibilityError, correlationId).userMessage, correlationId);
  }

  return advance(profileId, 6, context.session.progress.furthestStep, correlationId);
}

/* ------------------------------------------------------------------ */
/* Etape 7 — Finalisation (ISE-014)                                    */
/* ------------------------------------------------------------------ */

export async function completeOnboardingAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = onboardingFinalizeSchema.safeParse({ confirmed: formData.get('confirmed') });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('complete_onboarding');

  if (error) {
    // `onboarding_promotion_required` est un code metier leve par la base :
    // il est traduit ici, jamais affiche tel quel (D-102).
    const message = (error as { message?: string }).message ?? '';
    if (message.includes('onboarding_promotion_required')) {
      return failure(frOnboarding.finalize.promotionRequiredTitle, correlationId);
    }
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(ROUTES.dashboard);
  redirect(`${ROUTES.dashboard}?onboarding=termine`);
}
