import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Avatar, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { ROUTES } from '@/lib/routes';
import { MESSAGING_ROUTES } from '@/lib/routes/messaging';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadConversation, loadConversations, loadMessages } from '@/lib/queries/messaging';
import { loadReportReasons } from '@/lib/queries/support';
import { identityLine } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { ConversationList } from '@/components/messaging/ConversationList';
import { ConversationActions } from '@/components/messaging/ConversationActions';
import { MarkConversationRead } from '@/components/messaging/MarkConversationRead';
import { MessageThread } from '@/components/messaging/MessageThread';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMessaging.inbox.title };

const BACK_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-097 — fil d'une conversation.
 *
 * A 375 px : la liste des conversations disparait, un lien « Retour »
 * remonte a la boite de reception — c'est la pile maitre-detail de la
 * maquette mobile. A partir de 1024 px la liste reste visible a gauche.
 *
 * Le bandeau de CONTEXTE est rendu uniquement si la conversation en
 * porte un : `context_label` ou, a defaut, le module d'origine. Aucun
 * contexte n'est fabrique pour remplir la maquette.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, header, page, inbox, reasons] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadConversation(conversationId, correlationId),
    loadMessages(conversationId, null, correlationId),
    loadConversations('all', null, null, correlationId),
    loadReportReasons('message'),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={MESSAGING_ROUTES.inbox}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!header.ok || header.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <Link href={MESSAGING_ROUTES.inbox} className={BACK_LINK}>
          {frMessaging.common.back}
        </Link>
        <ErrorState
          title={frMessaging.thread.errorTitle}
          description={header.ok ? frMessaging.thread.notFound : header.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={MESSAGING_ROUTES.inbox} className={BACK_LINK}>
              {frMessaging.inbox.title}
            </Link>
          }
        />
      </div>,
    );
  }

  const conversation = header.data;
  const counterpartName = conversation.counterpart?.displayName ?? frMessaging.inbox.systemMessage;
  const messages = page.ok ? page.data.rows : [];
  const olderCursor = page.ok ? page.data.nextCursor : null;
  const contextLabel =
    conversation.contextLabel ??
    (conversation.contextType !== null
      ? (frMessaging.context[conversation.contextType] ?? null)
      : null);
  const reasonText =
    conversation.initiationReason !== null
      ? (frMessaging.reason[conversation.initiationReason] ?? null)
      : null;

  /* Dernier message RECU : c'est lui que la moderation pourra examiner
     si le membre le signale. Sans message recu, aucun signalement n'est
     propose — il n'y aurait rien a transmettre. */
  const lastReceived = [...messages].reverse().find((message) => !message.fromMe) ?? null;

  return shell(
    <>
      <MarkConversationRead
        conversationId={conversation.conversationId}
        unreadCount={conversation.unreadCount}
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-start">
        <section aria-label={frMessaging.inbox.title} className="min-w-0 max-lg:hidden">
          {inbox.ok ? (
            <ConversationList
              rows={inbox.data.rows}
              activeConversationId={conversation.conversationId}
              scope="all"
              query=""
              previousHref={null}
              nextHref={null}
            />
          ) : null}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <Link href={MESSAGING_ROUTES.inbox} className={`${BACK_LINK} self-start lg:hidden`}>
            {frMessaging.common.back}
          </Link>

          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <Avatar name={counterpartName} size={48} />
                <div className="flex min-w-0 flex-col gap-1">
                  <h1 className="text-h2 text-text-primary font-bold">{counterpartName}</h1>
                  {conversation.counterpart !== null ? (
                    <p className="text-body-sm text-text-secondary">
                      {identityLine(conversation.counterpart)}
                    </p>
                  ) : null}
                  {conversation.counterpartId !== null ? (
                    <Link
                      href={memberProfileRoute(conversation.counterpartId)}
                      className="text-body-sm text-primary focus-visible:outline-active-blue font-medium underline decoration-transparent hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {frMessaging.thread.seeProfile}
                    </Link>
                  ) : null}
                </div>
              </div>

              {contextLabel !== null || reasonText !== null ? (
                <div className="border-border flex flex-wrap items-center gap-3 border-t pt-4">
                  {contextLabel !== null ? (
                    <p className="text-body-sm text-text-secondary">
                      <span className="text-text-primary font-medium">
                        {frMessaging.thread.contextPrefix}
                      </span>{' '}
                      : {contextLabel}
                    </p>
                  ) : null}
                  {reasonText !== null ? <Badge tone="info">{reasonText}</Badge> : null}
                </div>
              ) : null}
            </div>
          </Card>

          {conversation.archived ? (
            <Alert variant="info" title={frMessaging.thread.archived}>
              {frMessaging.thread.archivedBody}
            </Alert>
          ) : null}

          {conversation.isBlocked ? (
            <Alert variant="warning" title={frMessaging.thread.blocked}>
              {frMessaging.thread.blockedBody}
            </Alert>
          ) : null}

          {!page.ok ? (
            <ErrorState
              title={frMessaging.thread.errorTitle}
              description={page.error.userMessage}
              correlationId={correlationId}
            />
          ) : (
            <Card>
              <MessageThread
                conversationId={conversation.conversationId}
                viewerProfileId={viewer.profileId ?? ''}
                initialMessages={messages}
                initialOlderCursor={olderCursor}
                canReply={conversation.canReply}
                showReadReceipts={conversation.showReadReceipts}
                counterpartName={counterpartName}
              />
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">Actions</CardTitle>
            </CardHeader>
            <ConversationActions
              conversationId={conversation.conversationId}
              counterpartId={conversation.counterpartId}
              counterpartName={counterpartName}
              archived={conversation.archived}
              reportableMessageId={lastReceived?.messageId ?? null}
              reasons={reasons.map((reason) => ({ code: reason.code, name: reason.name }))}
            />
          </Card>
        </div>
      </div>
    </>,
  );
}
