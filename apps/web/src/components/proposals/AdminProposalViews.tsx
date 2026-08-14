import Link from 'next/link';
import { Badge } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { formatDateTime } from '@/lib/admin/format';
import { proposalState, type ProposalDetail, type ProposalQueueRow } from '@/lib/content-proposals';
import { KeyValue, SectionCard } from '@/app/administration/_components/PageHeader';
import { RowCard, RowList } from '@/app/administration/_components/RowCard';

/**
 * Vues PARTAGÉES des deux files de propositions (0132).
 *
 * Les écrans restent séparés — `/administration/actualites/propositions`
 * et `/administration/evenements/propositions`, chacun derrière sa
 * permission —, mais la ligne de liste et la fiche de lecture sont
 * identiques. Les dupliquer aurait garanti que les deux copies divergent
 * à la première correction.
 *
 * Composants SERVEUR : aucun état, aucun gestionnaire d'événement. Seule
 * la décision est interactive, et elle vit dans
 * `ProposalDecisionForms.tsx`.
 */

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

export function ProposalQueueList({
  rows,
  detailHref,
  label,
}: {
  rows: readonly ProposalQueueRow[];
  detailHref: (id: string) => string;
  label: string;
}) {
  const labels = frContentProposals.admin;

  return (
    <RowList label={label}>
      {rows.map((row) => (
        <RowCard
          key={row.id}
          title={row.title}
          meta={[
            `${labels.author} : ${row.authorName.length > 0 ? row.authorName : '—'}`,
            row.submittedAt === null
              ? null
              : `${labels.submittedAt} : ${formatDateTime(row.submittedAt)}`,
            row.hasCover
              ? frContentProposals.common.coverJoined
              : frContentProposals.common.coverNone,
          ]
            .filter((value) => value !== null)
            .join(' · ')}
          badges={
            <Badge tone={proposalState(row.kind, row.status) === 'rejected' ? 'error' : 'warning'}>
              {proposalState(row.kind, row.status) === 'rejected'
                ? frContentProposals.common.statusRejected
                : frContentProposals.common.statusPending}
            </Badge>
          }
          actions={
            <Link href={detailHref(row.id)} className={DETAIL_LINK}>
              {labels.open}
            </Link>
          }
        />
      ))}
    </RowList>
  );
}

/** Fiche de lecture : ce que l'auteur a réellement écrit, sans reformatage. */
export function ProposalSummary({ proposal }: { proposal: ProposalDetail }) {
  const labels = frContentProposals.admin;
  const isNews = proposal.kind === 'news';

  return (
    <SectionCard title={labels.sectionContent}>
      <dl className="grid gap-5 sm:grid-cols-2">
        <KeyValue label={labels.fieldTitle}>{proposal.title}</KeyValue>
        <KeyValue label={labels.author}>
          {proposal.authorName.length > 0 ? proposal.authorName : '—'}
        </KeyValue>
        <KeyValue label={labels.fieldCategory}>{proposal.categoryCode ?? '—'}</KeyValue>
        <KeyValue label={labels.submittedAt}>
          {proposal.submittedAt === null ? '—' : formatDateTime(proposal.submittedAt)}
        </KeyValue>

        {isNews ? (
          <>
            <KeyValue label={labels.fieldEventDate}>{proposal.eventDate ?? '—'}</KeyValue>
            <KeyValue label={labels.fieldSource}>
              {proposal.sourceUrl === null ? (
                '—'
              ) : (
                <a
                  href={proposal.sourceUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  {proposal.sourceUrl}
                </a>
              )}
            </KeyValue>
          </>
        ) : (
          <>
            <KeyValue label={labels.fieldFormat}>{proposal.format ?? '—'}</KeyValue>
            <KeyValue label={labels.fieldStartsAt}>
              {proposal.startsAt === null ? '—' : formatDateTime(proposal.startsAt)}
            </KeyValue>
            <KeyValue label={labels.fieldEndsAt}>
              {proposal.endsAt === null ? '—' : formatDateTime(proposal.endsAt)}
            </KeyValue>
            <KeyValue label={labels.fieldTimezone}>{proposal.timezone ?? '—'}</KeyValue>
            <KeyValue label={labels.fieldPlace}>
              {[proposal.venueName, proposal.city, proposal.countryCode]
                .filter((value) => value !== null && value.length > 0)
                .join(' · ') || '—'}
            </KeyValue>
          </>
        )}
      </dl>

      {proposal.summary !== null ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-muted font-medium">{labels.fieldSummary}</p>
          <p className="text-body-sm text-text-primary whitespace-pre-line">{proposal.summary}</p>
        </div>
      ) : null}

      {proposal.body !== null ? (
        <div className="flex flex-col gap-1">
          <p className="text-caption text-text-muted font-medium">{labels.fieldBody}</p>
          <p className="text-body-sm text-text-primary whitespace-pre-line">{proposal.body}</p>
        </div>
      ) : null}
    </SectionCard>
  );
}
