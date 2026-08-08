'use server';

import { revalidatePath } from 'next/cache';
import { connectionResponseSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, success, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NETWORK_ROUTES } from '@/lib/routes/network';

/**
 * Reponses a une demande de connexion — ISE-039, ISE-041, ISE-042.
 *
 * TROIS chemins, et trois seulement :
 *
 *   accepter  -> `public.accept_connection_request()` (migration 0006).
 *                JAMAIS un `update` depuis le client : la fonction pose
 *                le verrou, refuse une seconde acceptation et cree la
 *                relation dans la MEME transaction. Un `update` client
 *                laisserait une demande « accepted » sans relation.
 *   decliner  -> `public.respond_to_connection_request(..., 'declined')`.
 *   retirer   -> `public.respond_to_connection_request(..., 'withdrawn')`.
 *
 * « Ignorer » n'est pas ici, et n'existe nulle part : ignorer une
 * invitation n'ecrit rien. La demande reste `pending` jusqu'a son
 * expiration (D-55).
 */

/** ISE-041 / ISE-042 — Accepter une invitation. */
export async function acceptConnectionRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();
  const requestId = formData.get('requestId');

  if (typeof requestId !== 'string' || requestId.length === 0) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('accept_connection_request', {
    p_request_id: requestId,
  });

  if (error) {
    console.error('[ISE] acceptation de demande de connexion en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(NETWORK_ROUTES.invitations);
  revalidatePath(NETWORK_ROUTES.connections);
  return success('La relation est établie.');
}

/** ISE-039 / ISE-041 / ISE-042 — Decliner ou retirer. */
export async function respondToConnectionRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = connectionResponseSchema.safeParse({
    requestId: formData.get('requestId'),
    decision: formData.get('decision'),
  });

  if (!parsed.success) {
    return failure(BUSINESS_ERRORS.validation_failed, correlationId);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('respond_to_connection_request', {
    p_request_id: parsed.data.requestId,
    p_to_status: parsed.data.decision,
    p_reason: null,
  });

  if (error) {
    console.error('[ISE] reponse a une demande de connexion en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  revalidatePath(NETWORK_ROUTES.invitations);
  revalidatePath(NETWORK_ROUTES.connections);
  return success(
    parsed.data.decision === 'declined'
      ? 'L’invitation a été déclinée. Aucun motif n’a été transmis.'
      : 'Votre demande a été retirée.',
  );
}
