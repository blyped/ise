import Link from 'next/link';
import { Alert, EmptyState, ErrorState } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadProposalDetail, signedProposalCoverUrl } from '@/lib/admin/queries-proposals';
import { proposalState } from '@/lib/content-proposals';
import { AdminShell } from '../../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../../_components/PageHeader';
import { ProposalSummary } from '@/components/proposals/AdminProposalViews';
import { ProposalDecisionForms } from '@/components/proposals/ProposalDecisionForms';
import { approveEventProposalAction, rejectEventProposalAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.admin.detailTitle };

/**
 * EXAMEN D'UNE PROPOSITION D'ÉVÉNEMENT (0132). Pendant strict de l'écran
 * des actualités, derrière `events.manage`.
 *
 * ACCEPTER PEUT ÉCHOUER, ET C'EST VOULU : `moderate_content_proposal`
 * refuse de publier un événement en ligne sans lien de connexion, ou un
 * présentiel sans ville ni lieu. Ces deux cohérences avaient été relâchées
 * pour l'état `pending_review` afin qu'un membre puisse proposer sans tout
 * connaître ; elles reviennent au moment où l'événement devient réel.
 */
export default async function EventProposalPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const access = await requireAdminPermission('events.manage');
  const { eventId } = await params;
  const correlationId = newCorrelationId();
  const labels = frContentProposals.admin;

  const detail = await loadProposalDetail('event', eventId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.events} screenTitle={labels.detailTitle}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={labels.detailTitle}
      subtitle={labels.detailSubtitle}
      action={{ href: ADMIN_ROUTES.eventProposals, label: frContentProposals.common.back }}
    />
  );

  if (!detail.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frContentProposals.common.loadErrorTitle}
          description={detail.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const proposal = detail.data;
  if (proposal === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <EmptyState
          title={labels.notFound}
          description={labels.emptyBody}
          action={
            <Link href={ADMIN_ROUTES.eventProposals} className="text-primary hover:underline">
              {frContentProposals.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const coverUrl =
    proposal.coverPath === null ? null : await signedProposalCoverUrl(proposal.coverPath);
  const isPending = proposalState('event', proposal.status) === 'pending';

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <ProposalSummary proposal={proposal} />

      <SectionCard title={labels.sectionCover}>
        {proposal.coverPath === null ? (
          <p className="text-body-sm text-text-secondary">{labels.coverNone}</p>
        ) : (
          <>
            <p className="text-body-sm text-text-secondary">{labels.coverIntro}</p>
            {coverUrl !== null ? (
              /* Bucket PRIVÉ : URL signée, jamais `next/image`. */
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={coverUrl}
                alt={proposal.coverAlt ?? labels.coverPreviewAlt}
                className="border-border max-h-[320px] w-full rounded-lg border object-contain"
              />
            ) : (
              <p className="text-body-sm text-text-muted">{labels.coverPromoteFailed}</p>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard title={labels.sectionDecision}>
        {isPending ? (
          <ProposalDecisionForms
            proposalId={proposal.id}
            hasCover={proposal.coverPath !== null}
            coverAlt={proposal.coverAlt ?? ''}
            approveAction={approveEventProposalAction}
            rejectAction={rejectEventProposalAction}
          />
        ) : (
          <Alert
            variant="error"
            title={`${frContentProposals.common.statusRejected} — ${labels.reasonLabel}`}
          >
            {proposal.rejectionReason ?? '—'}
          </Alert>
        )}
      </SectionCard>
    </div>,
  );
}
