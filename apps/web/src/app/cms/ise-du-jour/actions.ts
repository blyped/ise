'use server';

import { revalidatePath } from 'next/cache';
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
  timestamp,
} from '@/lib/cms/action-support';
import {
  excludeProfileFromFeatured,
  overrideFeaturedProfile,
  setFeaturedAutomation,
  updateFeaturedRules,
} from '@/lib/cms/mutations';

/**
 * Server Actions de « ISE du jour » (CMS-006, ADDENDUM §36 et §22).
 *
 * LES OVERRIDES SONT AUDITABLES. Ce n'est pas une promesse de cet ecran :
 * `override_featured_profile()`, `exclude_profile_from_featured()` et
 * `set_featured_profile_automation()` appellent toutes
 * `private.log_audit()` avec l'acteur, la periode et le motif. Aucune
 * ecriture directe n'est possible dans `cms_featured_profile_history` —
 * la table n'a AUCUNE politique d'ecriture (docs/rls.md §11.2). C'est ce
 * qui garantit la piste d'audit, pas le code ci-dessous.
 *
 * L'override REFUSE un profil non eligible : il ne contourne pas le
 * consentement du membre (`allow_public_feature`).
 */

export async function toggleAutomationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const enabled = requiredText(formData, 'enabled') === 'true';
  const state = await runCmsPublishAction(
    'cms.featured_profile.manage',
    (correlationId) => setFeaturedAutomation(enabled, text(formData, 'reason'), correlationId),
    enabled ? frCms.featured.automationOn : frCms.featured.automationOff,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.featuredProfile);
  return state;
}

export async function overrideProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  if (profileId.length === 0) {
    return {
      status: 'error',
      message: frCms.common.requiredField,
      correlationId: null,
      fieldErrors: { profileId: frCms.common.requiredField },
    };
  }

  const startsAt = timestamp(formData, 'startsAt');
  const endsAt = timestamp(formData, 'endsAt');
  if (startsAt !== null && endsAt !== null && Date.parse(endsAt) <= Date.parse(startsAt)) {
    return {
      status: 'error',
      message: 'La fin doit suivre le début.',
      correlationId: null,
      fieldErrors: { endsAt: 'La fin doit suivre le début.' },
    };
  }

  const state = await runCmsPublishAction(
    'cms.featured_profile.manage',
    (correlationId) =>
      overrideFeaturedProfile(profileId, startsAt, endsAt, text(formData, 'reason'), correlationId),
    frCms.featured.overrideDone,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.featuredProfile);
  return state;
}

export async function excludeProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profileId = requiredText(formData, 'profileId');
  if (profileId.length === 0) {
    return {
      status: 'error',
      message: frCms.common.requiredField,
      correlationId: null,
      fieldErrors: { profileId: frCms.common.requiredField },
    };
  }

  const state = await runCmsPublishAction(
    'cms.featured_profile.manage',
    (correlationId) =>
      excludeProfileFromFeatured(
        profileId,
        timestamp(formData, 'until'),
        text(formData, 'reason'),
        correlationId,
      ),
    frCms.featured.excludeDone,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.featuredProfile);
  return state;
}

export async function updateRulesAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const minDays = integer(formData, 'minDaysBetweenFeatures', 90);
  if (minDays < 1 || minDays > 3650) {
    return {
      status: 'error',
      message: 'Le délai doit être compris entre 1 et 3650 jours.',
      correlationId: null,
      fieldErrors: { minDaysBetweenFeatures: 'Entre 1 et 3650.' },
    };
  }

  const state = await runCmsAction(
    'cms.featured_profile.manage',
    (correlationId) =>
      updateFeaturedRules(
        {
          minDaysBetweenFeatures: minDays,
          requireClaimedProfile: checkbox(formData, 'requireClaimedProfile'),
          requireAvatar: checkbox(formData, 'requireAvatar'),
          requirePromotion: checkbox(formData, 'requirePromotion'),
          requireExpertiseOrPosition: checkbox(formData, 'requireExpertiseOrPosition'),
          balanceDimension: requiredText(formData, 'balanceDimension') || 'promotion',
        },
        correlationId,
      ),
    frCms.common.saved,
  );
  if (state.status === 'success') revalidatePath(CMS_ROUTES.featuredProfile);
  return state;
}
