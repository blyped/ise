'use server';

import { revalidatePath } from 'next/cache';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import type { FormState } from '@/lib/form-state';
import { requiredText, runCmsAction, text } from '@/lib/cms/action-support';
import { setLandingPillar } from '@/lib/cms/mutations';

const PILLAR_KEYS = ['connecter', 'entraider', 'collaborer', 'impacter'] as const;

/**
 * Server Action de CMS-011 (0114) — pose l'image, la légende optionnelle et
 * le lien d'UN pilier a la fois. Le titre et le corps du pilier restent
 * fixes (fr.public.pillars) : cette action n'y touche jamais.
 */
export async function setPillarAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const pillarKeyRaw = requiredText(formData, 'pillarKey');
  if (!(PILLAR_KEYS as readonly string[]).includes(pillarKeyRaw)) {
    return {
      status: 'error',
      message: 'Pilier inconnu.',
      correlationId: null,
      fieldErrors: {},
    };
  }
  const pillarKey = pillarKeyRaw as (typeof PILLAR_KEYS)[number];
  const mediaId = text(formData, 'mediaId');
  const caption = text(formData, 'caption');
  const linkTarget = text(formData, 'linkTarget');

  const state = await runCmsAction(
    'cms.edit',
    (correlationId) => setLandingPillar(pillarKey, mediaId, caption, linkTarget, correlationId),
    frCms.pillars.done,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.pillars);
  return state;
}
