import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { ROUTES } from '@/lib/routes';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyTickets, loadSupportCategories } from '@/lib/queries/support';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSupport.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-100 — centre d'aide.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : la maquette montre un champ
 * « Rechercher une réponse » et six « sujets fréquents » avec leurs
 * articles. AUCUNE base d'articles n'existe : il n'y a ni table
 * d'articles, ni contenu redige. Une recherche qui ne renverrait jamais
 * rien, ou des articles inventes, seraient l'un et l'autre du faux.
 * L'ecran affiche donc les 16 categories REELLES de
 * `public.support_categories` — celles qui orientent effectivement une
 * demande — et le dit explicitement.
 *
 * D-85 : aucun delai de reponse n'est affiche.
 */
export default async function HelpPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, categories, tickets] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadSupportCategories(),
    loadMyTickets(null, correlationId),
  ]);

  const openTotal = tickets.ok ? tickets.data.openTotal : 0;

  return (
    <AppShell
      currentPath={SUPPORT_ROUTES.help}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSupport.title}</h1>
          <p className="text-body text-text-secondary max-md:hidden">{frSupport.subtitle}</p>
        </div>

        <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSupport.help.noFaqTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frSupport.help.noFaqBody}</p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSupport.help.categoriesTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary mb-5">
                {frSupport.help.categoriesBody}
              </p>

              {categories.length === 0 ? (
                <EmptyState
                  title="Aucune catégorie disponible"
                  description="Le référentiel des catégories n’a pas pu être chargé."
                />
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => (
                    <li key={category.code}>
                      <Link
                        href={`${SUPPORT_ROUTES.newTicket}?categorie=${encodeURIComponent(category.code)}`}
                        className="rounded-base border-border bg-surface hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue flex min-h-[44px] flex-col justify-center gap-1 border p-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        <span className="text-body-sm text-text-primary font-medium">
                          {category.name}
                        </span>
                        {category.routesToModeration ? (
                          <span>
                            <Badge tone="warning">{frSupport.help.moderationHint}</Badge>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={SUPPORT_ROUTES.newTicket} className={PRIMARY}>
                {frSupport.help.createTicket}
              </Link>
              <Link href={SUPPORT_ROUTES.tickets} className={LINK}>
                {frSupport.help.myTickets}
              </Link>
            </div>

            <Alert variant="info" title={frSupport.help.noSla} />
          </div>

          <aside className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSupport.help.myTickets}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {openTotal === 0
                  ? frSupport.ticket.emptyBody
                  : `${openTotal} demande${openTotal > 1 ? 's' : ''} en cours.`}
              </p>
              <p className="mt-4">
                <Link href={SUPPORT_ROUTES.tickets} className={LINK}>
                  {frSupport.help.myTickets}
                </Link>
              </p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSupport.report.title}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frSupport.report.subtitle}</p>
              <p className="text-caption text-text-muted mt-4">
                {frSupport.report.blockDistinction}
              </p>
              <p className="text-body-sm text-text-secondary mt-4">
                Un signalement se dépose depuis l’élément concerné : le profil, la conversation ou
                le contenu. Le contexte est ainsi conservé automatiquement.
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
