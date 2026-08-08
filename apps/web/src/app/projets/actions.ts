'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { frProjects } from '@/i18n/projects';
import { PROJECT_ROUTES, projectParticipationRoute, projectRoute } from '@/lib/routes/projects';
import {
  confirmProjectMembership,
  respondProjectInvitation,
  setMilestoneStatus,
  submitProjectInterest,
  withdrawProjectInterest,
  withdrawProjectMembership,
} from '@/lib/queries/projects';

/**
 * Server Actions de la tranche PROJETS & CONSORTIUMS.
 *
 * `submitInterestAction` et `confirmMembershipAction` sont deux gestes
 * distincts et non substituables (MASTER PROMPT §32) : le premier
 * exprime une intention, le second engage la personne et horodate son
 * consentement.
 */

function one(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on' || formData.get(key) === 'true';
}

export async function submitInterestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const roleId = one(formData, 'roleId');
  const message = one(formData, 'message');
  const availabilityNotes = one(formData, 'availabilityNotes');
  const availabilityConfirmed = checked(formData, 'availabilityConfirmed');
  const termsAcknowledged = checked(formData, 'termsAcknowledged');
  const cvConsent = checked(formData, 'cvConsent');
  const correlationId = newCorrelationId();

  const fieldErrors: Record<string, string> = {};
  if (message.length < 20) {
    fieldErrors['message'] = 'Décrivez en quelques lignes ce que vous pouvez prendre en charge.';
  }
  if (!termsAcknowledged) {
    fieldErrors['termsAcknowledged'] = frProjects.contribution.termsRequired;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return failure('Complétez les champs signalés.', correlationId, fieldErrors);
  }

  const result = await submitProjectInterest(
    {
      projectId,
      roleId: roleId.length > 0 ? roleId : null,
      message,
      availabilityNotes: availabilityNotes.length > 0 ? availabilityNotes : null,
      availabilityConfirmed,
      termsAcknowledged,
      cvConsent,
    },
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectRoute(projectId));
  revalidatePath(PROJECT_ROUTES.list);
  redirect(projectRoute(projectId));
}

export async function withdrawInterestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const applicationId = one(formData, 'applicationId');
  const correlationId = newCorrelationId();

  const result = await withdrawProjectInterest(applicationId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectRoute(projectId));
  return success(frProjects.contribution.withdrawSuccess);
}

export async function respondInvitationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const invitationId = one(formData, 'invitationId');
  const response = one(formData, 'response');
  const correlationId = newCorrelationId();

  if (response !== 'accepted' && response !== 'declined' && response !== 'question_asked') {
    return failure('Réponse inconnue.', correlationId);
  }

  const result = await respondProjectInvitation(invitationId, response, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectRoute(projectId));
  return success(
    response === 'accepted'
      ? frProjects.detail.invitationAccepted
      : frProjects.detail.invitationDecline,
  );
}

/** SEUL chemin vers une participation engagée. Consentement horodaté. */
export async function confirmMembershipAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const roleTitle = one(formData, 'roleTitle');
  const compensation = one(formData, 'compensation');
  const consent = checked(formData, 'consent');
  const cvConsent = checked(formData, 'cvConsent');
  const correlationId = newCorrelationId();

  if (!consent) {
    return failure('La confirmation est obligatoire.', correlationId, {
      consent: frProjects.participation.confirmTerms,
    });
  }

  const result = await confirmProjectMembership(
    projectId,
    { role_title: roleTitle, compensation_type: compensation },
    cvConsent,
    correlationId,
  );
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectParticipationRoute(projectId));
  revalidatePath(projectRoute(projectId));
  return success(frProjects.participation.confirmSuccess);
}

export async function withdrawMembershipAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const correlationId = newCorrelationId();

  const result = await withdrawProjectMembership(projectId, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectParticipationRoute(projectId));
  return success(frProjects.participation.withdrawSuccess);
}

export async function setMilestoneAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = one(formData, 'projectId');
  const milestoneId = one(formData, 'milestoneId');
  const status = one(formData, 'status');
  const correlationId = newCorrelationId();

  const result = await setMilestoneStatus(milestoneId, status, correlationId);
  if (!result.ok) return failure(result.error.userMessage, correlationId);

  revalidatePath(projectParticipationRoute(projectId));
  return success(frProjects.participation.milestoneUpdate);
}
