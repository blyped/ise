import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCommunities } from '@/i18n/communities';
import { ROUTES } from '@/lib/routes';
import { COMMUNITY_ROUTES, communityRoute } from '@/lib/routes/communities';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCommunities } from '@/lib/queries/communities';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { formatDay, toCommunityScope, type CommunityCard } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { JoinCommunityForm } from '@/components/collab/JoinCommunityForm';
import {
  ACTION_LINK,
  CHIP,
  FIELD,
  PRIMARY_LINK,
  SELECT,
  TAB_BASE,
  TAB_CURRENT,
  TAB_IDLE,
} from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCommunities.list.title };

const TABS = [
  { id: 'for_me', label: frCommunities.list.tabForMe },
  { id: 'all', label: frCommunities.list.tabAll },
  { id: 'mine', label: frCommunities.list.tabMine },
  { id: 'new', label: frCommunities.list.tabNew },
] as const;

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

function reasonLabel(code: string): string {
  if (code === 'skill_domain') return frCommunities.reason.skill_domain;
  if (code === 'sector') return frCommunities.reason.sector;
  if (code === 'country') return frCommunities.reason.country;
  if (code === 'connections') return frCommunities.reason.connections;
  return code;
}

function typeLabel(communityType: string): string {
  const labels: Record<string, string> = frCommunities.type;
  return labels[communityType] ?? communityType;
}

/**
 * ISE-084 — Espace Communautés.
 *
 * L'onglet par défaut est « Pour moi ». Il ne montre que des
 * communautés pour lesquelles la base a produit au moins une raison
 * explicite (CA-COMM-02) : une liste sans explication serait un
 * classement déguisé.
 *
 * ÉCART ASSUMÉ (MASTER PROMPT §1) : la maquette suggère un encart
 * « Activité récente » chiffrant les échanges par communauté. Seule la
 * date de la dernière publication et le nombre de questions ouvertes
 * sont rendus : un décompte d'échanges affiché en rail latéral serait
 * lu comme un palmarès, ce que la spécification interdit.
 *
 * RESPONSIVE : à 375 px les onglets défilent, les filtres passent en
 * pile, les cartes en une colonne et le rail latéral sous la liste.
 */
