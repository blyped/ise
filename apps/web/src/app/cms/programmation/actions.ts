'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import { requiredText, runCmsAction, timestamp } from '@/lib/cms/action-support';
import { cancelScheduleOrder, createScheduleOrder } from '@/lib/cms/mutations';
import { CMS_SCHEDULE_ENTITY_TYPES } from '@/lib/cms/types';

/**
 * Server Actions de la programmation globale (CMS-009, ADDENDUM §40).
 *
 * L'ordre est une DEMANDE, pas une execution : il est traite par
 * `private.publish_scheduled_cms_content()`, toutes les dix minutes. Un
 * ordre ne se declare jamais « applique » depuis un client — le trigger
 * `cms_guard_schedule_state()` le refuse, et il a raison : ce serait
 * affirmer qu'un traitement a eu lieu sans preuve.
 */

export async function createScheduleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const entityType = requiredText(formData, 'entityType');
  const entityId = requiredText(formData, 'entityId');
  const publishAt = timestamp(formData, 'publishAt');
  const unpublishAt = timestamp(formData, 'unpublishAt');

  if (!(CMS_SCHEDULE_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return {
      status: 'error',
      message: 'Type de contenu inconnu.',
      correlationId: null,
      fieldErrors: { entityType: frCms.common.requiredField },
    };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entityId)) {
    return {
      status: 'error',
      message: 'Identifiant de contenu invalide.',
      correlationId: null,
      fieldErrors: { entityId: 'Identifiant invalide.' },
    };
  }
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
      createScheduleOrder(entityType, entityId, publishAt, unpublishAt, correlationId),
    frCms.schedule.created,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.schedule);
  return state;
}

export async function cancelScheduleAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const orderId = requiredText(formData, 'orderId');
  const state = await runCmsAction(
    'cms.schedule',
    (correlationId) => cancelScheduleOrder(orderId, correlationId),
    frCms.schedule.cancelled,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.schedule);
  return state;
}
