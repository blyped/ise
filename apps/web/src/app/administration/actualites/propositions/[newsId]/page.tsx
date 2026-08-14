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
import { approveNewsProposalAction, rejectNewsProposalAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContentProposals.admin.detailTitle };

/**
 * EXAMEN D'UNE PROPOSITION D'ACTUALITÉ (0132).
 *
 * L'APERÇU DU VISUEL PASSE PAR UNE URL SIGNÉE. Le bucket
 * `content-proposals` est PRIVÉ : il n'existe aucune URL publique, et
 * c'est précisément l'intérêt du dispositif — l'image d'une proposition
 * non validée ne doit être accessible ni au réseau, ni au web ouvert.
 * L'administration la voit par une signature de cinq minutes, fabriquée
 * au rendu. Pas de `next/image` : le domaine Supabase n'est pas déclaré
 * comme source distante, et une URL signée n'a rien à faire dans un cache.
 */
export default async function NewsProposalPage({
  params,
}: {
  params: Promise<{ newsId: string }>;
}) {
  const access = await requireAdminPermission('content.publish');
  const { newsId } = await params;
  const correlationId = newCorrelationId();
  const labels = frContentProposals.admin;

  const detail = await loadProposalDetail('news', newsId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.news} screenTitle={labels.detailTitle}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={labels.detailTitle}
      subtitle={labels.detailSubtitle}
      action={{ href: ADMIN_ROUTES.newsProposals, label: frContentProposals.common.back }}
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
            <Link href={ADMIN_ROUTES.newsProposals} className="text-primary hover:underline">
              {frContentProposals.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const coverUrl =
    proposal.coverPath === null ? null : await signedProposalCoverUrl(proposal.coverPath);
  const isPending = proposalState('news', proposal.status) === 'pending';

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
            approveAction={approveNewsProposalAction}
            rejectAction={rejectNewsProposalAction}
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
