import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminPromotionRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminPromotions } from '@/lib/admin/queries';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.promotions.title };

const PROMOTION_STATUSES = ['active', 'archived'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-008 — Gestion des promotions : decomptes REELS par promotion
 * (profils, actifs, non reclames, signalements), creation, acces au
 * detail. Permission `promotions.manage` (verifiee ici ET en base).
 */
export default async function AdminPromotionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const params = await searchParams;
  const query = paramValue(params, 'recherche');
  const status = paramOneOf(params, 'statut', PROMOTION_STATUSES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminPromotions(query, status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdmin.promotions.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAdmin.promotions.title}
      subtitle={frAdmin.promotions.subtitle}
      action={{ href: ADMIN_ROUTES.promotionNew, label: frAdmin.promotions.newPromotion }}
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

      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterBar
          action={ADMIN_ROUTES.promotions}
          search={{
            name: 'recherche',
            placeholder: frAdmin.promotions.searchPlaceholder,
            value: query ?? '',
          }}
          selects={[
            {
              name: 'statut',
              label: frAdmin.promotions.filterStatus,
              value: status ?? '',
              options: PROMOTION_STATUSES.map((value) => ({
                value,
                label: frAdmin.promotions.status[value] ?? value,
              })),
            },
          ]}
        />
        <Link href={ADMIN_ROUTES.promotionSuggestions} className={DETAIL_LINK}>
          {frAdmin.promotions.suggestionsLink}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.promotions.empty} description={frAdmin.promotions.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.promotions.title}>
            {rows.map((row) => (
              <RowCard
                key={row.promotionId}
                title={row.name}
                meta={[
                  `${frAdmin.promotions.columns.profiles} : ${row.totalProfiles}`,
                  `${frAdmin.promotions.columns.active} : ${row.activeMembers}`,
                  `${frAdmin.promotions.columns.unclaimed} : ${row.unclaimedProfiles}`,
                  `${frAdmin.promotions.columns.suggestions} : ${row.suggestionsPending}`,
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={row.status}
                    label={frAdmin.promotions.status[row.status] ?? row.status}
                  />
                }
                actions={
                  <Link href={adminPromotionRoute(row.promotionId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.promotions,
              { recherche: query, statut: status },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
