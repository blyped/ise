import { notFound, redirect } from 'next/navigation';
import { ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkCall } from '@/lib/queries/calls';
import { loadCountries, loadSectors, searchSkills } from '@/lib/queries/reference';
import { loadLanguages, loadTools } from '@/lib/queries/tranche-reference';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallWizardShell } from '@/components/calls/CallWizardShell';
import { WantedProfileForm } from '@/components/calls/WantedProfileForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.wizard.wantedTitle };

/** ISE-050 — Profil recherché (étape 2 de l'assistant). */
export default async function WantedProfilePage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result, skills, sectors, countries, tools, languages] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCall(callId, correlationId),
    searchSkills(null, 60, correlationId),
    loadSectors(correlationId),
    loadCountries(correlationId),
    loadTools(correlationId),
    loadLanguages(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CALL_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok || result.data === null) {
    return shell(
      <ErrorState
        title={frCalls.detail.notFoundTitle}
        description={result.ok ? frCalls.detail.notFoundBody : result.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const call = result.data;
  if (!call.isAuthor || call.status !== 'draft') redirect(callRoute(callId));

  return shell(
    <CallWizardShell
      currentStep={2}
      title={frCalls.wizard.wantedTitle}
      subtitle={frCalls.wizard.wantedSubtitle}
    >
      <WantedProfileForm
        call={call}
        skills={skills.ok ? skills.data : []}
        sectors={sectors.ok ? sectors.data : []}
        countries={countries.ok ? countries.data : []}
        tools={tools.ok ? tools.data : []}
        languages={languages.ok ? languages.data : []}
      />
    </CallWizardShell>,
  );
}
