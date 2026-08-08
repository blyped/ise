import { notFound, redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { StatTile } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadAudiencePreview, loadNetworkCall } from '@/lib/queries/calls';
import { loadPromotions } from '@/lib/queries/reference';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallWizardShell } from '@/components/calls/CallWizardShell';
import { AudienceForm } from '@/components/calls/AudienceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.wizard.audienceTitle };

/**
 * ISE-051 — Ciblage d'audience (étape 3).
 *
 * Les chiffres du rail sont RECALCULES à l'ouverture de la page, à
 * partir des critères réellement enregistrés (D6 §44). Aucun nombre
 * n'est estimé : s'il n'y a aucune correspondance, l'écran le dit et
 * explique pourquoi, plutôt que d'afficher un zéro sans contexte.
 */
export default async function CallAudiencePage({
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
  const [viewer, result, promotions, preview] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCall(callId, correlationId),
    loadPromotions(correlationId),
    loadAudiencePreview(callId, correlationId),
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

  const audience = preview.ok ? preview.data : null;

  return shell(
    <CallWizardShell
      currentStep={3}
      title={frCalls.wizard.audienceTitle}
      subtitle={frCalls.wizard.audienceSubtitle}
      aside={
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCalls.wizard.audienceComputed}</CardTitle>
          </CardHeader>

          {audience === null ? (
            <p className="text-body-sm text-text-secondary">
              {frCalls.wizard.audienceNotComputedBody}
            </p>
          ) : audience.total === 0 ? (
            <>
              <p className="text-body-sm text-text-primary font-medium">
                {frCalls.wizard.audienceEmptyTitle}
              </p>
              <p className="text-body-sm text-text-secondary mt-2">
                {frCalls.wizard.audienceEmptyBody}
              </p>
            </>
          ) : (
            <>
              <StatTile
                value={audience.total}
                label={tc(frCalls.wizard.audienceTotal, { count: audience.total })}
              />
              <dl className="border-border text-body-sm mt-5 flex flex-col gap-2 border-t pt-4">
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{frCalls.wizard.audienceVeryRelevant}</dt>
                  <dd className="text-text-primary font-semibold">{audience.veryRelevant}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{frCalls.wizard.audienceRelevant}</dt>
                  <dd className="text-text-primary font-semibold">{audience.relevant}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-text-secondary">{frCalls.wizard.audienceClose}</dt>
                  <dd className="text-text-primary font-semibold">{audience.closeProfile}</dd>
                </div>
              </dl>
              {audience.priorityNotice > 0 ? (
                <p className="text-caption text-text-muted mt-4">
                  {tc(frCalls.wizard.audienceNoticePriority, { count: audience.priorityNotice })}
                </p>
              ) : null}
            </>
          )}
        </Card>
      }
    >
      <AudienceForm call={call} promotions={promotions.ok ? promotions.data : []} />
    </CallWizardShell>,
  );
}
