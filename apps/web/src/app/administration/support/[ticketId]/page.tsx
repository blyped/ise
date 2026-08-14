import Link from 'next/link';
import { Alert, Badge, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminSupport, tAdminSupport } from '@/i18n/admin-support';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadSupportTicket } from '@/lib/admin/queries-support';
import { formatDateTime } from '@/lib/admin/format';
import { formatBytes, type SupportAttachment } from '@/lib/support-attachments';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { ReplyForm } from './ReplyForm';
import { UrgencyForm } from './UrgencyForm';
import {
  assignTicketToMeAction,
  replyTicketAction,
  setTicketUrgencyAction,
  transitionTicketAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminSupport.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-039 — detail d'une remontee.
 *
 * Ce que cet ecran montre et que le demandeur ne voit JAMAIS :
 *   · les notes internes, marquees comme telles (filtrees en base pour
 *     le membre, 0049 / 0053) ;
 *   · le CONTEXTE TECHNIQUE collecte au depot (0131), deja reduit par la
 *     liste blanche `private.sanitize_support_context` — ni jeton, ni
 *     cookie, ni contenu prive ne peut s'y trouver ;
 *   · la priorite et son auteur.
 *
 * Aucun SLA affiche (D-85). La priorite s'ajuste ici et seulement ici :
 * le demandeur ne la choisit pas.
 */
export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const access = await requireAdminPermission('support.manage');
  const { ticketId } = await params;
  const correlationId = newCorrelationId();
  const detail = await loadSupportTicket(ticketId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.support}
      screenTitle={frAdminSupport.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminSupport.detail.title} subtitle={frAdminSupport.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.support} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const ticket = detail.data;
  const isClosed = ticket.status === 'closed';

  const authorLabel = (kind: string): string => {
    switch (kind) {
      case 'member':
        return frAdminSupport.detail.authorMember;
      case 'agent':
        return frAdminSupport.detail.authorAgent;
      default:
        return frAdminSupport.detail.authorSystem;
    }
  };

  const attachmentList = (attachments: readonly SupportAttachment[]) =>
    attachments.length === 0 ? null : (
      <ul
        aria-label={frAdminSupport.detail.attachmentsTitle}
        className="border-border mt-3 flex flex-col gap-1 border-t pt-3"
      >
        {attachments.map((attachment) => (
          <li key={attachment.attachmentId} className="text-caption text-text-secondary">
            {attachment.href !== null ? (
              <a
                href={attachment.href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                {attachment.fileName}
              </a>
            ) : (
              <span className="text-text-muted">{attachment.fileName}</span>
            )}{' '}
            <span className="text-text-muted">
              ({formatBytes(attachment.byteSize)} · {attachment.mimeType})
            </span>
          </li>
        ))}
      </ul>
    );

  const hasAttachments = ticket.messages.some((message) => message.attachments.length > 0);

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.support} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={`${ticket.referenceCode} — ${ticket.subject}`}
          subtitle={frAdminSupport.subtitle}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={ticket.status}
              label={frAdminSupport.status[ticket.status] ?? ticket.status}
            />
            <StatusBadge
              status={ticket.urgency}
              label={frAdminSupport.urgency[ticket.urgency] ?? ticket.urgency}
            />
            {ticket.reopenedCount > 0 ? (
              <Badge tone="warning">{frAdminSupport.detail.reopened(ticket.reopenedCount)}</Badge>
            ) : null}
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminSupport.detail.title}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdminSupport.detail.requester}>
            {ticket.requesterProfileId !== null && ticket.requesterName !== null ? (
              <Link href={adminMemberRoute(ticket.requesterProfileId)} className={BACK_LINK}>
                {ticket.requesterName}
              </Link>
            ) : (
              (ticket.requesterName ?? frAdmin.common.none)
            )}
          </KeyValue>
          <KeyValue label={frAdminSupport.detail.promotion}>
            {ticket.promotionName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdminSupport.detail.category}>
            {ticket.categoryName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdminSupport.columns.assignee}>
            {ticket.assigneeName ?? frAdminSupport.unassigned}
          </KeyValue>
          <KeyValue label={frAdminSupport.columns.urgency}>
            {`${frAdminSupport.urgency[ticket.urgency] ?? ticket.urgency} — ${
              frAdminSupport.urgencySource[ticket.urgencySource] ?? ticket.urgencySource
            }`}
            {ticket.urgencySetBy !== null
              ? ` · ${tAdminSupport(frAdminSupport.detail.urgencySetBy, { name: ticket.urgencySetBy })}`
              : ''}
          </KeyValue>
          <KeyValue label={frAdminSupport.columns.created}>
            {formatDateTime(ticket.createdAt)}
          </KeyValue>
          {ticket.correlationId !== null ? (
            <KeyValue label={frAdminSupport.detail.correlation}>{ticket.correlationId}</KeyValue>
          ) : null}
        </dl>
        <p className="text-body-sm text-text-secondary whitespace-pre-wrap">{ticket.description}</p>
      </SectionCard>

      <SectionCard title={frAdminSupport.detail.technicalTitle}>
        <p className="text-body-sm text-text-secondary">{frAdminSupport.detail.technicalIntro}</p>
        {ticket.technicalContext.length === 0 ? (
          <p className="text-body-sm text-text-muted mt-4">
            {frAdminSupport.detail.technicalEmpty}
          </p>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {ticket.technicalContext.map((entry) => (
              <KeyValue
                key={entry.key}
                label={frAdminSupport.detail.technicalKeys[entry.key] ?? entry.key}
              >
                <span className="break-words">{entry.value}</span>
              </KeyValue>
            ))}
          </dl>
        )}
      </SectionCard>

      <SectionCard title={frAdminSupport.detail.threadTitle}>
        {hasAttachments ? (
          <Alert variant="warning" title={frAdminSupport.detail.attachmentsNoScan} />
        ) : null}
        <ol className="mt-4 flex flex-col gap-3" aria-label={frAdminSupport.detail.threadTitle}>
          {ticket.messages.map((message) => (
            <li
              key={message.messageId}
              className={`rounded-lg border p-4 ${
                message.isInternalNote
                  ? 'border-[#FDE68A] bg-[#FFFBEB]'
                  : 'border-border bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-body-sm text-text-primary font-semibold">
                  {message.authorName ?? authorLabel(message.authorKind)}
                </p>
                <span className="text-caption text-text-muted">
                  {authorLabel(message.authorKind)} · {formatDateTime(message.createdAt)}
                </span>
                {message.isInternalNote ? (
                  <Badge tone="warning">{frAdminSupport.detail.internalNote}</Badge>
                ) : null}
              </div>
              <p className="text-body-sm text-text-secondary mt-2 whitespace-pre-wrap">
                {message.body}
              </p>
              {attachmentList(message.attachments)}
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title={frAdminSupport.detail.urgencyTitle}>
        <UrgencyForm
          action={setTicketUrgencyAction}
          ticketId={ticket.ticketId}
          currentUrgency={ticket.urgency}
        />
      </SectionCard>

      {isClosed ? (
        <Alert variant="info" title={frAdminSupport.detail.closedInfo} />
      ) : (
        <>
          <SectionCard title={frAdminSupport.detail.replyTitle}>
            <ReplyForm action={replyTicketAction} ticketId={ticket.ticketId} />
          </SectionCard>

          <SectionCard title={frAdminSupport.columns.status}>
            <div className="flex flex-wrap items-start gap-4">
              {ticket.assigneeProfileId === null ? (
                <ActionButton
                  action={assignTicketToMeAction}
                  fields={{ ticketId: ticket.ticketId }}
                  label={frAdminSupport.detail.assignToMe}
                />
              ) : null}

              {ticket.status === 'open' ? (
                <ActionButton
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'acknowledged' }}
                  label={frAdminSupport.detail.acknowledge}
                />
              ) : null}

              {ticket.status === 'open' ||
              ticket.status === 'acknowledged' ||
              ticket.status === 'waiting_user' ||
              ticket.status === 'resolved' ? (
                <ActionButton
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'in_progress' }}
                  label={frAdminSupport.detail.take}
                />
              ) : null}

              {ticket.status === 'acknowledged' || ticket.status === 'in_progress' ? (
                <ReasonAction
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'waiting_user' }}
                  triggerLabel={frAdminSupport.detail.waitUser}
                  title={frAdminSupport.detail.waitUser}
                  description={frAdminSupport.detail.waitUserBody}
                  confirmLabel={frAdminSupport.detail.waitUser}
                  withReason={false}
                  destructive={false}
                />
              ) : null}

              {ticket.status === 'acknowledged' ||
              ticket.status === 'in_progress' ||
              ticket.status === 'waiting_user' ? (
                <ReasonAction
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'resolved' }}
                  triggerLabel={frAdminSupport.detail.resolve}
                  title={frAdminSupport.detail.resolve}
                  description={frAdminSupport.detail.resolveBody}
                  confirmLabel={frAdminSupport.detail.resolve}
                  withReason={false}
                  destructive={false}
                />
              ) : null}
            </div>
          </SectionCard>
        </>
      )}
    </div>,
  );
}
