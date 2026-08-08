import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { CONNECTION_STATUS_LABELS } from '@ise/domain';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { memberProfileRoute } from '@/lib/routes/search';
import { NETWORK_ROUTES, sentRequestRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { formatDate, isUuid, loadConnectionRequest } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileSummary } from '@/components/network/ProfileSummary';
import { InvitationActions } from '@/components/network/InvitationActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.invitation.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-042 — Detail d'une invitation recue.
 *
 * « Liens et points communs » n'affiche QUE des signaux explicites
 * calcules en base (D-43, D-51) : relations communes — qui sont, par
 * construction, les miennes —, promotion commune, organisation commune.
 * Quand rien n'est trouve, l'ecran le dit franchement au lieu d'inventer
 * une affinite : « aucun lien commun explicite » n'est pas un signal
 * negatif, c'est l'absence de donnee structuree.
 */
export default async function InvitationDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { requestId } = await params;
  if (!isUuid(requestId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadConnectionRequest(requestId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={NETWORK_ROUTES.connections}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok) {
    return shell(
      <ErrorState
        title={frNetwork.invitation.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
            {frNetwork.invitation.backToList}
          </Link>
        }
      />,
    );
  }

  if (result.data === null) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">
          {frNetwork.invitation.notFoundTitle}
        </h1>
        <p>
          <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
            {frNetwork.invitation.backToList}
          </Link>
        </p>
      </div>,
    );
  }

  const request = result.data;

  // Une demande que j'ai ENVOYEE releve d'ISE-039, pas de cet ecran.
  if (request.myRole === 'requester') {
    redirect(sentRequestRoute(requestId));
  }

  const isPending = request.status === 'pending';
  const common = request.commonGround;
  const hasCommon =
    common.sharesPromotion ||
    common.sharedOrganization !== null ||
    common.mutualConnections.length > 0;

  return shell(
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={NETWORK_ROUTES.invitations}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frNetwork.invitation.backToList}
        </Link>
      </p>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.invitation.title}</h1>
        <p className="text-body text-text-secondary max-md:hidden">
          {frNetwork.invitation.subtitle}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <ProfileSummary
              card={request.profile}
              trailing={
                <div className="flex flex-col items-start gap-3 md:items-end">
                  <Badge tone={isPending ? 'warning' : 'neutral'}>
                    {isPending
                      ? frNetwork.invitation.statusPending
                      : CONNECTION_STATUS_LABELS[request.status]}
                  </Badge>
                  <Link
                    href={memberProfileRoute(request.profile.profileId)}
                    className={ACTION_LINK}
                  >
                    {frNetwork.common.seeFullProfile}
                  </Link>
                </div>
              }
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.invitation.motiveTitle}</CardTitle>
            </CardHeader>
            <p className="rounded-base text-body text-text-primary bg-[#EFF6FF] p-4 font-medium">
              {request.context !== null
                ? (frNetwork.context[request.context] ?? request.context)
                : frNetwork.invitation.motiveNone}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.invitation.messageTitle}</CardTitle>
            </CardHeader>
            {request.message !== null ? (
              <p className="text-body text-text-secondary whitespace-pre-line">{request.message}</p>
            ) : (
              <p className="text-body-sm text-text-muted">{frNetwork.invitation.messageNone}</p>
            )}
            {request.createdAt !== null ? (
              <p className="text-caption text-text-muted mt-4 text-right">
                {tn(frNetwork.invitation.receivedAt, { date: formatDate(request.createdAt) })}
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.invitation.commonTitle}</CardTitle>
            </CardHeader>
            {!hasCommon ? (
              <p className="text-body-sm text-text-muted">{frNetwork.invitation.commonNone}</p>
            ) : (
              <dl className="flex flex-col gap-4">
                {common.mutualConnections.length > 0 ? (
                  <div className="flex flex-col gap-1 md:flex-row md:justify-between md:gap-6">
                    <dt className="text-caption text-text-muted">
                      {frNetwork.invitation.commonMutual}
                    </dt>
                    <dd className="text-body-sm text-text-primary md:max-w-[62%] md:text-right">
                      {common.mutualConnections.map((entry, index) => (
                        <span key={entry.profileId}>
                          {index > 0 ? ' · ' : ''}
                          <Link
                            href={memberProfileRoute(entry.profileId)}
                            className="text-primary hover:text-primary-hover focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
                          >
                            {entry.displayName}
                          </Link>
                        </span>
                      ))}
                    </dd>
                  </div>
                ) : null}

                {common.sharesPromotion ? (
                  <div className="flex flex-col gap-1 md:flex-row md:justify-between md:gap-6">
                    <dt className="text-caption text-text-muted">
                      {frNetwork.invitation.commonPromotion}
                    </dt>
                    <dd className="text-body-sm text-text-primary md:text-right">
                      {frNetwork.invitation.commonPromotionValue}
                    </dd>
                  </div>
                ) : null}

                {common.sharedOrganization !== null ? (
                  <div className="flex flex-col gap-1 md:flex-row md:justify-between md:gap-6">
                    <dt className="text-caption text-text-muted">
                      {frNetwork.invitation.commonOrganization}
                    </dt>
                    <dd className="text-body-sm text-text-primary md:text-right">
                      {common.sharedOrganization}
                    </dd>
                  </div>
                ) : null}
              </dl>
            )}
            <p className="border-border text-caption text-text-muted mt-5 border-t pt-4">
              {frNetwork.invitation.commonSource}
            </p>
          </Card>

          {/* Barre d'actions. A 375 px les boutons passent en pile pleine
              largeur (cible tactile 44 px) ; a partir de `sm` ils
              s'alignent. */}
          {isPending ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Votre décision</CardTitle>
              </CardHeader>
              <InvitationActions
                requestId={request.requestId}
                ignoreHref={NETWORK_ROUTES.invitations}
                detailHref={null}
              />
            </Card>
          ) : (
            <Alert variant="info" title={frNetwork.invitation.alreadyAnswered}>
              {CONNECTION_STATUS_LABELS[request.status]}
              {request.respondedAt !== null ? ` — ${formatDate(request.respondedAt)}` : ''}
            </Alert>
          )}
        </div>

        <aside className="flex flex-col gap-7 max-xl:order-first">
          <Alert variant="success" title={frNetwork.invitation.acceptTitle}>
            {frNetwork.invitation.acceptBody}
          </Alert>
          <Alert variant="warning" title={frNetwork.invitation.declineTitle}>
            {frNetwork.invitation.declineBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
