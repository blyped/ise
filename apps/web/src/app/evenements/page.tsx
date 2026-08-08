import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frContent } from '@/i18n/content';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, eventRoute } from '@/lib/routes/content';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadEvents } from '@/lib/queries/content';
import { loadCountries } from '@/lib/queries/reference';
import { formatEventDayBadge, formatEventMoment, toEventScope } from '@/lib/content-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  ACTION_LINK,
  FIELD,
  PRIMARY_LINK,
  SELECT,
  TAB_BASE,
  TAB_CURRENT,
  TAB_IDLE,
} from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContent.events.title };

const TABS = [
  { id: 'for_me', label: frContent.events.tabForMe },
  { id: 'upcoming', label: frContent.events.tabUpcoming },
  { id: 'online', label: frContent.events.tabOnline },
  { id: 'nearby', label: frContent.events.tabNearby },
  { id: 'mine', label: frContent.events.tabMine },
  { id: 'past', label: frContent.events.tabPast },
] as const;

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * ISE-094 — Espace Événements.
 *
 * Le bloc de date est le premier élément de chaque carte, comme dans la
 * maquette, et le fuseau horaire est toujours écrit (CA-EVENT-01).
 *
 * ÉCART ASSUMÉ : le bouton « + Proposer un événement » n'est pas rendu.
 * L'assistant de création (type, informations, programme, intervenants,
 * visibilité) n'est pas livré dans cette tranche ; le rail latéral le
 * dit plutôt que d'afficher un bouton qui ne mène nulle part
 * (MASTER PROMPT §113).
 */
