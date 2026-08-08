'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import {
  checkbox,
  integer,
  requiredText,
  runCmsAction,
  runCmsPublishAction,
  text,
  validationFailure,
} from '@/lib/cms/action-support';
import {
  publishCmsContent,
  rollbackCmsContent,
  swapSectionOrder,
  transitionCmsContent,
  updateSection,
  type SectionDraft,
} from '@/lib/cms/mutations';
import { CMS_ENTITY_TYPES, CMS_SOURCE_MODES } from '@/lib/cms/types';

/**
 * Server Actions des sections d'accueil (CMS-003, ADDENDUM §33).
 *
 * `is_structural` n'est pas modifiable : c'est une propriete du squelette
 * de la landing, pas un reglage editorial. Une section structurelle se
 * masque (`is_enabled = false`), elle ne se supprime pas — et la RLS le
 * refuserait de toute facon (`DELETE` exige `cms.publish` ET
 * `not is_structural`).
 */

const sectionSchema = z
  .object({
    title: z.string().trim().nullable(),
    subtitle: z.string().trim().nullable(),
    isEnabled: z.boolean(),
    sourceMode: z.enum(CMS_SOURCE_MODES),
    maxItems: z.number().int().min(0, 'Entre 0 et 24.').max(24, 'Entre 0 et 24.'),
    ctaLabel: z.string().trim().nullable(),
    ctaEntityType: z.enum(CMS_ENTITY_TYPES).nullable(),
    ctaEntityId: z.string().uuid('Identifiant de cible invalide.').nullable(),
  })
  .refine((value) => (value.ctaEntityType === null) === (value.ctaEntityId === null), {
    message: 'Indiquez le type ET l’identifiant de la cible, ou aucun des deux.',
    path: ['ctaEntityId'],
  });

function readSection(formData: FormData): SectionDraft | { error: z.ZodError } {
  const parsed = sectionSchema.safeParse({
    title: text(formData, 'title'),
    subtitle: text(formData, 'subtitle'),
    isEnabled: checkbox(formData, 'isEnabled'),
    sourceMode: requiredText(formData, 'sourceMode') || 'automatic',
    maxItems: integer(formData, 'maxItems', 3),
    ctaLabel: text(formData, 'ctaLabel'),
    ctaEntityType: text(formData, 'ctaEntityType'),
    ctaEntityId: text(formData, 'ctaEntityId'),
  });
  if (!parsed.success) return { error: parsed.error };
  return parsed.data;
}

export async function updateSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionId = requiredText(formData, 'sectionId');
  const draft = readSection(formData);
  if ('error' in draft) return validationFailure(draft.error);

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => updateSection(sectionId, draft, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}

/**
 * Activation / desactivation rapide. C'est le geste que le brief attend
 * de la version Mobile du CMS (§54) : consulter, ACTIVER, programmer,
 * valider — sans passer par le formulaire complet.
 */
export async function toggleSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionId = requiredText(formData, 'sectionId');
  const enable = requiredText(formData, 'enable') === 'true';

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      updateSection(
        sectionId,
        {
          title: text(formData, 'title'),
          subtitle: text(formData, 'subtitle'),
          isEnabled: enable,
          sourceMode: requiredText(formData, 'sourceMode') || 'automatic',
          maxItems: integer(formData, 'maxItems', 3),
          ctaLabel: text(formData, 'ctaLabel'),
          ctaEntityType: text(formData, 'ctaEntityType'),
          ctaEntityId: text(formData, 'ctaEntityId'),
        },
        correlationId,
      ),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}

export async function reorderSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      swapSectionOrder(
        {
          id: requiredText(formData, 'currentId'),
          displayOrder: integer(formData, 'currentOrder', 0),
        },
        { id: requiredText(formData, 'otherId'), displayOrder: integer(formData, 'otherOrder', 0) },
        correlationId,
      ),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}

export async function publishSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionId = requiredText(formData, 'sectionId');
  const state = await runCmsPublishAction('cms.publish', (correlationId) =>
    publishCmsContent('cms_section', sectionId, correlationId),
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}

export async function unpublishSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionId = requiredText(formData, 'sectionId');
  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) =>
      transitionCmsContent('cms_section', sectionId, 'archived', null, correlationId),
    frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}

export async function rollbackSectionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const sectionId = requiredText(formData, 'sectionId');
  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) => rollbackCmsContent('cms_section', sectionId, correlationId),
    frCms.common.rolledBack,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.sections);
  return state;
}
