import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminTicketRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminTickets } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.support.title };

const TICKET_STATUSES = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-038 — File des tickets support (`admin_list_support_tickets`,
 * permission `support.manage`). Aucun SLA ni delai cible n'est affiche
 * (D-85) : seuls les faits — statut, urgence, assignation, dates.
 */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('support.manage');
  const params = await searchParams;
  const status = paramOneOf(params, 'statut', TICKET_STATUSES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminTickets(status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.support}
      screenTitle={frAdmin.support.title}
    >
      {children}
    </AdminShell>
  );

  const header = <PageHeader title={frAdmin.support.title} subtitle={frAdmin.support.subtitle} />;

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
        action={ADMIN_ROUTES.support}
        selects={[
          {
            name: 'statut',
            label: frAdmin.support.filterLabel,
            value: status ?? '',
            options: TICKET_STATUSES.map((value) => ({
              value,
              label: frAdmin.support.status[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.support.empty} description={frAdmin.support.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.support.title}>
            {rows.map((row) => (
              <RowCard
                key={row.ticketId}
                title={`${row.referenceCode} — ${row.subject}`}
                meta={[
                  row.requesterName ?? frAdmin.common.none,
                  row.assigneeName ?? frAdmin.support.unassigned,
                  formatDateTime(row.createdAt),
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.status}
                      label={frAdmin.support.status[row.status] ?? row.status}
                    />
                    <StatusBadge
                      status={row.urgency}
                      label={frAdmin.support.urgency[row.urgency] ?? row.urgency}
                    />
                  </>
                }
                actions={
                  <Link href={adminTicketRoute(row.ticketId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(ADMIN_ROUTES.support, { statut: status }, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
