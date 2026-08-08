import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES, promotionRoute } from '@/lib/routes/promotions';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadPromotionOverview } from '@/lib/queries/promotions';
import { AppShell } from '@/components/layout/AppShell';
import { LINK_BUTTON } from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.overview.kicker };

/**
 * ISE-067, sans identifiant : la promotion du membre connecte.
 *
 * La resolution se fait cote base (`get_promotion_overview(null)`) puis
 * l'ecran redirige vers l'URL canonique `/promotions/{id}`, celle que
 * la maquette montre dans le fil d'Ariane.
 */
export default async function MyPromotionPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, overview] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadPromotionOverview(null, correlationId),
  ]);

  if (overview.ok && overview.data !== null) {
    redirect(promotionRoute(overview.data.promotionId));
  }

  return (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {overview.ok ? (
        <EmptyState
          title={frPromotions.common.noPromotionTitle}
          description={frPromotions.common.noPromotionBody}
          action={
            <Link href={PROMOTION_ROUTES.hub} className={LINK_BUTTON}>
              {frPromotions.common.back}
            </Link>
          }
        />
      ) : (
        <ErrorState
          title={frPromotions.common.loadErrorTitle}
          description={overview.error.userMessage}
          correlationId={correlationId}
        />
      )}
    </AppShell>
  );
}
