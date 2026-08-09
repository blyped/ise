'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminPromotionRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import {
  integer,
  requiredText,
  runAdminAction,
  runAdminActionWithPayload,
  text,
  validationError,
} from '@/lib/admin/action-support';

/**
 * Server Actions des promotions (SA-008 -> SA-010).
 *
 * Toutes les ecritures passent par les fonctions `admin_*` (0076/0077),
 * qui exigent `promotions.manage` et journalisent. L'indice de contact
 * d'un membre manquant n'est lisible QU'ICI : sa lecture est une action
 * journalisee en base (`admin_get_missing_member_contact_hint`), pas un
 * affichage.
 */

export async function upsertPromotionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const promotionId = integer(formData, 'promotionId');
  const name = requiredText(formData, 'name');
  const year = integer(formData, 'year');
  const description = text(formData, 'description');
  const estimatedSize = integer(formData, 'estimatedSize');
  const status = text(formData, 'status');

  if (name.length < 3 || year === null || year < 1960 || year > 2100) {
    return validationError(frAdmin.promotions.form.invalid, {
      name: name.length < 3 ? frAdmin.promotions.form.invalid : '',
      year: year === null ? frAdmin.promotions.form.yearHelp : '',
    });
  }

  const state = await runAdminAction(
    ['promotions.manage'],
    'admin_upsert_promotion',
    {
      p_promotion_id: promotionId,
      p_name: name,
      p_graduation_year: year,
      p_description: description,
      p_estimated_size: estimatedSize,
      p_status: status,
    },
    promotionId === null ? frAdmin.promotions.form.created : frAdmin.promotions.form.updated,
  );
  if (state.status === 'success') {
    revalidatePath(ADMIN_ROUTES.promotions);
    if (promotionId !== null) revalidatePath(adminPromotionRoute(promotionId));
  }
  return state;
}

export async function setPromotionManagerAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const promotionId = integer(formData, 'promotionId');
  const profileId = requiredText(formData, 'profileId');
  const managerRole = text(formData, 'managerRole') ?? 'delegate';
  const active = requiredText(formData, 'active') === 'true';

  if (promotionId === null) return validationError(frAdmin.promotions.form.invalid);

  const state = await runAdminAction(
    ['promotions.manage'],
    'admin_set_promotion_manager',
    {
      p_promotion_id: promotionId,
      p_profile_id: profileId,
      p_manager_role: managerRole,
      p_active: active,
    },
    frAdmin.promotions.detail.managerDone,
  );
  if (state.status === 'success') revalidatePath(adminPromotionRoute(promotionId));
  return state;
}

export async function reviewMissingMemberAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const suggestionId = requiredText(formData, 'suggestionId');
  const decision = requiredText(formData, 'decision');
  const matchedProfileId = text(formData, 'matchedProfileId');
  const promotionId = integer(formData, 'promotionId');

  const state = await runAdminAction(
    ['promotions.manage'],
    'admin_review_missing_member_suggestion',
    {
      p_suggestion_id: suggestionId,
      p_decision: decision,
      p_matched_profile_id: matchedProfileId,
    },
    frAdmin.promotions.detail.missingDone,
  );
  if (state.status === 'success' && promotionId !== null) {
    revalidatePath(adminPromotionRoute(promotionId));
  }
  return state;
}

export async function revealContactHintAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const suggestionId = requiredText(formData, 'suggestionId');

  return runAdminActionWithPayload(
    ['promotions.manage'],
    'admin_get_missing_member_contact_hint',
    { p_suggestion_id: suggestionId },
    (payload) => {
      const record =
        payload !== null && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {};
      const hint = typeof record['contact_hint'] === 'string' ? record['contact_hint'] : null;
      return hint !== null ? frAdmin.contactHint.result(hint) : frAdmin.contactHint.none;
    },
  );
}

export async function reviewPromotionSuggestionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const suggestionId = requiredText(formData, 'suggestionId');
  const decision = requiredText(formData, 'decision');
  const reviewNote = text(formData, 'reason');
  const matchedPromotionId = integer(formData, 'matchedPromotionId');

  const state = await runAdminAction(
    ['promotions.manage'],
    'admin_review_promotion_suggestion',
    {
      p_suggestion_id: suggestionId,
      p_decision: decision,
      p_review_note: reviewNote,
      p_matched_promotion_id: matchedPromotionId,
    },
    frAdmin.promotions.suggestions.done,
  );
  if (state.status === 'success') revalidatePath(ADMIN_ROUTES.promotionSuggestions);
  return state;
}
