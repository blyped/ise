import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { ADMIN_ROUTES, adminCommunityRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCommunities } from '@/lib/admin/queries-communities';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCommunities.list.title };

const COMMUNITY_STATUSES = ['draft', 'active', 'inactive', 'merged', 'archived'] as const;
const COMMUNITY_TYPES = ['country', 'sector', 'thematic', 'special'] as const;
const VISIBILITIES = ['network', 'private'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-027 — Liste administrative des communautes : tous statuts (y
 * compris brouillon) et visibilites (y compris privees), invisibles de
 * `list_communities` (l'ecran membre) qui filtre par
 * `private.can_see_community`. Permission `communities.manage`
 * (verifiee ici ET en base par `admin_list_communities`, 0099).
 */
export default async function AdminCommunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('communities.manage');
  const params = await searchParams;
  const query = paramValue(params, 'recherche');
  const status = paramOneOf(params, 'statut', COMMUNITY_STATUSES);
  const communityType = paramOneOf(params, 'type', COMMUNITY_TYPES);
  const visibility = paramOneOf(params, 'visibilite', VISIBILITIES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminCommunities({ status, communityType, visibility, query }, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.communities} screenTitle={frAdminCommunities.list.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAdminCommunities.list.title}
      subtitle={frAdminCommunities.list.subtitle}
      action={{ href: ADMIN_ROUTES.communityNew, label: frAdminCommunities.list.newCommunity }}
    />
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.communities}
        search={{
          name: 'recherche',
          placeholder: frAdminCommunities.list.searchPlaceholder,
          value: query ?? '',
        }}
        selects={[
          {
            name: 'statut',
            label: frAdminCommunities.list.filterStatus,
            value: status ?? '',
            options: COMMUNITY_STATUSES.map((value) => ({
              value,
              label: frAdminCommunities.status[value] ?? value,
            })),
          },
          {
            name: 'type',
            label: frAdminCommunities.list.filterType,
            value: communityType ?? '',
            options: COMMUNITY_TYPES.map((value) => ({
              value,
              label: frAdminCommunities.communityType[value] ?? value,
            })),
          },
          {
            name: 'visibilite',
            label: frAdminCommunities.list.filterVisibility,
            value: visibility ?? '',
            options: VISIBILITIES.map((value) => ({
              value,
              label: frAdminCommunities.visibility[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdminCommunities.list.empty} description={frAdminCommunities.list.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminCommunities.list.title}>
            {rows.map((row) => (
              <RowCard
                key={row.communityId}
                title={row.name}
                meta={[
                  `${frAdminCommunities.list.columns.type} : ${frAdminCommunities.communityType[row.communityType] ?? row.communityType}`,
                  `${frAdminCommunities.list.columns.visibility} : ${frAdminCommunities.visibility[row.visibility] ?? row.visibility}`,
                  `${frAdminCommunities.list.columns.members} : ${row.memberCount}`,
                ].join(' · ')}
                badges={
                  <StatusBadge status={row.status} label={frAdminCommunities.status[row.status] ?? row.status} />
                }
                actions={
                  <Link href={adminCommunityRoute(row.communityId)} className={DETAIL_LINK}>
                    {frAdminCommunities.list.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.communities,
              { recherche: query, statut: status, type: communityType, visibilite: visibility },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
