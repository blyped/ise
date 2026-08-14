import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frContent } from '@/i18n/content';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, eventRoute, newsRoute } from '@/lib/routes/content';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkFeed } from '@/lib/queries/content';
import { formatEventMoment, toFeedScope } from '@/lib/content-view';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  ACTION_LINK,
  FIELD,
  PRIMARY_LINK,
  TAB_BASE,
  TAB_CURRENT,
  TAB_IDLE,
} from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContent.news.title };

const TABS = [
  { id: 'for_me', label: frContent.news.tabForMe },
  { id: 'network', label: frContent.news.tabNetwork },
  { id: 'careers', label: frContent.news.tabCareers },
  { id: 'publications', label: frContent.news.tabPublications },
  { id: 'events', label: frContent.news.tabEvents },
] as const;

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * ISE-092 — Actualités & événements du réseau.
 *
 * Le fil est mixte : la maquette y montre une prise de poste, un
 * événement et une ressource côte à côte. L'union est faite en base,
 * avec un curseur unique (D-44) ; l'ordre est chronologique et rien
 * n'est « boosté ».
 *
 * ÉCART ASSUMÉ : les mentions « 12 membres l'ont félicité » et
 * « 31 enregistrements · 14 lectures utiles » de la maquette ne sont
 * pas rendues. Ce sont des compteurs de réactions et de vues, que le
 * MASTER PROMPT §1 et CA-NEWS-01 interdisent. Ce qui les remplace :
 * pour un événement, le nombre réel d'inscrits et de relations déjà
 * inscrites ; pour une actualité, sa catégorie et sa source.
 */
