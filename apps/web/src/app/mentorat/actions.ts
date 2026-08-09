'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import {
  checkbox,
  errorUrl,
  field,
  fieldList,
  requiredField,
  successUrl,
} from '@/lib/collaborate-feedback';
import {
  acceptMentorshipAlternative,
  cancelMentorshipRequest,
  logMentorshipSession,
  respondToMentorshipRequest,
  saveMentorProfile,
  saveMentorshipNeed,
  setMentorshipItem,
  submitMentorshipFeedback,
  submitMentorshipRequest,
  transitionMentorship,
} from '@/lib/queries/mentorship';
import {
  MENTORSHIP_ROUTES,
  mentorshipRequestRoute,
  mentorshipReviewRoute,
  mentorshipRoute,
} from '@/lib/routes/mentorship';

/**
 * Server Actions de la tranche MENTORAT (ISE-078 -> ISE-083).
 *
 * DEUX REGLES CARDINALES :
 *   * Aucune action ne transporte ni ne produit de score (MASTER
 *     PROMPT §30) — elles ne font que passer des champs declares.
 *   * `respondRequestAction` accepte, decline SANS motif obligatoire
 *     ([F 59]) ou propose un autre format (D-54) ; c'est le demandeur
 *     qui accepte ou refuse l'alternative (`answerAlternativeAction`).
 */

