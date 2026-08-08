import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { INTRODUCTION_STATUS_LABELS, type IntroductionActor } from '@ise/domain';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { memberProfileRoute } from '@/lib/routes/search';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { formatDate, isUuid, loadIntroduction } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { IntroductionPathGraph, SELF_NODE } from '@/components/network/IntroductionPathGraph';
import { IntroductionTimeline } from '@/components/network/IntroductionTimeline';
import { IntroductionActions } from '@/components/network/IntroductionActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.follow.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-045 — Suivi d'une demande d'introduction.
 *
 * Chaque etape de la frise reflete un FAIT CONSTATE, lu dans
 * `introduction_events` : rien n'est deduit de la position dans la
 * liste (MASTER PROMPT §25).
 *
 * Les actions proposees viennent de
 * `introductionMachine.available(statut, acteur)` — le miroir de la
 * matrice SQL. Aucun bouton n'est ecrit en dur, et aucun bouton affiche
 * ne peut etre refuse par la base pour cause de mauvais acteur.
 */
export default async function IntroductionFollowPage({
  params,
}: {
  params: Promise<{ introductionId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { introductionId } = await params;
  if (!isUuid(introductionId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadIntroduction(introductionId, correlationId),
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
        title={frNetwork.follow.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={NETWORK_ROUTES.introductions} className={ACTION_LINK}>
            {frNetwork.follow.backToList}
          </Link>
        }
      />,
    );
  }

  if (result.data === null) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.follow.notFoundTitle}</h1>
        <p className="text-body text-text-secondary">{frNetwork.follow.notFoundBody}</p>
        <p>
          <Link href={NETWORK_ROUTES.introductions} className={ACTION_LINK}>
            {frNetwork.follow.backToList}
          </Link>
        </p>
      </div>,
    );
  }

  const intro = result.data;
  const actor: IntroductionActor = intro.myRole;

  const requesterName = intro.requester?.displayName ?? '—';
  const intermediaryName = intro.intermediary?.displayName ?? '—';
  const targetName = intro.target?.displayName ?? '—';

  /** Le nœud de gauche prend « Vous » quand c'est moi le demandeur. */
  const firstNode = intro.myRole === 'requester' ? SELF_NODE : { name: requesterName };

  const introducedDone = intro.introducedAt !== null;
  const acceptedDone =
    intro.intermediaryRespondedAt !== null && intro.status !== 'intermediary_declined';

  /* ---- Faits constates : uniquement des horodatages reels ---- */
  const facts: string[] = [];
  if (intro.createdAt !== null) {
    facts.push(`Demande envoyée le ${formatDate(intro.createdAt)}.`);
  }
  if (acceptedDone && intro.intermediaryRespondedAt !== null) {
    facts.push(`L’intermédiaire a accepté le ${formatDate(intro.intermediaryRespondedAt)}.`);
  }
  if (intro.status === 'intermediary_declined' && intro.intermediaryRespondedAt !== null) {
    facts.push(`L’intermédiaire a décliné le ${formatDate(intro.intermediaryRespondedAt)}.`);
  }
  if (introducedDone) {
    facts.push(`Introduction transmise le ${formatDate(intro.introducedAt)}.`);
  } else {
    facts.push('Aucun message n’a encore été transmis à la personne visée.');
  }
  if (intro.targetRespondedAt !== null) {
    facts.push(`Un échange a été constaté le ${formatDate(intro.targetRespondedAt)}.`);
  }
  facts.push('Aucune coordonnée personnelle n’a été partagée.');

  return shell(
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={NETWORK_ROUTES.introductions}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frNetwork.follow.backToList}
        </Link>
      </p>

      {/* 375 px : titre court, sous-titre supprime.
          1440 px : titre complet et rappel du chemin en toutes lettres. */}
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          <span className="lg:hidden">{frNetwork.follow.titleShort}</span>
          <span className="max-lg:hidden">{frNetwork.follow.title}</span>
        </h1>
        <p className="text-body text-text-secondary max-lg:hidden">
          {tn(frNetwork.follow.subtitle, {
            intermediary: intermediaryName,
            target: targetName,
          })}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {/* Carte d'etat : elle nomme le statut REEL, avec le libelle de
              la machine d'etats. Aucun raccourci du type « mise en
              relation reussie ». */}
          <Card>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
              <div className="min-w-0">
                <p className="text-h4 text-text-primary font-semibold">
                  {INTRODUCTION_STATUS_LABELS[intro.status]}
                </p>
                <p className="text-body-sm text-text-secondary mt-1">
                  {frNetwork.follow.purposeLabel} :{' '}
                  {frNetwork.purpose[intro.purpose] ?? intro.purpose}
                </p>
                <p className="text-caption text-text-muted mt-1">
                  {intro.myRole === 'requester'
                    ? frNetwork.follow.roleRequester
                    : intro.myRole === 'intermediary'
                      ? frNetwork.follow.roleIntermediary
                      : frNetwork.follow.roleTarget}
                </p>
              </div>
              <Badge
                tone={
                  intro.status === 'completed'
                    ? 'success'
                    : ['intermediary_declined', 'withdrawn', 'expired', 'no_outcome'].includes(
                          intro.status,
                        )
                      ? 'neutral'
                      : 'warning'
                }
              >
                {INTRODUCTION_STATUS_LABELS[intro.status]}
              </Badge>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.follow.pathTitle}</CardTitle>
            </CardHeader>
            <IntroductionPathGraph
              nodes={[firstNode, { name: intermediaryName }, { name: targetName }]}
              edges={[
                {
                  label: acceptedDone ? 'acceptée' : 'demande envoyée',
                  established: acceptedDone,
                },
                {
                  label: introducedDone ? 'introduction transmise' : 'à transmettre',
                  established: introducedDone,
                },
              ]}
              caption={
                introducedDone
                  ? undefined
                  : 'Le second lien reste en pointillés tant que rien n’a été transmis.'
              }
            />
            <p className="mt-4 flex flex-wrap gap-3">
              {intro.intermediary !== null ? (
                <Link
                  href={memberProfileRoute(intro.intermediary.profileId)}
                  className={ACTION_LINK}
                >
                  {frNetwork.common.seeProfile} — {intermediaryName}
                </Link>
              ) : null}
              {intro.target !== null ? (
                <Link href={memberProfileRoute(intro.target.profileId)} className={ACTION_LINK}>
                  {frNetwork.common.seeProfile} — {targetName}
                </Link>
              ) : null}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.follow.historyTitle}</CardTitle>
            </CardHeader>
            {intro.events.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frNetwork.follow.historyEmpty}</p>
            ) : (
              <IntroductionTimeline status={intro.status} events={intro.events} />
            )}
          </Card>

          {/* Le contexte adresse a l'intermediaire n'est PAS renvoye a la
              personne visee : la cle est absente de la charge utile, il
              n'y a donc rien a masquer ici. */}
          {intro.messageToIntermediary !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frNetwork.follow.messageToIntermediaryTitle}</CardTitle>
              </CardHeader>
              <p className="text-body text-text-secondary whitespace-pre-line">
                {intro.messageToIntermediary}
              </p>
            </Card>
          ) : null}

          {intro.messageToTarget !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frNetwork.follow.messageToTargetTitle}</CardTitle>
              </CardHeader>
              <p className="text-body text-text-secondary whitespace-pre-line">
                {intro.messageToTarget}
              </p>
            </Card>
          ) : null}

          {intro.declineReason !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frNetwork.follow.declineReasonTitle}</CardTitle>
              </CardHeader>
              <p className="text-body text-text-secondary whitespace-pre-line">
                {intro.declineReason}
              </p>
            </Card>
          ) : null}

          {intro.outcome !== null ? (
            <Alert
              variant="success"
              title={frNetwork.outcome.labels[intro.outcome] ?? intro.outcome}
            >
              {intro.outcomeNote !== null ? (
                <>
                  {intro.outcomeNote}
                  <br />
                </>
              ) : null}
              {intro.outcomeDeclaredByRole !== null && intro.outcomeDeclaredAt !== null
                ? tn(frNetwork.outcome.doneBy, {
                    role: frNetwork.role[intro.outcomeDeclaredByRole] ?? '—',
                    date: formatDate(intro.outcomeDeclaredAt),
                  })
                : ''}
            </Alert>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.follow.actionsTitle}</CardTitle>
            </CardHeader>
            <IntroductionActions
              introductionId={intro.introductionId}
              status={intro.status}
              actor={actor}
            />
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.follow.factsTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </Card>

          <Alert variant="warning" title={frNetwork.follow.confusionTitle}>
            {frNetwork.follow.confusionBody}
          </Alert>

          <Alert variant="info" title={frNetwork.follow.waitTitle}>
            {frNetwork.follow.waitBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
