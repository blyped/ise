'use server';

import { revalidatePath } from 'next/cache';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { availabilitySettingsSchema } from '@ise/validation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { AVAILABILITY_ROUTES, PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { loadAvailabilityTypes } from '@/lib/queries/reference';
import { frProfile } from '@/i18n/profile';
import { toAvailabilityInput } from '../mon-profil/form-input-extras';

/**
 * ISE-033 — enregistrement de la disponibilite.
 *
 * Les types actives sont confrontes au REFERENTIEL (14 codes reels de
 * `availability_types`) : un code inconnu est refuse avant toute
 * ecriture. Les preferences (frequence max, delai, canal, visibilite,
 * note) s'appliquent aux types actifs ; les types decoches restent en
 * base avec `active = false` — l'historique n'est pas efface.
 *
 * La disponibilite declaree ne vaut JAMAIS obligation d'accepter
 * (MASTER PROMPT §20) : aucun engagement n'est deduit de ces valeurs.
 */
export async function saveAvailabilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = availabilitySettingsSchema.safeParse(toAvailabilityInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;

  const types = await loadAvailabilityTypes(context.correlationId);
  if (!types.ok) return failure(types.error.userMessage, context.correlationId);

  const knownCodes = new Set(types.data.map((type) => type.code));
  if (input.activeTypes.some((code) => !knownCodes.has(code))) {
    return failure(BUSINESS_ERRORS.validation_failed, context.correlationId);
  }

  const supabase = await createSupabaseServerClient();

  // Types actives : upsert avec les preferences declarees.
  if (input.activeTypes.length > 0) {
    const { error } = await supabase.from('profile_availabilities').upsert(
      input.activeTypes.map((code) => ({
        profile_id: context.profile.id,
        availability_type: code,
        active: true,
        max_per_month: input.maxPerMonth ?? null,
        ideal_delay_days: input.idealDelayDays ?? null,
        preferred_channel: input.preferredChannel ?? null,
        visibility: input.visibility,
        notes: input.notes ?? null,
      })),
      { onConflict: 'profile_id,availability_type' },
    );
    if (error) {
      return failure(
        toBusinessError(error, context.correlationId).userMessage,
        context.correlationId,
      );
    }
  }

  // Types decoches : desactivation des lignes existantes.
  let deactivation = supabase
    .from('profile_availabilities')
    .update({ active: false })
    .eq('profile_id', context.profile.id);
  if (input.activeTypes.length > 0) {
    deactivation = deactivation.not(
      'availability_type',
      'in',
      `(${input.activeTypes.map((code) => `"${code}"`).join(',')})`,
    );
  }
  const { error: deactivateError } = await deactivation;
  if (deactivateError) {
    return failure(
      toBusinessError(deactivateError, context.correlationId).userMessage,
      context.correlationId,
    );
  }

  revalidatePath(AVAILABILITY_ROUTES.overview);
  revalidatePath(AVAILABILITY_ROUTES.edit);
  revalidatePath(PROFILE_ROUTES.overview);
  revalidatePath(PROFILE_ROUTES.completion);
  revalidatePath(PROFILE_ROUTES.missingItems);
  return success(frProfile.availabilityForm.saved);
}
