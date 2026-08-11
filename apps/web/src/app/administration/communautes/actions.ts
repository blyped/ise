'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { frAdmin } from '@/i18n/admin';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { ADMIN_ROUTES, adminCommunityRoute } from '@/lib/routes/admin';
import type { FormState } from '@/lib/form-state';
import { failure } from '@/lib/form-state';
import { newCorrelationId } from '@/lib/correlation';
import { readAdminAccess } from '@/lib/admin/permissions';
import { adminRpc } from '@/lib/admin/rpc';
import { integer, requiredText, text, validationError } from '@/lib/admin/action-support';

/**
 * SA-027 — Creation d'une communaute via `admin_create_community`
 * (0099). Communautes curatees : la creation n'est jamais ouverte a un
 * membre (0072). Erreurs metier traduites par `toAdminError` via le
 * dictionnaire partage `frAdmin.errors` (D-102) : les codes propres a
 * cette tranche (`community_missing_required_field`, `invalid_slug`,
 * `slug_already_exists`, `community_discriminant_required`) y ont ete
 * ajoutes.
 */
export async function createCommunityAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const access = await readAdminAccess();
  if (access === null || !access.canAny(['communities.manage'])) {
    return failure(frAdmin.errors['permission_denied'] ?? '', correlationId);
  }

  const name = requiredText(formData, 'name');
  const slug = requiredText(formData, 'slug');
  const description = requiredText(formData, 'description');

  if (name.length < 3 || slug.length === 0 || description.length === 0) {
    return validationError(frAdminCommunities.form.invalid, {
      name: name.length < 3 ? frAdminCommunities.form.invalid : '',
      slug: slug.length === 0 ? frAdminCommunities.form.invalid : '',
    });
  }

  const result = await adminRpc(
    'admin_create_community',
    {
      p_name: name,
      p_slug: slug,
      p_description: description,
      p_community_type: requiredText(formData, 'communityType') || 'thematic',
      p_country_code: text(formData, 'countryCode')?.toUpperCase() ?? null,
      p_sector_id: integer(formData, 'sectorId'),
      p_skill_domain_id: null,
      p_purpose: text(formData, 'purpose'),
      p_charter_text: text(formData, 'charterText'),
      p_visibility: requiredText(formData, 'visibility') || 'network',
      p_join_policy: requiredText(formData, 'joinPolicy') || 'open',
      p_post_moderation_mode: requiredText(formData, 'postModerationMode') || 'immediate',
      p_status: requiredText(formData, 'initialStatus') || 'active',
    },
    correlationId,
    (payload) => payload as { id?: unknown } | null,
  );

  if (!result.ok) {
    return failure(result.error.userMessage, correlationId);
  }

  revalidatePath(ADMIN_ROUTES.communities);
  const newId = result.data !== null && typeof result.data === 'object' ? result.data['id'] : null;
  if (typeof newId === 'string') {
    redirect(adminCommunityRoute(newId));
  }
  return { status: 'success', message: frAdminCommunities.form.created, correlationId: null, fieldErrors: {} };
}
