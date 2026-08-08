import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { ROUTES } from '@/lib/routes';
import {
  SEARCH_ROUTES,
  findRouteWithCriteria,
  saveSearchRoute,
  searchResultsRoute,
} from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import {
  loadCriteriaLabels,
  runDirectorySearch,
  runRelevanceSearch,
  type CriterionChip,
} from '@/lib/queries/search';
import {
  PARAM,
  criteriaToQueryString,
  hasAnyCriteria,
  parseCriteriaFromParams,
  resolveSearchMode,
} from '@/lib/search-criteria';
import { AppShell } from '@/components/layout/AppShell';
import { ResultsList } from './ResultsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSearch.results.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Correspondance dimension -> parametre d'URL, pour retirer une puce. */
const PARAM_OF: Record<string, string> = {
  skills: PARAM.skills,
  sectors: PARAM.sectors,
  functions: PARAM.functions,
  countries: PARAM.countries,
  subregions: PARAM.subregions,
  promotions: PARAM.promotions,
  languages: PARAM.languages,
  availability: PARAM.availability,
};

const DIMENSION_LABEL: Record<string, string> = {
  skills: frSearch.criteria.skills,
  sectors: frSearch.criteria.sectors,
  functions: frSearch.criteria.functions,
  countries: frSearch.criteria.countries,
  subregions: frSearch.criteria.subregions,
  promotions: frSearch.criteria.promotions,
  languages: frSearch.criteria.languages,
  availability: frSearch.criteria.availability,
};

function withoutValue(queryString: string, param: string, value: string): string {
  const source = new URLSearchParams(queryString);
  const target = new URLSearchParams();
  for (const [key, entry] of source.entries()) {
    if (key === param && entry === value) continue;
    target.append(key, entry);
  }
  return target.toString();
}

/**
 * ISE-035 — Resultats de recherche.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : la maquette affiche
 * « 324 profils » et une pagination numerotee (1 2 3 … 17). Les deux
 * supposent un COMPTE TOTAL et un OFFSET, que la decision D-44 interdit
 * (pagination keyset) et que les RPC ne renvoient pas. Compter
 * l'integralite de l'annuaire a chaque recherche serait par ailleurs le
 * balayage complet que le moteur cherche precisement a eviter. L'ecran
 * annonce donc ce qu'il sait reellement : le nombre de profils affiches,
 * et un chargement de page suivante. Aucun total n'est invente
 * (MASTER PROMPT §98).
 */
