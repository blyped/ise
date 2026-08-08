import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import {
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import {
  PROMOTION_ROUTES,
  promotionInvitationsRoute,
  promotionMembersRoute,
  promotionReferencedMemberRoute,
  promotionRoute,
} from '@/lib/routes/promotions';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadPromotionMembers } from '@/lib/queries/promotions';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  INPUT,
  LINK_BUTTON,
  LoadMoreLink,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.overview.tabMembers };

const STATUSES = ['all', 'claimed', 'to_find', 'can_help'] as const;
type MemberStatus = (typeof STATUSES)[number];

/**
 * ISE-068 — Membres de la promotion.
 *
 * CA-PROMO-03 : la carte d'un profil non reclame reste MINIMALE. Elle
 * n'affiche ni organisation, ni fonction, ni compétence — la base ne les
 * projette pas — et surtout aucune coordonnee historique.
 */
export default async function PromotionMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ promotionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  if (Number.isNaN(promotionId)) notFound();

  const query = await searchParams;
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const rawTab = one(query['onglet']) ?? 'all';
  const status: MemberStatus = (STATUSES as readonly string[]).includes(rawTab)
    ? (rawTab as MemberStatus)
    : 'all';
  const search = one(query['recherche']);
  const countryCode = one(query['pays']);
  const sectorParam = one(query['secteur']);
  const sectorId = sectorParam === null ? null : Number.parseInt(sectorParam, 10);
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, page, countries, sectors] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadPromotionMembers(
      promotionId,
      {
        query: search,
        countryCode,
        sectorId: sectorId !== null && !Number.isNaN(sectorId) ? sectorId : null,
        skillId: null,
        status,
      },
      cursor,
      correlationId,
    ),
    loadCountries(correlationId),
    loadSectors(correlationId),
  ]);

  const base = promotionMembersRoute(promotionId);
  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <Breadcrumb
          label={frPromotions.common.breadcrumb}
          items={[
            { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
            { label: frPromotions.overview.tabMembers, href: null },
          ]}
        />
        <ErrorState
          title={frPromotions.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, facets } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frPromotions.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.promotionTitle, href: promotionRoute(promotionId) },
          { label: frPromotions.overview.tabMembers, href: null },
        ]}
      />

      <PageHeader
        title={frPromotions.members.title.replace('{promotion}', String(promotionId))}
        subtitle={frPromotions.members.subtitle
          .replace('{referenced}', String(facets.all))
          .replace('{claimed}', String(facets.claimed))
          .replace('{toFind}', String(facets.toFind))}
        actions={
          <Link href={promotionInvitationsRoute(promotionId)} className={PRIMARY_BUTTON}>
            {frPromotions.overview.invite}
          </Link>
        }
      />

      <form method="get" action={base} className="flex flex-col gap-4">
        <input type="hidden" name="onglet" value={status} />
        <div className="flex flex-col gap-3 sm:flex-row">
          <label htmlFor="recherche-membres" className="sr-only">
            {frPromotions.members.searchLabel}
          </label>
          <input
            id="recherche-membres"
            name="recherche"
            type="search"
            defaultValue={search ?? ''}
            placeholder={frPromotions.members.searchPlaceholder}
            className={INPUT}
          />
          <button type="submit" className={PRIMARY_BUTTON}>
            {frPromotions.members.filterApply}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frPromotions.members.filterCountry}
            <select name="pays" defaultValue={countryCode ?? ''} className={SELECT}>
              <option value="">{frPromotions.members.filterAll}</option>
              {(countries.ok ? countries.data : []).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-caption text-text-secondary flex flex-col gap-1">
            {frPromotions.members.filterSector}
            <select name="secteur" defaultValue={sectorParam ?? ''} className={SELECT}>
              <option value="">{frPromotions.members.filterAll}</option>
              {(sectors.ok ? sectors.data : []).map((sector) => (
                <option key={sector.id} value={String(sector.id)}>
                  {sector.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      <TabLinks
        label={frPromotions.overview.tabMembers}
        current={status}
        items={[
          { id: 'all', label: `${frPromotions.members.tabAll} ${facets.all}`, href: base },
          {
            id: 'claimed',
            label: `${frPromotions.members.tabClaimed} ${facets.claimed}`,
            href: `${base}?onglet=claimed`,
          },
          {
            id: 'to_find',
            label: `${frPromotions.members.tabToFind} ${facets.toFind}`,
            href: `${base}?onglet=to_find`,
          },
          {
            id: 'can_help',
            label: `${frPromotions.members.tabCanHelp} ${facets.canHelp}`,
            href: `${base}?onglet=can_help`,
          },
        ]}
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frPromotions.overview.tabMembers}
          className="flex min-w-0 flex-col gap-5"
        >
          {rows.length === 0 ? (
            <EmptyState
              title={frPromotions.members.emptyTitle}
              description={frPromotions.members.emptyBody}
              action={
                <Link href={`${base}?onglet=to_find`} className={LINK_BUTTON}>
                  {frPromotions.members.sideHelpAction}
                </Link>
              }
            />
          ) : (
            <ul className="grid gap-5 lg:grid-cols-2">
              {rows.map((member) => (
                <li key={member.profileId}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={member.displayName} size={40} />
                        <div className="flex min-w-0 flex-col">
                          <span className="text-body-sm text-text-primary truncate font-semibold">
                            {member.displayName}
                          </span>
                          {member.isClaimed ? (
                            <span className="text-caption text-text-secondary truncate">
                              {[member.position, member.organization, member.city]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          ) : (
                            <span className="text-caption text-text-secondary truncate">
                              {member.countryName ?? ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge tone={member.isClaimed ? 'success' : 'warning'}>
                        {member.isClaimed
                          ? frPromotions.members.badgeClaimed
                          : frPromotions.members.badgeReferenced}
                      </Badge>
                    </div>

                    {member.skills.length === 0 ? null : (
                      <ul className="flex flex-wrap gap-2">
                        {member.skills.map((skill) => (
                          <li key={skill}>
                            <Chip>{skill}</Chip>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                      {member.availabilityHelp ? (
                        <Badge tone="info">{frPromotions.members.badgeAvailable}</Badge>
                      ) : null}
                      {member.isClaimed ? (
                        <Link href={memberProfileRoute(member.profileId)} className={LINK_BUTTON}>
                          {frPromotions.members.seeProfile}
                        </Link>
                      ) : (
                        <Link
                          href={promotionReferencedMemberRoute(promotionId, member.profileId)}
                          className={LINK_BUTTON}
                        >
                          {frPromotions.members.helpFind}
                        </Link>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <LoadMoreLink
            href={`${base}?onglet=${status}`}
            label={frPromotions.members.loadMore}
            nextCursor={page.data.nextCursor}
          />
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.members.distributionTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-2">
              <div className="flex items-baseline gap-3">
                <dt className="text-h3 text-text-primary font-bold">{facets.claimed}</dt>
                <dd className="text-caption text-text-secondary">
                  {frPromotions.overview.statClaimed}
                </dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="text-h3 text-text-primary font-bold">{facets.toFind}</dt>
                <dd className="text-caption text-text-secondary">
                  {frPromotions.members.tabToFind}
                </dd>
              </div>
              <div className="flex items-baseline gap-3">
                <dt className="text-h3 text-text-primary font-bold">{facets.canHelp}</dt>
                <dd className="text-caption text-text-secondary">
                  {frPromotions.members.tabCanHelp}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frPromotions.members.sideHelpTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frPromotions.members.sideHelpBody}</p>
            <p className="mt-5">
              <Link href={`${base}?onglet=to_find`} className={LINK_BUTTON}>
                {frPromotions.members.sideHelpAction}
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
