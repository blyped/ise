import { redirect } from 'next/navigation';
import { BUSINESS_ERRORS } from '@ise/domain';
import { onboardingStepNumber, type OnboardingStepSlug } from '@ise/validation';
import { ROUTES } from '@/lib/routes';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadOnboardingSession, type OnboardingSession } from '@/lib/queries/onboarding';

export interface OnboardingGuardOk {
  ok: true;
  userId: string;
  accountEmail: string;
  accountConfirmed: boolean;
  session: OnboardingSession;
  step: number;
  correlationId: string;
}

export interface OnboardingGuardFailed {
  ok: false;
  correlationId: string;
  message: string;
}

export type OnboardingGuard = OnboardingGuardOk | OnboardingGuardFailed;

/**
 * Garde commune aux 7 etapes.
 *
 * Trois sorties, toutes reelles :
 *  · pas de session       -> ecran de session expiree ;
 *  · compte sans profil   -> reclamation (ISE-005), rien a onboarder ;
 *  · onboarding termine   -> tableau de bord.
 *
 * Et une regle de parcours : on ne saute pas une etape. Demander l'etape 5
 * alors que la base n'en a enregistre que 2 renvoie a l'etape 2 — la
 * position fait foi cote SERVEUR, jamais cote navigateur.
 */
export async function requireOnboardingStep(
  slug: OnboardingStepSlug,
  options: { allowCompleted?: boolean } = {},
): Promise<OnboardingGuard> {
  const step = onboardingStepNumber(slug);
  const correlationId = newCorrelationId();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
  if (!user) redirect(ROUTES.sessionExpired);

  const result = await loadOnboardingSession(user.id, correlationId);
  if (!result.ok) {
    return { ok: false, correlationId, message: result.error.userMessage };
  }

  const session = result.data;
  if (session === null) redirect(ROUTES.claimSearch);

  const completed =
    session.profile.onboardingCompletedAt !== null || session.progress.completedAt !== null;
  if (completed && options.allowCompleted !== true) redirect(ROUTES.dashboard);

  if (step > session.progress.furthestStep) {
    redirect(onboardingRoute(session.progress.furthestStep));
  }

  return {
    ok: true,
    userId: user.id,
    accountEmail: user.email ?? '',
    accountConfirmed: Boolean(user.email_confirmed_at),
    session,
    step,
    correlationId,
  };
}

/**
 * Variante pour les Server Actions : elles n'affichent rien, elles ont
 * besoin du profil ou d'une erreur metier.
 */
export async function currentOnboardingProfile(
  correlationId: string,
): Promise<{ ok: true; session: OnboardingSession } | { ok: false; message: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, message: BUSINESS_ERRORS.not_authenticated };

  const result = await loadOnboardingSession(user.id, correlationId);
  if (!result.ok) return { ok: false, message: result.error.userMessage };
  if (result.data === null) return { ok: false, message: BUSINESS_ERRORS.not_found };

  return { ok: true, session: result.data };
}
