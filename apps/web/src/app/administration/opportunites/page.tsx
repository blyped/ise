import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminOpportunityRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminOpportunities } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.opportunities.title };

const MODERATION_FILTERS = ['pending', 'approved', 'rejected', 'not_required'] as const;
const STATUS_FILTERS = [
  'draft',
  'active',
  'paused',
  'closed',
  'expired',
  'cancelled',
  'moderated',
] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-019 — Gestion des opportunites (`admin_list_opportunities`,
 * permission `opportunities.manage`). Sans filtre explicite, l'ecran
 * ouvre la FILE DE MODERATION (`moderation_status = 'pending'`) : les
 * offres relayees d'une source externe attendent une validation avant
 * publication (0008). Le filtre « Tous » leve cette restriction.
 */
export default async function AdminOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('opportunities.manage');
  const params = await searchParams;

  // File `pending` par defaut ; `moderation=tous` montre tout.
  const rawModeration = paramValue(params, 'moderation');
  const moderation =
    rawModeration === 'tous'
      ? null
      : (paramOneOf(params, 'moderation', MODERATION_FILTERS) ?? 'pending');
  const status = paramOneOf(params, 'statut', STATUS_FILTERS);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminOpportunities(moderation, status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.opportunities}
      screenTitle={frAdmin.opportunities.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader title={frAdmin.opportunities.title} subtitle={frAdmin.opportunities.subtitle} />
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
  const moderationValue = moderation ?? 'tous';

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.opportunities}
        selects={[
          {
            name: 'moderation',
            label: frAdmin.opportunities.filterModeration,
            value: moderationValue === 'tous' ? '' : moderationValue,
            options: MODERATION_FILTERS.map((value) => ({
              value,
              label: frAdmin.opportunities.moderation[value] ?? value,
            })),
          },
          {
            name: 'statut',
            label: frAdmin.opportunities.filterStatus,
            value: status ?? '',
            options: STATUS_FILTERS.map((value) => ({
              value,
              label: frAdmin.opportunities.status[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState
          title={frAdmin.opportunities.empty}
          description={frAdmin.opportunities.emptyBody}
        />
      ) : (
        <>
          <RowList label={frAdmin.opportunities.title}>
            {rows.map((row) => (
              <RowCard
                key={row.opportunityId}
                title={row.title}
                meta={[
                  row.organization ?? row.authorName ?? frAdmin.common.none,
                  frAdmin.opportunities.origin[row.origin] ?? row.origin,
                  formatDate(row.createdAt),
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.moderationStatus}
                      label={
                        frAdmin.opportunities.moderation[row.moderationStatus] ??
                        row.moderationStatus
                      }
                    />
                    <StatusBadge
                      status={row.status}
                      label={frAdmin.opportunities.status[row.status] ?? row.status}
                    />
                  </>
                }
                actions={
                  <Link href={adminOpportunityRoute(row.opportunityId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.opportunities,
              { moderation: moderationValue, statut: status },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
