import { redirect } from 'next/navigation';
import { ROUTES } from '@/lib/routes';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadOnboardingSession } from '@/lib/queries/onboarding';

export const dynamic = 'force-dynamic';

/**
 * Point d'entree de l'onboarding.
 *
 * Il ne rend rien : il relit la POSITION ENREGISTREE EN BASE et renvoie a
 * l'etape correspondante. C'est ce qui permet de fermer l'onglet et de
 * reprendre exactement la ou l'on s'etait arrete, depuis n'importe quel
 * appareil.
 */
export default async function OnboardingEntryPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const result = await loadOnboardingSession(user.id, newCorrelationId());

  // Une lecture en echec ne doit pas bloquer : la premiere etape est
  // idempotente, elle re-affichera l'erreur si elle persiste.
  if (!result.ok) redirect(onboardingRoute(1));
  if (result.data === null) redirect(ROUTES.claimSearch);

  const { profile, progress } = result.data;
  if (profile.onboardingCompletedAt !== null || progress.completedAt !== null) {
    redirect(ROUTES.dashboard);
  }

  redirect(onboardingRoute(progress.currentStep));
}
