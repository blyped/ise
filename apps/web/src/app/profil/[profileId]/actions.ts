'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';

/**
 * ISE-037 — BLOCAGE d'un membre depuis sa fiche profil.
 *
 * POURQUOI CETTE ACTION EXISTE
 *   `public.block_profile()` (0016), la table `public.profile_blocks` et
 *   l'ecran de deblocage `/parametres/membres-bloques` n'ont jamais cesse
 *   de fonctionner. Ce qui avait disparu avec la messagerie (decision
 *   C-08), c'est le SEUL point d'entree qui permettait d'appeler la
 *   fonction. On rouvre le point d'entree ; on ne reecrit aucun mecanisme.
 *
 * POURQUOI ON REDIRIGE APRES COUP
 *   Le blocage est bidirectionnel et `private.can_see_profile()` l'evalue
 *   AVANT toute visibilite : une fois bloque, `get_member_profile()`
 *   renvoie `null` et cette meme page devient un 404. Rester dessus
 *   afficherait « ce profil n'existe pas » juste apres avoir bloque —
 *   deroutant et faux. On renvoie donc vers « Membres bloques », qui est
 *   l'ecran ou le blocage se constate et se defait.
 */
export async function blockProfileAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const profileId = formData.get('profileId');

  if (typeof profileId !== 'string' || profileId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('block_profile', {
    p_profile_id: profileId,
    p_reason: null,
  });

  if (error) {
    console.error('[ISE] blocage en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(SETTINGS_ROUTES.blocked);
  redirect(SETTINGS_ROUTES.blocked);
}
