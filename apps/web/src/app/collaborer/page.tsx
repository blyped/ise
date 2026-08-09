import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardDescription, CardHeader, CardTitle } from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES } from '@/lib/routes/internships';
import { MENTORSHIP_ROUTES } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { AppShell } from '@/components/layout/AppShell';
import { LINK_BUTTON, PageHeader } from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.hub.title };

/**
 * Point d'entree « Collaborer » de la navigation membre (MASTER PROMPT
 * §89). Il regroupe les trois espaces livres par cette tranche :
 * promotion, stages, mentorat.
 *
 * Il n'y a ici AUCUNE donnee : c'est un aiguillage. Les chiffres vivent
 * dans les trois espaces, la ou ils ont un sens.
 */
export default async function CollaborateHubPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  void correlationId;
  const viewer = await loadViewerContext(user.id, user.email ?? '');

  // `href: null` = module dont les ecrans ne sont pas encore livres. La carte
  // reste visible mais n'est pas cliquable : un lien mort serait un bouton
  // decoratif (MASTER PROMPT §113).
  const CARDS: readonly {
    key: string;
    title: string;
    body: string;
    href: string | null;
  }[] = [
    {
      key: 'promotion',
      title: frPromotions.hub.promotionTitle,
      body: frPromotions.hub.promotionBody,
      href: PROMOTION_ROUTES.mine,
    },
    {
      key: 'internships',
      title: frPromotions.hub.internshipsTitle,
      body: frPromotions.hub.internshipsBody,
      href: INTERNSHIP_ROUTES.home,
    },
    {
      key: 'mentorship',
      title: frPromotions.hub.mentorshipTitle,
      body: frPromotions.hub.mentorshipBody,
      // ISE-078 a ISE-083 livres : la carte ouvre l'espace mentorat.
      href: MENTORSHIP_ROUTES.home,
    },
  ];

  return (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-8">
        <PageHeader title={frPromotions.hub.title} subtitle={frPromotions.hub.subtitle} />

        <ul className="grid gap-6 lg:grid-cols-3">
          {CARDS.map((card) => (
            <li key={card.key}>
              <Card className="flex h-full flex-col">
                <CardHeader>
                  <CardTitle as="h2">{card.title}</CardTitle>
                  <CardDescription>{card.body}</CardDescription>
                </CardHeader>
                <p className="mt-auto pt-5">
                  {card.href === null ? (
                    <span className="text-body-sm text-text-muted">
                      {frPromotions.hub.comingSoon}
                    </span>
                  ) : (
                    <Link href={card.href} className={LINK_BUTTON}>
                      {frPromotions.hub.open}
                    </Link>
                  )}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
