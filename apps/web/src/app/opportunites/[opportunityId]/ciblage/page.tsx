import { notFound, redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { StatTile } from '@ise/ui-web/cards';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, opportunityRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunity, loadOpportunityAudience } from '@/lib/queries/opportunities';
import {
  loadCountries,
  loadJobFunctions,
  loadPromotions,
  loadSectors,
  searchSkills,
} from '@/lib/queries/reference';
import { loadLanguages, loadTools } from '@/lib/queries/tranche-reference';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityWizardShell } from '@/components/opportunities/OpportunityWizardShell';
import { TargetingForm } from '@/components/opportunities/TargetingForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.wizard.audienceTitle };

/**
 * ISE-058 — Ciblage et matching (étape 2).
 *
 * Le rail affiche l'audience RÉELLEMENT calculée à partir des critères
 * déjà enregistrés. Aucun nombre n'est estimé (MASTER PROMPT §98).
 */
export default async function OpportunityTargetingPage({
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
  const [
    viewer,
    result,
    skills,
    sectors,
    countries,
    tools,
    languages,
    functions,
    promotions,
    audience,
  ] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    searchSkills(null, 60, correlationId),
    loadSectors(correlationId),
    loadCountries(correlationId),
    loadTools(correlationId),
    loadLanguages(correlationId),
    loadJobFunctions(correlationId),
    loadPromotions(correlationId),
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
      currentStep={2}
      title={frOpportunities.wizard.audienceTitle}
      subtitle={frOpportunities.wizard.audienceSubtitle}
      aside={
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frOpportunities.tracking.matchesTitle}</CardTitle>
          </CardHeader>
          {preview === null || preview.total === 0 ? (
            <p className="text-body-sm text-text-secondary">
              Aucun profil ne correspond encore à ces critères. Retirez un critère obligatoire : il
              exclut, il ne pondère pas.
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
      <TargetingForm
        opportunity={opportunity}
        skills={skills.ok ? skills.data : []}
        sectors={sectors.ok ? sectors.data : []}
        countries={countries.ok ? countries.data : []}
        tools={tools.ok ? tools.data : []}
        languages={languages.ok ? languages.data : []}
        functions={functions.ok ? functions.data : []}
        promotions={promotions.ok ? promotions.data : []}
      />
    </OpportunityWizardShell>,
  );
}
