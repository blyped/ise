import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkCalls } from '@/lib/queries/calls';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { toCallScope, CALL_TYPES } from '@/lib/calls-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallsList } from './CallsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.list.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const TABS = [
  { id: 'for_me', label: frCalls.list.tabForMe },
  { id: 'all', label: frCalls.list.tabAll },
  { id: 'promotion', label: frCalls.list.tabPromotion },
  { id: 'saved', label: frCalls.list.tabSaved },
] as const;

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * ISE-047 — Appels au réseau.
 *
 * L'onglet par defaut est « Pour moi » : il ne montre QUE les appels
 * pour lesquels la base a produit une correspondance reelle, avec ses
 * raisons. Un fil chronologique aurait ete plus simple, mais il aurait
 * fait de ce module un mur de publications — exactement ce que le
 * cahier des charges refuse.
 *
 * ECART ASSUME : le tri « pertinence / récents / échéance » de la
 * maquette n'est pas propose comme un menu. L'ordre depend de l'onglet :
 * correspondance dans « Pour moi », chronologique ailleurs. Un tri par
 * pertinence sur un onglet sans correspondance n'aurait rien a trier.
 *
 * RESPONSIVE : a 375 px les onglets defilent horizontalement, les
 * filtres passent en pile et le rail lateral se place sous la liste.
 */
export default async function CallsPage({
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
  const scope = toCallScope(params['onglet']);
  const query = one(params['recherche']);
  const callType = one(params['type']);
  const sectorParam = one(params['secteur']);
  const countryCode = one(params['pays']);
  const urgency = one(params['urgence']);
  const cursor = unsealCursor(one(params['curseur']));

  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);
  const correlationId = newCorrelationId();

  const [viewer, page, sectors, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCalls(
      {
        scope,
        query,
        callType,
        skillId: null,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
        countryCode,
        urgency,
        status: 'open',
      },
      cursor,
      correlationId,
    ),
    loadSectors(correlationId),
    loadCountries(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CALL_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCalls.list.title}</h1>
        <p className="text-body text-text-secondary">{frCalls.list.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={CALL_ROUTES.mine} className={ACTION_LINK}>
          {frCalls.list.mine}
        </Link>
        <Link
          href={CALL_ROUTES.create}
          className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          + {frCalls.list.create}
        </Link>
      </div>
    </div>
  );

  const tabs = (
    <nav aria-label={frCalls.list.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.id === scope;
          return (
            <li key={tab.id}>
              <Link
                href={`${CALL_ROUTES.list}?onglet=${tab.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`text-body-sm focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border-b-2 px-4 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isCurrent
                    ? 'border-primary text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        {tabs}
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={CALL_ROUTES.list} className={ACTION_LINK}>
              {frCalls.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const activeFilters: Record<string, string> = {};
  if (query !== null) activeFilters['recherche'] = query;
  if (callType !== null) activeFilters['type'] = callType;
  if (sectorParam !== null) activeFilters['secteur'] = sectorParam;
  if (countryCode !== null) activeFilters['pays'] = countryCode;
  if (urgency !== null) activeFilters['urgence'] = urgency;

  const emptyTitle =
    scope === 'for_me'
      ? frCalls.list.emptyForMeTitle
      : scope === 'saved'
        ? frCalls.list.emptySavedTitle
        : frCalls.list.emptyAllTitle;
  const emptyBody =
    scope === 'for_me'
      ? frCalls.list.emptyForMeBody
      : scope === 'saved'
        ? frCalls.list.emptySavedBody
        : frCalls.list.emptyAllBody;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <form method="get" action={CALL_ROUTES.list} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={scope} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-appels" className="sr-only">
            {frCalls.list.searchLabel}
          </label>
          <input
            id="recherche-appels"
            name="recherche"
            type="search"
            defaultValue={query ?? ''}
            placeholder={frCalls.list.searchPlaceholder}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] min-w-0 flex-1 border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button
            type="submit"
            className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frCalls.list.searchSubmit}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCalls.list.filterType}
            <select
              name="type"
              defaultValue={callType ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frCalls.list.filterAll}</option>
              {CALL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {frCalls.type[type] ?? type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCalls.list.filterSector}
            <select
              name="secteur"
              defaultValue={sectorParam ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frCalls.list.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCalls.list.filterCountry}
            <select
              name="pays"
              defaultValue={countryCode ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frCalls.list.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCalls.list.filterUrgency}
            <select
              name="urgence"
              defaultValue={urgency ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frCalls.list.filterAll}</option>
              <option value="deadline_soon">{frCalls.list.urgencySoon}</option>
              <option value="normal">{frCalls.list.urgencyNormal}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frCalls.list.filterApply}
          </button>
          {Object.keys(activeFilters).length > 0 ? (
            <Link href={`${CALL_ROUTES.list}?onglet=${scope}`} className={ACTION_LINK}>
              {frCalls.list.searchClear}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frCalls.list.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={emptyTitle}
              description={emptyBody}
              action={
                scope === 'for_me' ? (
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href={`${CALL_ROUTES.list}?onglet=all`} className={ACTION_LINK}>
                      {frCalls.list.emptyForMeAction}
                    </Link>
                    <Link href={PROFILE_ROUTES.skills} className={ACTION_LINK}>
                      Compléter mes compétences
                    </Link>
                  </div>
                ) : (
                  <Link href={CALL_ROUTES.create} className={ACTION_LINK}>
                    {frCalls.list.create}
                  </Link>
                )
              }
            />
          ) : (
            <CallsList
              key={`${scope}-${JSON.stringify(activeFilters)}`}
              initialRows={rows}
              initialNextCursor={page.data.nextCursor}
              scope={scope}
              filters={activeFilters}
            />
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frCalls.list.noBoostNotice}>
            {frCalls.list.noBoostBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.list.create}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              Un appel au réseau n’est pas une publication : c’est une demande adressée aux
              personnes qui peuvent réellement aider.
            </p>
            <p className="mt-5">
              <Link href={CALL_ROUTES.create} className={ACTION_LINK}>
                {frCalls.list.create}
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
