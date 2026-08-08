import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { MetaList, RelevanceNote } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import {
  CALL_ROUTES,
  callClosureRoute,
  callRespondRoute,
  callTrackingRoute,
} from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkCall } from '@/lib/queries/calls';
import { RESPONSE_TYPES } from '@/lib/calls-view';
import { formatDate, isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallDetailView } from '@/components/calls/CallDetailView';
import { SaveCallButton } from '@/components/calls/SaveCallButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.detail.breadcrumb };

const LINK =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const PRIMARY =
  'inline-flex min-h-[48px] w-full items-center justify-center rounded-base bg-primary px-6 text-body font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-048 — Détail d'un appel.
 *
 * Les quatre entrées « Comment pouvez-vous aider ? » ne sont rendues que
 * si l'appel est ACTIF, que le lecteur n'en est pas l'auteur et qu'il
 * n'a pas déjà répondu. Un bouton qui mènerait à un refus de la base
 * serait un bouton décoratif (MASTER PROMPT §113).
 *
 * ECART ASSUME : la maquette propose « Partager avec un ISE » et un menu
 * « Signaler / Masquer ». Aucun n'est rendu : le partage suppose la
 * messagerie (ISE-097, non livrée) et le signalement suppose l'écran de
 * modération (SA-018). Les proposer ici les rendrait inopérants.
 */
export default async function CallDetailPage({
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
  const justResponded = query['reponse'] === '1';

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
        action={
          <Link href={CALL_ROUTES.list} className={LINK}>
            {frCalls.common.back}
          </Link>
        }
      />,
    );
  }

  const call = result.data;
  const isOpen = call.status === 'active';
  const canRespond = isOpen && !call.isAuthor && call.myResponse === null;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={CALL_ROUTES.list} className="hover:text-primary">
          {frCalls.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="text-text-primary font-medium">{frCalls.detail.breadcrumb}</span>
      </nav>

      {justResponded ? (
        <Alert variant="success" title={frCalls.respond.doneTitle}>
          {frCalls.respond.doneBody}
        </Alert>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0">
          <CallDetailView call={call} />
        </div>

        <aside className="flex flex-col gap-7">
          {call.relevance !== null ? (
            <RelevanceNote
              title={frCalls.list.whyTitle}
              label={
                call.relevance.label !== null ? frCalls.relevance[call.relevance.label] : undefined
              }
              reasons={call.relevance.reasons}
            />
          ) : null}

          {call.isAuthor ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCalls.detail.manageTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frCalls.detail.manageBody}</p>
              <div className="mt-5 flex flex-col gap-3">
                {call.status !== 'draft' ? (
                  <Link href={callTrackingRoute(callId)} className={LINK}>
                    {frCalls.detail.manageTracking}
                  </Link>
                ) : (
                  <Link href={`${CALL_ROUTES.list}/${callId}/besoin`} className={LINK}>
                    {frCalls.mine.continueDraft}
                  </Link>
                )}
                {isOpen || call.status === 'paused' || call.status === 'expired' ? (
                  <Link href={callClosureRoute(callId)} className={LINK}>
                    {frCalls.detail.manageClose}
                  </Link>
                ) : null}
              </div>
            </Card>
          ) : canRespond ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCalls.detail.howToHelp}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-3">
                {RESPONSE_TYPES.filter((type) => type !== 'other').map((type) => (
                  <li key={type}>
                    <Link href={callRespondRoute(callId, type)} className={LINK}>
                      <span className="flex flex-col items-start">
                        <span className="font-semibold">{frCalls.responseType[type]}</span>
                        <span className="text-caption text-text-muted">
                          {frCalls.responseTypeHint[type]}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-5">
                <Link href={callRespondRoute(callId)} className={PRIMARY}>
                  {frCalls.list.help}
                </Link>
              </p>
            </Card>
          ) : call.myResponse !== null ? (
            <Alert variant="success" title={frCalls.detail.alreadyRespondedTitle}>
              {tc(frCalls.detail.alreadyRespondedBody, {
                date: formatDate(call.myResponse.createdAt),
              })}
            </Alert>
          ) : (
            <Alert variant="info" title={frCalls.detail.closedTitle}>
              {frCalls.detail.closedBody}
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frCalls.detail.keyInfoTitle}</CardTitle>
            </CardHeader>
            <MetaList
              items={[
                {
                  label: frCalls.detail.statusLabel,
                  value: frCalls.status[call.status] ?? call.status,
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
                  label: frCalls.detail.responsesLabel,
                  value: call.isAuthor ? call.responseCount : null,
                },
              ]}
            />
            <div className="border-border mt-5 border-t pt-4">
              <SaveCallButton callId={call.callId} isSaved={call.isSaved} />
            </div>
          </Card>

          <Alert variant="info" title={frCalls.detail.privacyTitle}>
            {frCalls.detail.privacyBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
