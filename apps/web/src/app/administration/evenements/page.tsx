import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminEvents } from '@/i18n/admin-events';
import { ADMIN_ROUTES, adminEventRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminEvents } from '@/lib/admin/queries-events';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminEvents.list.title };

const EVENT_STATUSES = [
  'draft',
  'pending_review',
  'published',
  'full',
  'completed',
  'cancelled',
  'archived',
] as const;
const EVENT_FORMATS = ['online', 'in_person', 'hybrid'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-030 — Liste administrative des evenements : tous statuts (y
 * compris brouillon et en revue), invisibles de `list_events` (l'ecran
 * membre) qui exclut par construction les statuts non publies (sauf
 * pour le scope 'mine'). Permission `events.manage` (verifiee ici ET
 * en base par `admin_list_events`, 0100).
 */
export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('events.manage');
  const params = await searchParams;
  const query = paramValue(params, 'recherche');
  const status = paramOneOf(params, 'statut', EVENT_STATUSES);
  const format = paramOneOf(params, 'format', EVENT_FORMATS);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminEvents({ status, eventTypeCode: null, format, query }, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.events} screenTitle={frAdminEvents.list.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAdminEvents.list.title}
      subtitle={frAdminEvents.list.subtitle}
      action={{ href: ADMIN_ROUTES.eventNew, label: frAdminEvents.list.newEvent }}
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
        action={ADMIN_ROUTES.events}
        search={{
          name: 'recherche',
          placeholder: frAdminEvents.list.searchPlaceholder,
          value: query ?? '',
        }}
        selects={[
          {
            name: 'statut',
            label: frAdminEvents.list.filterStatus,
            value: status ?? '',
            options: EVENT_STATUSES.map((value) => ({
              value,
              label: frAdminEvents.status[value] ?? value,
            })),
          },
          {
            name: 'format',
            label: frAdminEvents.list.filterFormat,
            value: format ?? '',
            options: EVENT_FORMATS.map((value) => ({
              value,
              label: frAdminEvents.format[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdminEvents.list.empty} description={frAdminEvents.list.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminEvents.list.title}>
            {rows.map((row) => (
              <RowCard
                key={row.eventId}
                title={row.title}
                meta={[
                  `${frAdminEvents.list.columns.format} : ${frAdminEvents.format[row.format] ?? row.format}`,
                  `${frAdminEvents.list.columns.startsAt} : ${formatDateTime(row.startsAt)}`,
                  `${frAdminEvents.list.columns.organizer} : ${row.organizerLabel ?? frAdmin.common.none}`,
                  `${frAdminEvents.list.columns.registered} : ${row.registeredCount}`,
                ].join(' · ')}
                badges={
                  <StatusBadge status={row.status} label={frAdminEvents.status[row.status] ?? row.status} />
                }
                actions={
                  <Link href={adminEventRoute(row.eventId)} className={DETAIL_LINK}>
                    {frAdminEvents.list.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.events,
              { recherche: query, statut: status, format },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
