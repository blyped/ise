'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { frSettings, ts } from '@/i18n/settings';

/**
 * Ecritures des PARAMETRES, de la CONFIDENTIALITE et des PREFERENCES
 * (ISE-099, SYS-008, SYS-009).
 *
 * Chaque ecriture passe par une fonction de 0053 qui revalide la regle
 * en base : un niveau de visibilite hors `allowed_levels` est refuse par
 * la base, pas seulement par le formulaire (CA-SET-01), et un canal
 * interdit par le catalogue est refuse de meme (D-80).
 */

/** ISE-099 — visibilite d'un champ (D-73, D-74). */
export async function setFieldVisibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const fieldKey = formData.get('fieldKey');
  const visibility = formData.get('visibility');
  const label = formData.get('label');

  if (
    typeof fieldKey !== 'string' ||
    fieldKey.length === 0 ||
    typeof visibility !== 'string' ||
    visibility.length === 0
  ) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_field_visibility', {
    p_field_key: fieldKey,
    p_visibility: visibility,
  });
  if (error) {
    console.error('[ISE] visibilite de champ en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.privacy);
  return success(
    ts(frSettings.privacy.updated, {
      field: typeof label === 'string' && label.length > 0 ? label : fieldKey,
      level: frSettings.visibility[visibility] ?? visibility,
    }),
  );
}

/** ISE-099 — preference de notification pour un type (D-80). */
export async function setNotificationPreferenceAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const typeCode = formData.get('typeCode');
  const inApp = formData.get('inApp');
  const emailMode = formData.get('emailMode');
  const push = formData.get('push');

  if (typeof typeCode !== 'string' || typeCode.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_notification_preference', {
    p_type_code: typeCode,
    p_in_app: inApp === null ? null : inApp === 'true',
    p_email_mode: typeof emailMode === 'string' && emailMode.length > 0 ? emailMode : null,
    p_push: push === null ? null : push === 'true',
  });
  if (error) {
    console.error('[ISE] preference de notification en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.notifications);
  return success(frSettings.saved);
}

/**
 * ISE-099 — compte et sollicitations.
 *
 * C-08 : `p_direct_message_policy` et `p_show_read_receipts` sont
 * desormais toujours NULL. La RPC les traite en `coalesce(param, colonne)`
 * — NULL signifie « inchange » — donc les valeurs deja enregistrees sont
 * CONSERVEES telles quelles, sans etre ni lues ni ecrites par l'interface.
 * Leur unique consommateur, `private.can_message_profile()`, a disparu
 * avec la messagerie ISE<->ISE (migration 0128).
 */
export async function updateMemberSettingsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const digest = formData.get('emailDigestFrequency');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('update_my_settings', {
    p_direct_message_policy: null,
    p_show_read_receipts: null,
    p_appear_in_matching: formData.get('appearInMatching') === 'true',
    p_appear_in_attendee_lists: formData.get('appearInAttendeeLists') === 'true',
    p_email_digest_frequency: typeof digest === 'string' && digest.length > 0 ? digest : null,
    p_notification_preset: null,
  });
  if (error) {
    console.error('[ISE] mise a jour des reglages en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.account);
  revalidatePath(SETTINGS_ROUTES.overview);
  return success(frSettings.saved);
}

/** ISE-099 — desactivation TEMPORAIRE, distincte de la suppression. */
export async function setProfilePausedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const paused = formData.get('paused') === 'true';
  const reason = formData.get('reason');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_profile_paused', {
    p_paused: paused,
    p_reason: typeof reason === 'string' && reason.length > 0 ? reason : null,
  });
  if (error) {
    console.error('[ISE] mise en pause en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.account);
  return success(
    paused
      ? 'Votre profil est en pause. Vos données sont conservées.'
      : 'Votre profil est de nouveau visible dans le réseau.',
  );
}

/** SYS-009 — consentement versionne. Une revocation est une NOUVELLE trace. */
export async function recordConsentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const consentType = formData.get('consentType');
  const version = formData.get('version');
  const granted = formData.get('granted') === 'true';

  if (
    typeof consentType !== 'string' ||
    consentType.length === 0 ||
    typeof version !== 'string' ||
    version.length === 0
  ) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('record_consent', {
    p_consent_type: consentType,
    p_version: version,
    p_granted: granted,
  });
  if (error) {
    console.error('[ISE] enregistrement de consentement en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.data);
  return success(
    granted
      ? 'Votre consentement est enregistré, daté et versionné.'
      : 'Votre révocation est enregistrée. La trace précédente est conservée, comme la loi l’exige.',
  );
}

/** ISE-099 — deblocage depuis « Membres bloqués ». */
export async function unblockProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const profileId = formData.get('profileId');
  if (typeof profileId !== 'string' || profileId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('unblock_profile', { p_profile_id: profileId });
  if (error) {
    console.error('[ISE] deblocage en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }
  revalidatePath(SETTINGS_ROUTES.blocked);
  return success(frSettings.blocked.unblocked);
}

/**
 * SYS-008 — SUPPRESSION DU COMPTE (D-19, MASTER PROMPT §48).
 *
 * L'action exige la confirmation exacte « SUPPRIMER ». Elle n'est JAMAIS
 * mise en file d'attente hors connexion (§46) : elle s'execute
 * immediatement ou echoue, et le formulaire le dit.
 *
 * Ce qui disparait : le compte. Ce qui reste : le PROFIL REFERENCE, qui
 * redevient un profil non reclame de l'annuaire ISE.
 */
export async function deleteMyAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const confirmation = formData.get('confirmation');

  if (typeof confirmation !== 'string' || confirmation.trim().toUpperCase() !== 'SUPPRIMER') {
    return failure(frSettings.data.deleteWrongConfirmation, correlationId, {
      confirmation: frSettings.data.deleteWrongConfirmation,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('delete_my_account', { p_confirmation: 'SUPPRIMER' });
  if (error) {
    console.error('[ISE] suppression de compte en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  await supabase.auth.signOut();
  redirect(ROUTES.signIn);
}
