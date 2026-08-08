import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { MetaList, StatTile } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadAudiencePreview, loadNetworkCall } from '@/lib/queries/calls';
import { formatDate, isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallWizardShell } from '@/components/calls/CallWizardShell';
import { CallCardView } from '@/components/calls/CallCardView';
import { CallDetailView } from '@/components/calls/CallDetailView';
import { PublishCallForm } from '@/components/calls/PublishCallForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.wizard.previewTitle };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-052 — Aperçu avant publication (étape 4).
 *
 * La carte et le détail sont rendus par LES MÊMES composants que le fil
 * et l'écran ISE-048 : c'est ce qui rend la promesse « voici exactement
 * ce que verront les membres » vérifiable plutôt que décorative.
 */
export default async function CallPreviewPage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result, preview] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCall(callId, correlationId),
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
      currentStep={4}
      title={frCalls.wizard.previewTitle}
      subtitle={frCalls.wizard.previewSubtitle}
      aside={
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frCalls.wizard.audienceComputed}</CardTitle>
          </CardHeader>
          {audience === null || audience.total === 0 ? (
            <p className="text-body-sm text-text-secondary">{frCalls.wizard.audienceEmptyBody}</p>
          ) : (
            <>
              <StatTile
                value={audience.total}
                label={tc(frCalls.wizard.audienceTotal, { count: audience.total })}
              />
              {audience.samples.length > 0 ? (
                <ul className="border-border mt-5 flex flex-col gap-3 border-t pt-4">
                  {audience.samples.map((sample) => (
                    <li key={sample.profile.profileId} className="text-body-sm">
                      <span className="text-text-primary font-medium">
                        {sample.profile.displayName}
                      </span>
                      {sample.relevance?.label ? (
                        <span className="text-caption text-text-muted block">
                          {frCalls.relevance[sample.relevance.label]}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </Card>
      }
    >
      <div className="flex flex-col gap-8">
        <section aria-label={frCalls.wizard.previewSummary}>
          <h2 className="text-h3 text-text-primary mb-4 font-semibold">
            {frCalls.wizard.previewSummary}
          </h2>
          <MetaList
            items={[
              {
                label: frCalls.wizard.typeLabel,
                value: frCalls.type[call.callType] ?? call.callType,
              },
              {
                label: frCalls.detail.deadlineLabel,
                value: call.deadline !== null ? formatDate(call.deadline) : null,
              },
              {
                label: frCalls.detail.visibilityLabel,
                value: frCalls.visibility[call.visibility] ?? call.visibility,
              },
              {
                label: frCalls.wizard.audiencePromotionsLabel,
                value:
                  call.audiencePromotions.length > 0 ? call.audiencePromotions.join(' · ') : null,
              },
              {
                label: frCalls.detail.helpTypesTitle,
                value:
                  call.helpTypes.length > 0
                    ? call.helpTypes.map((h) => frCalls.helpType[h] ?? h).join(' · ')
                    : null,
              },
            ]}
          />
        </section>

        <section aria-label={frCalls.wizard.previewCard} className="flex flex-col gap-4">
          <h2 className="text-h3 text-text-primary font-semibold">{frCalls.wizard.previewCard}</h2>
          <CallCardView call={call} />
        </section>

        <section aria-label={frCalls.wizard.previewDetail} className="flex flex-col gap-4">
          <h2 className="text-h3 text-text-primary font-semibold">
            {frCalls.wizard.previewDetail}
          </h2>
          <CallDetailView call={call} />
        </section>

        {audience !== null && audience.total === 0 ? (
          <Alert variant="warning" title={frCalls.wizard.audienceEmptyTitle}>
            {frCalls.wizard.audienceEmptyBody}
          </Alert>
        ) : null}

        <div className="border-border flex flex-wrap items-center justify-between gap-4 border-t pt-6">
          <Link href={`${callRoute(callId)}/ciblage`} className={LINK}>
            {frCalls.wizard.editStep}
          </Link>
          <PublishCallForm callId={callId} />
        </div>
      </div>
    </CallWizardShell>,
  );
}
