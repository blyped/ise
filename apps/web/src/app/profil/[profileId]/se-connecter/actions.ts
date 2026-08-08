'use server';

import { redirect } from 'next/navigation';
import { connectionRequestSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sentRequestRoute } from '@/lib/routes/network';

/**
 * ISE-038 — Envoyer une demande de connexion.
 *
 * L'action ne decide RIEN : elle valide la saisie avec le meme schema que
 * le client, puis appelle `public.send_connection_request()` (0039).
 * C'est la base qui verrouille le profil destinataire, refuse le doublon,
 * refuse la relation existante, applique le blocage et la limitation de
 * debit (D-103, 30/jour). Rejouer l'une de ces regles ici serait un
 * second endroit ou se tromper (MASTER PROMPT §113).
 */
export async function sendConnectionRequestAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const rawMessage = formData.get('message');
  const rawContext = formData.get('context');

  const parsed = connectionRequestSchema.safeParse({
    addresseeProfileId: formData.get('addresseeProfileId'),
    ...(typeof rawMessage === 'string' && rawMessage.trim().length > 0
      ? { message: rawMessage }
      : {}),
    ...(typeof rawContext === 'string' && rawContext.length > 0 ? { context: rawContext } : {}),
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('send_connection_request', {
    p_addressee_profile_id: parsed.data.addresseeProfileId,
    p_message: parsed.data.message ?? null,
    p_context: parsed.data.context ?? null,
  });

  if (error) {
    console.error('[ISE] envoi de demande de connexion en echec', {
      correlationId,
      code: error.code,
    });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as { request_id?: unknown };
  const requestId = typeof payload.request_id === 'string' ? payload.request_id : null;

  if (requestId === null) {
    // La demande est partie, mais l'identifiant n'est pas exploitable :
    // on ne fabrique pas une page de confirmation sur une supposition.
    return failure(BUSINESS_ERRORS.unknown, correlationId);
  }

  // ISE-039 lit l'etat REEL de la demande en base : l'ecran de
  // confirmation ne le deduit pas de sa propre requete.
  redirect(sentRequestRoute(requestId));
}
