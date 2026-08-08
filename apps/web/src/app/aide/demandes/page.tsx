import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frSupport, tsup } from '@/i18n/support';
import { ROUTES } from '@/lib/routes';
import { SUPPORT_ROUTES, ticketRoute } from '@/lib/routes/support';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyTickets } from '@/lib/queries/support';
import { formatDate } from '@/lib/messaging-view';
import { AppShell } from '@/components/layout/AppShell';

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

/** ISE-100 — « Mes demandes ». Aucun delai cible n'y figure (D-85). */
export default async function MyTicketsPage({
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
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyTickets(cursor, correlationId),
  ]);

  return (
    <AppShell
      currentPath={SUPPORT_ROUTES.help}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSupport.ticket.listTitle}</h1>
          <p className="text-body text-text-secondary">{frSupport.ticket.listSubtitle}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href={SUPPORT_ROUTES.newTicket} className={LINK}>
            {frSupport.help.createTicket}
          </Link>
          <Link href={SUPPORT_ROUTES.help} className={LINK}>
            {frSupport.title}
          </Link>
        </div>

        {!page.ok ? (
          <ErrorState
            title={frSupport.errorTitle}
            description={page.error.userMessage}
            correlationId={correlationId}
          />
        ) : page.data.rows.length === 0 ? (
          <EmptyState
            title={frSupport.ticket.emptyTitle}
            description={frSupport.ticket.emptyBody}
            action={
              <Link href={SUPPORT_ROUTES.newTicket} className={LINK}>
                {frSupport.help.createTicket}
              </Link>
            }
          />
        ) : (
          <>
            <p aria-live="polite" className="text-body-sm text-text-secondary">
              {page.data.openTotal === 0
                ? 'Aucune demande en cours.'
                : tsup(
                    page.data.openTotal > 1
                      ? frSupport.ticket.openCountPlural
                      : frSupport.ticket.openCount,
                    { count: page.data.openTotal },
                  )}
            </p>

            <ul className="flex flex-col gap-4">
              {page.data.rows.map((row) => (
                <li key={row.ticketId}>
                  <Card padding="sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge tone={STATUS_TONE[row.status] ?? 'neutral'}>
                          {frSupport.status[row.status] ?? row.status}
                        </Badge>
                        <span className="text-caption text-text-muted">
                          {frSupport.ticket.reference} {row.referenceCode}
                        </span>
                        {row.categoryName !== null ? (
                          <Badge tone="neutral">{row.categoryName}</Badge>
                        ) : null}
                      </div>

                      <Link
                        href={ticketRoute(row.ticketId)}
                        className="text-body text-text-primary focus-visible:outline-active-blue font-semibold underline decoration-transparent hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {row.subject}
                      </Link>

                      <p className="text-caption text-text-muted">
                        {tsup(frSupport.ticket.createdOn, { date: formatDate(row.createdAt) })} ·{' '}
                        {tsup(
                          row.messageCount > 1
                            ? frSupport.ticket.messageCountPlural
                            : frSupport.ticket.messageCount,
                          { count: row.messageCount },
                        )}
                      </p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>

            {page.data.nextCursor !== null ? (
              <Link
                href={`${SUPPORT_ROUTES.tickets}?curseur=${encodeURIComponent(page.data.nextCursor)}`}
                className={LINK}
              >
                {frSupport.ticket.loadMore}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
