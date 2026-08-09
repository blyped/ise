import Link from 'next/link';
import { Alert, Badge, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminTicket } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { ReplyForm } from './ReplyForm';
import { assignTicketToMeAction, replyTicketAction, transitionTicketAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.support.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-039 — Detail agent d'un ticket : fil complet (notes internes
 * INCLUSES, marquees comme telles — le demandeur ne les voit jamais),
 * reponse, assignation, transitions par `transition_support_ticket`.
 * Aucun SLA affiche (D-85).
 */
export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const access = await requireAdminPermission('support.manage');
  const { ticketId } = await params;
  const correlationId = newCorrelationId();
  const detail = await loadAdminTicket(ticketId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.support}
      screenTitle={frAdmin.support.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.support.detail.title} subtitle={frAdmin.support.subtitle} />
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
        return frAdmin.support.detail.authorMember;
      case 'agent':
        return frAdmin.support.detail.authorAgent;
      default:
        return frAdmin.support.detail.authorSystem;
    }
  };

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.support} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={`${ticket.referenceCode} — ${ticket.subject}`}
          subtitle={frAdmin.support.subtitle}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={ticket.status}
              label={frAdmin.support.status[ticket.status] ?? ticket.status}
            />
            <StatusBadge
              status={ticket.urgency}
              label={frAdmin.support.urgency[ticket.urgency] ?? ticket.urgency}
            />
            {ticket.reopenedCount > 0 ? (
              <Badge tone="warning">{frAdmin.support.detail.reopened(ticket.reopenedCount)}</Badge>
            ) : null}
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdmin.support.detail.title}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdmin.support.detail.requester}>
            {ticket.requesterProfileId !== null && ticket.requesterName !== null ? (
              <Link href={adminMemberRoute(ticket.requesterProfileId)} className={BACK_LINK}>
                {ticket.requesterName}
              </Link>
            ) : (
              (ticket.requesterName ?? frAdmin.common.none)
            )}
          </KeyValue>
          <KeyValue label={frAdmin.support.detail.category}>
            {ticket.categoryName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.support.columns.assignee}>
            {ticket.assigneeName ?? frAdmin.support.unassigned}
          </KeyValue>
          <KeyValue label={frAdmin.support.columns.created}>
            {formatDateTime(ticket.createdAt)}
          </KeyValue>
          {ticket.correlationId !== null ? (
            <KeyValue label={frAdmin.support.detail.correlation}>{ticket.correlationId}</KeyValue>
          ) : null}
        </dl>
        <p className="text-body-sm text-text-secondary whitespace-pre-wrap">{ticket.description}</p>
      </SectionCard>

      <SectionCard title={frAdmin.support.detail.threadTitle}>
        <ol className="flex flex-col gap-3" aria-label={frAdmin.support.detail.threadTitle}>
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
                  <Badge tone="warning">{frAdmin.support.detail.internalNote}</Badge>
                ) : null}
              </div>
              <p className="text-body-sm text-text-secondary mt-2 whitespace-pre-wrap">
                {message.body}
              </p>
            </li>
          ))}
        </ol>
      </SectionCard>

      {isClosed ? (
        <Alert variant="info" title={frAdmin.support.detail.closedInfo} />
      ) : (
        <>
          <SectionCard title={frAdmin.support.detail.replyTitle}>
            <ReplyForm action={replyTicketAction} ticketId={ticket.ticketId} />
          </SectionCard>

          <SectionCard title={frAdmin.support.columns.status}>
            <div className="flex flex-wrap items-start gap-4">
              {ticket.assigneeProfileId === null ? (
                <ActionButton
                  action={assignTicketToMeAction}
                  fields={{ ticketId: ticket.ticketId }}
                  label={frAdmin.support.detail.assignToMe}
                />
              ) : null}

              {ticket.status === 'open' ||
              ticket.status === 'waiting_user' ||
              ticket.status === 'resolved' ? (
                <ActionButton
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'in_progress' }}
                  label={frAdmin.support.detail.take}
                />
              ) : null}

              {ticket.status === 'in_progress' ? (
                <ReasonAction
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'waiting_user' }}
                  triggerLabel={frAdmin.support.detail.waitUser}
                  title={frAdmin.support.detail.waitUser}
                  description={frAdmin.support.detail.waitUserBody}
                  confirmLabel={frAdmin.support.detail.waitUser}
                  withReason={false}
                  destructive={false}
                />
              ) : null}

              {ticket.status === 'in_progress' || ticket.status === 'waiting_user' ? (
                <ReasonAction
                  action={transitionTicketAction}
                  fields={{ ticketId: ticket.ticketId, toStatus: 'resolved' }}
                  triggerLabel={frAdmin.support.detail.resolve}
                  title={frAdmin.support.detail.resolve}
                  description={frAdmin.support.detail.resolveBody}
                  confirmLabel={frAdmin.support.detail.resolve}
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
