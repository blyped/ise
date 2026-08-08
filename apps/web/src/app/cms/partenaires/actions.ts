'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES, partnerCampaignRoute } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import {
  requiredText,
  runCmsAction,
  runCmsPublishAction,
  text,
  timestamp,
  validationFailure,
} from '@/lib/cms/action-support';
import {
  createCampaign,
  deleteCampaign,
  publishCmsContent,
  rollbackCmsContent,
  transitionCmsContent,
  updateCampaign,
  type CampaignDraft,
} from '@/lib/cms/mutations';
import { CMS_ENTITY_TYPES, CMS_PLACEMENTS } from '@/lib/cms/types';

/**
 * Server Actions des campagnes partenaires (CMS-007, ADDENDUM §37, §26).
 *
 * TRANSPARENCE OBLIGATOIRE. `sponsored_label` est `NOT NULL` avec au moins
 * 3 caracteres utiles : une campagne sans mention ne peut PAS exister en
 * base. Le schema Zod ci-dessous reprend la meme borne, non pas pour
 * proteger — la contrainte le fait — mais pour rendre un message francais
 * plutot qu'une violation 23514.
 */

const campaignSchema = z
  .object({
    organizationId: z.string().uuid('Choisissez une organisation.'),
    campaignName: z.string().trim().min(3, 'Le nom doit compter au moins 3 caractères.'),
    placement: z.enum(CMS_PLACEMENTS),
    title: z.string().trim().nullable(),
    description: z.string().trim().nullable(),
    mediaId: z.string().uuid().nullable(),
    mobileMediaId: z.string().uuid().nullable(),
    ctaLabel: z.string().trim().nullable(),
    targetEntityType: z.enum(CMS_ENTITY_TYPES).nullable(),
    targetEntityId: z.string().uuid('Identifiant de cible invalide.').nullable(),
    targetUrl: z
      .string()
      .trim()
      .regex(/^https:\/\//, 'L’adresse doit commencer par https://')
      .nullable(),
    sponsoredLabel: z
      .string()
      .trim()
      .min(3, 'La mention de transparence est obligatoire (3 caractères minimum).'),
    startAt: z.string().min(1, 'La date de début est obligatoire.'),
    endAt: z.string().min(1, 'La date de fin est obligatoire.'),
  })
  .refine((value) => (value.targetEntityType === null) === (value.targetEntityId === null), {
    message: 'Indiquez le type ET l’identifiant de la ressource, ou aucun des deux.',
    path: ['targetEntityId'],
  })
  .refine((value) => value.targetEntityId !== null || value.targetUrl !== null, {
    message: 'Une campagne doit pointer une ressource interne ou une adresse https.',
    path: ['targetUrl'],
  })
  .refine((value) => Date.parse(value.endAt) > Date.parse(value.startAt), {
    message: 'La fin de campagne doit suivre son début.',
    path: ['endAt'],
  });

function readCampaign(formData: FormData): CampaignDraft | { error: z.ZodError } {
  const parsed = campaignSchema.safeParse({
    organizationId: requiredText(formData, 'organizationId'),
    campaignName: requiredText(formData, 'campaignName'),
    placement: requiredText(formData, 'placement') || 'partners_band',
    title: text(formData, 'title'),
    description: text(formData, 'description'),
    mediaId: text(formData, 'mediaId'),
    mobileMediaId: text(formData, 'mobileMediaId'),
    ctaLabel: text(formData, 'ctaLabel'),
    targetEntityType: text(formData, 'targetEntityType'),
    targetEntityId: text(formData, 'targetEntityId'),
    targetUrl: text(formData, 'targetUrl'),
    sponsoredLabel: requiredText(formData, 'sponsoredLabel'),
    startAt: timestamp(formData, 'startAt') ?? '',
    endAt: timestamp(formData, 'endAt') ?? '',
  });
  if (!parsed.success) return { error: parsed.error };
  return parsed.data;
}

export async function createCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const draft = readCampaign(formData);
  if ('error' in draft) return validationFailure(draft.error);

  let createdId: string | null = null;
  const state = await runCmsAction(
    'cms.partners.manage',
    async (correlationId) => {
      const result = await createCampaign(draft, correlationId);
      if (result.ok) createdId = result.data;
      return result;
    },
    frCms.common.saved,
  );

  if (state.status === 'success' && createdId !== null) {
    revalidatePath(CMS_ROUTES.partners);
    redirect(partnerCampaignRoute(createdId));
  }
  return state;
}

export async function updateCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const draft = readCampaign(formData);
  if ('error' in draft) return validationFailure(draft.error);

  const state = await runCmsAction(
    'cms.partners.manage',
    (correlationId) => updateCampaign(campaignId, draft, correlationId),
    frCms.common.saved,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.partners);
    revalidatePath(partnerCampaignRoute(campaignId));
  }
  return state;
}

export async function publishCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const state = await runCmsPublishAction('cms.publish', (correlationId) =>
    publishCmsContent('cms_partner_campaign', campaignId, correlationId),
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.partners);
  return state;
}

export async function unpublishCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) =>
      transitionCmsContent('cms_partner_campaign', campaignId, 'expired', null, correlationId),
    frCms.common.unpublished,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.partners);
  return state;
}

export async function rollbackCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const state = await runCmsPublishAction(
    'cms.publish',
    (correlationId) => rollbackCmsContent('cms_partner_campaign', campaignId, correlationId),
    frCms.common.rolledBack,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.partners);
  return state;
}

export async function deleteCampaignAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const campaignId = requiredText(formData, 'campaignId');
  const state = await runCmsAction(
    'cms.partners.manage',
    (correlationId) => deleteCampaign(campaignId, correlationId),
    frCms.common.deleted,
  );
  if (state.status === 'success') {
    revalidatePath(CMS_ROUTES.partners);
    redirect(CMS_ROUTES.partners);
  }
  return state;
}
