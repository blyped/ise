'use server';

import { redirect } from 'next/navigation';
import { signInSchema } from '@ise/validation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { newCorrelationId } from '@/lib/correlation';
import { authErrorMessage } from '@/lib/auth-errors';
import { failure, fieldErrorsFromZod, type FormState } from '@/lib/form-state';
import { safeRedirect } from '@/lib/public/safe-redirect';

/**
 * ISE-001 — Connexion.
 * Le schema Zod partage est rejoue ici : la validation client n'a valeur que
 * de confort, le serveur reste l'autorite (MASTER PROMPT §62).
 *
 * ADDENDUM §4 et §5 : la cible de retour repasse par `safeRedirect`, meme si
 * la page l'a deja validee. L'action est appelable directement, avec un
 * `FormData` fabrique : elle ne peut rien tenir pour acquis.
 */
export async function signInAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    rememberMe: formData.get('rememberMe') === 'on',
  });

  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    console.error('[ISE] connexion refusée', { correlationId, code: error.code });
    return failure(authErrorMessage(error), correlationId);
  }

  const target = safeRedirect(formData.get('redirectTo'), {
    source: 'ISE-001 (action)',
    correlationId,
  });
  redirect(target);
}
