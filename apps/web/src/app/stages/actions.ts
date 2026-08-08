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
  declareApplicationSent,
  declareApplicationStep,
  recordInternshipResult,
  requestInternshipHelp,
  respondToInternshipHelp,
  saveApplicationDraft,
  saveInternshipNeed,
} from '@/lib/queries/internships';
import {
  INTERNSHIP_ROUTES,
  internshipApplicationRoute,
  internshipApplyRoute,
  internshipHelpRoute,
  internshipResultRoute,
} from '@/lib/routes/internships';

/**
 * Server Actions de la tranche STAGES.
 *
 * REGLE CARDINALE (MASTER PROMPT §27, D-55) : `saveDraftAction` prepare,
 * `declareSentAction` DECLARE. Il n'existe aucune troisieme action, et
 * aucune des deux n'envoie quoi que ce soit a une organisation.
 */

export async function saveNeedAction(formData: FormData): Promise<void> {
  const back = INTERNSHIP_ROUTES.preferences;
  const correlationId = newCorrelationId();
  const rawStatus = field(formData, 'status');
  const status: 'draft' | 'active' | 'paused' =
    rawStatus === 'paused' ? 'paused' : rawStatus === 'draft' ? 'draft' : 'active';

  const result = await saveInternshipNeed(
    {
      status,
      internshipType: field(formData, 'internshipType') ?? 'academic',
      objective: field(formData, 'objective'),
      startDate: field(formData, 'startDate'),
      endDate: field(formData, 'endDate'),
      datesFlexible: checkbox(formData, 'datesFlexible'),
      workMode: field(formData, 'workMode') ?? 'on_site',
      remoteAllowed: checkbox(formData, 'remoteAllowed'),
      mobilityInternational: field(formData, 'mobility') ?? 'no',
      visibility: field(formData, 'visibility') ?? 'internship_managers_and_relevant_alumni',
      sectorIds: fieldList(formData, 'sectorIds'),
      countryCodes: fieldList(formData, 'countryCodes'),
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(INTERNSHIP_ROUTES.home);
  redirect(successUrl(back, 'need_saved'));
}

export async function saveDraftAction(formData: FormData): Promise<void> {
  const offerId = requiredField(formData, 'offerId');
  const applicationId = field(formData, 'applicationId');
  const back = internshipApplyRoute(offerId);
  const correlationId = newCorrelationId();

  const result = await saveApplicationDraft(
    applicationId,
    offerId,
    {
      positionTitle: field(formData, 'positionTitle'),
      applicationChannel: field(formData, 'channel'),
      cvStoragePath: field(formData, 'cvPath'),
      message: field(formData, 'message'),
      notes: null,
    },
    correlationId,
  );

  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));
  revalidatePath(back);
  redirect(successUrl(back, 'draft_saved'));
}

/**
 * SEUL chemin vers « envoyée ». Sans date declaree, la base refuse et
 * l'ecran le dit : la plateforme n'a rien constate.
 */
export async function declareSentAction(formData: FormData): Promise<void> {
  const offerId = requiredField(formData, 'offerId');
  const applicationId = requiredField(formData, 'applicationId');
  const back = internshipApplyRoute(offerId);
  const correlationId = newCorrelationId();

  const sentOn = field(formData, 'sentOn');
  const channel = field(formData, 'channel') ?? 'email';
  if (sentOn === null) redirect(errorUrl(back, 'validation_failed', correlationId));

  const result = await declareApplicationSent(
    applicationId,
    channel,
    sentOn as string,
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(INTERNSHIP_ROUTES.applications);
  redirect(successUrl(internshipApplicationRoute(applicationId), 'declared_sent'));
}

export async function declareStepAction(formData: FormData): Promise<void> {
  const applicationId = requiredField(formData, 'applicationId');
  const back = internshipApplicationRoute(applicationId);
  const correlationId = newCorrelationId();

  const toStatus = field(formData, 'toStatus');
  if (toStatus === null) redirect(errorUrl(back, 'validation_failed', correlationId));

  const result = await declareApplicationStep(
    applicationId,
    toStatus as string,
    field(formData, 'occurredOn'),
    field(formData, 'note'),
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'step_declared'));
}

export async function requestHelpAction(formData: FormData): Promise<void> {
  const offerId = requiredField(formData, 'offerId');
  const back = internshipHelpRoute(offerId);
  const correlationId = newCorrelationId();

  const alumniProfileId = field(formData, 'alumniProfileId');
  const requestType = field(formData, 'requestType');
  const message = field(formData, 'message');
  if (alumniProfileId === null || requestType === null || message === null) {
    redirect(errorUrl(back, 'validation_failed', correlationId));
  }

  const result = await requestInternshipHelp(
    alumniProfileId as string,
    requestType as string,
    message as string,
    offerId,
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'help_requested'));
}

export async function respondHelpAction(formData: FormData): Promise<void> {
  const requestId = requiredField(formData, 'requestId');
  const back = INTERNSHIP_ROUTES.alumni;
  const correlationId = newCorrelationId();
  const raw = field(formData, 'decision');
  const decision: 'accept' | 'decline' | 'answer' =
    raw === 'accept' ? 'accept' : raw === 'answer' ? 'answer' : 'decline';

  const result = await respondToInternshipHelp(
    requestId,
    decision,
    field(formData, 'message'),
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(back);
  redirect(successUrl(back, 'help_answered'));
}

export async function recordResultAction(formData: FormData): Promise<void> {
  const applicationId = requiredField(formData, 'applicationId');
  const back = internshipResultRoute(applicationId);
  const correlationId = newCorrelationId();

  const countryCode = field(formData, 'countryCode');
  const startDate = field(formData, 'startDate');
  const endDate = field(formData, 'endDate');
  if (countryCode === null || startDate === null || endDate === null) {
    redirect(errorUrl(back, 'validation_failed', correlationId));
  }

  const rawAttribution = field(formData, 'networkAttribution');
  const networkAttribution: 'direct' | 'partial' | 'none' | 'unknown' =
    rawAttribution === 'direct'
      ? 'direct'
      : rawAttribution === 'partial'
        ? 'partial'
        : rawAttribution === 'none'
          ? 'none'
          : 'unknown';

  const result = await recordInternshipResult(
    applicationId,
    {
      organizationRaw: field(formData, 'organization'),
      countryCode: countryCode as string,
      city: field(formData, 'city'),
      department: field(formData, 'department'),
      startDate: startDate as string,
      endDate: endDate as string,
      workMode: field(formData, 'workMode') ?? 'on_site',
      supervisorName: field(formData, 'supervisorName'),
      supervisorRole: field(formData, 'supervisorRole'),
      placementSource: field(formData, 'placementSource') ?? 'other',
      networkAttribution,
      helperProfileId: field(formData, 'helperProfileId'),
      agreementStatus: field(formData, 'agreementStatus') ?? 'not_started',
    },
    correlationId,
  );
  if (!result.ok) redirect(errorUrl(back, result.error.code, correlationId));

  revalidatePath(INTERNSHIP_ROUTES.applications);
  redirect(successUrl(internshipApplicationRoute(applicationId), 'result_recorded'));
}
