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
  setLandingExposure,
  unpinEntityInSection,
} from '@/lib/cms/mutations';

/**
 * Server Actions des evenements (CMS-005, ADDENDUM §35).
 *
 * SOURCE REELLE : `public.events`. Aucune donnee n'est recopiee, aucun
 * champ metier n'est modifiable ici. Le CMS pilote trois choses :
 *   * la visibilite landing (`landing_visibility`) ;
 *   * la priorite editoriale (`landing_priority`) ;
 *   * la MISE EN AVANT, qui n'est pas une colonne mais un override
 *     `pin` sur la section `events` — la primitive generique du §43.
 *     Elle est bornee dans le temps et expire d'elle-meme.
 *
 * Un evenement passe quitte la landing SANS intervention : la projection
 * publique filtre sur `starts_at > now()`. Il n'y a donc pas de bouton
 * « retirer un evenement passe » : il serait decoratif.
 */

const EVENTS_SECTION_KEY = 'events';

export async function setEventLandingVisibilityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
  const visible = requiredText(formData, 'visible') === 'true';

  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) =>
      setLandingExposure('event', eventId, visible ? 'visible' : 'hidden', null, correlationId),
    visible ? frCms.common.published : frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.events);
  return state;
}

export async function setEventPriorityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
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
    (correlationId) => setLandingExposure('event', eventId, null, priority, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.events);
  return state;
}

export async function toggleEventPinAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
  const pin = requiredText(formData, 'pin') === 'true';
  const endsAt = timestamp(formData, 'pinEndsAt');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      pin
        ? pinEntityInSection(
            EVENTS_SECTION_KEY,
            'event',
            eventId,
            endsAt,
            text(formData, 'reason'),
            correlationId,
          )
        : unpinEntityInSection(EVENTS_SECTION_KEY, eventId, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.events);
  return state;
}

export async function scheduleEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const eventId = requiredText(formData, 'eventId');
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
    (correlationId) => createScheduleOrder('event', eventId, publishAt, unpublishAt, correlationId),
    frCms.schedule.created,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.events);
    revalidatePath(CMS_ROUTES.schedule);
  }
  return state;
}
