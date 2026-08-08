import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES } from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipHome, loadInternshipOffers } from '@/lib/queries/internships';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { formatDate } from '@/lib/collaborate-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  INPUT,
  LINK_BUTTON,
  LoadMoreLink,
  PRIMARY_BUTTON,
  PageHeader,
  RelevanceBadge,
  ReasonList,
  SELECT,
  StatGrid,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.home.title };

const SCOPES = ['for_me', 'all', 'partners'] as const;
type Scope = (typeof SCOPES)[number];

const RELEVANCE_LABELS: Record<string, string> = {
  very_relevant: frInternships.offer.relevanceVeryRelevant,
  relevant: frInternships.offer.relevanceRelevant,
  close_profile: frInternships.offer.relevanceCloseProfile,
};

const SUCCESS: Record<string, string> = { need_saved: frInternships.preferences.done };

/**
 * ISE-072 — Espace stages, version eleve.
 *
 * Le module ne s'adresse qu'aux profils `student` : la base repond
 * `42501` a un diplome et cet ecran le traduit par un etat explicite
 * qui renvoie vers l'espace « aider », plutot que par une page blanche
 * ou un acces silencieusement vide (D-93).
 */
export default async function InternshipHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const feedback = readFeedback(query);
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const rawScope = one(query['onglet']) ?? 'for_me';
  const scope: Scope = (SCOPES as readonly string[]).includes(rawScope)
    ? (rawScope as Scope)
    : 'for_me';
  const search = one(query['recherche']);
  const countryCode = one(query['pays']);
  const sectorParam = one(query['domaine']);
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, home, page, countries, sectors] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipHome(correlationId),
    loadInternshipOffers(
      {
        scope,
        query: search,
        countryCode,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
        maxMonths: null,
      },
      cursor,
      correlationId,
    ),
    loadCountries(correlationId),
    loadSectors(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const crumbs = (
    <Breadcrumb
      label={frInternships.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.internshipsTitle, href: null },
      ]}
    />
  );

  // Un diplome n'a rien a faire ici : on le dit, et on lui ouvre sa porte.
  if (!home.ok && home.error.code === 'not_authorized') {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.common.studentsOnlyTitle}
          description={frInternships.common.studentsOnlyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.alumni} className={PRIMARY_BUTTON}>
              {frInternships.common.studentsOnlyAction}
            </Link>
          }
        />
      </div>,
    );
  }

  if (!home.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frInternships.common.loadErrorTitle}
          description={home.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = page.ok ? page.data.rows : [];

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.home.title}
        subtitle={frInternships.home.subtitle}
        actions={
          <Link href={INTERNSHIP_ROUTES.preferences} className={LINK_BUTTON}>
            {home.data.need === null ? frInternships.home.declareSearch : frInternships.home.adjust}
          </Link>
        }
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      {home.data.need === null ? (
        <Alert
          variant="action"
          title={frInternships.home.noNeedTitle}
          action={
            <Link href={INTERNSHIP_ROUTES.preferences} className={PRIMARY_BUTTON}>
              {frInternships.home.declareSearch}
            </Link>
          }
        >
          {frInternships.home.noNeedBody}
        </Alert>
      ) : (
        <StatGrid
          label={frInternships.home.title}
          items={[
            {
              value: String(home.data.counters.applications),
              caption: frInternships.home.counterApplications,
            },
            {
              value: String(home.data.counters.interviews),
              caption: frInternships.home.counterInterviews,
            },
            {
              value: String(home.data.counters.offersReceived),
              caption: frInternships.home.counterOffers,
            },
            {
              value: String(home.data.counters.helpers),
              caption: frInternships.home.counterHelpers,
            },
          ]}
        />
      )}

      {home.data.placement === null ? null : (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frInternships.home.placementTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary">
            {frInternships.home.placementBody
              .replace('{organization}', home.data.placement.organization ?? '')
              .replace('{start}', formatDate(home.data.placement.startDate) ?? '')
              .replace('{end}', formatDate(home.data.placement.endDate) ?? '')}
          </p>
        </Card>
      )}

      <TabLinks
        label={frInternships.home.title}
        current={scope}
        items={[
          { id: 'for_me', label: frInternships.home.tabForMe, href: INTERNSHIP_ROUTES.home },
          {
            id: 'all',
            label: frInternships.home.tabAll,
            href: `${INTERNSHIP_ROUTES.home}?onglet=all`,
          },
          {
            id: 'partners',
            label: frInternships.home.tabPartners,
            href: `${INTERNSHIP_ROUTES.home}?onglet=partners`,
          },
          // L'onglet « Mes candidatures » pointait vers INTERNSHIP_ROUTES.applications
          // (`/stages/candidatures`), route qui N'EXISTE PAS : ISE-076 n'est pas livre.
          // Un onglet qui mene a une 404 est un bouton decoratif (MASTER PROMPT §113).
          // Il reviendra avec l'ecran, pas avant.
        ]}
      />

      <form method="get" action={INTERNSHIP_ROUTES.home} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={scope} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-stages" className="sr-only">
            {frInternships.home.searchPlaceholder}
          </label>
          <input
            id="recherche-stages"
            name="recherche"
            type="search"
            defaultValue={search ?? ''}
            placeholder={frInternships.home.searchPlaceholder}
            className={INPUT}
          />
          <button type="submit" className={PRIMARY_BUTTON}>
            {frInternships.home.filterApply}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frInternships.home.filterCountry}
            <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
              <option value="">{frInternships.home.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frInternships.home.filterSector}
            <select name="domaine" defaultValue={sectorParam ?? ''} className={SELECT}>
              <option value="">{frInternships.home.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frInternships.home.title} className="flex min-w-0 flex-col gap-5">
          {!page.ok ? (
            <ErrorState
              title={frInternships.common.loadErrorTitle}
              description={page.error.userMessage}
              correlationId={correlationId}
            />
          ) : rows.length === 0 ? (
            <EmptyState
              title={frInternships.home.emptyTitle}
              description={frInternships.home.emptyBody}
              action={
                <Link href={`${INTERNSHIP_ROUTES.home}?onglet=all`} className={LINK_BUTTON}>
                  {frInternships.home.tabAll}
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {rows.map((offer) => (
                <li key={offer.offerId}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <Badge tone="neutral">{frInternships.offer.badge}</Badge>
                      <RelevanceBadge relevance={offer.relevance} labels={RELEVANCE_LABELS} />
                    </div>
                    <h3 className="text-h3 text-text-primary font-semibold">{offer.title}</h3>
                    <p className="text-caption text-text-secondary">
                      {[offer.organization, offer.city, offer.countryName]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {offer.skills.length === 0 ? null : (
                      <ul className="flex flex-wrap gap-2">
                        {offer.skills.slice(0, 3).map((skill) => (
                          <li key={skill}>
                            <Chip>{skill}</Chip>
                          </li>
                        ))}
                      </ul>
                    )}
                    <ReasonList reasons={offer.relevance.reasons.slice(0, 2)} />
                    {/* ISE-073 et ISE-074 ne sont pas encore livres : aucun
                        lien ne pointe vers un ecran inexistant (MASTER
                        PROMPT §113, convention « À venir » de la barre
                        laterale). */}
                    <p className="text-caption text-text-muted mt-auto pt-2">
                      {frInternships.common.detailComingSoon}
                    </p>
                    {offer.deadline === null ? null : (
                      <p className="text-caption text-warning">
                        {frInternships.offer.deadline.replace(
                          '{date}',
                          formatDate(offer.deadline) ?? '',
                        )}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <LoadMoreLink
            href={`${INTERNSHIP_ROUTES.home}?onglet=${scope}`}
            label={frInternships.home.loadMore}
            nextCursor={page.ok ? page.data.nextCursor : null}
          />
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.home.networkTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frInternships.home.networkBody.replace(
                '{count}',
                String(rows.filter((offer) => offer.networkIseCount > 0).length),
              )}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.home.alumniTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frInternships.home.alumniBody}</p>
            <p className="mt-5">
              <Link href={INTERNSHIP_ROUTES.alumni} className={LINK_BUTTON}>
                {frInternships.home.alumniAction}
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
