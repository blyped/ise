import { redirect } from 'next/navigation';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCountries } from '@/lib/queries/reference';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityWizardShell } from '@/components/opportunities/OpportunityWizardShell';
import { OfferForm } from '@/components/opportunities/OfferForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.wizard.createTitle };

/** ISE-057 — Publier une opportunité, étape 1. */
export default async function NewOpportunityPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCountries(correlationId),
  ]);

  return (
    <AppShell
      currentPath={OPPORTUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <OpportunityWizardShell
        currentStep={1}
        title={frOpportunities.wizard.createTitle}
        subtitle={frOpportunities.wizard.createSubtitle}
      >
        <OfferForm opportunity={null} countries={countries.ok ? countries.data : []} />
      </OpportunityWizardShell>
    </AppShell>
  );
}
