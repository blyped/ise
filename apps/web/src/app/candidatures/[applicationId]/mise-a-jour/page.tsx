import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES, applicationRoute } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadApplication } from '@/lib/queries/opportunities';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { ApplicationUpdateForm } from '@/components/opportunities/ApplicationUpdateForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.update.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-06X — mise a jour ou resultat final d'une candidature (D-55). */
export default async function ApplicationStepPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  if (!isUuid(applicationId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadApplication(applicationId, correlationId),
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
        title={frOpportunities.application.notFoundTitle}
        description={
          result.ok ? frOpportunities.application.notFoundBody : result.error.userMessage
        }
        correlationId={correlationId}
      />,
    );
  }

  const application = result.data;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={OPPORTUNITY_ROUTES.applications} className="hover:text-primary">
          {frOpportunities.applications.title}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={applicationRoute(applicationId)} className="hover:text-primary">
          {application.opportunity?.title ?? frOpportunities.application.title}
        </Link>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOpportunities.update.title}</h1>
        <p className="text-body text-text-secondary">{frOpportunities.update.subtitle}</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <ApplicationUpdateForm
            applicationId={applicationId}
            allowed={application.allowedTransitions}
            selfDeclared={application.stepsAreSelfDeclared}
          />
        </Card>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frOpportunities.outcome.impactTitle}>
            {frOpportunities.outcome.impactBody}
          </Alert>
          <p>
            <Link href={applicationRoute(applicationId)} className={LINK}>
              {frOpportunities.common.back}
            </Link>
          </p>
        </aside>
      </div>
    </div>,
  );
}
