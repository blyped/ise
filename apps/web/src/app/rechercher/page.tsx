import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, EmptyState, ErrorState } from '@ise/ui-web';
import { frSearch } from '@/i18n/search';
import { ROUTES } from '@/lib/routes';
import { SEARCH_ROUTES, searchResultsRoute, saveSearchRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadSearchReferentials } from '@/lib/queries/search';
import { listSavedSearches } from '@/lib/queries/saved-search';
import { parseCriteriaFromParams } from '@/lib/search-criteria';
import { AppShell } from '@/components/layout/AppShell';
import { SearchForm } from './SearchForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSearch.find.title };

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-034 — Trouver un ISE.
 *
 * Les huit referentiels (competences, secteurs, fonctions, pays, zones,
 * promotions, langues, types de disponibilite) sont lus en base a chaque
 * affichage. Aucune liste n'est ecrite en dur ; un referentiel vide fait
 * disparaitre son critere plutot que d'afficher un filtre inerte.
 */
export default async function FindMemberPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const params = await searchParams;

  // `searchParams` de Next n'expose pas `getAll` : on le reconstruit.
  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) for (const entry of value) urlParams.append(key, entry);
    else if (typeof value === 'string') urlParams.append(key, value);
  }
  const parsed = parseCriteriaFromParams(urlParams);

  const [viewer, referentials, saved] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadSearchReferentials(),
    listSavedSearches(correlationId),
  ]);

  if (viewer.withoutProfile) {
    return (
      <AppShell currentPath={SEARCH_ROUTES.find} displayName={viewer.displayName}>
        <h1 className="text-h1 text-text-primary font-bold">{frSearch.find.title}</h1>
        <div className="mt-6">
          <Alert
            variant="info"
            title="Votre compte n’est pas encore rattaché à un profil ISE."
            action={
              <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
                Réclamer mon profil
              </Link>
            }
          >
            L’annuaire des membres n’est consultable qu’une fois votre profil réclamé et activé.
          </Alert>
        </div>
      </AppShell>
    );
  }

  const savedRows = saved.ok ? saved.data : [];

  return (
    <AppShell
      currentPath={SEARCH_ROUTES.find}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-8">
        <nav aria-label="Fil d’Ariane">
          <ol className="text-body-sm text-text-muted flex flex-wrap items-center gap-2">
            <li>{frSearch.find.breadcrumbNetwork}</li>
            <li aria-hidden="true">›</li>
            <li aria-current="page" className="text-primary font-medium">
              {frSearch.find.breadcrumbCurrent}
            </li>
          </ol>
        </nav>

        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSearch.find.title}</h1>
          <p className="text-body text-text-secondary">{frSearch.find.subtitle}</p>
        </header>

        {referentials.failed ? (
          <ErrorState
            title="Une partie des référentiels n’a pas pu être chargée."
            description="Les critères concernés sont masqués plutôt qu’affichés vides. Réessayez dans un instant."
            correlationId={correlationId}
          />
        ) : null}

        {!parsed.ok ? (
          <Alert variant="warning" title={frSearch.find.validationFailed}>
            Les critères présents dans l’adresse ont été ignorés. Renseignez-les de nouveau
            ci-dessous.
          </Alert>
        ) : null}

        {/* A 1440 px la colonne « recherches enregistrees » est laterale ;
            a 375 px elle passe SOUS le formulaire : on ne fait pas defiler
            l'utilisateur devant une liste avant de lui proposer de
            chercher (MASTER PROMPT §57). */}
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <SearchForm
            referentials={referentials}
            initial={
              parsed.ok
                ? parsed.criteria
                : {
                    skillIds: [],
                    sectorIds: [],
                    jobFunctionIds: [],
                    countryCodes: [],
                    subregionCodes: [],
                    promotionIds: [],
                    languageCodes: [],
                    availabilityTypes: [],
                    pageSize: 20,
                  }
            }
          />

          <aside className="flex flex-col gap-5" aria-labelledby="recherches-enregistrees">
            <Card>
              <CardHeader>
                <h2
                  id="recherches-enregistrees"
                  className="text-h4 text-text-primary font-semibold"
                >
                  {frSearch.find.savedTitle}
                </h2>
              </CardHeader>

              {!saved.ok ? (
                <ErrorState
                  title={frSearch.results.errorTitle}
                  description={saved.error.userMessage}
                  correlationId={correlationId}
                />
              ) : savedRows.length === 0 ? (
                <EmptyState
                  title={frSearch.find.savedEmpty}
                  description={frSearch.find.savedEmptyHint}
                />
              ) : (
                <ul className="flex flex-col gap-4">
                  {savedRows.slice(0, 6).map((row) => (
                    <li
                      key={row.savedSearchId}
                      className="border-border border-b pb-4 last:border-b-0 last:pb-0"
                    >
                      <p className="text-body-sm text-text-primary font-semibold">{row.name}</p>
                      <p className="mt-2">
                        <Badge tone={row.alertStatus === 'active' ? 'info' : 'neutral'}>
                          {row.alertEnabled
                            ? row.alertStatus === 'paused'
                              ? frSearch.find.savedAlertPaused
                              : frSearch.find.savedAlertOn
                            : frSearch.find.savedAlertOff}
                        </Badge>
                      </p>
                      {row.criteria !== null ? (
                        <p className="mt-3">
                          <Link
                            href={searchResultsRoute(row.queryString)}
                            className={`${LINK_CLASS} text-body-sm`}
                          >
                            {frSearch.find.savedOpen}
                          </Link>
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-5">
                <Link href={saveSearchRoute('')} className={`${LINK_CLASS} text-body-sm`}>
                  {frSearch.find.savedManage}
                </Link>
              </p>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
