import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { RelevanceNote } from '@ise/ui-web/cards';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import {
  OPPORTUNITY_ROUTES,
  applicationRoute,
  opportunityApplyRoute,
  opportunityClosureRoute,
  opportunityTrackingRoute,
} from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunity } from '@/lib/queries/opportunities';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunityDetailView } from '@/components/opportunities/OpportunityDetailView';
import { SaveOpportunityButton } from '@/components/opportunities/SaveOpportunityButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.detail.breadcrumb };

const LINK =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const PRIMARY =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-base bg-primary px-6 text-body font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-056 — Détail d'une opportunité.
 *
 * Le CTA principal change de LIBELLÉ selon le mode de candidature
 * (MASTER PROMPT §27, D-55) : « Postuler sur Compétences ISE » quand la
 * plateforme reçoit réellement le dossier, « Voir comment postuler »
 * quand elle ne fait que renvoyer ailleurs. Un unique bouton
 * « Candidater » aurait laissé croire, dans le second cas, que la
 * plateforme transmet quelque chose.
 */
export default async function OpportunityDetailPage({
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
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
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
        action={
          <Link href={OPPORTUNITY_ROUTES.list} className={LINK}>
            {frOpportunities.common.back}
          </Link>
        }
      />,
    );
  }

  const opportunity = result.data;
  const isOpen = opportunity.status === 'active';
  const application = opportunity.myApplication;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={OPPORTUNITY_ROUTES.list} className="hover:text-primary">
          {frOpportunities.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="text-text-primary font-medium">{frOpportunities.detail.breadcrumb}</span>
      </nav>

      {opportunity.moderationStatus === 'pending' ? (
        <Alert variant="warning" title={frOpportunities.detail.pendingModerationTitle}>
          {frOpportunities.detail.pendingModerationBody}
        </Alert>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0">
          <OpportunityDetailView opportunity={opportunity} />
        </div>

        <aside className="flex flex-col gap-7">
          {opportunity.relevance !== null ? (
            <RelevanceNote
              title={frOpportunities.detail.whyTitle}
              label={
                opportunity.relevance.label !== null
                  ? frOpportunities.relevance[opportunity.relevance.label]
                  : undefined
              }
              reasons={opportunity.relevance.reasons}
            />
          ) : null}

          {opportunity.isManager ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frOpportunities.detail.manageTitle}</CardTitle>
              </CardHeader>
              <div className="flex flex-col gap-3">
                {opportunity.status === 'draft' ? (
                  <Link href={`${OPPORTUNITY_ROUTES.list}/${opportunityId}/offre`} className={LINK}>
                    {frOpportunities.mine.continueDraft}
                  </Link>
                ) : (
                  <Link href={opportunityTrackingRoute(opportunityId)} className={LINK}>
                    {frOpportunities.detail.manageTracking}
                  </Link>
                )}
                {isOpen || opportunity.status === 'paused' || opportunity.status === 'expired' ? (
                  <Link href={opportunityClosureRoute(opportunityId)} className={LINK}>
                    {frOpportunities.detail.manageClose}
                  </Link>
                ) : null}
              </div>
            </Card>
          ) : application !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">
                  {application.isSelfDeclared
                    ? frOpportunities.detail.alreadyDeclaredTitle
                    : frOpportunities.detail.alreadyAppliedTitle}
                </CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frOpportunities.applicationStatus[application.status] ?? application.status}
              </p>
              <p className="mt-5">
                <Link href={applicationRoute(application.applicationId)} className={LINK}>
                  {frOpportunities.detail.seeApplication}
                </Link>
              </p>
            </Card>
          ) : isOpen ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frOpportunities.detail.howToApplyTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frOpportunities.applicationModeHint[opportunity.applicationMode]}
              </p>
              <p className="mt-5">
                <Link href={opportunityApplyRoute(opportunityId)} className={PRIMARY}>
                  {opportunity.canApplyInternally
                    ? frOpportunities.detail.ctaInternal
                    : frOpportunities.detail.ctaExternal}
                </Link>
              </p>
            </Card>
          ) : (
            <Alert variant="info" title={frOpportunities.detail.closedTitle}>
              {frOpportunities.detail.closedBody}
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.detail.organizationTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {opportunity.organization ?? frOpportunities.common.notSpecified}
            </p>
            {opportunity.author !== null ? (
              <p className="text-caption text-text-muted mt-3">
                {frOpportunities.sourceType[opportunity.sourceType]} ·{' '}
                {opportunity.author.displayName}
              </p>
            ) : null}
            {opportunity.sourceUrl !== null ? (
              <p className="text-caption text-text-muted mt-3 break-all">{opportunity.sourceUrl}</p>
            ) : null}
            <div className="border-border mt-5 border-t pt-4">
              <SaveOpportunityButton
                opportunityId={opportunity.opportunityId}
                isSaved={opportunity.isSaved}
              />
            </div>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
