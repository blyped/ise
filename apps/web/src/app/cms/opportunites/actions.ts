'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import {
  integer,
  requiredText,
  runCmsAction,
  runCmsPublishAction,
  text,
  timestamp,
} from '@/lib/cms/action-support';
import {
  createScheduleOrder,
  pinEntityInSection,
  setLandingCoverMedia,
  setLandingExposure,
  unpinEntityInSection,
} from '@/lib/cms/mutations';

/**
 * Server Actions des opportunites (CMS-006bis, 0113).
 *
 * SOURCE REELLE : `public.opportunities`. Aucun champ metier (statut,
 * moderation, description, remuneration, contact, URL de candidature) n'est
 * modifiable ici (ADDENDUM §13) — miroir exact des evenements (CMS-005).
 * Le CMS pilote : la visibilite landing, la priorite, l'epinglage temporaire
 * (override borne dans le temps, §43), et depuis 0113 le visuel de
 * couverture (FK vers la mediatheque publique).
 */

const OPPORTUNITIES_SECTION_KEY = 'opportunities';

export async function setOpportunityLandingVisibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const visible = requiredText(formData, 'visible') === 'true';

  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) =>
      setLandingExposure(
        'opportunity',
        opportunityId,
        visible ? 'visible' : 'hidden',
        null,
        correlationId,
      ),
    visible ? frCms.common.published : frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.opportunities);
  return state;
}

export async function setOpportunityPriorityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const priority = integer(formData, 'priority', 0);
  if (priority < 0 || priority > 1000) {
    return {
      status: 'error',
      message: 'La priorité doit être comprise entre 0 et 1000.',
      correlationId: null,
      fieldErrors: { priority: 'Entre 0 et 1000.' },
    };
  }

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      setLandingExposure('opportunity', opportunityId, null, priority, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.opportunities);
  return state;
}

export async function toggleOpportunityPinAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const pin = requiredText(formData, 'pin') === 'true';
  const endsAt = timestamp(formData, 'pinEndsAt');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      pin
        ? pinEntityInSection(
            OPPORTUNITIES_SECTION_KEY,
            'opportunity',
            opportunityId,
            endsAt,
            text(formData, 'reason'),
            correlationId,
          )
        : unpinEntityInSection(OPPORTUNITIES_SECTION_KEY, opportunityId, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.opportunities);
  return state;
}

export async function setOpportunityCoverMediaAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const mediaId = text(formData, 'mediaId');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => setLandingCoverMedia('opportunity', opportunityId, mediaId, correlationId),
    frCms.opportunities.coverDone,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.opportunities);
  return state;
}

export async function scheduleOpportunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const opportunityId = requiredText(formData, 'opportunityId');
  const publishAt = timestamp(formData, 'publishAt');
  const unpublishAt = timestamp(formData, 'unpublishAt');

  if (publishAt === null && unpublishAt === null) {
    return {
      status: 'error',
      message: 'Indiquez au moins une date de publication ou de dépublication.',
      correlationId: null,
      fieldErrors: { publishAt: frCms.common.requiredField },
    };
  }
  if (
    publishAt !== null &&
    unpublishAt !== null &&
    Date.parse(unpublishAt) <= Date.parse(publishAt)
  ) {
    return {
      status: 'error',
      message: 'La date de fin doit suivre la date de début.',
      correlationId: null,
      fieldErrors: { unpublishAt: 'La fin doit suivre le début.' },
    };
  }

  const state = await runCmsAction(
    'cms.schedule',
    (correlationId) =>
      createScheduleOrder('opportunity', opportunityId, publishAt, unpublishAt, correlationId),
    frCms.schedule.created,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.opportunities);
    revalidatePath(CMS_ROUTES.schedule);
  }
  return state;
}
