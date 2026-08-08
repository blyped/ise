'use server';

import { redirect } from 'next/navigation';
import { introductionRequestSchema } from '@ise/validation';
import { BUSINESS_ERRORS, toBusinessError } from '@ise/domain';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { introductionRoute } from '@/lib/routes/network';

/**
 * ISE-044 — Demander une introduction.
 *
 * L'action valide la saisie puis appelle `public.request_introduction()`
 * (0039). C'est la base qui verifie les DEUX maillons du chemin — je
 * suis en relation avec l'intermediaire, ET l'intermediaire est en
 * relation avec la personne visee (D-51) —, le blocage, le doublon et la
 * limitation de debit (D-103). Rien de tout cela n'est rejoue ici.
 */
export async function requestIntroductionAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const rawToTarget = formData.get('messageToTarget');

  const parsed = introductionRequestSchema.safeParse({
    intermediaryProfileId: formData.get('intermediaryProfileId'),
    targetProfileId: formData.get('targetProfileId'),
    purpose: formData.get('purpose'),
    messageToIntermediary: formData.get('messageToIntermediary'),
    ...(typeof rawToTarget === 'string' && rawToTarget.trim().length > 0
      ? { messageToTarget: rawToTarget }
      : {}),
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('request_introduction', {
    p_intermediary_profile_id: parsed.data.intermediaryProfileId,
    p_target_profile_id: parsed.data.targetProfileId,
    p_purpose: parsed.data.purpose,
    p_message_to_intermediary: parsed.data.messageToIntermediary,
    p_message_to_target: parsed.data.messageToTarget ?? null,
  });

  if (error) {
    console.error('[ISE] demande d’introduction en echec', { correlationId, code: error.code });
    return failure(toBusinessError(error, correlationId).userMessage, correlationId);
  }

  const payload = (data ?? {}) as { introduction_id?: unknown };
  const introductionId =
    typeof payload.introduction_id === 'string' ? payload.introduction_id : null;

  if (introductionId === null) {
    return failure(BUSINESS_ERRORS.unknown, correlationId);
  }

  // ISE-045 relit l'etat reel : l'ecran de suivi ne suppose pas que la
  // demande est en attente parce qu'on vient de l'envoyer.
  redirect(introductionRoute(introductionId));
}
