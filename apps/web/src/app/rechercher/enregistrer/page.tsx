import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES, searchResultsRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCriteriaLabels } from '@/lib/queries/search';
import { listSavedSearches } from '@/lib/queries/saved-search';
import {
  criteriaToQueryString,
  hasAnyCriteria,
  parseCriteriaFromParams,
} from '@/lib/search-criteria';
import { AppShell } from '@/components/layout/AppShell';
import { SaveSearchForm } from './SaveSearchForm';
import { SavedSearchList } from './SavedSearchList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSearch.save.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

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

/** Nom propose : la liste des criteres, pas un identifiant technique. */
function suggestName(parts: readonly string[]): string {
  return parts.slice(0, 4).join(' · ');
}

/** ISE-036 — Enregistrer la recherche et son alerte. */
export default async function SaveSearchPage({
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
  const criteria = parsed.ok ? parsed.criteria : null;
  const hasCriteria = criteria !== null && hasAnyCriteria(criteria);
  const queryString = criteria !== null ? criteriaToQueryString(criteria) : '';

  const [viewer, chips, saved] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    criteria !== null ? loadCriteriaLabels(criteria) : Promise.resolve([]),
    listSavedSearches(correlationId),
  ]);

  const chipLabels = [
    ...((criteria?.query ?? '').length > 0 ? [criteria?.query ?? ''] : []),
    ...chips.map((chip) => chip.label),
  ];

  return (
    <AppShell
      currentPath={SEARCH_ROUTES.save}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <p>
            <Link
              href={hasCriteria ? searchResultsRoute(queryString) : SEARCH_ROUTES.find}
              className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ← {frSearch.save.backToResults}
            </Link>
          </p>
          <h1 className="text-h1 text-text-primary font-bold">{frSearch.save.title}</h1>
          <p className="text-body text-text-secondary">{frSearch.save.subtitle}</p>
        </div>

        {/*
          1440 px : formulaire a gauche, recapitulatif des criteres et liste
          des recherches deja enregistrees a droite — l'utilisateur verifie
          ce qu'il enregistre sans quitter le formulaire.
          375 px : le recapitulatif passe AU-DESSUS du formulaire (on ne
          nomme pas une selection qu'on ne voit pas), la liste des
          recherches existantes passe tout en bas (MASTER PROMPT §57).
        */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
          <div className="flex flex-col gap-7 max-xl:order-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.save.title}</CardTitle>
              </CardHeader>
              <SaveSearchForm
                queryString={queryString}
                defaultName={suggestName(chipLabels)}
                savedSearchId={null}
                hasCriteria={hasCriteria}
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.save.listTitle}</CardTitle>
              </CardHeader>
              {saved.ok ? (
                <SavedSearchList rows={saved.data} />
              ) : (
                <ErrorState
                  title={frSearch.results.errorTitle}
                  description={saved.error.userMessage}
                  correlationId={correlationId}
                />
              )}
            </Card>
          </div>

          <aside className="flex flex-col gap-5 max-xl:order-1">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frSearch.save.criteriaLegend}</CardTitle>
              </CardHeader>

              {!hasCriteria ? (
                <>
                  <p className="text-body-sm text-text-secondary">{frSearch.save.criteriaEmpty}</p>
                  <p className="mt-4">
                    <Link href={SEARCH_ROUTES.find} className={ACTION_LINK}>
                      {frSearch.results.emptyAction}
                    </Link>
                  </p>
                </>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(criteria?.query ?? '').length > 0 ? (
                    <li className="rounded-base border-border bg-surface-muted border px-4 py-3">
                      <span className="text-caption text-text-muted block">
                        {frSearch.criteria.query}
                      </span>
                      <span className="text-body-sm text-text-primary">{criteria?.query}</span>
                    </li>
                  ) : null}
                  {chips.map((chip) => (
                    <li
                      key={`${chip.dimension}-${chip.value}`}
                      className="rounded-base border-border bg-surface-muted border px-4 py-3"
                    >
                      <span className="text-caption text-text-muted block">
                        {DIMENSION_LABEL[chip.dimension] ?? chip.dimension}
                      </span>
                      <span className="text-body-sm text-text-primary">{chip.label}</span>
                    </li>
                  ))}
                  {typeof criteria?.minYearsOfExperience === 'number' ? (
                    <li className="rounded-base border-border bg-surface-muted border px-4 py-3">
                      <span className="text-caption text-text-muted block">
                        {frSearch.criteria.experience}
                      </span>
                      <span className="text-body-sm text-text-primary">
                        {frSearch.criteria.experienceValue.replace(
                          '{years}',
                          String(criteria.minYearsOfExperience),
                        )}
                      </span>
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
