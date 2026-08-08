import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { INTRODUCTION_STATUS_LABELS } from '@ise/domain';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { NETWORK_ROUTES, introductionRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { formatDate, isUuid, loadIntroduction } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { IntroductionPathGraph, SELF_NODE } from '@/components/network/IntroductionPathGraph';
import { OutcomeForm } from './OutcomeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.outcome.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-046 — Bilan d'introduction.
 *
 * LA regle de cet ecran, et la raison pour laquelle il refuse parfois de
 * s'ouvrir : **il est interdit d'ecrire « introduction reussie » quand la
 * seule chose constatee est « intermediaire accepte »**
 * (MASTER PROMPT §25, D-55).
 *
 * Concretement :
 *   - tant que le statut n'est pas `target_responded`, le formulaire
 *     n'est PAS rendu et l'ecran explique pourquoi. Ce n'est pas un
 *     confort d'interface : `declare_introduction_outcome()` leverait
 *     `invalid_transition` de toute facon ;
 *   - seuls le demandeur et la personne presentee peuvent declarer un
 *     resultat. L'intermediaire, lui, a constate qu'il avait transmis —
 *     il ne peut pas constater ce qui s'est dit ensuite ;
 *   - une fois le resultat declare, l'ecran l'affiche tel quel, avec son
 *     auteur et sa date, et ne propose pas de le « corriger » : la base
 *     refuse une seconde declaration.
 */
export default async function IntroductionOutcomePage({
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
        title={frNetwork.outcome.errorTitle}
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
  const requesterName = intro.requester?.displayName ?? '—';
  const intermediaryName = intro.intermediary?.displayName ?? '—';
  const targetName = intro.target?.displayName ?? '—';

  const canDeclare = intro.myRole === 'requester' || intro.myRole === 'target';
  const exchangeConstated = intro.status === 'target_responded';
  const alreadyDeclared = intro.outcome !== null;

  const backLink = (
    <p>
      <Link
        href={introductionRoute(introductionId)}
        className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        ← {frNetwork.outcome.backToFollow}
      </Link>
    </p>
  );

  return shell(
    <div className="flex flex-col gap-8">
      {backLink}

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.outcome.title}</h1>
        <p className="text-body text-text-secondary max-md:hidden">{frNetwork.outcome.subtitle}</p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.outcome.pathTitle}</CardTitle>
            </CardHeader>
            <IntroductionPathGraph
              nodes={[
                intro.myRole === 'requester' ? SELF_NODE : { name: requesterName },
                { name: intermediaryName },
                { name: targetName },
              ]}
              edges={[
                { label: 'acceptée', established: intro.intermediaryRespondedAt !== null },
                { label: 'introduction transmise', established: intro.introducedAt !== null },
              ]}
              caption={INTRODUCTION_STATUS_LABELS[intro.status]}
            />
          </Card>

          {alreadyDeclared ? (
            <Alert variant="success" title={frNetwork.outcome.doneTitle}>
              {frNetwork.outcome.labels[intro.outcome ?? ''] ?? intro.outcome}
              {intro.outcomeNote !== null ? (
                <>
                  <br />
                  {intro.outcomeNote}
                </>
              ) : null}
              {intro.outcomeDeclaredByRole !== null && intro.outcomeDeclaredAt !== null ? (
                <>
                  <br />
                  {tn(frNetwork.outcome.doneBy, {
                    role: frNetwork.role[intro.outcomeDeclaredByRole] ?? '—',
                    date: formatDate(intro.outcomeDeclaredAt),
                  })}
                </>
              ) : null}
            </Alert>
          ) : !canDeclare ? (
            <Alert variant="info" title={frNetwork.outcome.notAllowedTitle}>
              {frNetwork.outcome.notAllowedBody}
            </Alert>
          ) : !exchangeConstated ? (
            /* Le garde-fou du §25, dit a l'utilisateur au lieu d'etre
               subi comme une erreur technique. */
            <Alert variant="warning" title={frNetwork.outcome.tooEarlyTitle}>
              {frNetwork.outcome.tooEarlyBody}
              <br />
              {INTRODUCTION_STATUS_LABELS[intro.status]}
            </Alert>
          ) : (
            <OutcomeForm introductionId={intro.introductionId} />
          )}

          {!exchangeConstated && canDeclare && !alreadyDeclared ? (
            <p>
              <Link href={introductionRoute(introductionId)} className={ACTION_LINK}>
                {frNetwork.outcome.backToFollow}
              </Link>
            </p>
          ) : null}
        </div>

        <aside className="flex flex-col gap-7 max-xl:order-first">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.outcome.honestyTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frNetwork.outcome.honestyBody}</p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.outcome.measuredTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frNetwork.outcome.measuredBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
