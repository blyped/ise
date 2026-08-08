import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { StatTile } from '@ise/ui-web/cards';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callTrackingRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadCallTracking, loadRespondents } from '@/lib/queries/calls';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { ClosureForm } from '@/components/calls/ClosureForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.closure.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-054 — Clôture d'un appel et mesure d'impact.
 *
 * Le rail rappelle les chiffres RÉELS de l'appel : ils viennent des
 * mêmes compteurs que l'écran de suivi, jamais d'une estimation.
 */
export default async function CallClosurePage({ params }: { params: Promise<{ callId: string }> }) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, tracking, respondents] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadCallTracking(callId, correlationId),
    loadRespondents(callId, correlationId),
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

  if (call.status !== 'active' && call.status !== 'paused' && call.status !== 'expired') {
    return shell(
      <div className="flex flex-col gap-6">
        <Alert variant="info" title={frCalls.detail.closedTitle}>
          {frCalls.detail.closedBody}
        </Alert>
        <p>
          <Link href={callTrackingRoute(callId)} className={LINK}>
            {frCalls.detail.manageTracking}
          </Link>
        </p>
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={CALL_ROUTES.list} className="hover:text-primary">
          {frCalls.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={callTrackingRoute(callId)} className="hover:text-primary">
          {call.title}
        </Link>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCalls.closure.title}</h1>
        <p className="text-body text-text-secondary">{frCalls.closure.subtitle}</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <ClosureForm callId={callId} respondents={respondents.ok ? respondents.data : []} />
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.tracking.metricsTitle}</CardTitle>
            </CardHeader>
            <div className="grid grid-cols-2 gap-5">
              <StatTile value={call.targeted} label={frCalls.tracking.targeted} />
              <StatTile value={call.responses} label={frCalls.tracking.responses} />
              <StatTile value={call.recommendations} label={frCalls.tracking.recommendations} />
              <StatTile value={call.introductions} label={frCalls.tracking.introductions} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.closure.impactTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              <li>{frCalls.closure.impactBody1}</li>
              <li>{frCalls.closure.impactBody2}</li>
              <li>{frCalls.closure.impactBody3}</li>
            </ul>
          </Card>

          <Alert variant="info" title={frCalls.closure.noImpactTitle}>
            {frCalls.closure.noImpactBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
