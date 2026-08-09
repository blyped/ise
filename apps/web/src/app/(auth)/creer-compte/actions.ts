'use server';

import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { newCorrelationId } from '@/lib/correlation';
import { authErrorMessage } from '@/lib/auth-errors';
import { failure, fieldErrorsFromZod, success, type FormState } from '@/lib/form-state';
import { ROUTES } from '@/lib/routes';
import { safeRedirect } from '@/lib/public/safe-redirect';
import { fr, t } from '@/i18n/fr';
import { signUpFormSchema, signUpInputFrom } from './schema';

/**
 * ISE-002 — Creation de compte et envoi de l'e-mail de confirmation.
 *
 * Creer un compte ne cree PAS un profil ISE (MASTER PROMPT §6) : le prenom et
 * le nom sont seulement conserves dans les metadonnees du compte, et serviront
 * a la reclamation du profil référencé.
 */
export async function signUpAction(_previous: FormState, formData: FormData): Promise<FormState> {
  const correlationId = newCorrelationId();

  const parsed = signUpFormSchema.safeParse(signUpInputFrom(formData));
  if (!parsed.success) {
    return failure(
      BUSINESS_ERRORS.validation_failed,
      correlationId,
      fieldErrorsFromZod(parsed.error),
    );
  }

  const env = publicEnv();
  const supabase = await createSupabaseServerClient();

  // ISE-070 (suite) : une personne invitee sans compte doit retomber sur
  // l'invitation, pas sur le tableau de bord (meme mecanisme que ISE-001).
  const next = safeRedirect(formData.get('redirectTo'), {
    source: 'ISE-002 (action)',
    correlationId,
  });

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}${ROUTES.authCallback}?redirectTo=${encodeURIComponent(next)}`,
      data: {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
      },
    },
  });

  if (error) {
    console.error('[ISE] création de compte refusée', { correlationId, code: error.code });
    return failure(authErrorMessage(error), correlationId);
  }

  // Confirmation d'e-mail desactivee cote projet : la session existe deja.
  if (data.session) {
    redirect(next);
  }

  return success(t(fr.auth.signUp.confirmationBody, { email: parsed.data.email }));
}
