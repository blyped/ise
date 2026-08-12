'use server';

import { redirect } from 'next/navigation';
import { resetPasswordSchema } from '@ise/validation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { newCorrelationId } from '@/lib/correlation';
import { authErrorMessage } from '@/lib/auth-errors';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { ROUTES } from '@/lib/routes';

/**
 * D-161 — Activation d'un compte pre-cree : definition du PREMIER mot de
 * passe. Meme validation que ISE-004 (`resetPasswordSchema`), mais a la
 * difference de la reinitialisation, la session est CONSERVEE : la personne
 * vient d'arriver, la renvoyer a l'ecran de connexion serait une friction
 * sans gain (le lien d'activation a deja prouve la possession de la boite
 * mail, exactement comme une connexion reussie).
 */
export async function activateAccountAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirmation: formData.get('passwordConfirmation'),
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return failure(BUSINESS_ERRORS.not_authenticated, correlationId);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    console.error('[ISE] activation refusée', { correlationId, code: error.code });
    return failure(authErrorMessage(error), correlationId);
  }

  redirect(ROUTES.dashboard);
}
