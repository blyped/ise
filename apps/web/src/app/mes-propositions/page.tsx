import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, EmptyState, ErrorState, type BadgeTone } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, eventRoute, newsRoute } from '@/lib/routes/content';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyProposals } from '@/lib/queries/content-proposals';
import { formatDay } from '@/lib/communities-view';
import type { MyProposal, ProposalState } from '@/lib/content-proposals';
import { AppShell } from '@/components/layout/AppShell';
import { ACTION_LINK, PRIMARY_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.member.listTitle };

/**
 * MES PROPOSITIONS (0132) — « où en est ce que j'ai envoyé ? ».
 *
 * Route commune aux deux natures : c'est le même geste, et l'auteur ne
 * pense pas en tables. C'est aussi la cible du lien porté par la
 * notification de décision (`moderate_content_proposal`), ce qui donne à
 * cet écran une seconde raison d'exister à cette adresse-là.
 *
 * UN REFUS EST TOUJOURS RENDU AVEC SON MOTIF. Un refus muet ne permet
 * aucune correction ; c'est pour cela que `moderate_content_proposal`
 * exige un motif d'au moins dix caractères avant même d'écrire quoi que
 * ce soit.
 */

const TONES: Record<ProposalState, BadgeTone> = {
  pending: 'warning',
  published: 'success',
  rejected: 'error',
  other: 'neutral',
};

function stateLabel(state: ProposalState): string {
  const common = frContentProposals.common;
  if (state === 'pending') return common.statusPending;
  if (state === 'published') return common.statusPublished;
  if (state === 'rejected') return common.statusRejected;
  return common.statusOther;
}

/** Le lien vers la publication n'a de sens qu'une fois publiée. */
function publishedHref(row: MyProposal): string | null {
  if (row.state !== 'published') return null;
  return row.kind === 'news' ? newsRoute(row.id) : eventRoute(row.id);
}

export default async function MyProposalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const justSent = params['envoyee'];
  const correlationId = newCorrelationId();

  const [viewer, proposals] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyProposals(correlationId),
  ]);

  const labels = frContentProposals.member;

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CONTENT_ROUTES.myProposals}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <h1 className="text-h1 text-text-primary font-bold">{labels.listTitle}</h1>
      <p className="text-body text-text-secondary max-w-[68ch]">{labels.listSubtitle}</p>
      <div className="flex flex-wrap gap-3">
        <Link href={CONTENT_ROUTES.proposeNews} className={PRIMARY_LINK}>
          {labels.entryNewsTitle}
        </Link>
        <Link href={CONTENT_ROUTES.proposeEvent} className={ACTION_LINK}>
          {labels.entryEventTitle}
        </Link>
      </div>
    </div>
  );

  if (!proposals.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frContentProposals.common.loadErrorTitle}
          description={proposals.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = proposals.data;

  return shell(
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8">
      {header}

      {justSent === 'actualite' ? <Alert variant="success" title={labels.sentNews} /> : null}
      {justSent === 'evenement' ? <Alert variant="success" title={labels.sentEvent} /> : null}

      {rows.length === 0 ? (
        <EmptyState title={labels.listEmpty} description={labels.listEmptyBody} />
      ) : (
        <ul aria-label={labels.listTitle} className="flex flex-col gap-5">
          {rows.map((row) => {
            const href = publishedHref(row);
            return (
              <li key={`${row.kind}-${row.id}`}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-caption text-text-secondary font-semibold uppercase">
                        {row.kind === 'news'
                          ? frContentProposals.common.kindNews
                          : frContentProposals.common.kindEvent}
                      </p>
                      <h2 className="text-h3 text-text-primary mt-1 font-semibold">{row.title}</h2>
                    </div>
                    <Badge tone={TONES[row.state]}>{stateLabel(row.state)}</Badge>
                  </div>

                  {row.summary !== null ? (
                    <p className="text-body-sm text-text-secondary mt-3">{row.summary}</p>
                  ) : null}

                  <p className="text-caption text-text-muted mt-3">
                    {[
                      row.createdAt === null
                        ? null
                        : `${labels.listSubmittedOn} ${formatDay(row.createdAt) ?? ''}`,
                      row.reviewedAt === null
                        ? null
                        : `${labels.listReviewedOn} ${formatDay(row.reviewedAt) ?? ''}`,
                      row.hasCover
                        ? frContentProposals.common.coverJoined
                        : frContentProposals.common.coverNone,
                    ]
                      .filter((value) => value !== null)
                      .join(' · ')}
                  </p>

                  {row.state === 'pending' ? (
                    <p className="text-caption text-text-muted mt-3">{labels.pendingNote}</p>
                  ) : null}

                  {row.state === 'rejected' && row.rejectionReason !== null ? (
                    <Alert
                      variant="error"
                      title={labels.listRejectionReason}
                      className="mt-4"
                    >
                      {row.rejectionReason}
                    </Alert>
                  ) : null}

                  {href !== null ? (
                    <p className="border-border mt-5 border-t pt-4">
                      <Link href={href} className={ACTION_LINK}>
                        {labels.listSee}
                      </Link>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>,
  );
}
