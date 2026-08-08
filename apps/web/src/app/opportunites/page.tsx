import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunities } from '@/lib/queries/opportunities';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { toOpportunityScope } from '@/lib/opportunities-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunitiesList } from './OpportunitiesList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.list.title };

const LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-055 — Hub Opportunités.
 *
 * L'onglet par défaut « Pour vous » ne montre QUE les offres pour
 * lesquelles la base a produit une correspondance réelle, avec ses
 * raisons. Les onglets Emplois / Stages / Missions sont le MÊME onglet
 * « Toutes » filtré par type : le périmètre MVP s'arrête là (D27 §1), et
 * un onglet « Business » vide aurait été un onglet décoratif.
 */
export default async function OpportunitiesPage({
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
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const tab = one(params['onglet']) ?? 'for_you';
  const typeFromTab =
    tab === 'jobs'
      ? 'job'
      : tab === 'internships'
        ? 'internship'
        : tab === 'missions'
          ? 'mission'
          : null;
  const scope = toOpportunityScope(typeFromTab !== null || tab === 'all' ? 'all' : tab);

  const query = one(params['recherche']);
  const sectorParam = one(params['secteur']);
  const countryCode = one(params['pays']);
  const level = one(params['niveau']);
  const remoteOnly = params['remote'] === 'true';
  const newGraduates = params['debutants'] === 'true';
  const cursor = unsealCursor(one(params['curseur']));
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);

  const correlationId = newCorrelationId();
  const [viewer, page, sectors, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunities(
      {
        scope,
        query,
        opportunityType: typeFromTab,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
        countryCode,
        experienceLevel: level,
        remoteOnly,
        newGraduates,
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
      currentPath={OPPORTUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const TABS = [
    { id: 'for_you', label: frOpportunities.list.tabForYou },
    { id: 'jobs', label: frOpportunities.list.tabJobs },
    { id: 'internships', label: frOpportunities.list.tabInternships },
    { id: 'missions', label: frOpportunities.list.tabMissions },
    { id: 'all', label: frOpportunities.list.tabAll },
  ] as const;

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOpportunities.list.title}</h1>
        <p className="text-body text-text-secondary">{frOpportunities.list.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={OPPORTUNITY_ROUTES.applications} className={LINK}>
          {frOpportunities.list.myApplications}
        </Link>
        <Link href={OPPORTUNITY_ROUTES.mine} className={LINK}>
          {frOpportunities.list.mine}
        </Link>
        <Link
          href={OPPORTUNITY_ROUTES.create}
          className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          + {frOpportunities.list.create}
        </Link>
      </div>
    </div>
  );

  const tabs = (
    <nav aria-label={frOpportunities.list.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((item) => {
          const isCurrent = item.id === tab;
          return (
            <li key={item.id}>
              <Link
                href={`${OPPORTUNITY_ROUTES.list}?onglet=${item.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`text-body-sm focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border-b-2 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isCurrent
                    ? 'border-primary text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border-transparent'
                }`}
              >
                {item.label}
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
          title={frOpportunities.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const activeFilters: Record<string, string> = {};
  if (query !== null) activeFilters['recherche'] = query;
  if (typeFromTab !== null) activeFilters['type'] = typeFromTab;
  if (sectorParam !== null) activeFilters['secteur'] = sectorParam;
  if (countryCode !== null) activeFilters['pays'] = countryCode;
  if (level !== null) activeFilters['niveau'] = level;
  if (remoteOnly) activeFilters['remote'] = 'true';
  if (newGraduates) activeFilters['debutants'] = 'true';

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <form method="get" action={OPPORTUNITY_ROUTES.list} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={tab} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-opportunites" className="sr-only">
            {frOpportunities.list.searchLabel}
          </label>
          <input
            id="recherche-opportunites"
            name="recherche"
            type="search"
            defaultValue={query ?? ''}
            placeholder={frOpportunities.list.searchPlaceholder}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] min-w-0 flex-1 border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button
            type="submit"
            className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frOpportunities.list.searchSubmit}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frOpportunities.list.filterSector}
            <select
              name="secteur"
              defaultValue={sectorParam ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frOpportunities.list.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frOpportunities.list.filterCountry}
            <select
              name="pays"
              defaultValue={countryCode ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frOpportunities.list.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frOpportunities.list.filterLevel}
            <select
              name="niveau"
              defaultValue={level ?? ''}
              className="rounded-base bg-surface text-body-sm text-text-primary h-[44px] border border-[#CBD5E1] px-3"
            >
              <option value="">{frOpportunities.list.filterAll}</option>
              {(['junior', 'intermediate', 'senior', 'executive'] as const).map((value) => (
                <option key={value} value={value}>
                  {frOpportunities.experienceLevel[value]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-5">
          <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="remote" value="true" defaultChecked={remoteOnly} />
            {frOpportunities.list.filterRemote}
          </label>
          <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-2">
            <input type="checkbox" name="debutants" value="true" defaultChecked={newGraduates} />
            {frOpportunities.list.filterNewGraduates}
          </label>
          <button
            type="submit"
            className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frOpportunities.list.filterApply}
          </button>
          {Object.keys(activeFilters).length > 0 ? (
            <Link href={`${OPPORTUNITY_ROUTES.list}?onglet=${tab}`} className={LINK}>
              {frOpportunities.list.searchClear}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frOpportunities.list.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={
                scope === 'for_you'
                  ? frOpportunities.list.emptyForYouTitle
                  : frOpportunities.list.emptyAllTitle
              }
              description={
                scope === 'for_you'
                  ? frOpportunities.list.emptyForYouBody
                  : frOpportunities.list.emptyAllBody
              }
              action={
                scope === 'for_you' ? (
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href={`${OPPORTUNITY_ROUTES.list}?onglet=all`} className={LINK}>
                      {frOpportunities.list.emptyForYouAction}
                    </Link>
                    <Link href={PROFILE_ROUTES.skills} className={LINK}>
                      Compléter mes compétences
                    </Link>
                  </div>
                ) : (
                  <Link href={OPPORTUNITY_ROUTES.create} className={LINK}>
                    {frOpportunities.list.create}
                  </Link>
                )
              }
            />
          ) : (
            <OpportunitiesList
              key={`${tab}-${JSON.stringify(activeFilters)}`}
              initialRows={rows}
              initialNextCursor={page.data.nextCursor}
              scope={scope}
              filters={activeFilters}
            />
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.list.savedLink}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frOpportunities.list.emptySavedBody}
            </p>
            <p className="mt-5">
              <Link href={OPPORTUNITY_ROUTES.saved} className={LINK}>
                {frOpportunities.list.savedLink}
              </Link>
            </p>
          </Card>

          <Alert variant="info" title={frOpportunities.apply.noMassApplyTitle}>
            {frOpportunities.apply.noMassApplyBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
