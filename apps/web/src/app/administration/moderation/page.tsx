import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminReportRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminReports } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.moderation.title };

const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-018 / SA-038 — File des signalements (`admin_list_reports`,
 * permission `profiles.moderate`). Sans filtre, la file montre ce qui
 * attend une decision : open + reviewing. Un trigger refuse tout UPDATE
 * direct de `status` : seules les transitions de `transition_report`
 * existent.
 */
export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('profiles.moderate');
  const params = await searchParams;
  const status = paramOneOf(params, 'statut', REPORT_STATUSES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminReports(status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.moderation}
      screenTitle={frAdmin.moderation.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader title={frAdmin.moderation.title} subtitle={frAdmin.moderation.subtitle} />
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
        action={ADMIN_ROUTES.moderation}
        selects={[
          {
            name: 'statut',
            label: frAdmin.moderation.filterLabel,
            value: status ?? '',
            options: REPORT_STATUSES.map((value) => ({
              value,
              label: frAdmin.moderation.status[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.moderation.empty} description={frAdmin.moderation.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.moderation.title}>
            {rows.map((row) => (
              <RowCard
                key={row.reportId}
                title={row.reasonName || row.reasonCode}
                meta={[
                  frAdmin.moderation.targetType[row.targetType] ?? row.targetType,
                  `${frAdmin.moderation.reportedBy} ${row.reporterName ?? frAdmin.common.none}`,
                  formatDateTime(row.createdAt),
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.status}
                      label={frAdmin.moderation.status[row.status] ?? row.status}
                    />
                    <StatusBadge
                      status={row.severity}
                      label={frAdmin.moderation.severity[row.severity] ?? row.severity}
                    />
                  </>
                }
                actions={
                  <Link href={adminReportRoute(row.reportId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(ADMIN_ROUTES.moderation, { statut: status }, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
