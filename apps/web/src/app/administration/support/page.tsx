import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminSupport } from '@/i18n/admin-support';
import { ADMIN_ROUTES, adminTicketRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadSupportDashboard,
  loadSupportTickets,
  type AdminSupportDashboard,
  type AdminSupportFilters,
} from '@/lib/admin/queries-support';
import { loadSupportCategories } from '@/lib/queries/support';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { SupportFilters } from './SupportFilters';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminSupport.title };

const TICKET_STATUSES = [
  'open',
  'acknowledged',
  'in_progress',
  'waiting_user',
  'resolved',
  'closed',
] as const;

const URGENCIES = ['low', 'standard', 'high', 'critical'] as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-038 — COCKPIT DES REMONTEES (`admin_list_support_tickets` et
 * `admin_support_dashboard`, permission `support.manage`).
 *
 * Aucun SLA ni delai cible n'est affiche (D-85) : seuls des FAITS —
 * statut, priorite, nature, assignation, dates, absence de reponse.
 * Les cinq compteurs de tete sont comptes en base a chaque chargement,
 * jamais estimes ni arrondis (MASTER PROMPT §98).
 *
 * Une erreur sur les compteurs ne fait pas tomber l'ecran : la file
 * reste consultable, les compteurs sont simplement absents. L'inverse
 * (compteurs sans file) n'a pas de sens et affiche l'erreur.
 */
export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('support.manage');
  const params = await searchParams;
  const correlationId = newCorrelationId();

  const dateParam = (key: string): string | null => {
    const value = paramValue(params, key);
    return value !== null && ISO_DATE.test(value) ? value : null;
  };
  const assigneeParam = ((): string | null => {
    const value = paramValue(params, 'responsable');
    return value !== null && UUID.test(value) ? value : null;
  })();
  const promotionParam = ((): string | null => {
    const value = paramValue(params, 'promotion');
    return value !== null && /^\d+$/.test(value) ? value : null;
  })();

  // Le referentiel des natures est lu AVANT la file : un code de nature
  // inconnu dans l'URL ferait lever `validation_failed` a la RPC, donc une
  // page d'erreur pour une simple faute de frappe. On le ramene ici a
  // « pas de filtre ».
  const categories = await loadSupportCategories();

  const filters: AdminSupportFilters = {
    status: paramOneOf(params, 'statut', TICKET_STATUSES),
    categoryCode: paramOneOf(
      params,
      'nature',
      categories.map((category) => category.code),
    ),
    urgency: paramOneOf(params, 'priorite', URGENCIES),
    promotionId: promotionParam,
    assigneeProfileId: assigneeParam,
    unanswered: paramValue(params, 'sansreponse') === '1',
    from: dateParam('du'),
    to: dateParam('au'),
  };

  const cursor = paramValue(params, 'curseur');

  const [dashboardResult, page] = await Promise.all([
    loadSupportDashboard(correlationId),
    loadSupportTickets(filters, cursor, correlationId),
  ]);

  const dashboard: AdminSupportDashboard | null = dashboardResult.ok ? dashboardResult.data : null;

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.support}
      screenTitle={frAdminSupport.title}
    >
      {children}
    </AdminShell>
  );

  const header = <PageHeader title={frAdminSupport.title} subtitle={frAdminSupport.subtitle} />;

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

  const counters =
    dashboard === null
      ? []
      : [
          { key: 'new', label: frAdminSupport.counters.new, value: dashboard.newCount },
          {
            key: 'in_progress',
            label: frAdminSupport.counters.inProgress,
            value: dashboard.inProgressCount,
          },
          {
            key: 'unanswered',
            label: frAdminSupport.counters.unanswered,
            value: dashboard.unansweredCount,
          },
          {
            key: 'critical',
            label: frAdminSupport.counters.critical,
            value: dashboard.criticalCount,
          },
          {
            key: 'resolved',
            label: frAdminSupport.counters.resolved,
            value: dashboard.resolvedCount,
          },
        ];

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {counters.length > 0 ? (
        <section aria-label={frAdminSupport.counters.title} className="flex flex-col gap-2">
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {counters.map((counter) => (
              <div
                key={counter.key}
                className="rounded-base border-border bg-surface flex flex-col gap-1 border p-5"
              >
                <dt className="text-caption text-text-muted font-medium">{counter.label}</dt>
                <dd className="text-h2 text-text-primary font-bold">{counter.value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-text-muted">{frAdminSupport.counters.hint}</p>
        </section>
      ) : null}

      <SupportFilters filters={filters} categories={categories} dashboard={dashboard} />

      {rows.length === 0 ? (
        <EmptyState title={frAdminSupport.empty} description={frAdminSupport.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminSupport.title}>
            {rows.map((row) => (
              <RowCard
                key={row.ticketId}
                title={`${row.referenceCode} — ${row.subject}`}
                meta={[
                  row.requesterName ?? frAdmin.common.none,
                  row.promotionName ?? frAdmin.common.none,
                  row.categoryName ?? frAdmin.common.none,
                  row.assigneeName ?? frAdminSupport.unassigned,
                  formatDateTime(row.createdAt),
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.status}
                      label={frAdminSupport.status[row.status] ?? row.status}
                    />
                    <StatusBadge
                      status={row.urgency}
                      label={frAdminSupport.urgency[row.urgency] ?? row.urgency}
                    />
                    {row.unanswered ? (
                      <StatusBadge status="open" label={frAdminSupport.unanswered} />
                    ) : null}
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
            nextHref={nextPageHref(
              ADMIN_ROUTES.support,
              {
                statut: filters.status,
                nature: filters.categoryCode,
                priorite: filters.urgency,
                promotion: filters.promotionId,
                responsable: filters.assigneeProfileId,
                sansreponse: filters.unanswered ? '1' : null,
                du: filters.from,
                au: filters.to,
              },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