export default async function CommunitiesPage({
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
  const scope = toCommunityScope(params['onglet']);
  const query = one(params['recherche']);
  const communityType = one(params['type']);
  const countryCode = one(params['pays']);
  const sectorParam = one(params['secteur']);
  const cursor = unsealCursor(one(params['curseur']));
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);

  const correlationId = newCorrelationId();
  const [viewer, page, sectors, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCommunities(
      {
        scope,
        query,
        communityType,
        countryCode,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
      },
      cursor,
      correlationId,
    ),
    loadSectors(correlationId),
    loadCountries(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={COMMUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-primary font-medium">{frCommunities.common.breadcrumb}</p>
      <h1 className="text-h1 text-text-primary font-bold">{frCommunities.list.title}</h1>
      <p className="text-body text-text-secondary">{frCommunities.list.subtitle}</p>
    </div>
  );

  const tabs = (
    <nav aria-label={frCommunities.list.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.id === scope;
          return (
            <li key={tab.id}>
              <Link
                href={`${COMMUNITY_ROUTES.list}?onglet=${tab.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`${TAB_BASE} ${isCurrent ? TAB_CURRENT : TAB_IDLE}`}
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
          title={frCommunities.common.loadErrorTitle}
          description={`${frCommunities.common.loadErrorBody} ${page.error.userMessage}`}
          correlationId={correlationId}
          action={
            <Link href={`${COMMUNITY_ROUTES.list}?onglet=${scope}`} className={ACTION_LINK}>
              {frCommunities.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const activeFilters: Record<string, string> = { onglet: scope };
  if (query !== null) activeFilters['recherche'] = query;
  if (communityType !== null) activeFilters['type'] = communityType;
  if (countryCode !== null) activeFilters['pays'] = countryCode;
  if (sectorParam !== null) activeFilters['secteur'] = sectorParam;

  const nextHref =
    page.data.nextCursor === null
      ? null
      : `${COMMUNITY_ROUTES.list}?${new URLSearchParams({
          ...activeFilters,
          curseur: page.data.nextCursor,
        }).toString()}`;

  const emptyTitle =
    scope === 'for_me'
      ? frCommunities.list.emptyForMeTitle
      : scope === 'mine'
        ? frCommunities.list.emptyMineTitle
        : frCommunities.list.emptyAllTitle;
  const emptyBody =
    scope === 'for_me'
      ? frCommunities.list.emptyForMeBody
      : scope === 'mine'
        ? frCommunities.list.emptyMineBody
        : frCommunities.list.emptyAllBody;

  const card = (community: CommunityCard) => {
    const last = formatDay(community.lastActivityAt);
    return (
      <li key={community.communityId}>
        <Card className="h-full">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-h3 text-text-primary font-semibold">
                <Link
                  href={communityRoute(community.communityId)}
                  className="focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {community.name}
                </Link>
              </h2>
              <p className="text-caption text-text-secondary mt-1">
                {typeLabel(community.communityType)}
                {community.typeLabel === null ? '' : ` · ${community.typeLabel}`} ·{' '}
                {community.memberCount} {frCommunities.common.members}
              </p>
            </div>
            {community.isMember ? (
              <Badge tone="success">{frCommunities.common.memberBadge}</Badge>
            ) : community.membership?.status === 'pending' ? (
              <Badge tone="warning">{frCommunities.common.pendingBadge}</Badge>
            ) : (
              <Badge tone="neutral">
                {frCommunities.joinPolicy[
                  community.joinPolicy as 'open' | 'request' | 'invitation'
                ] ?? community.joinPolicy}
              </Badge>
            )}
          </div>

          <p className="text-body-sm text-text-secondary mt-3">{community.description}</p>

          {community.reasons.length > 0 ? (
            <ul className="mt-4 flex flex-col gap-1">
              {community.reasons.map((reason) => (
                <li key={reason.code} className="text-caption text-text-secondary">
                  ✓ {reasonLabel(reason.code)}
                  {reason.label === null ? '' : ` — ${reason.label}`}
                  {reason.detail === null ? '' : ` (${reason.detail})`}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
            <span className="text-caption text-text-muted">
              {last === null
                ? 'Aucune publication pour le moment'
                : `${frCommunities.list.lastActivity} : ${last}`}
            </span>
            {community.openQuestionCount > 0 ? (
              <span className={CHIP}>
                {community.openQuestionCount} {frCommunities.list.openQuestions}
              </span>
            ) : null}
            <span className="ml-auto flex flex-wrap gap-3">
              <Link href={communityRoute(community.communityId)} className={ACTION_LINK}>
                {frCommunities.list.open}
              </Link>
              {!community.isMember && community.membership === null ? (
                <JoinCommunityForm
                  communityId={community.communityId}
                  joinPolicy={community.joinPolicy}
                />
              ) : null}
            </span>
          </div>
        </Card>
      </li>
    );
  };

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <form method="get" action={COMMUNITY_ROUTES.list} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={scope} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-communautes" className="sr-only">
            {frCommunities.list.searchLabel}
          </label>
          <input
            id="recherche-communautes"
            name="recherche"
            type="search"
            defaultValue={query ?? ''}
            placeholder={frCommunities.list.searchPlaceholder}
            className={`${FIELD} flex-1`}
          />
          <button type="submit" className={PRIMARY_LINK}>
            {frCommunities.list.searchSubmit}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCommunities.list.filterType}
            <select name="type" defaultValue={communityType ?? ''} className={SELECT}>
              <option value="">{frCommunities.list.filterAll}</option>
              <option value="country">{frCommunities.type.country}</option>
              <option value="sector">{frCommunities.type.sector}</option>
              <option value="thematic">{frCommunities.type.thematic}</option>
              <option value="special">{frCommunities.type.special}</option>
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCommunities.list.filterSector}
            <select name="secteur" defaultValue={sectorParam ?? ''} className={SELECT}>
              <option value="">{frCommunities.list.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frCommunities.list.filterCountry}
            <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
              <option value="">{frCommunities.list.filterAll}</option>
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
            {frCommunities.list.filterApply}
          </button>
          {Object.keys(activeFilters).length > 1 ? (
            <Link href={`${COMMUNITY_ROUTES.list}?onglet=${scope}`} className={ACTION_LINK}>
              {frCommunities.list.searchClear}
            </Link>
          ) : null}
        </div>
      </form>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frCommunities.list.title} className="flex min-w-0 flex-col gap-5">
          {rows.length === 0 ? (
            <EmptyState
              title={emptyTitle}
              description={emptyBody}
              action={
                <Link href={`${COMMUNITY_ROUTES.list}?onglet=all`} className={ACTION_LINK}>
                  {frCommunities.list.emptyForMeAction}
                </Link>
              }
            />
          ) : (
            <>
              <ul className="grid gap-5 lg:grid-cols-2">{rows.map(card)}</ul>
              {nextHref === null ? (
                <p className="text-caption text-text-muted">{frCommunities.common.endOfList}</p>
              ) : (
                <Link href={nextHref} className={`${ACTION_LINK} self-start`}>
                  {frCommunities.common.loadMore}
                </Link>
              )}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frCommunities.reason.title}>
            {frCommunities.list.emptyForMeBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.list.contributeTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frCommunities.list.contributeBody}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCommunities.list.noCreationTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frCommunities.list.noCreationBody}</p>
            <p className="mt-5">
              <Link href={SUPPORT_ROUTES.help} className={ACTION_LINK}>
                Contacter l’assistance
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
