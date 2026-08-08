import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { StatTile } from '@ise/ui-web/cards';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, opportunityRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunity, loadOpportunityAudience } from '@/lib/queries/opportunities';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityWizardShell } from '@/components/opportunities/OpportunityWizardShell';
import { OpportunityCardView } from '@/components/opportunities/OpportunityCardView';
import { OpportunityDetailView } from '@/components/opportunities/OpportunityDetailView';
import { PublishOpportunityForm } from '@/components/opportunities/PublishOpportunityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.wizard.previewTitle };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-059 — Aperçu avant publication (étape 3). */
export default async function OpportunityPreviewPage({
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
  const [viewer, result, audience] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    loadOpportunityAudience(opportunityId, correlationId),
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
  if (!opportunity.isManager || opportunity.status !== 'draft') {
    redirect(opportunityRoute(opportunityId));
  }
  const preview = audience.ok ? audience.data : null;

  return shell(
    <OpportunityWizardShell
      currentStep={3}
      title={frOpportunities.wizard.previewTitle}
      subtitle={frOpportunities.wizard.previewSubtitle}
      aside={
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frOpportunities.tracking.matchesTitle}</CardTitle>
          </CardHeader>
          {preview === null || preview.total === 0 ? (
            <p className="text-body-sm text-text-secondary">
              {frOpportunities.wizard.publishedNoMatch}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-5">
              <StatTile value={preview.total} label={frOpportunities.tracking.targeted} />
              <StatTile
                value={preview.veryRelevant}
                label={frOpportunities.tracking.strongMatches}
              />
            </div>
          )}
        </Card>
      }
    >
      <div className="flex flex-col gap-8">
        {opportunity.origin === 'external' ? (
          <Alert variant="warning" title={frOpportunities.wizard.publishedPendingTitle}>
            {frOpportunities.wizard.publishedPendingBody}
          </Alert>
        ) : null}

        <section aria-label={frOpportunities.wizard.previewCard} className="flex flex-col gap-4">
          <h2 className="text-h3 text-text-primary font-semibold">
            {frOpportunities.wizard.previewCard}
          </h2>
          <OpportunityCardView opportunity={opportunity} />
        </section>

        <section aria-label={frOpportunities.wizard.previewDetail} className="flex flex-col gap-4">
          <h2 className="text-h3 text-text-primary font-semibold">
            {frOpportunities.wizard.previewDetail}
          </h2>
          <OpportunityDetailView opportunity={opportunity} />
        </section>

        <div className="border-border flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <Link href={`${opportunityRoute(opportunityId)}/ciblage`} className={LINK}>
            {frOpportunities.wizard.editStep}
          </Link>
          <PublishOpportunityForm opportunityId={opportunityId} />
        </div>
      </div>
    </OpportunityWizardShell>,
  );
}
