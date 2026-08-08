import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, opportunityTrackingRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunity, loadOpportunityCandidates } from '@/lib/queries/opportunities';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityClosureForm } from '@/components/opportunities/OpportunityClosureForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.closure.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-061 — Fermer une opportunité et enregistrer son résultat. */
export default async function OpportunityClosurePage({
  params,
}: {
  params: Promise<{ opportunityId: string }>;
}) {
  const { opportunityId } = await params;
  if (!isUuid(opportunityId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result, candidates] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    loadOpportunityCandidates(opportunityId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={OPPORTUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok || result.data === null) {
    return shell(
      <ErrorState
        title={frOpportunities.detail.notFoundTitle}
        description={result.ok ? frOpportunities.detail.notFoundBody : result.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const opportunity = result.data;
  if (
    opportunity.status !== 'active' &&
    opportunity.status !== 'paused' &&
    opportunity.status !== 'expired'
  ) {
    return shell(
      <div className="flex flex-col gap-6">
        <Alert variant="info" title={frOpportunities.detail.closedTitle}>
          {frOpportunities.detail.closedBody}
        </Alert>
        <p>
          <Link href={opportunityTrackingRoute(opportunityId)} className={LINK}>
            {frOpportunities.detail.manageTracking}
          </Link>
        </p>
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOpportunities.closure.title}</h1>
        <p className="text-body text-text-secondary">{frOpportunities.closure.subtitle}</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <OpportunityClosureForm
            opportunityId={opportunityId}
            candidates={candidates.ok ? candidates.data : []}
          />
        </Card>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frOpportunities.closure.noImpactTitle}>
            {frOpportunities.closure.noImpactBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
