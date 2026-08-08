import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frSupport, tsup } from '@/i18n/support';
import { ROUTES } from '@/lib/routes';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadTicket } from '@/lib/queries/support';
import { formatDateTime } from '@/lib/messaging-view';
import { AppShell } from '@/components/layout/AppShell';
import { TicketReplyForm } from '@/components/support/TicketReplyForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSupport.ticket.listTitle };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const STATUS_TONE: Record<string, 'info' | 'accent' | 'success' | 'neutral'> = {
  open: 'info',
  in_progress: 'info',
  waiting_user: 'accent',
  resolved: 'success',
  closed: 'neutral',
};

/**
 * ISE-100 — fil d'une demande.
 *
 * Les NOTES INTERNES du support ne figurent pas dans ce fil : elles sont
 * filtrees en base (`is_internal_note`, 0049 et 0053). Le membre voit
 * ses messages et les reponses qui lui sont adressees, rien de plus.
 *
 * D-85 : aucun delai cible, aucune date d'echeance, aucune promesse.
 */
export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ticketId } = await params;
  const query = await searchParams;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, ticket] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadTicket(ticketId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={SUPPORT_ROUTES.help}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!ticket.ok || ticket.data === null) {
    return shell(
      <div className="flex flex-col gap-7">
        <ErrorState
          title={frSupport.errorTitle}
          description={ticket.ok ? frSupport.ticket.notFound : ticket.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={SUPPORT_ROUTES.tickets} className={LINK}>
              {frSupport.ticket.listTitle}
            </Link>
          }
        />
      </div>,
    );
  }

  const detail = ticket.data;

  return shell(
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6">
      <Link href={SUPPORT_ROUTES.tickets} className={`${LINK} self-start`}>
        {frSupport.ticket.listTitle}
      </Link>

      {query['cree'] === '1' ? (
        <Alert
          variant="success"
          title={tsup(frSupport.ticket.created, { reference: detail.referenceCode })}
        />
      ) : null}

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={STATUS_TONE[detail.status] ?? 'neutral'}>
              {frSupport.status[detail.status] ?? detail.status}
            </Badge>
            {detail.categoryName !== null ? (
              <Badge tone="neutral">{detail.categoryName}</Badge>
            ) : null}
            <span className="text-caption text-text-muted">
              {frSupport.ticket.reference} {detail.referenceCode}
            </span>
          </div>
          <h1 className="text-h2 text-text-primary font-bold">{detail.subject}</h1>
          <p className="text-caption text-text-muted">
            {tsup(frSupport.ticket.createdOn, { date: formatDateTime(detail.createdAt) })}
          </p>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frSupport.ticket.threadLabel}</CardTitle>
        </CardHeader>
        <ol aria-live="polite" className="flex flex-col gap-4">
          {detail.messages.map((message) => (
            <li
              key={message.messageId}
              className={message.fromMe ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  message.fromMe
                    ? 'bg-primary text-body-sm max-w-[min(560px,90%)] rounded-lg px-5 py-4 text-white'
                    : 'border-border bg-surface text-body-sm text-text-primary max-w-[min(560px,90%)] rounded-lg border px-5 py-4'
                }
              >
                <p
                  className={
                    message.fromMe
                      ? 'text-caption mb-1 text-white/80'
                      : 'text-caption text-text-muted mb-1'
                  }
                >
                  {message.fromMe
                    ? frSupport.ticket.authorMember
                    : message.authorKind === 'agent'
                      ? frSupport.ticket.authorAgent
                      : frSupport.ticket.authorSystem}
                  {' · '}
                  {formatDateTime(message.createdAt)}
                </p>
                <p className="whitespace-pre-wrap break-words">{message.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <TicketReplyForm
          ticketId={detail.ticketId}
          canReply={detail.canReply}
          canClose={detail.canClose}
          canReopen={detail.canReopen}
        />
      </Card>

      <p className="text-caption text-text-muted">{frSupport.help.noSla}</p>
    </div>,
  );
}
