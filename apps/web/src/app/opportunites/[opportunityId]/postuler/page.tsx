import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, applicationRoute, opportunityRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyDocuments, loadOpportunity } from '@/lib/queries/opportunities';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  DeclareApplicationForm,
  ExternalOfferForm,
  InternalApplyForm,
} from '@/components/opportunities/ApplyForms';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.apply.titleExternal };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Cible du CTA d'ISE-056 — « Postuler » ou « Voir comment postuler ».
 *
 * CET ÉCRAN PORTE LA RÈGLE CARDINALE DE LA TRANCHE (MASTER PROMPT §27,
 * D-55). Deux parcours entièrement distincts y cohabitent, et l'écran ne
 * les mélange jamais :
 *
 *   * mode `internal` : le formulaire dépose une candidature réelle. La
 *     plateforme la constate et pourra en suivre les étapes.
 *   * modes externes : la plateforme n'envoie RIEN. Elle affiche le
 *     lien ou l'adresse, journalise le clic comme un fait technique, et
 *     propose ensuite au membre de DÉCLARER lui-même s'il a postulé.
 *
 * Le second parcours ne contient aucun bouton nommé « Candidater ».
 */
export default async function ApplyPage({
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
  const [viewer, result, documents] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadOpportunity(opportunityId, correlationId),
    loadMyDocuments('cv', correlationId),
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

  if (opportunity.myApplication !== null) {
    return shell(
      <div className="flex flex-col gap-6">
        <Alert
          variant="info"
          title={
            opportunity.myApplication.isSelfDeclared
              ? frOpportunities.detail.alreadyDeclaredTitle
              : frOpportunities.detail.alreadyAppliedTitle
          }
        />
        <p>
          <Link href={applicationRoute(opportunity.myApplication.applicationId)} className={LINK}>
            {frOpportunities.detail.seeApplication}
          </Link>
        </p>
      </div>,
    );
  }

  if (opportunity.status !== 'active') {
    return shell(
      <Alert variant="info" title={frOpportunities.detail.closedTitle}>
        {frOpportunities.detail.closedBody}
      </Alert>,
    );
  }

  const internal = opportunity.canApplyInternally;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={OPPORTUNITY_ROUTES.list} className="hover:text-primary">
          {frOpportunities.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={opportunityRoute(opportunityId)} className="hover:text-primary">
          {opportunity.title}
        </Link>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          {internal ? frOpportunities.apply.titleInternal : frOpportunities.apply.titleExternal}
        </h1>
        <p className="text-body text-text-secondary">
          {internal
            ? frOpportunities.apply.subtitleInternal
            : frOpportunities.applicationModeHint[opportunity.applicationMode]}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          {internal ? (
            <InternalApplyForm
              opportunityId={opportunityId}
              documents={documents.ok ? documents.data : []}
            />
          ) : (
            <div className="flex flex-col gap-8">
              <ExternalOfferForm
                opportunityId={opportunityId}
                url={opportunity.externalApplicationUrl}
                email={opportunity.externalApplicationEmail}
              />

              {opportunity.applicationMode === 'contact_recruiter' &&
              opportunity.contact !== null ? (
                <p className="text-body-sm text-text-secondary">
                  {frOpportunities.apply.contactRecruiter} :{' '}
                  <span className="text-text-primary font-medium">
                    {opportunity.contact.displayName}
                  </span>
                </p>
              ) : null}

              <section
                aria-label={frOpportunities.apply.declareTitle}
                className="border-border border-t pt-7"
              >
                <h2 className="text-h3 text-text-primary font-semibold">
                  {frOpportunities.apply.declareTitle}
                </h2>
                <p className="text-body-sm text-text-secondary mb-5 mt-2">
                  {frOpportunities.apply.declareBody}
                </p>
                <DeclareApplicationForm opportunityId={opportunityId} />
              </section>
            </div>
          )}
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{opportunity.title}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {[opportunity.organization, opportunity.city, opportunity.country]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="mt-4">
              <Link href={opportunityRoute(opportunityId)} className={LINK}>
                {frOpportunities.list.see}
              </Link>
            </p>
          </Card>

          <Alert variant="info" title={frOpportunities.apply.noMassApplyTitle}>
            {frOpportunities.apply.noMassApplyBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
