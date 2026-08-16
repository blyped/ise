'use server';

import { revalidatePath } from 'next/cache';
import { revalidateLanding } from '@/lib/public/revalidate-landing';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { publicShowcaseSchema } from '@ise/validation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/profile-guard';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { frShowcase } from '@/i18n/profile-showcase';
import { toPublicShowcaseInput } from '../form-input';

/**
 * Server Action de la vitrine publique (révision de D-135, migration 0120).
 *
 * D-211 — ce fichier ne porte plus QUE la brève description et le
 * consentement `allowPublicFeature` (paraître comme « ISE du jour »,
 * texte seul). Les trois actions de photo (`publishPublicPhotoAction`,
 * `withdrawPublicPhotoAction`, `updatePublicPhotoCropAction`) ont été
 * retirées de ce fichier : le porteur a demandé un dépôt UNIQUE de photo
 * (celle que le membre choisit pour son profil est celle qui paraît, si
 * consenti, sur l'accueil), donc le dépôt et le consentement de publication
 * de la photo vivent désormais ensemble sur l'écran « Photo de profil »
 * (`mon-profil/en-tete/actions.ts`), aux côtés du cadrage à deux blocs
 * (médaillon + rectangle « ISE du jour »). Voir docs/decisions.md, D-211.
 *
 * LA SÉCURITÉ N'EST PAS ICI. Elle est en base :
 *   · la politique `ise_profiles_update_own` limite l'UPDATE à ma propre
 *     ligne, et le privilège colonne n'est accordé que sur les colonnes que
 *     le membre a le droit d'écrire (`allow_public_feature`, `public_summary`) ;
 *   · le consentement photo (`allow_public_photo`) et les colonnes de
 *     portrait restent gouvernés par les mêmes garde-fous qu'avant (0120,
 *     0141), simplement appelés depuis l'écran photo désormais.
 */

async function refreshShowcase(): Promise<void> {
  revalidatePath(PROFILE_ROUTES.publicShowcase);
  revalidatePath(PROFILE_ROUTES.overview);

  // D-210 — publier/retirer la parution « ISE du jour » (texte) change ce
  // que sert `get_landing_featured_profile()` : purge tolérante à l'échec
  // du cache serveur étiqueté de la landing (voir revalidate-landing.ts).
  try {
    await revalidateLanding();
  } catch (error) {
    console.error('[ISE] invalidation du cache de la landing en echec (vitrine publique)', {
      cause: error instanceof Error ? error.name : 'inconnue',
    });
  }
}

/* ------------------------------------------------------------------ */
/* Brève description et consentement « ISE du jour »                   */
/* ------------------------------------------------------------------ */

export async function savePublicShowcaseAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const parsed = publicShowcaseSchema.safeParse(toPublicShowcaseInput(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      context.correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const input = parsed.data;
  const supabase = await createSupabaseServerClient();

  // `public_photo_*` et `allow_public_photo` ne sont PAS écrits ici (D-211) :
  // ils vivent désormais sur l'écran « Photo de profil ».
  const { error } = await supabase
    .from('ise_profiles')
    .update({
      public_summary: input.publicSummary ?? null,
      allow_public_feature: input.allowPublicFeature,
    })
    .eq('id', context.profile.id);

  if (error) {
    const business = toBusinessError(error, context.correlationId);
    return failure(business.userMessage, context.correlationId);
  }

  await refreshShowcase();
  return success(frShowcase.saved);
}
