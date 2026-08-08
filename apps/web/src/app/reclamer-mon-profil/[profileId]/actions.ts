'use server';

import { redirect } from 'next/navigation';
import { claimSubmitSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';

/**
 * ISE-006 — Demander l'association d'un profil reference.
 *
 * L'action ne decide RIEN : elle valide la saisie puis appelle la fonction
 * atomique `public.submit_profile_claim`. C'est la base qui verrouille le
 * profil, refuse les doublons, applique la limitation de debit et decide de
 * l'approbation automatique par e-mail historique (migration 0029).
 * Reimplementer l'une de ces regles ici serait un second endroit ou se
 * tromper (MASTER PROMPT §113).
 */
export async function submitClaimAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = claimSubmitSchema.safeParse({
    profileId: formData.get('profileId'),
    claimMethod: formData.get('claimMethod'),
    confirmsIdentity: formData.get('confirmsIdentity') === 'on',
    declaredDetails: {},
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('submit_profile_claim', {
    p_profile_id: parsed.data.profileId,
    p_claim_method: parsed.data.claimMethod,
    p_declared_details: parsed.data.declaredDetails,
  });

  if (error) {
    // Jamais le message brut de PostgreSQL vers l'interface (D-102).
    console.error('[ISE] soumission de reclamation en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  // L'issue — approbation immediate ou revue humaine — est lue par ISE-007
  // depuis la base : l'ecran ne la deduit pas de sa propre requete.
  redirect(ROUTES.claimVerification);
}
