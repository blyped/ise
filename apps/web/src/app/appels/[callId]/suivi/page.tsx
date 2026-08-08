import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { RelevanceNote, StatTile, StatusTimeline } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callClosureRoute, callRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCallResponses, loadCallTracking } from '@/lib/queries/calls';
import { formatDate, isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { ResponseTriage } from '@/components/calls/ResponseTriage';
import { CallStateActions } from '@/components/calls/CallStateActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.tracking.title };

const LINK =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-053 — Suivi de l'appel et réponses reçues.
 *
 * ECART ASSUME : la maquette affiche « 39 vues utiles » et un « taux de
 * réponse ». Aucune vue n'est comptée par la plateforme, et aucun taux
 * n'est calculé : ces chiffres n'existent pas en base. Les afficher
 * aurait supposé de les inventer (MASTER PROMPT §98). Les indicateurs
 * rendus ici — profils ciblés, réponses, réponses utiles,
 * recommandations, introductions proposées — sont tous comptés sur des
 * lignes réelles.
 */
export default async function CallTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ callId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const justPublished = query['publie'] === '1';
  const closure = typeof query['cloture'] === 'string' ? query['cloture'] : null;
  const statusFilter = typeof query['statut'] === 'string' ? query['statut'] : null;

  const correlationId = newCorrelationId();
  const [viewer, tracking, responses] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCallTracking(callId, correlationId),
    loadCallResponses(callId, statusFilter, null, null, correlationId),
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

  if (!tracking.ok || tracking.data === null) {
    return shell(
      <ErrorState
        title={frCalls.detail.notFoundTitle}
        description={tracking.ok ? frCalls.detail.notFoundBody : tracking.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={CALL_ROUTES.mine} className={LINK}>
            {frCalls.list.mine}
          </Link>
        }
      />,
    );
  }

  const call = tracking.data;
  const rows = responses.ok ? responses.data.rows : [];

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={CALL_ROUTES.list} className="hover:text-primary">
          {frCalls.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={CALL_ROUTES.mine} className="hover:text-primary">
          {frCalls.list.mine}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="text-text-primary font-medium">{frCalls.tracking.breadcrumb}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCalls.tracking.title}</h1>
        <p className="text-body text-text-secondary">{call.title}</p>
      </div>

      {justPublished ? (
        <Alert variant="success" title={frCalls.wizard.publishedTitle}>
          {call.targeted > 0
            ? tc(frCalls.wizard.publishedBody, { count: call.targeted })
            : frCalls.wizard.publishedNoMatch}
        </Alert>
      ) : null}

      {closure !== null ? (
        <Alert
          variant={closure === 'not_resolved' ? 'info' : 'success'}
          title={frCalls.closure.doneTitle}
        >
          {closure === 'not_resolved'
            ? frCalls.closure.doneNotResolved
            : frCalls.closure.doneResolved}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCalls.tracking.metricsTitle}</CardTitle>
        </CardHeader>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile value={call.targeted} label={frCalls.tracking.targeted} />
          <StatTile value={call.responses} label={frCalls.tracking.responses} />
          <StatTile value={call.useful} label={frCalls.tracking.useful} />
          <StatTile value={call.recommendations} label={frCalls.tracking.recommendations} />
          <StatTile value={call.introductions} label={frCalls.tracking.introductions} />
        </div>
        <p className="border-border text-caption text-text-muted mt-5 border-t pt-4">
          {call.firstResponseAt !== null
            ? tc(frCalls.tracking.firstResponse, { date: formatDate(call.firstResponseAt) })
            : frCalls.tracking.noFirstResponse}
        </p>
      </Card>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frCalls.tracking.responsesTitle}
          className="flex min-w-0 flex-col gap-5"
        >
          <h2 className="text-h3 text-text-primary font-semibold">
            {frCalls.tracking.responsesTitle}
          </h2>

          <p aria-live="polite" className="sr-only">
            {tc(frCalls.list.responses, { count: rows.length })}
          </p>

          {rows.length === 0 ? (
            <EmptyState
              title={frCalls.tracking.emptyTitle}
              description={frCalls.tracking.emptyBody}
              action={
                <Link href={callRoute(callId)} className={LINK}>
                  {frCalls.list.see}
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {rows.map((response) => (
                <li key={response.responseId}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-body-sm text-text-primary font-semibold">
                        {response.author?.displayName ?? '—'}
                      </span>
                      {response.author?.promotionLabel ? (
                        <span className="text-caption text-text-muted">
                          {response.author.promotionLabel}
                        </span>
                      ) : null}
                      <Badge tone="info">
                        {frCalls.responseType[response.responseType] ?? response.responseType}
                      </Badge>
                      <Badge tone="neutral">
                        {frCalls.responseStatus[response.status] ?? response.status}
                      </Badge>
                    </div>

                    {response.message !== null ? (
                      <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
                        {response.message}
                      </p>
                    ) : null}

                    {response.sharesContact ? (
                      <p className="text-caption text-success mt-2">
                        {frCalls.tracking.contactShared}
                      </p>
                    ) : null}

                    {response.recommendations.map((recommendation) => (
                      <div
                        key={recommendation.recommendationId}
                        className="rounded-base border-border bg-surface-muted mt-4 border p-4"
                      >
                        <p className="text-body-sm text-text-primary font-semibold">
                          {recommendation.profile !== null
                            ? `${frCalls.tracking.recommendationOf} : ${recommendation.profile.displayName}`
                            : `${frCalls.tracking.externalPerson} : ${recommendation.externalPersonName ?? '—'}`}
                        </p>
                        {recommendation.rationale !== null ? (
                          <p className="text-body-sm text-text-secondary mt-2">
                            {recommendation.rationale}
                          </p>
                        ) : null}
                        {recommendation.externalPersonContext !== null ? (
                          <p className="text-caption text-text-muted mt-2">
                            {recommendation.externalPersonContext}
                          </p>
                        ) : null}
                        <p className="text-caption mt-2 flex flex-wrap gap-3">
                          {recommendation.offersIntroduction ? (
                            <span className="text-success">
                              {frCalls.tracking.offersIntroduction}
                            </span>
                          ) : null}
                          {!recommendation.consentConfirmed ? (
                            <span className="text-warning">{frCalls.tracking.noConsent}</span>
                          ) : null}
                        </p>
                      </div>
                    ))}

                    {response.relevance !== null ? (
                      <RelevanceNote
                        className="mt-4"
                        title={frCalls.list.whyTitle}
                        label={
                          response.relevance.label !== null
                            ? frCalls.relevance[response.relevance.label]
                            : undefined
                        }
                        reasons={response.relevance.reasons}
                      />
                    ) : null}

                    <div className="border-border mt-5 border-t pt-4">
                      <ResponseTriage
                        callId={callId}
                        responseId={response.responseId}
                        status={response.status}
                      />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.tracking.closeCta}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frCalls.tracking.closeCtaBody}</p>
            <div className="mt-5 flex flex-col gap-3">
              {call.status === 'active' || call.status === 'paused' || call.status === 'expired' ? (
                <Link href={callClosureRoute(callId)} className={LINK}>
                  {frCalls.detail.manageClose}
                </Link>
              ) : null}
              <CallStateActions callId={callId} status={call.status} />
              <Link href={callRoute(callId)} className={LINK}>
                {frCalls.list.see}
              </Link>
            </div>
          </Card>

          <Alert variant="info" title={frCalls.tracking.metricsNotice}>
            {frCalls.tracking.metricsBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.tracking.historyTitle}</CardTitle>
            </CardHeader>
            <StatusTimeline
              emptyLabel={frCalls.tracking.noFirstResponse}
              entries={call.events.map((event, index) => ({
                id: `${event.eventType}-${index}`,
                label: frCalls.status[event.toStatus ?? ''] ?? event.eventType,
                date: event.createdAt !== null ? formatDate(event.createdAt) : undefined,
              }))}
            />
          </Card>
        </aside>
      </div>
    </div>,
  );
}