export default async function NewsFeedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const scope = toFeedScope(params['onglet']);
  const query = one(params['recherche']);
  const cursor = unsealCursor(one(params['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkFeed(scope, query, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CONTENT_ROUTES.news}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-primary font-medium">{frContent.news.breadcrumb}</p>
      <h1 className="text-h1 text-text-primary font-bold">{frContent.news.title}</h1>
      <p className="text-body text-text-secondary">{frContent.news.subtitle}</p>
    </div>
  );

  const tabs = (
    <nav aria-label={frContent.news.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={`${CONTENT_ROUTES.news}?onglet=${tab.id}`}
              aria-current={tab.id === scope ? 'page' : undefined}
              className={`${TAB_BASE} ${tab.id === scope ? TAB_CURRENT : TAB_IDLE}`}
            >
              {tab.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        {tabs}
        <ErrorState
          title={frContent.common.loadErrorTitle}
          description={`${frContent.common.loadErrorBody} ${page.error.userMessage}`}
          correlationId={correlationId}
          action={
            <Link href={`${CONTENT_ROUTES.news}?onglet=${scope}`} className={ACTION_LINK}>
              {frContent.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const nextHref =
    page.data.nextCursor === null
      ? null
      : `${CONTENT_ROUTES.news}?${new URLSearchParams({
          onglet: scope,
          ...(query === null ? {} : { recherche: query }),
          curseur: page.data.nextCursor,
        }).toString()}`;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <form method="get" action={CONTENT_ROUTES.news} className="flex flex-col gap-3 sm:flex-row">
        <input type="hidden" name="onglet" value={scope} />
        <label htmlFor="recherche-fil" className="sr-only">
          {frContent.news.searchLabel}
        </label>
        <input
          id="recherche-fil"
          name="recherche"
          type="search"
          defaultValue={query ?? ''}
          placeholder={frContent.news.searchPlaceholder}
          className={`${FIELD} flex-1`}
        />
        <button type="submit" className={PRIMARY_LINK}>
          {frContent.news.searchSubmit}
        </button>
        {query === null ? null : (
          <Link href={`${CONTENT_ROUTES.news}?onglet=${scope}`} className={ACTION_LINK}>
            {frContent.news.searchClear}
          </Link>
        )}
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frContent.news.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={frContent.news.emptyTitle}
              description={frContent.news.emptyBody}
              action={
                <Link href={`${CONTENT_ROUTES.news}?onglet=network`} className={ACTION_LINK}>
                  {frContent.news.emptyAction}
                </Link>
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-5">
                {rows.map((entry) =>
                  entry.kind === 'news' ? (
                    <li key={`news-${entry.news.newsId}`}>
                      <Card>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar
                              name={entry.news.profiles[0]?.displayName ?? entry.news.title}
                              size={32}
                            />
                            <div>
                              <p className="text-body-sm text-text-primary font-medium">
                                {entry.news.profiles[0]?.displayName ?? '—'}
                              </p>
                              <p className="text-caption text-text-muted">
                                {[
                                  entry.news.profiles[0]?.promotionLabel,
                                  formatDay(entry.news.publishedAt),
                                ]
                                  .filter((value) => value !== null && value !== undefined)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                          <Badge tone="info">{entry.news.categoryName ?? ''}</Badge>
                        </div>

                        <h2 className="text-h3 text-text-primary mt-4 font-semibold">
                          <Link
                            href={newsRoute(entry.news.newsId)}
                            className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {entry.news.title}
                          </Link>
                        </h2>
                        <p className="text-body-sm text-text-secondary mt-2">
                          {entry.news.summary}
                        </p>

                        <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                          {entry.news.landingVisibility === 'visible' ? (
                            <Badge tone="warning">{frContent.landing.visibleTitle}</Badge>
                          ) : null}
                          <Link
                            href={newsRoute(entry.news.newsId)}
                            className={`${ACTION_LINK} ml-auto`}
                          >
                            {frContent.news.read}
                          </Link>
                        </div>
                      </Card>
                    </li>
                  ) : (
                    <li key={`event-${entry.event.eventId}`}>
                      <Card>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-caption text-text-secondary font-semibold uppercase">
                              {entry.event.eventTypeName ?? frContent.news.tabEvents}
                            </p>
                            <h2 className="text-h3 text-text-primary mt-1 font-semibold">
                              <Link
                                href={eventRoute(entry.event.eventId)}
                                className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                              >
                                {entry.event.title}
                              </Link>
                            </h2>
                          </div>
                          <Badge tone="accent">{frContent.news.tabEvents}</Badge>
                        </div>

                        <p className="text-body-sm text-text-secondary mt-2">
                          {formatEventMoment(entry.event.startsAt, entry.event.timezone)}
                        </p>
                        <p className="text-caption text-text-muted mt-1">
                          {[
                            frContent.events.format[
                              entry.event.format as 'online' | 'in_person' | 'hybrid'
                            ],
                            entry.event.city,
                            entry.event.organizerLabel,
                          ]
                            .filter((value) => value !== null && value !== undefined)
                            .join(' · ')}
                        </p>

                        <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                          <span className="text-caption text-text-muted">
                            {entry.event.registeredCount} {frContent.events.registered}
                            {entry.event.knownRegisteredCount > 0
                              ? ` · ${entry.event.knownRegisteredCount} ${frContent.events.knownRegistered}`
                              : ''}
                          </span>
                          <Link
                            href={eventRoute(entry.event.eventId)}
                            className={`${ACTION_LINK} ml-auto`}
                          >
                            {frContent.events.see}
                          </Link>
                        </div>
                      </Card>
                    </li>
                  ),
                )}
              </ul>

              {nextHref === null ? (
                <p className="text-caption text-text-muted">{frContent.common.endOfFeed}</p>
              ) : (
                <Link href={nextHref} className={`${ACTION_LINK} self-start`}>
                  {frContent.common.loadMore}
                </Link>
              )}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frContent.news.antiBubbleTitle}>
            {frContent.news.antiBubbleBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.events.breadcrumb}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              Les rencontres, webinaires et rendez-vous du réseau ont leur propre espace, avec
              filtres par format et par pays.
            </p>
            <p className="mt-5">
              <Link href={CONTENT_ROUTES.events} className={ACTION_LINK}>
                {frContent.events.title}
              </Link>
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.news.submitTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frContent.news.submitBody}</p>
            {/* 0132 — point d'entrée de la proposition membre, au même
                endroit que la carte qui, jusqu'ici, se contentait
                d'annoncer que ce n'était pas possible. */}
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={CONTENT_ROUTES.proposeNews} className={PRIMARY_LINK}>
                {frContent.news.submitAction}
              </Link>
              <Link href={CONTENT_ROUTES.myProposals} className={ACTION_LINK}>
                {frContent.news.submitTrack}
              </Link>
            </div>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