export async function saveNeedAction(formData: FormData): Promise<void> {
  const back = MENTORSHIP_ROUTES.need;
  const correlationId = newCorrelationId();

  const objectiveText = field(formData, 'objectiveText');
  if (objectiveText === null) redirect(errorUrl(back, 'validation_failed', correlationId));

  const sectorId = field(formData, 'sectorId');
  const result = await saveMentorshipNeed(
    {
      objectiveType: field(formData, 'objectiveType') ?? 'other',
      objectiveText: objectiveText as string,
      topics: fieldList(formData, 'topics'),
      mentorPreference: field(formData, 'mentorPreference'),
      constraintsText: field(formData, 'constraints'),
      preferredFormat: field(formData, 'preferredFormat') ?? 'three_months',
      preferredFrequency: field(formData, 'preferredFrequency'),
      sectorId,
      countryCode: field(formData, 'countryCode'),
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(MENTORSHIP_ROUTES.home);
  redirect(successUrl(MENTORSHIP_ROUTES.recommendations, 'need_saved'));
}

export async function saveMentorProfileAction(formData: FormData): Promise<void> {
  const back = MENTORSHIP_ROUTES.becomeMentor;
  const correlationId = newCorrelationId();

  const rawCapacity = field(formData, 'maxActiveMentees');
  const capacity = rawCapacity === null ? 2 : Number.parseInt(rawCapacity, 10);

  const result = await saveMentorProfile(
    {
      isActive: !checkbox(formData, 'pause'),
      mentorStatement: field(formData, 'statement'),
      maxActiveMentees: Number.isNaN(capacity) ? 2 : capacity,
      preferredFormats: fieldList(formData, 'formats'),
      preferredFrequency: field(formData, 'frequency'),
      acceptedObjectives: fieldList(formData, 'objectives'),
      acceptedAudiences: fieldList(formData, 'audiences'),
      preferredChannels: fieldList(formData, 'channels'),
      availabilityState: field(formData, 'availabilityState') ?? 'available_now',
      availableFrom: field(formData, 'availableFrom'),
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(MENTORSHIP_ROUTES.home);
  redirect(successUrl(MENTORSHIP_ROUTES.home, 'mentor_saved'));
}

/** ISE-082 — la demande n'ouvre AUCUNE relation : le mentor decide. */
export async function submitRequestAction(formData: FormData): Promise<void> {
  const mentorProfileId = requiredField(formData, 'mentorProfileId');
  const back = mentorshipRequestRoute(mentorProfileId);
  const correlationId = newCorrelationId();

  const objectiveText = field(formData, 'objectiveText');
  if (objectiveText === null) redirect(errorUrl(back, 'validation_failed', correlationId));

  const result = await submitMentorshipRequest(
    {
      mentorProfileId,
      objectiveType: field(formData, 'objectiveType') ?? 'other',
      objectiveText: objectiveText as string,
      expectations: fieldList(formData, 'expectations'),
      requestedFormat: field(formData, 'requestedFormat') ?? 'three_months',
      requestedFrequency: field(formData, 'requestedFrequency'),
      currentSituation: field(formData, 'currentSituation'),
      message: field(formData, 'message'),
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(MENTORSHIP_ROUTES.requests);
  redirect(successUrl(`${MENTORSHIP_ROUTES.requests}?onglet=sent`, 'request_sent'));
}

/**
 * Reponse du mentor : accepter, decliner (motif FACULTATIF) ou proposer
 * un autre format (D-54).
 */
export async function respondRequestAction(formData: FormData): Promise<void> {
  const requestId = requiredField(formData, 'requestId');
  const back = MENTORSHIP_ROUTES.requests;
  const correlationId = newCorrelationId();

  const raw = field(formData, 'decision');
  const decision: 'accept' | 'decline' | 'propose_alternative' =
    raw === 'accept' ? 'accept' : raw === 'propose_alternative' ? 'propose_alternative' : 'decline';

  const result = await respondToMentorshipRequest(
    requestId,
    decision,
    {
      declineReason: field(formData, 'declineReason'),
      alternativeFormat: field(formData, 'alternativeFormat'),
      alternativeMessage: field(formData, 'alternativeMessage'),
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(back);

  if (decision === 'accept' && result.data.mentorshipId !== null) {
    redirect(successUrl(mentorshipRoute(result.data.mentorshipId), 'respond_done'));
  }
  redirect(
    successUrl(back, decision === 'propose_alternative' ? 'alternative_sent' : 'respond_done'),
  );
}

/** Le DEMANDEUR repond a l'alternative proposee (D-54). */
export async function answerAlternativeAction(formData: FormData): Promise<void> {
  const requestId = requiredField(formData, 'requestId');
  const back = `${MENTORSHIP_ROUTES.requests}?onglet=sent`;
  const correlationId = newCorrelationId();
  const accept = field(formData, 'accept') === 'true';

  const result = await acceptMentorshipAlternative(requestId, accept, correlationId);
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(MENTORSHIP_ROUTES.requests);

  if (accept && result.data.mentorshipId !== null) {
    redirect(successUrl(mentorshipRoute(result.data.mentorshipId), 'alternative_answered'));
  }
  redirect(successUrl(back, 'alternative_answered'));
}

export async function cancelRequestAction(formData: FormData): Promise<void> {
  const requestId = requiredField(formData, 'requestId');
  const back = `${MENTORSHIP_ROUTES.requests}?onglet=sent`;
  const correlationId = newCorrelationId();

  const result = await cancelMentorshipRequest(requestId, correlationId);
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(MENTORSHIP_ROUTES.requests);
  redirect(successUrl(back, 'request_cancelled'));
}

/** Pause, reprise, cloture, arret — motif toujours facultatif ([U 102]). */
export async function transitionAction(formData: FormData): Promise<void> {
  const mentorshipId = requiredField(formData, 'mentorshipId');
  const back = mentorshipRoute(mentorshipId);
  const correlationId = newCorrelationId();

  const toStatus = field(formData, 'toStatus');
  if (toStatus === null) redirect(errorUrl(back, 'validation_failed', correlationId));

  const result = await transitionMentorship(
    mentorshipId,
    toStatus as string,
    field(formData, 'reason'),
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'transition_done'));
}

export async function setItemAction(formData: FormData): Promise<void> {
  const mentorshipId = requiredField(formData, 'mentorshipId');
  const back = mentorshipRoute(mentorshipId);
  const correlationId = newCorrelationId();

  const rawKind = field(formData, 'kind');
  const kind: 'goal' | 'action' = rawKind === 'action' ? 'action' : 'goal';
  const itemId = field(formData, 'itemId');
  const title = field(formData, 'title');
  if (itemId === null && title === null) {
    redirect(errorUrl(back, 'validation_failed', correlationId));
  }

  const result = await setMentorshipItem(
    mentorshipId,
    kind,
    itemId,
    title,
    field(formData, 'status'),
    field(formData, 'dueOn'),
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'item_saved'));
}

export async function logSessionAction(formData: FormData): Promise<void> {
  const mentorshipId = requiredField(formData, 'mentorshipId');
  const back = mentorshipRoute(mentorshipId);
  const correlationId = newCorrelationId();

  const result = await logMentorshipSession(
    mentorshipId,
    {
      sessionId: field(formData, 'sessionId'),
      scheduledAt: field(formData, 'scheduledAt'),
      format: field(formData, 'format'),
      topic: field(formData, 'topic'),
      sharedSummary: field(formData, 'sharedSummary'),
      privateNote: field(formData, 'privateNote'),
      status: field(formData, 'status') ?? 'planned',
    },
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'session_saved'));
}

/** ISE-083 — bilan. Jamais de note publique (CA-MENT-09). */
export async function submitFeedbackAction(formData: FormData): Promise<void> {
  const mentorshipId = requiredField(formData, 'mentorshipId');
  const back = mentorshipReviewRoute(mentorshipId);
  const correlationId = newCorrelationId();

  const result = await submitMentorshipFeedback(
    mentorshipId,
    {
      usefulness: field(formData, 'usefulness'),
      objectiveProgress: field(formData, 'objectiveProgress'),
      objectiveReached: field(formData, 'objectiveReached'),
      outcomeType: field(formData, 'outcomeType'),
      comment: field(formData, 'comment'),
      platformFeedback: field(formData, 'platformFeedback'),
      publicTestimonialConsent: checkbox(formData, 'testimonialConsent'),
      testimonialText: field(formData, 'testimonialText'),
      isAnonymousTestimonial: checkbox(formData, 'testimonialAnonymous'),
    },
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(mentorshipRoute(mentorshipId));
  redirect(successUrl(mentorshipRoute(mentorshipId), 'review_done'));
}
