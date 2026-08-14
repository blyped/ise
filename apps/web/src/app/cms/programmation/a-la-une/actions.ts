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
  addLandingQueueEntry,
  moveLandingQueueEntry,
  removeLandingQueueEntry,
  setFeaturedRotation,
  setLandingQueueDefaultDays,
  type LandingQueueSection,
} from '@/lib/cms/landing-queue';

/**
 * Server Actions de la file « À la une du réseau » (0121).
 *
 * Ce fichier ne décide de rien : chaque action transporte une demande vers
 * une fonction `SECURITY DEFINER` qui revérifie la permission, verrouille
 * la section et journalise. Les contrôles ci-dessous ne servent qu'à
 * produire un message français plutôt qu'une erreur SQL brute.
 *
 * D-128 : aucune de ces actions ne touche au circuit éditorial. Programmer
 * un passage, c'est décider de l'EXPOSITION, pas de la publication.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_TYPES = ['news', 'event', 'opportunity'] as const;
const SECTIONS = ['news', 'events', 'opportunities'] as const;

function invalid(message: string, field: string, detail: string): FormState {
  return {
    status: 'error',
    message,
    correlationId: null,
    fieldErrors: { [field]: detail },
  };
}

export async function addQueueEntryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const entityType = requiredText(formData, 'entityType');
  const entityId = requiredText(formData, 'entityId');

  if (!(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return invalid('Type de contenu inconnu.', 'entityType', frCms.common.requiredField);
  }
  if (!UUID.test(entityId)) {
    return invalid('Choisissez un contenu dans la liste.', 'entityId', 'Contenu non reconnu.');
  }

  const startsAt = timestamp(formData, 'startsAt');
  const endsAt = timestamp(formData, 'endsAt');
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return invalid('La fin doit suivre le début.', 'endsAt', 'La fin doit suivre le début.');
  }

  const state = await runCmsPublishAction(
    'cms.schedule',
    (correlationId) =>
      addLandingQueueEntry(
        entityType as (typeof ENTITY_TYPES)[number],
        entityId,
        startsAt,
        endsAt,
        text(formData, 'reason'),
        correlationId,
      ),
    'Passage ajouté à la file.',
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingQueue);
  return state;
}

export async function moveQueueEntryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const entryId = requiredText(formData, 'entryId');
  const direction = requiredText(formData, 'direction');
  if (direction !== 'up' && direction !== 'down') {
    return invalid('Sens de déplacement inconnu.', 'direction', frCms.common.requiredField);
  }

  const state = await runCmsPublishAction(
    'cms.schedule',
    (correlationId) => moveLandingQueueEntry(entryId, direction, correlationId),
    'Ordre de la file mis à jour.',
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingQueue);
  return state;
}

export async function removeQueueEntryAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const entryId = requiredText(formData, 'entryId');

  const state = await runCmsPublishAction(
    'cms.schedule',
    (correlationId) => removeLandingQueueEntry(entryId, correlationId),
    'Passage retiré de la file.',
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingQueue);
  return state;
}

/**
 * Cadence par défaut d'un encart (0124).
 *
 * Remplace la constante de sept jours qui était écrite en dur dans
 * `add_landing_queue_entry()` et décidait, sans que personne ne puisse la
 * voir, du rythme de la file. Les bornes 1–90 sont celles de la contrainte
 * en base : on les revérifie ici seulement pour rendre un message français.
 */
export async function setPassageDurationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionKey = requiredText(formData, 'sectionKey');
  if (!(SECTIONS as readonly string[]).includes(sectionKey)) {
    return invalid('Encart inconnu.', 'sectionKey', frCms.common.requiredField);
  }

  const days = integer(formData, 'passageDays', 7);
  if (days < 1 || days > 90) {
    return invalid(
      'La durée doit être comprise entre 1 et 90 jours.',
      'passageDays',
      'Entre 1 et 90.',
    );
  }

  const state = await runCmsPublishAction(
    'cms.schedule',
    (correlationId) =>
      setLandingQueueDefaultDays(sectionKey as LandingQueueSection, days, correlationId),
    'Durée de passage enregistrée. Les passages déjà programmés gardent leurs dates.',
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingQueue);
  return state;
}

export async function setRotationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const days = integer(formData, 'intervalDays', 1);
  if (days < 1 || days > 90) {
    return invalid(
      'La fréquence doit être comprise entre 1 et 90 jours.',
      'intervalDays',
      'Entre 1 et 90.',
    );
  }

  const state = await runCmsAction(
    'cms.featured_profile.manage',
    (correlationId) => setFeaturedRotation(days, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingQueue);
  return state;
}
