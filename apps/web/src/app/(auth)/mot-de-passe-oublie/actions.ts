'use server';

import { forgotPasswordSchema } from '@ise/validation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { newCorrelationId } from '@/lib/correlation';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { ROUTES } from '@/lib/routes';
import { fr } from '@/i18n/fr';

/**
 * ISE-003 — Mot de passe oublie.
 * La reponse est identique que l'adresse existe ou non : reveler l'existence
 * d'un compte permettrait d'enumerer les membres.
 */
export async function forgotPasswordAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const env = publicEnv();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_SITE_URL}${ROUTES.authCallback}?suivant=${encodeURIComponent(ROUTES.resetPassword)}`,
  });

  if (error) {
    // Journalise, mais jamais montre : la reponse reste volontairement neutre.
    console.error('[ISE] envoi du lien de réinitialisation', { correlationId, code: error.code });
  }

  return success(fr.auth.forgotPassword.sentBody);
}
