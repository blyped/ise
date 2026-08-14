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
  runCmsPublishAction,
  text,
  validationFailure,
} from '@/lib/cms/action-support';
import {
  removeLandingOrganization,
  setLandingOrganization,
} from '@/lib/cms/landing-organizations';

/**
 * Server Actions de CMS-013 (0133) — section « logos » de la page d'accueil.
 *
 * `runCmsPublishAction` et non `runCmsAction` : ces deux ecritures changent
 * IMMEDIATEMENT ce que voit un visiteur, sans passer par un cycle
 * brouillon/publication. Le cache cible de PUB-001 doit donc etre invalide
 * dans la foulee (§46), et le message dit si l'invalidation a eu lieu — on ne
 * pretend jamais avoir purge un cache qu'on n'a pas purge.
 *
 * La permission demandee est `cms.edit`, la meme que celle que la fonction
 * `set_landing_organization()` verifie en base. Le controle cote application
 * ne protege rien : il produit un message francais plutot qu'une erreur 42501.
 */

const organizationSchema = z.object({
  organizationId: z.string().uuid('Choisissez une organisation.'),
  mediaId: z.string().uuid('Logo invalide : choisissez-le dans la médiathèque.').nullable(),
  displayOrder: z
    .number()
    .int('L’ordre doit être un nombre entier.')
    .min(0, 'L’ordre va de 0 à 999.')
    .max(999, 'L’ordre va de 0 à 999.'),
});

export async function setLandingOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = organizationSchema.safeParse({
    organizationId: requiredText(formData, 'organizationId'),
    mediaId: text(formData, 'mediaId'),
    displayOrder: integer(formData, 'displayOrder', 0),
  });
  if (!parsed.success) return validationFailure(parsed.error);

  const isPublished = checkbox(formData, 'isPublished');

  const state = await runCmsPublishAction(
    'cms.edit',
    (correlationId) =>
      setLandingOrganization(
        parsed.data.organizationId,
        parsed.data.mediaId,
        parsed.data.displayOrder,
        isPublished,
        correlationId,
      ),
    frCms.landingOrganizations.done,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingOrganizations);
  return state;
}

export async function removeLandingOrganizationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const organizationId = requiredText(formData, 'organizationId');

  const state = await runCmsPublishAction(
    'cms.edit',
    (correlationId) => removeLandingOrganization(organizationId, correlationId),
    frCms.landingOrganizations.removed,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.landingOrganizations);
  return state;
}
