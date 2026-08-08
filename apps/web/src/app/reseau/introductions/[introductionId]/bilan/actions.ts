'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { introductionOutcomeSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NETWORK_ROUTES, introductionRoute } from '@/lib/routes/network';

/**
 * ISE-046 — Declarer le resultat reel d'une introduction.
 *
 * L'action n'ecrit RIEN elle-meme : elle appelle
 * `public.declare_introduction_outcome()` (0039), qui
 *   1. refuse un resultat d'echange tant que `target_responded` n'a pas
 *      ete constate — c'est la traduction en code de l'interdiction
 *      d'ecrire « introduction reussie » sur un simple « intermediaire
 *      accepte » (MASTER PROMPT §25, D-55) ;
 *   2. delegue le changement de statut a
 *      `public.transition_introduction()`, seule voie d'ecriture ;
 *   3. enregistre le resultat, son auteur et sa date.
 *
 * Si la regle 1 est violee, la base repond `invalid_transition` et
 * l'ecran affiche le message metier correspondant. L'interface n'essaie
 * pas de deviner a la place de la base.
 */
export async function declareIntroductionOutcomeAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const rawNote = formData.get('note');

  const parsed = introductionOutcomeSchema.safeParse({
    introductionId: formData.get('introductionId'),
    outcome: formData.get('outcome'),
    ...(typeof rawNote === 'string' && rawNote.trim().length > 0 ? { note: rawNote } : {}),
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('declare_introduction_outcome', {
    p_introduction_id: parsed.data.introductionId,
    p_outcome: parsed.data.outcome,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    console.error('[ISE] declaration de bilan d’introduction en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(introductionRoute(parsed.data.introductionId));
  revalidatePath(NETWORK_ROUTES.introductions);

  redirect(introductionRoute(parsed.data.introductionId));
}
