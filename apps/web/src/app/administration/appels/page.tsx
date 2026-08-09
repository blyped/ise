import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminCallRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCalls } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.calls.title };

const CALL_FILTERS = [
  'reported',
  'active',
  'paused',
  'resolved',
  'closed',
  'expired',
  'cancelled',
  'moderated',
] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-016 — File de moderation des appels au reseau
 * (`admin_list_network_calls`, permission `calls.moderate`). Les
 * brouillons n'y figurent JAMAIS : un brouillon est un espace prive du
 * membre. Le filtre « Signalés » montre les appels portant au moins un
 * signalement ouvert — c'est la file de travail du moderateur.
 */
export default async function AdminCallsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('calls.moderate');
  const params = await searchParams;
  const status = paramOneOf(params, 'statut', CALL_FILTERS);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminCalls(status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.calls} screenTitle={frAdmin.calls.title}>
      {children}
    </AdminShell>
  );

  const header = <PageHeader title={frAdmin.calls.title} subtitle={frAdmin.calls.subtitle} />;

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
        action={ADMIN_ROUTES.calls}
        selects={[
          {
            name: 'statut',
            label: frAdmin.calls.filterLabel,
            value: status ?? '',
            options: CALL_FILTERS.map((value) => ({
              value,
              label:
                value === 'reported'
                  ? frAdmin.calls.reportedFilter
                  : (frAdmin.calls.status[value] ?? value),
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.calls.empty} description={frAdmin.calls.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.calls.title}>
            {rows.map((row) => (
              <RowCard
                key={row.callId}
                title={row.title}
                meta={[
                  row.authorName,
                  formatDate(row.createdAt),
                  `${frAdmin.calls.columns.reports} : ${row.openReports}`,
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.status}
                      label={frAdmin.calls.status[row.status] ?? row.status}
                    />
                    {row.urgency === 'deadline_soon' ? (
                      <StatusBadge
                        status="deadline_soon"
                        label={frAdmin.calls.urgency[row.urgency] ?? row.urgency}
                      />
                    ) : null}
                  </>
                }
                actions={
                  <Link href={adminCallRoute(row.callId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(ADMIN_ROUTES.calls, { statut: status }, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
