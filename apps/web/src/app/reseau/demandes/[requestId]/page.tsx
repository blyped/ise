import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { CONNECTION_STATUS_LABELS } from '@ise/domain';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { memberProfileRoute } from '@/lib/routes/search';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { formatDate, isUuid, loadConnectionRequest } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileSummary } from '@/components/network/ProfileSummary';
import { WithdrawRequestButton } from '@/components/network/WithdrawRequestButton';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.sent.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** Etat d'une etape de suivi : constate, en attente, ou pas encore atteint. */
function TrackingStep({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <li className="flex gap-4 pb-5 last:pb-0">
      <span aria-hidden="true" className="flex flex-col items-center">
        <span
          className={`mt-1 h-3 w-3 shrink-0 rounded-full border-2 ${
            done ? 'border-success bg-success' : 'border-border bg-surface'
          }`}
        />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <p
          className={
            done ? 'text-body-sm text-text-primary font-semibold' : 'text-body-sm text-text-muted'
          }
        >
          {label}
        </p>
        <p className="text-caption text-text-muted sm:text-right">{value}</p>
      </div>
    </li>
  );
}

/**
 * ISE-039 — Demande de connexion envoyee.
 *
 * L'ecran lit l'etat REEL de la demande en base : il ne suppose pas
 * qu'elle est en attente parce qu'on vient de l'envoyer. Si le
 * destinataire a deja repondu entre-temps, c'est sa reponse qui
 * s'affiche.
 *
 * ECART ASSUME : la maquette ajoute un bloc « Autres profils
 * pertinents ». Il n'est pas rendu : le proposer supposerait un moteur
 * de recommandation appele depuis cet ecran, avec des donnees qui
 * n'existent pas ici. Un bloc peuple de personas serait une donnee
 * inventee (MASTER PROMPT §78).
 */
export default async function SentRequestPage({
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
        title={frNetwork.sent.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
            {frNetwork.sent.backToNetwork}
          </Link>
        }
      />,
    );
  }

  if (result.data === null) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.sent.notFoundTitle}</h1>
        <p>
          <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
            {frNetwork.sent.backToNetwork}
          </Link>
        </p>
      </div>,
    );
  }

  const request = result.data;

  // Une demande RECUE n'a rien a faire sur cet ecran : ISE-042 la traite.
  if (request.myRole === 'addressee') {
    redirect(`${NETWORK_ROUTES.invitations}/${encodeURIComponent(requestId)}`);
  }

  const name = request.profile.displayName;
  const isPending = request.status === 'pending';
  const isAccepted = request.status === 'accepted';

  return shell(
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={NETWORK_ROUTES.connections}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frNetwork.sent.backToNetwork}
        </Link>
      </p>

      {/* Bandeau de confirmation : il enonce un FAIT (la demande est
          partie), jamais un resultat (la relation n'existe pas encore). */}
      <Alert
        variant={isAccepted ? 'success' : 'info'}
        title={
          isAccepted
            ? CONNECTION_STATUS_LABELS.accepted
            : isPending
              ? frNetwork.sent.title
              : CONNECTION_STATUS_LABELS[request.status]
        }
        action={
          <Link href={memberProfileRoute(request.profile.profileId)} className={ACTION_LINK}>
            {frNetwork.common.seeProfile}
          </Link>
        }
      >
        {isPending ? (
          <>
            {tn(frNetwork.sent.banner, { name })}
            <br />
            {frNetwork.sent.bannerHint}
          </>
        ) : null}
      </Alert>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.sent.detailTitle}</CardTitle>
            </CardHeader>

            <ProfileSummary
              card={request.profile}
              trailing={
                <Badge tone={isPending ? 'warning' : isAccepted ? 'success' : 'neutral'}>
                  {CONNECTION_STATUS_LABELS[request.status]}
                </Badge>
              }
            />

            <dl className="border-border mt-6 flex flex-col gap-4 border-t pt-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-6">
                <dt className="text-caption text-text-muted">{frNetwork.sent.motiveLabel}</dt>
                <dd className="text-body-sm text-text-primary sm:text-right">
                  {request.context !== null
                    ? (frNetwork.context[request.context] ?? request.context)
                    : frNetwork.sent.motiveNone}
                </dd>
              </div>
              <div className="flex flex-col gap-2">
                <dt className="text-caption text-text-muted">{frNetwork.sent.messageLabel}</dt>
                <dd className="rounded-base text-body-sm text-text-secondary bg-[#EFF6FF] p-4">
                  {request.message !== null ? (
                    <span className="whitespace-pre-line">« {request.message} »</span>
                  ) : (
                    frNetwork.sent.messageNone
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.sent.trackingTitle}</CardTitle>
            </CardHeader>
            {/* Trois etapes, trois faits. « Connexion établie » ne
                s'allume qu'apres une acceptation reelle (D-55). */}
            <ol className="flex flex-col">
              <TrackingStep
                label={frNetwork.sent.step1}
                value={formatDate(request.createdAt)}
                done
              />
              <TrackingStep
                label={tn(frNetwork.sent.step2, { name })}
                value={
                  request.respondedAt !== null
                    ? formatDate(request.respondedAt)
                    : frNetwork.sent.step2Pending
                }
                done={request.respondedAt !== null}
              />
              <TrackingStep
                label={frNetwork.sent.step3}
                value={isAccepted ? formatDate(request.respondedAt) : frNetwork.sent.step3Pending}
                done={isAccepted}
              />
            </ol>

            {isPending && request.expiresAt !== null ? (
              <p className="text-caption text-text-muted mt-4">
                {tn(frNetwork.sent.expiresAt, { date: formatDate(request.expiresAt) })}
              </p>
            ) : null}
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
              {frNetwork.sent.seeConnections}
            </Link>
            <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
              {frNetwork.invitations.title}
            </Link>
          </div>
        </div>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frNetwork.sent.waitTitle}>
            {frNetwork.sent.waitBody}
          </Alert>

          {isPending ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frNetwork.sent.controlTitle}</CardTitle>
              </CardHeader>
              <WithdrawRequestButton requestId={request.requestId} />
            </Card>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
