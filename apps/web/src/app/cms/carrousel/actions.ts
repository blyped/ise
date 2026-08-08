'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES, carouselItemRoute } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import {
  checkbox,
  integer,
  requiredText,
  runCmsAction,
  runCmsPublishAction,
  text,
  timestamp,
  validationFailure,
} from '@/lib/cms/action-support';
import {
  createCarouselItem,
  deleteCarouselItem,
  publishCmsContent,
  rollbackCmsContent,
  swapCarouselPriority,
  transitionCmsContent,
  updateCarouselItem,
  type CarouselDraft,
} from '@/lib/cms/mutations';
import { CMS_CONTENT_TYPES, CMS_ENTITY_TYPES } from '@/lib/cms/types';

/**
 * Server Actions du carrousel (CMS-002, ADDENDUM §32).
 *
 * Le STATUT n'est jamais ecrit ici : `publishSlideAction` et
 * `transitionSlideAction` appellent les fonctions serveur atomiques, qui
 * verifient `cms.publish`, verrouillent la ligne, figent l'instantane et
 * journalisent. Une ecriture directe serait de toute facon refusee par le
 * trigger `cms_guard_publication_state()`.
 */

const draftSchema = z
  .object({
    title: z.string().trim().min(3, 'Le titre doit compter au moins 3 caractères.'),
    subtitle: z.string().trim().nullable(),
    description: z.string().trim().nullable(),
    mediaId: z.string().uuid().nullable(),
    mobileMediaId: z.string().uuid().nullable(),
    contentType: z.enum(CMS_CONTENT_TYPES),
    entityType: z.enum(CMS_ENTITY_TYPES).nullable(),
    entityId: z.string().uuid('Identifiant de ressource invalide.').nullable(),
    ctaLabel: z.string().trim().nullable(),
    startAt: z.string().nullable(),
    endAt: z.string().nullable(),
    priority: z.number().int().min(0).max(1000),
    partnerCampaignId: z.string().uuid().nullable(),
  })
  // La contrainte `cms_carousel_items_entity_pair` exige les deux ou aucun.
  // On le verifie ici pour rendre un message utile plutot qu'un 23514.
  .refine((value) => (value.entityType === null) === (value.entityId === null), {
    message: 'Indiquez le type ET l’identifiant de la ressource, ou aucun des deux.',
    path: ['entityId'],
  })
  .refine(
    (value) =>
      value.startAt === null ||
      value.endAt === null ||
      Date.parse(value.endAt) > Date.parse(value.startAt),
    { message: 'La fin de diffusion doit suivre le début.', path: ['endAt'] },
  );

function readDraft(formData: FormData): CarouselDraft | { error: z.ZodError } {
  const parsed = draftSchema.safeParse({
    title: requiredText(formData, 'title'),
    subtitle: text(formData, 'subtitle'),
    description: text(formData, 'description'),
    mediaId: text(formData, 'mediaId'),
    mobileMediaId: text(formData, 'mobileMediaId'),
    contentType: requiredText(formData, 'contentType') || 'institutional',
    entityType: text(formData, 'entityType'),
    entityId: text(formData, 'entityId'),
    ctaLabel: text(formData, 'ctaLabel'),
    startAt: timestamp(formData, 'startAt'),
    endAt: timestamp(formData, 'endAt'),
    priority: integer(formData, 'priority', 0),
    partnerCampaignId: text(formData, 'partnerCampaignId'),
  });
  if (!parsed.success) return { error: parsed.error };
  return parsed.data;
}

export async function createSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const draft = readDraft(formData);
  if ('error' in draft) return validationFailure(draft.error);

  let createdId: string | null = null;
  const state = await runCmsAction(
    'cms.edit',
    async (correlationId) => {
      const result = await createCarouselItem(draft, correlationId);
      if (result.ok) createdId = result.data;
      return result;
    },
    frCms.carousel.createdBody,
  );

  if (state.status === 'success' && createdId !== null) {
    revalidatePath(CMS_ROUTES.carousel);
    redirect(carouselItemRoute(createdId));
  }
  return state;
}

export async function updateSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemId = requiredText(formData, 'itemId');
  const draft = readDraft(formData);
  if ('error' in draft) return validationFailure(draft.error);

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => updateCarouselItem(itemId, draft, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.carousel);
    revalidatePath(carouselItemRoute(itemId));
  }
  return state;
}

export async function publishSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemId = requiredText(formData, 'itemId');
  const state = await runCmsPublishAction('cms.publish', (correlationId) =>
    publishCmsContent('cms_carousel_item', itemId, correlationId),
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.carousel);
  return state;
}

export async function transitionSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemId = requiredText(formData, 'itemId');
  const toStatus = requiredText(formData, 'toStatus');
  const allowed = ['draft', 'scheduled', 'expired', 'archived'] as const;
  if (!(allowed as readonly string[]).includes(toStatus)) {
    return {
      status: 'error',
      message: frCms.common.forbidden,
      correlationId: null,
      fieldErrors: {},
    };
  }

  // Depublier et archiver retirent le contenu du site : le cache doit suivre.
  const state = await runCmsPublishAction(
    toStatus === 'scheduled' ? 'cms.schedule' : 'cms.publish',
    (correlationId) =>
      transitionCmsContent(
        'cms_carousel_item',
        itemId,
        toStatus as (typeof allowed)[number],
        null,
        correlationId,
      ),
    frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.carousel);
  return state;
}

export async function rollbackSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemId = requiredText(formData, 'itemId');
  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) => rollbackCmsContent('cms_carousel_item', itemId, correlationId),
    frCms.common.rolledBack,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.carousel);
  return state;
}

/**
 * Reordonnancement ACCESSIBLE AU CLAVIER (§32).
 *
 * Deux boutons de formulaire, « Monter » et « Descendre ». Ils
 * fonctionnent au clavier parce qu'ils SONT des boutons, pas parce qu'on
 * a ajoute des ecouteurs de touches a une zone de glisser-deposer. Le
 * glisser-deposer n'est pas implemente : il aurait fallu le doubler d'un
 * chemin clavier de toute facon, et ce chemin-la suffit.
 */
export async function reorderSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentId = requiredText(formData, 'currentId');
  const currentPriority = integer(formData, 'currentPriority', 0);
  const otherId = requiredText(formData, 'otherId');
  const otherPriority = integer(formData, 'otherPriority', 0);

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) =>
      swapCarouselPriority(
        { id: currentId, priority: currentPriority },
        { id: otherId, priority: otherPriority },
        correlationId,
      ),
    frCms.carousel.moved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.carousel);
  return state;
}

export async function deleteSlideAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const itemId = requiredText(formData, 'itemId');
  const confirmed = checkbox(formData, 'confirmed');
  const state = await runCmsAction(
    'cms.publish',
    (correlationId) => deleteCarouselItem(itemId, correlationId),
    frCms.common.deleted,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.carousel);
    if (confirmed) redirect(CMS_ROUTES.carousel);
  }
  return state;
}
