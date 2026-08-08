import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES, callRoute } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkCall } from '@/lib/queries/calls';
import { RESPONSE_TYPES, type ResponseType } from '@/lib/calls-view';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { RespondForm } from '@/components/calls/RespondForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.respond.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-051 — Répondre à un appel.
 *
 * ECART ASSUME : la maquette décrit une modale (bureau) ou une feuille
 * (mobile). C'est une ROUTE : une réponse est un acte à part entière,
 * elle doit pouvoir être partagée, rechargée et retrouvée dans
 * l'historique du navigateur. Le retour ramène au détail de l'appel.
 */
export default async function RespondPage({
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
  const requested = query['type'];
  const defaultType: ResponseType =
    typeof requested === 'string' && (RESPONSE_TYPES as readonly string[]).includes(requested)
      ? (requested as ResponseType)
      : 'direct';

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCall(callId, correlationId),
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

  if (call.isAuthor || call.status !== 'active') {
    return shell(
      <Alert variant="info" title={frCalls.detail.closedTitle}>
        {frCalls.detail.closedBody}
      </Alert>,
    );
  }

  if (call.myResponse !== null) {
    return shell(
      <div className="flex flex-col gap-6">
        <Alert variant="info" title={frCalls.respond.alreadyTitle}>
          {frCalls.respond.alreadyBody}
        </Alert>
        <p>
          <Link href={callRoute(callId)} className={LINK}>
            {frCalls.common.back}
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
        <Link href={callRoute(callId)} className="hover:text-primary">
          {call.title}
        </Link>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCalls.respond.title}</h1>
        <p className="text-body text-text-secondary">{frCalls.respond.subtitle}</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <RespondForm callId={callId} defaultType={defaultType} />
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{call.title}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{call.excerpt}</p>
          </Card>

          <Alert variant="info" title={frCalls.detail.privacyTitle}>
            {frCalls.detail.privacyBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
