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
 * ISE-004 — Definition d'un nouveau mot de passe.
 * L'operation n'est possible que dans une session de recuperation ouverte par
 * le lien recu par e-mail ; le compte est ensuite deconnecte pour forcer une
 * reconnexion avec le nouveau mot de passe.
 */
export async function resetPasswordAction(
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
    console.error('[ISE] réinitialisation refusée', { correlationId, code: error.code });
    return failure(authErrorMessage(error), correlationId);
  }

  await supabase.auth.signOut();
  redirect(`${ROUTES.signIn}?raison=mot-de-passe-modifie`);
}
