import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadConnections, loadNetworkSummary } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ConnectionsList } from './ConnectionsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.connections.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-h2 text-text-primary font-bold">{value}</span>
      <span className="text-caption text-text-muted">{label}</span>
    </div>
  );
}

/**
 * ISE-040 — Mes relations.
 *
 * Les quatre compteurs du bandeau viennent de `my_network_summary()`, qui
 * les CALCULE sur les relations reelles et ne compte que ce que chaque
 * relation a rendu visible au membre courant. Aucun chiffre n'est
 * arrondi, aucun n'est simule (MASTER PROMPT §98) — et l'ecran precise
 * cette limite au lieu de laisser croire a un decompte absolu.
 *
 * RESPONSIVE : a 375 px les quatre compteurs deviennent deux lignes de
 * deux, le rail lateral passe SOUS la liste, et la recherche occupe
 * toute la largeur. A 1440 px, le rail devient persistant a droite et
 * porte les raccourcis de mobilisation du reseau — c'est un changement
 * de hierarchie, pas une reduction.
 */
export default async function ConnectionsPage({
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
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, summaryResult, pageResult] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkSummary(correlationId),
    loadConnections(query.length > 0 ? query : null, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={NETWORK_ROUTES.connections}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.connections.title}</h1>
        <p className="text-body text-text-secondary max-md:hidden">
          {frNetwork.connections.subtitle}
        </p>
      </div>
      <Link href={SEARCH_ROUTES.find} className={`${ACTION_LINK} max-lg:w-full`}>
        {frNetwork.connections.findMember}
      </Link>
    </div>
  );

  if (!pageResult.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frNetwork.connections.errorTitle}
          description={pageResult.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
              {frNetwork.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = pageResult.data.rows;
  const summary = summaryResult.ok ? summaryResult.data : null;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {/* Bandeau de compteurs. A 375 px : deux colonnes ; a 1024 px :
          quatre. Les libelles restent entiers dans les deux cas. */}
      {summary !== null ? (
        <Card>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={summary.connections} label={frNetwork.connections.statConnections} />
            <Stat value={summary.promotions} label={frNetwork.connections.statPromotions} />
            <Stat value={summary.countries} label={frNetwork.connections.statCountries} />
            <Stat value={summary.availableToHelp} label={frNetwork.connections.statAvailable} />
          </div>
          <p className="border-border text-caption text-text-muted mt-5 border-t pt-4">
            {frNetwork.connections.statsNote}
          </p>
        </Card>
      ) : (
        <Alert variant="warning" title="Les compteurs de votre réseau n’ont pas pu être calculés.">
          {frNetwork.common.correlationLabel} : {correlationId}
        </Alert>
      )}

      {summary !== null && summary.pendingReceived > 0 ? (
        <Alert
          variant="action"
          title={tn(frNetwork.connections.invitationsPending, {
            count: summary.pendingReceived,
          })}
          action={
            <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
              {frNetwork.connections.invitationsLink}
            </Link>
          }
        />
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frNetwork.connections.title} className="flex min-w-0 flex-col gap-5">
          {/* Recherche sans JavaScript : un `form` en GET. Le filtre est
              applique en base sur `normalized_name`, index trigramme. */}
          <form method="get" action={NETWORK_ROUTES.connections} className="flex flex-col gap-2">
            <label
              htmlFor="recherche-relations"
              className="text-body-sm text-text-primary font-medium"
            >
              {frNetwork.connections.searchLabel}
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="recherche-relations"
                name="recherche"
                type="search"
                defaultValue={query}
                placeholder={frNetwork.connections.searchPlaceholder}
                className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] min-w-0 flex-1 border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <button
                type="submit"
                className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {frNetwork.connections.searchSubmit}
              </button>
              {query.length > 0 ? (
                <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
                  {frNetwork.connections.searchClear}
                </Link>
              ) : null}
            </div>
          </form>

          {rows.length === 0 ? (
            <EmptyState
              title={
                query.length > 0
                  ? frNetwork.connections.emptySearchTitle
                  : frNetwork.connections.emptyTitle
              }
              description={
                query.length > 0
                  ? frNetwork.connections.emptySearchBody
                  : frNetwork.connections.emptyBody
              }
              action={
                <Link
                  href={query.length > 0 ? NETWORK_ROUTES.connections : SEARCH_ROUTES.find}
                  className={ACTION_LINK}
                >
                  {query.length > 0
                    ? frNetwork.connections.searchClear
                    : frNetwork.connections.findMember}
                </Link>
              }
            />
          ) : (
            /* `key` = recherche : changer de filtre repart d'une liste
               vide au lieu d'empiler deux jeux de resultats. */
            <ConnectionsList
              key={query}
              initialRows={rows}
              initialNextCursor={pageResult.data.nextCursor}
              query={query}
            />
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.connections.mobiliseTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frNetwork.connections.mobiliseBody}</p>
            <p className="mt-5 flex flex-col gap-3">
              <Link href={NETWORK_ROUTES.introductions} className={ACTION_LINK}>
                {frNetwork.connections.introductionsLink}
              </Link>
              <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
                {frNetwork.connections.invitationsLink}
              </Link>
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.connections.callOnTitle}</CardTitle>
            </CardHeader>
            {summary === null || summary.byAvailability.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frNetwork.connections.callOnEmpty}</p>
            ) : (
              <dl className="flex flex-col gap-3">
                {summary.byAvailability.map((entry) => (
                  <div
                    key={entry.code}
                    className="border-border flex items-baseline justify-between gap-4 border-b pb-2 last:border-b-0 last:pb-0"
                  >
                    <dt className="text-body-sm text-text-secondary">{entry.name}</dt>
                    <dd className="text-body-sm text-text-primary font-semibold">
                      {tn(frNetwork.connections.callOnCount, { count: entry.count })}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          <Alert variant="info" title={frNetwork.connections.qualityTitle}>
            {frNetwork.connections.qualityBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
