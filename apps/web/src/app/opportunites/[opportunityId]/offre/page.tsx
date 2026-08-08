import { notFound, redirect } from 'next/navigation';
import { ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, opportunityRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunity } from '@/lib/queries/opportunities';
import { loadCountries } from '@/lib/queries/reference';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityWizardShell } from '@/components/opportunities/OpportunityWizardShell';
import { OfferForm } from '@/components/opportunities/OfferForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.wizard.createTitle };

/** ISE-057 — étape 1 sur un brouillon existant. */
export default async function EditOfferPage({
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
  const [viewer, result, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    loadCountries(correlationId),
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

  return shell(
    <OpportunityWizardShell
      currentStep={1}
      title={frOpportunities.wizard.createTitle}
      subtitle={frOpportunities.wizard.createSubtitle}
    >
      <OfferForm opportunity={opportunity} countries={countries.ok ? countries.data : []} />
    </OpportunityWizardShell>,
  );
}
