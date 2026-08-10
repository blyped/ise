import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminOpportunities } from '@/i18n/admin-opportunities';
import { ADMIN_ROUTES, adminOpportunityRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminOpportunity } from '@/lib/admin/queries';
import { loadAdminOpportunityCandidates } from '@/lib/admin/queries-opportunities';
import { type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../../_components/PageHeader';
import { CloseOpportunityForm } from './CloseOpportunityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminOpportunities.closure.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const CLOSABLE = new Set(['active', 'paused', 'expired']);

/**
 * SA-022 — Cloture d'une opportunite et declaration de son resultat
 * (memes donnees que la cloture auteur ISE-061, cote admin).
 */
export default async function AdminOpportunityClosurePage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('opportunities.manage');
  const { opportunityId } = await params;
  const query = await searchParams;
  const justClosed = query['cloture'] === '1';
  const correlationId = newCorrelationId();

  const [detail, candidates] = await Promise.all([
    loadAdminOpportunity(opportunityId, correlationId),
    loadAdminOpportunityCandidates(opportunityId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.opportunities}
      screenTitle={frAdminOpportunities.closure.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminOpportunities.closure.title} subtitle={frAdminOpportunities.closure.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const opportunity = detail.data;
  const header = (
    <div className="flex flex-col gap-3">
      <Link href={adminOpportunityRoute(opportunityId)} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader title={frAdminOpportunities.closure.title} subtitle={opportunity.title} />
    </div>
  );

  if (justClosed) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <Alert variant="success" title={frAdminOpportunities.closure.doneTitle} />
      </div>,
    );
  }

  if (!CLOSABLE.has(opportunity.status)) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <Alert variant="info" title={frAdmin.opportunities.status[opportunity.status] ?? opportunity.status}>
          {frAdminOpportunities.closure.notClosable}
        </Alert>
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      <SectionCard title={frAdminOpportunities.closure.title}>
        <CloseOpportunityForm
          opportunityId={opportunityId}
          candidates={candidates.ok ? candidates.data : []}
        />
      </SectionCard>
    </div>,
  );
}
