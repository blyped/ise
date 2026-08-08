'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { frCommunities } from '@/i18n/communities';
import { COMMUNITY_ROUTES, communityPostRoute, communityRoute } from '@/lib/routes/communities';
import {
  addCommunityComment,
  createCommunityPost,
  joinCommunity,
  leaveCommunity,
  markCommentHelpful,
  resolveCommunityPost,
  setCommunityNotification,
} from '@/lib/queries/communities';

/**
 * Server Actions de la tranche COMMUNAUTES.
 *
 * Aucune ne fabrique de donnee : chacune relaie un geste explicite vers
 * une fonction atomique de la migration 0072 et rend le message metier
 * traduit par `BusinessError`, jamais le message PostgreSQL brut (D-102).
 */

function one(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/* ------------------------------------------------------------------ */
/* Adhesion                                                            */
/* ------------------------------------------------------------------ */

export async function joinCommunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const correlationId = newCorrelationId();
  if (communityId.length === 0) {
    return failure(frCommunities.common.notFoundTitle, correlationId);
  }

  const result = await joinCommunity(communityId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(COMMUNITY_ROUTES.list);
  revalidatePath(communityRoute(communityId));
  return success(
    result.data === 'pending'
      ? frCommunities.detail.pendingNotice
      : frCommunities.common.memberBadge,
  );
}

export async function leaveCommunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const correlationId = newCorrelationId();
  if (communityId.length === 0) {
    return failure(frCommunities.common.notFoundTitle, correlationId);
  }

  const result = await leaveCommunity(communityId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(COMMUNITY_ROUTES.list);
  revalidatePath(communityRoute(communityId));
  return success(frCommunities.detail.leave);
}

export async function setNotificationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const level = one(formData, 'level');
  const digest = one(formData, 'digest');
  const correlationId = newCorrelationId();

  const result = await setCommunityNotification(communityId, level, digest, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(communityRoute(communityId));
  return success(frCommunities.detail.notificationSave);
}

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export async function createPostAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const postType = one(formData, 'postType');
  const title = one(formData, 'title');
  const body = one(formData, 'body');
  const visibility = one(formData, 'visibility') || 'community';
  const correlationId = newCorrelationId();

  const fieldErrors: Record<string, string> = {};
  if (title.length < 8) fieldErrors['title'] = 'Le titre doit compter au moins 8 caractères.';
  if (title.length > 240) fieldErrors['title'] = 'Le titre ne peut pas dépasser 240 caractères.';
  if (body.length < 20) fieldErrors['body'] = 'Décrivez le contexte en quelques lignes.';
  if (Object.keys(fieldErrors).length > 0) {
    return failure('Complétez les champs signalés.', correlationId, fieldErrors);
  }

  const skillIds = formData
    .getAll('skillIds')
    .map((raw) => Number.parseInt(String(raw), 10))
    .filter((value) => Number.isFinite(value));

  const result = await createCommunityPost(
    { communityId, postType, title, body, visibility, skillIds },
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(communityRoute(communityId));
  redirect(communityPostRoute(communityId, result.data.postId));
}

export async function addCommentAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const postId = one(formData, 'postId');
  const body = one(formData, 'body');
  const parentId = one(formData, 'parentId');
  const correlationId = newCorrelationId();

  if (body.length < 2) {
    return failure('Écrivez votre réponse avant de l’envoyer.', correlationId, {
      body: 'Ce champ est obligatoire.',
    });
  }

  const result = await addCommunityComment(
    postId,
    body,
    parentId.length > 0 ? parentId : null,
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(communityPostRoute(communityId, postId));
  return success(frCommunities.tracking.replySubmit);
}

export async function markHelpfulAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const postId = one(formData, 'postId');
  const commentId = one(formData, 'commentId');
  const helpful = one(formData, 'helpful') === 'true';
  const correlationId = newCorrelationId();

  const result = await markCommentHelpful(commentId, helpful, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(communityPostRoute(communityId, postId));
  return success(
    helpful ? frCommunities.tracking.markHelpful : frCommunities.tracking.unmarkHelpful,
  );
}

export async function resolvePostAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const communityId = one(formData, 'communityId');
  const postId = one(formData, 'postId');
  const summary = one(formData, 'summary');
  const correlationId = newCorrelationId();

  if (summary.length < 20) {
    return failure('La synthèse est trop courte.', correlationId, {
      summary: frCommunities.tracking.resolveHelp,
    });
  }

  const result = await resolveCommunityPost(postId, summary, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(communityPostRoute(communityId, postId));
  return success(frCommunities.tracking.resolvedTitle);
}
