'use server';

import { revalidatePath } from 'next/cache';
import { introductionTransitionSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NETWORK_ROUTES, introductionRoute } from '@/lib/routes/network';

/**
 * ISE-045 — Faire avancer une introduction.
 *
 * TOUTE transition passe par `public.transition_introduction()`
 * (migration 0006). Aucune politique `UPDATE` n'est ouverte aux clients
 * sur `introduction_requests`, et c'est voulu : la matrice
 * acteur × etat × etat d'arrivee (D-50) vit en base, sous verrou, et
 * journalise chaque passage dans `introduction_events`.
 *
 * L'interface ne propose que les transitions rendues par
 * `introductionMachine.available(statut, acteur)` — le miroir TypeScript
 * de cette matrice. Si les deux divergeaient, la base gagnerait ; c'est
 * la raison d'etre du miroir.
 *
 * `completed` et `no_outcome` sont ABSENTS du schema : ils exigent une
 * declaration de resultat et passent par ISE-046.
 */
export async function transitionIntroductionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const rawNote = formData.get('note');

  const parsed = introductionTransitionSchema.safeParse({
    introductionId: formData.get('introductionId'),
    toStatus: formData.get('toStatus'),
    ...(typeof rawNote === 'string' && rawNote.trim().length > 0 ? { note: rawNote } : {}),
  });

  if (!parsed.success) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_introduction', {
    p_introduction_id: parsed.data.introductionId,
    p_to_status: parsed.data.toStatus,
    p_note: parsed.data.note ?? null,
  });

  if (error) {
    console.error('[ISE] transition d’introduction en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(introductionRoute(parsed.data.introductionId));
  revalidatePath(NETWORK_ROUTES.introductions);

  return success('L’étape a été enregistrée.');
}
