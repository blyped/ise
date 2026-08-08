import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { RelevanceNote, StatTile } from '@ise/ui-web/cards';
import { frOpportunities, to } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import {
  OPPORTUNITY_ROUTES,
  applicationRoute,
  opportunityClosureRoute,
  opportunityRoute,
} from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import {
  loadOpportunity,
  loadOpportunityMatches,
  loadReceivedApplications,
} from '@/lib/queries/opportunities';
import { formatDate, isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityStateActions } from '@/components/opportunities/OpportunityStateActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.tracking.title };

const LINK =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-060 — Suivi d'une offre et candidatures reçues.
 *
 * ECART ASSUME : la maquette affiche « 124 vues pertinentes ». Aucune vue
 * n'est comptée en base ; ce chiffre n'existe pas et n'est donc pas rendu
 * (MASTER PROMPT §98). Restent les candidatures réelles, le nombre de
 * profils ciblés et les correspondances fortes.
 *
 * Le libellé de pertinence accompagne chaque candidature comme une AIDE.
 * Aucun candidat n'est masqué, filtré ni trié hors de portée à cause de
 * lui (CA-OPP-06) : l'ordre est chronologique.
 */
export default async function OpportunityTrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ opportunityId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { opportunityId } = await params;
  if (!isUuid(opportunityId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const justPublished = query['publie'] === '1';
  const moderation = typeof query['moderation'] === 'string' ? query['moderation'] : null;
  const justClosed = query['cloture'] === '1';
  const statusFilter = typeof query['statut'] === 'string' ? query['statut'] : null;

  const correlationId = newCorrelationId();
  const [viewer, result, applications, matches] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    loadReceivedApplications(opportunityId, statusFilter, null, correlationId),
    loadOpportunityMatches(opportunityId, null, correlationId),
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
  const rows = applications.ok ? applications.data.rows : [];
  const matched = matches.ok ? matches.data.rows : [];

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={OPPORTUNITY_ROUTES.list} className="hover:text-primary">
          {frOpportunities.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={OPPORTUNITY_ROUTES.mine} className="hover:text-primary">
          {frOpportunities.list.mine}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="text-text-primary font-medium">{frOpportunities.tracking.breadcrumb}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOpportunities.tracking.title}</h1>
        <p className="text-body text-text-secondary">{opportunity.title}</p>
      </div>

      {justPublished ? (
        moderation === 'pending' ? (
          <Alert variant="warning" title={frOpportunities.wizard.publishedPendingTitle}>
            {frOpportunities.wizard.publishedPendingBody}
          </Alert>
        ) : (
          <Alert variant="success" title={frOpportunities.wizard.publishedTitle}>
            {matched.length > 0
              ? to(frOpportunities.wizard.publishedBody, { count: matched.length })
              : frOpportunities.wizard.publishedNoMatch}
          </Alert>
        )
      ) : null}

      {justClosed ? <Alert variant="success" title={frOpportunities.closure.doneTitle} /> : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOpportunities.tracking.metricsTitle}</CardTitle>
        </CardHeader>
        <div className="grid gap-5 sm:grid-cols-3">
          <StatTile value={rows.length} label={frOpportunities.tracking.applications} />
          <StatTile value={matched.length} label={frOpportunities.tracking.targeted} />
          <StatTile
            value={matched.filter((match) => match.relevance?.label === 'very_relevant').length}
            label={frOpportunities.tracking.strongMatches}
          />
        </div>
      </Card>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frOpportunities.tracking.candidatesTitle}
          className="flex min-w-0 flex-col gap-5"
        >
          <h2 className="text-h3 text-text-primary font-semibold">
            {frOpportunities.tracking.candidatesTitle}
          </h2>

          <p aria-live="polite" className="sr-only">
            {to(frOpportunities.mine.applications, { count: rows.length })}
          </p>

          {rows.length === 0 ? (
            <EmptyState
              title={frOpportunities.tracking.emptyTitle}
              description={frOpportunities.tracking.emptyBody}
              action={
                <Link href={opportunityRoute(opportunityId)} className={LINK}>
                  {frOpportunities.list.see}
                </Link>
              }
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {rows.map((application) => (
                <li key={application.applicationId}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-body-sm text-text-primary font-semibold">
                        {application.applicant?.displayName ?? '—'}
                      </span>
                      {application.applicant?.promotionLabel ? (
                        <span className="text-caption text-text-muted">
                          {application.applicant.promotionLabel}
                        </span>
                      ) : null}
                      <Badge tone="neutral">
                        {frOpportunities.applicationStatus[application.status] ??
                          application.status}
                      </Badge>
                      {application.isSelfDeclared ? (
                        <Badge tone="warning">{frOpportunities.tracking.externalApplication}</Badge>
                      ) : null}
                    </div>

                    {application.isSelfDeclared ? (
                      <p className="text-caption text-text-muted mt-2">
                        {frOpportunities.tracking.externalApplicationHint}
                      </p>
                    ) : null}

                    {application.message !== null ? (
                      <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
                        {application.message}
                      </p>
                    ) : null}

                    {application.relevance !== null ? (
                      <RelevanceNote
                        className="mt-4"
                        title={frOpportunities.detail.whyTitle}
                        label={
                          application.relevance.label !== null
                            ? frOpportunities.relevance[application.relevance.label]
                            : undefined
                        }
                        reasons={application.relevance.reasons}
                      />
                    ) : null}

                    <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
                      <span className="text-caption text-text-muted">
                        {application.submittedAt !== null
                          ? formatDate(application.submittedAt)
                          : ''}
                      </span>
                      <Link
                        href={applicationRoute(application.applicationId)}
                        className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue ml-auto inline-flex min-h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2 max-md:ml-0"
                      >
                        {frOpportunities.tracking.seeApplication}
                      </Link>
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
              <CardTitle as="h2">{frOpportunities.tracking.closeCta}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3">
              {opportunity.status === 'active' ||
              opportunity.status === 'paused' ||
              opportunity.status === 'expired' ? (
                <Link href={opportunityClosureRoute(opportunityId)} className={LINK}>
                  {frOpportunities.detail.manageClose}
                </Link>
              ) : null}
              <OpportunityStateActions opportunityId={opportunityId} status={opportunity.status} />
              <Link href={opportunityRoute(opportunityId)} className={LINK}>
                {frOpportunities.list.see}
              </Link>
            </div>
          </Card>

          <Alert variant="info" title={frOpportunities.tracking.noScoreTitle}>
            {frOpportunities.tracking.noScoreBody}
          </Alert>

          <Alert variant="info" title={frOpportunities.tracking.metricsNotice}>
            {frOpportunities.tracking.metricsBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
