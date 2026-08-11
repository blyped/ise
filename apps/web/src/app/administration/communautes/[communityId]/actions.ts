'use server';

import { revalidatePath } from 'next/cache';
import { frAdmin } from '@/i18n/admin';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { ADMIN_ROUTES, adminCommunityRoute } from '@/lib/routes/admin';
import { failure, type FormState } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { requiredText, runAdminAction, text } from '@/lib/admin/action-support';

/**
 * SA-028 — Edition du contenu d'une communaute via `admin_update_community`
 * (0099). Le type, le pays/secteur discriminant et le slug ne sont pas
 * editables ici (immuables apres creation, comme l'annee d'une
 * promotion) : seuls le contenu et les politiques le sont.
 */
export async function updateCommunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['communities.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const communityId = requiredText(formData, 'communityId');
  const name = requiredText(formData, 'name');
  const description = requiredText(formData, 'description');
  if (communityId.length === 0 || name.length < 3 || description.length === 0) {
    return failure(frAdminCommunities.form.invalid, correlationId, {
      name: name.length < 3 ? frAdminCommunities.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_update_community',
    {
      p_community_id: communityId,
      p_name: name,
      p_description: description,
      p_purpose: text(formData, 'purpose'),
      p_charter_text: text(formData, 'charterText'),
      p_visibility: text(formData, 'visibility'),
      p_join_policy: text(formData, 'joinPolicy'),
      p_post_moderation_mode: text(formData, 'postModerationMode'),
    },
    correlationId,
    (payload) => payload,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(adminCommunityRoute(communityId));
  revalidatePath(ADMIN_ROUTES.communities);
  return { status: 'success', message: frAdminCommunities.form.edited, correlationId: null, fieldErrors: {} };
}

/**
 * SA-028 — Transition de cycle de vie via `admin_set_community_status`
 * (0099) : draft/active/inactive/archived. La fusion ('merged') passe
 * par `mergeCommunityAction`, qui exige la communaute cible.
 */
export async function setCommunityStatusAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = requiredText(formData, 'communityId');
  const status = requiredText(formData, 'status');

  const state = await runAdminAction(
    ['communities.manage'],
    'admin_set_community_status',
    { p_community_id: communityId, p_status: status, p_merged_into_community_id: null },
    frAdminCommunities.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminCommunityRoute(communityId));
    revalidatePath(ADMIN_ROUTES.communities);
  }
  return state;
}

/**
 * SA-028 — Fusion d'une communaute dans une autre via
 * `admin_set_community_status` (0099, p_status = 'merged'). Aucune
 * donnee (publications, membres) n'est deplacee automatiquement : la
 * fusion marque seulement la communaute d'origine et la relie a la
 * cible.
 */
export async function mergeCommunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = requiredText(formData, 'communityId');
  const mergedIntoCommunityId = requiredText(formData, 'mergedIntoCommunityId');

  const state = await runAdminAction(
    ['communities.manage'],
    'admin_set_community_status',
    { p_community_id: communityId, p_status: 'merged', p_merged_into_community_id: mergedIntoCommunityId },
    frAdminCommunities.detail.done,
  );
  if (state.status === 'success') {
    revalidatePath(adminCommunityRoute(communityId));
    revalidatePath(ADMIN_ROUTES.communities);
  }
  return state;
}

/**
 * SA-029 — Moderation d'une publication via `admin_moderate_community_post`
 * (0099) : masquer / restaurer / retirer / verrouiller, motif
 * obligatoire (>= 10 caracteres, revalide en base), journalisee dans
 * `community_moderation_actions`.
 */
export async function moderatePostAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const postId = requiredText(formData, 'postId');
  const communityId = requiredText(formData, 'communityId');
  const action = requiredText(formData, 'action');
  const reason = requiredText(formData, 'reason');

  const state = await runAdminAction(
    ['communities.manage'],
    'admin_moderate_community_post',
    { p_post_id: postId, p_action: action, p_reason_text: reason },
    frAdminCommunities.detail.postDone,
  );
  if (state.status === 'success') revalidatePath(adminCommunityRoute(communityId));
  return state;
}