export default async function EventsPage({
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
  const scope = toEventScope(params['onglet']);
  const query = one(params['recherche']);
  const format = one(params['format']);
  const countryCode = one(params['pays']);
  const cursor = unsealCursor(one(params['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadEvents({ scope, query, format, countryCode }, cursor, correlationId),
    loadCountries(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CONTENT_ROUTES.events}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-primary font-medium">{frContent.events.breadcrumb}</p>
      <h1 className="text-h1 text-text-primary font-bold">{frContent.events.title}</h1>
      <p className="text-body text-text-secondary">{frContent.events.subtitle}</p>
    </div>
  );

  const tabs = (
    <nav aria-label={frContent.events.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <Link
              href={`${CONTENT_ROUTES.events}?onglet=${tab.id}`}
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
            <Link href={`${CONTENT_ROUTES.events}?onglet=${scope}`} className={ACTION_LINK}>
              {frContent.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const baseParams: Record<string, string> = { onglet: scope };
  if (query !== null) baseParams['recherche'] = query;
  if (format !== null) baseParams['format'] = format;
  if (countryCode !== null) baseParams['pays'] = countryCode;

  const nextHref =
    page.data.nextCursor === null
      ? null
      : `${CONTENT_ROUTES.events}?${new URLSearchParams({
          ...baseParams,
          curseur: page.data.nextCursor,
        }).toString()}`;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <form method="get" action={CONTENT_ROUTES.events} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={scope} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-evenements" className="sr-only">
            {frContent.events.searchLabel}
          </label>
          <input
            id="recherche-evenements"
            name="recherche"
            type="search"
            defaultValue={query ?? ''}
            placeholder={frContent.events.searchPlaceholder}
            className={`${FIELD} flex-1`}
          />
          <button type="submit" className={PRIMARY_LINK}>
            {frContent.events.searchSubmit}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frContent.events.filterFormat}
            <select name="format" defaultValue={format ?? ''} className={SELECT}>
              <option value="">{frContent.events.filterAll}</option>
              <option value="online">{frContent.events.format.online}</option>
              <option value="in_person">{frContent.events.format.in_person}</option>
              <option value="hybrid">{frContent.events.format.hybrid}</option>
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frContent.events.filterCountry}
            <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
              <option value="">{frContent.events.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={ACTION_LINK}>
            {frContent.events.filterApply}
          </button>
          {Object.keys(baseParams).length > 1 ? (
            <Link href={`${CONTENT_ROUTES.events}?onglet=${scope}`} className={ACTION_LINK}>
              {frContent.events.searchClear}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frContent.events.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={
                scope === 'for_me' ? frContent.events.emptyForMeTitle : frContent.events.emptyTitle
              }
              description={
                scope === 'for_me' ? frContent.events.emptyForMeBody : frContent.events.emptyBody
              }
              action={
                <Link href={`${CONTENT_ROUTES.events}?onglet=upcoming`} className={ACTION_LINK}>
                  {frContent.events.emptyForMeAction}
                </Link>
              }
            />
          ) : (
            <>
              <ul className="grid gap-5 lg:grid-cols-2">
                {rows.map((event) => {
                  const badge = formatEventDayBadge(event.startsAt, event.timezone);
                  return (
                    <li key={event.eventId}>
                      <Card className="h-full">
                        <div className="flex items-start gap-4">
                          <div
                            aria-hidden="true"
                            className="rounded-base bg-surface-muted flex h-[62px] w-[62px] shrink-0 flex-col items-center justify-center"
                          >
                            <span className="text-caption text-text-secondary uppercase">
                              {badge.month}
                            </span>
                            <span className="text-h3 text-text-primary font-bold">{badge.day}</span>
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-h3 text-text-primary font-semibold">
                              <Link
                                href={eventRoute(event.eventId)}
                                className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                              >
                                {event.title}
                              </Link>
                            </h2>
                            <p className="text-caption text-text-secondary mt-1">
                              {formatEventMoment(event.startsAt, event.timezone)}
                            </p>
                            <p className="text-caption text-text-muted">
                              {[
                                frContent.events.format[
                                  event.format as 'online' | 'in_person' | 'hybrid'
                                ],
                                event.city,
                                event.organizerLabel,
                              ]
                                .filter((value) => value !== null && value !== undefined)
                                .join(' · ')}
                            </p>
                          </div>
                        </div>

                        <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                          <span className="text-caption text-text-muted">
                            {event.registeredCount} {frContent.events.registered}
                            {event.capacity === null
                              ? ''
                              : ` / ${event.capacity} ${frContent.eventDetail.capacityTitle.toLowerCase()}`}
                          </span>
                          {event.status === 'cancelled' ? (
                            <Badge tone="error">{frContent.events.eventCancelled}</Badge>
                          ) : event.myRegistration?.status === 'registered' ? (
                            <Badge tone="success">{frContent.events.registeredBadge}</Badge>
                          ) : event.myRegistration?.status === 'waitlisted' ? (
                            <Badge tone="warning">{frContent.events.waitlistedBadge}</Badge>
                          ) : event.myRegistration?.status === 'pending_approval' ? (
                            <Badge tone="warning">{frContent.events.pendingBadge}</Badge>
                          ) : null}
                          <Link
                            href={eventRoute(event.eventId)}
                            className={`${ACTION_LINK} ml-auto`}
                          >
                            {frContent.events.see}
                          </Link>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>

              {nextHref === null ? (
                <p className="text-caption text-text-muted">{frContent.common.endOfEvents}</p>
              ) : (
                <Link href={nextHref} className={`${ACTION_LINK} self-start`}>
                  {frContent.common.loadMore}
                </Link>
              )}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          {scope === 'nearby' ? (
            <Alert variant="info" title={frContent.events.nearbyUnavailableTitle}>
              {frContent.events.nearbyUnavailableBody}
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.news.breadcrumb}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              Le fil du réseau mêle actualités et événements ; cet espace ne montre que les
              rendez-vous.
            </p>
            <p className="mt-5">
              <Link href={CONTENT_ROUTES.news} className={ACTION_LINK}>
                {frContent.news.title}
              </Link>
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.events.proposeTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frContent.events.proposeBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