export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const params = await searchParams;

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const entry of value) urlParams.append(key, entry);
    else if (typeof value === 'string') urlParams.append(key, value);
  }

  const parsed = parseCriteriaFromParams(urlParams);
  const viewer = await loadViewerContext(user.id, user.email ?? '');

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={SEARCH_ROUTES.results}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!parsed.ok) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frSearch.results.title}</h1>
        <Alert variant="error" title={frSearch.find.validationFailed}>
          Les critères présents dans l’adresse sont invalides. Reprenez la recherche.
        </Alert>
        <p>
          <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
            {frSearch.results.emptyAction}
          </Link>
        </p>
      </div>,
    );
  }

  const criteria = parsed.criteria;
  if (!hasAnyCriteria(criteria)) redirect(SEARCH_ROUTES.find);

  const queryString = criteriaToQueryString(criteria);
  const mode = resolveSearchMode(criteria);
  // Curseur : uniquement par le chemin sans JavaScript (voir ResultsList).
  const rawCursor = unsealCursor(urlParams.get('curseur'));

  const [page, chips] = await Promise.all([
    mode === 'relevance'
      ? runRelevanceSearch(criteria, rawCursor, correlationId)
      : runDirectorySearch(criteria, rawCursor, correlationId),
    loadCriteriaLabels(criteria),
  ]);

  const allChips: CriterionChip[] = [
    ...((criteria.query ?? '').length > 0
      ? [{ dimension: 'query', value: criteria.query ?? '', label: criteria.query ?? '' }]
      : []),
    ...chips,
    ...(typeof criteria.minYearsOfExperience === 'number'
      ? [
          {
            dimension: 'experience',
            value: String(criteria.minYearsOfExperience),
            label: frSearch.criteria.experienceValue.replace(
              '{years}',
              String(criteria.minYearsOfExperience),
            ),
          },
        ]
      : []),
  ];

  /* ---- Rappel des criteres : rail lateral en 1440, bandeau en 375 ---- */
  const criteriaPanel = (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{frSearch.results.criteriaLegend}</CardTitle>
      </CardHeader>
      <ul className="flex flex-wrap gap-2 xl:flex-col xl:items-start">
        {allChips.map((chip) => {
          const param = PARAM_OF[chip.dimension];
          const label = DIMENSION_LABEL[chip.dimension] ?? frSearch.criteria.query;
          const removable = param !== undefined;
          const href = removable
            ? searchResultsRoute(withoutValue(queryString, param, chip.value))
            : null;

          return (
            <li key={`${chip.dimension}-${chip.value}`} className="max-w-full">
              <span className="border-border bg-surface-muted text-body-sm text-text-secondary inline-flex min-h-[36px] max-w-full items-center gap-2 rounded-full border px-4 py-1 max-md:min-h-[44px]">
                <span className="truncate">
                  <span className="text-text-muted">{label} : </span>
                  {chip.label}
                </span>
                {href !== null ? (
                  <Link
                    href={href}
                    aria-label={`${frSearch.common.remove} — ${label} : ${chip.label}`}
                    className="text-text-muted hover:text-error focus-visible:outline-active-blue shrink-0 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <span aria-hidden="true">×</span>
                  </Link>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={findRouteWithCriteria(queryString)} className={ACTION_LINK}>
          {frSearch.results.backToSearch}
        </Link>
        <Link href={SEARCH_ROUTES.find} className={`${ACTION_LINK} text-text-secondary`}>
          {frSearch.common.clearAll}
        </Link>
      </div>
    </Card>
  );

  const header = (
    <div className="flex flex-col gap-6">
      <nav aria-label="Fil d’Ariane">
        <ol className="text-body-sm text-text-muted flex flex-wrap items-center gap-2">
          <li>{frSearch.find.breadcrumbNetwork}</li>
          <li aria-hidden="true">›</li>
          <li>
            <Link
              href={findRouteWithCriteria(queryString)}
              className="text-primary hover:text-primary-hover focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frSearch.find.breadcrumbCurrent}
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-primary font-medium">
            {frSearch.results.breadcrumbCurrent}
          </li>
        </ol>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSearch.results.title}</h1>
          <p className="text-body text-text-secondary">
            {mode === 'relevance'
              ? frSearch.results.modeRelevanceHint
              : frSearch.results.modeDirectoryHint}
          </p>
        </div>
        <Link href={saveSearchRoute(queryString)} className={`${ACTION_LINK} max-lg:w-full`}>
          {frSearch.results.saveSearch}
        </Link>
      </div>
    </div>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frSearch.results.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={searchResultsRoute(queryString)} className={ACTION_LINK}>
              {frSearch.results.errorAction}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {/*
        375 px : le rappel des criteres est un bandeau HORIZONTAL au-dessus
        des resultats — l'utilisateur voit d'abord ce qu'il a demande, puis
        fait defiler les profils.
        1440 px : il devient un RAIL lateral persistant, visible pendant
        tout le defilement, ce qui permet de retirer un critere sans
        remonter en haut de page (MASTER PROMPT §57).
      */}
      <div className="grid gap-7 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <div className="xl:sticky xl:top-6">{criteriaPanel}</div>

        <section aria-label={frSearch.results.title} className="flex min-w-0 flex-col gap-5">
          <p className="text-body-sm text-text-secondary">
            {rows.length === 1
              ? frSearch.results.countOne.replace('{count}', '1')
              : frSearch.results.countMany.replace('{count}', String(rows.length))}
          </p>

          {rows.length === 0 ? (
            <EmptyState
              title={frSearch.results.emptyTitle}
              description={frSearch.results.emptyBody}
              action={
                <Link href={findRouteWithCriteria(queryString)} className={ACTION_LINK}>
                  {frSearch.results.emptyAction}
                </Link>
              }
            />
          ) : (
            /* `key` = criteres : changer de recherche doit repartir d'une
               liste vide, pas empiler les resultats de la precedente. */
            <ResultsList
              key={queryString}
              initialRows={rows}
              initialNextCursor={page.data.nextCursor}
              queryString={queryString}
            />
          )}

          {rows.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.results.emptySuggestionsTitle}</CardTitle>
              </CardHeader>
              <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-3 pl-5">
                {frSearch.results.emptySuggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </section>
      </div>
    </div>,
  );
}
