import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frOpportunities } from '@/i18n/opportunities';
import { frAdminOpportunities } from '@/i18n/admin-opportunities';
import { ADMIN_ROUTES, adminOpportunityCandidatesRoute, adminOpportunityRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminOpportunity } from '@/lib/admin/queries';
import { loadAdminOpportunityApplications } from '@/lib/admin/queries-opportunities';
import { formatDateTime } from '@/lib/admin/format';
import { APPLICATION_STATUSES } from '@/lib/opportunities-view';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../../../_components/PageHeader';
import { RowCard, RowList } from '../../../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminOpportunities.candidates.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-021 — Supervision de toutes les candidatures recues pour une
 * opportunite (memes donnees que le suivi auteur ISE-060, cote admin).
 */
export default async function AdminOpportunityCandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('opportunities.manage');
  const { opportunityId } = await params;
  const query = await searchParams;
  const status = paramOneOf(query, 'statut', APPLICATION_STATUSES);
  const cursor = paramValue(query, 'curseur');
  const correlationId = newCorrelationId();

  const [opportunity, page] = await Promise.all([
    loadAdminOpportunity(opportunityId, correlationId),
    loadAdminOpportunityApplications(opportunityId, status, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.opportunities}
      screenTitle={frAdminOpportunities.candidates.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <Link href={adminOpportunityRoute(opportunityId)} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader
        title={frAdminOpportunities.candidates.title}
        subtitle={
          opportunity.ok && opportunity.data !== null
            ? opportunity.data.title
            : frAdminOpportunities.candidates.subtitle
        }
      />
    </div>
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

      <nav className="flex flex-wrap gap-3" aria-label={frAdminOpportunities.candidates.filterStatus}>
        <Link
          href={adminOpportunityCandidatesRoute(opportunityId)}
          className={`text-caption font-medium ${status === null ? 'text-primary underline' : 'text-text-muted'}`}
        >
          {frAdmin.common.all}
        </Link>
        {APPLICATION_STATUSES.map((value) => (
          <Link
            key={value}
            href={`${adminOpportunityCandidatesRoute(opportunityId)}?statut=${value}`}
            className={`text-caption font-medium ${status === value ? 'text-primary underline' : 'text-text-muted'}`}
          >
            {frOpportunities.applicationStatus[value] ?? value}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={frAdminOpportunities.candidates.empty}
          description={frAdminOpportunities.candidates.emptyBody}
        />
      ) : (
        <>
          <RowList label={frAdminOpportunities.candidates.title}>
            {rows.map((application) => (
              <RowCard
                key={application.applicationId}
                title={application.applicant?.displayName ?? frAdmin.common.none}
                meta={[
                  application.channel === 'external'
                    ? frAdminOpportunities.candidates.external
                    : frAdminOpportunities.candidates.internal,
                  application.submittedAt !== null
                    ? formatDateTime(application.submittedAt)
                    : frAdmin.common.none,
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={application.status}
                    label={frOpportunities.applicationStatus[application.status] ?? application.status}
                  />
                }
              >
                {application.message !== null ? (
                  <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
                    {application.message}
                  </p>
                ) : null}
              </RowCard>
            ))}
          </RowList>
          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              adminOpportunityCandidatesRoute(opportunityId),
              { statut: status },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
