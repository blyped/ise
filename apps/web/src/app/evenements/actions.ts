'use server';

import { revalidatePath } from 'next/cache';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { frContent } from '@/i18n/content';
import { CONTENT_ROUTES, eventFollowupRoute, eventRoute } from '@/lib/routes/content';
import {
  cancelEventRegistration,
  declareEventOutcome,
  deleteEventOutcome,
  registerToEvent,
  setEventRegistrationListed,
  type EventAnswer,
} from '@/lib/queries/content';

/**
 * Server Actions de la tranche ACTUALITES & EVENEMENTS.
 *
 * Aucune ne touche `news.editorial_status` ni `landing_visibility` : le
 * circuit editorial et l'exposition publique appartiennent au CMS
 * (D-128, D-131). Aucune n'ecrit `attended` : la presence se constate,
 * elle ne se declare pas depuis cet ecran (D-55).
 */

function one(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function registerAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const eventId = one(formData, 'eventId');
  const correlationId = newCorrelationId();

  const answers: EventAnswer[] = [];
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('question:') && typeof value === 'string' && value.trim().length > 0) {
      answers.push({ questionId: key.slice('question:'.length), answer: value.trim() });
    }
  }

  const result = await registerToEvent(eventId, answers, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(eventRoute(eventId));
  revalidatePath(CONTENT_ROUTES.events);

  const message =
    result.data === 'waitlisted'
      ? frContent.events.waitlistedBadge
      : result.data === 'pending_approval'
        ? frContent.events.pendingBadge
        : frContent.events.registeredBadge;
  return success(message);
}

export async function cancelRegistrationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = one(formData, 'eventId');
  const correlationId = newCorrelationId();

  const result = await cancelEventRegistration(eventId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(eventRoute(eventId));
  revalidatePath(CONTENT_ROUTES.events);
  return success(frContent.events.cancelledBadge);
}

export async function setListedAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = one(formData, 'eventId');
  const listed = one(formData, 'listed') === 'true';
  const correlationId = newCorrelationId();

  const result = await setEventRegistrationListed(eventId, listed, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(eventRoute(eventId));
  return success(frContent.eventDetail.listedSave);
}

/** ISE-096 — le membre déclare une suite constatée (D-55). */
export async function declareOutcomeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = one(formData, 'eventId');
  const outcomeType = one(formData, 'outcomeType');
  const targetProfileId = one(formData, 'targetProfileId');
  const notes = one(formData, 'notes');
  const correlationId = newCorrelationId();

  if (notes.length < 3) {
    return failure('Précisez la suite que vous déclarez.', correlationId, {
      notes: 'Ce champ est obligatoire.',
    });
  }

  const result = await declareEventOutcome(
    {
      eventId,
      outcomeType,
      targetEntityType: targetProfileId.length > 0 ? 'profile' : null,
      targetEntityId: targetProfileId.length > 0 ? targetProfileId : null,
      notes,
    },
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(eventFollowupRoute(eventId));
  return success(frContent.followup.declareSuccess);
}

export async function deleteOutcomeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = one(formData, 'eventId');
  const outcomeId = one(formData, 'outcomeId');
  const correlationId = newCorrelationId();

  const result = await deleteEventOutcome(outcomeId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(eventFollowupRoute(eventId));
  return success(frContent.followup.remove);
}
