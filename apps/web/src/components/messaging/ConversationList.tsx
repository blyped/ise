import Link from 'next/link';
import { Avatar, Badge, EmptyState } from '@ise/ui-web';
import { frMessaging, tm } from '@/i18n/messaging';
import { MESSAGING_ROUTES, conversationRoute } from '@/lib/routes/messaging';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { formatDate, type ConversationRow } from '@/lib/messaging-view';

/**
 * ISE-097 — liste des conversations.
 *
 * Le compteur de non-lus vient de `conversation_participants.unread_count`,
 * maintenu par trigger a chaque message persiste : c'est un compteur
 * REEL, pas une estimation, et il n'est jamais plafonne a « 99+ »
 * (MASTER PROMPT §98, Design System §69).
 *
 * L'extrait affiche est celui du dernier message VISIBLE PAR LE LECTEUR :
 * un message qu'il a masque n'y reapparait pas (D-72).
 */
export function ConversationList({
  rows,
  activeConversationId,
  scope,
  query,
  previousHref,
  nextHref,
}: {
  rows: readonly ConversationRow[];
  activeConversationId: string | null;
  scope: 'all' | 'unread' | 'archived';
  query: string;
  previousHref: string | null;
  nextHref: string | null;
}) {
  if (rows.length === 0) {
    const empty =
      scope === 'unread'
        ? {
            title: frMessaging.inbox.emptyUnreadTitle,
            body: frMessaging.inbox.emptyUnreadBody,
            href: MESSAGING_ROUTES.inbox,
            action: frMessaging.inbox.filterAll,
          }
        : scope === 'archived'
          ? {
              title: frMessaging.inbox.emptyArchivedTitle,
              body: frMessaging.inbox.emptyArchivedBody,
              href: MESSAGING_ROUTES.inbox,
              action: frMessaging.inbox.filterAll,
            }
          : {
              title: frMessaging.inbox.emptyTitle,
              body: frMessaging.inbox.emptyBody,
              href: SEARCH_ROUTES.find,
              action: frMessaging.inbox.emptyAction,
            };

    return (
      <EmptyState
        title={query.length > 0 ? 'Aucune conversation ne correspond' : empty.title}
        description={
          query.length > 0
            ? 'Essayez un autre nom, un autre contexte, ou effacez la recherche.'
            : empty.body
        }
        action={
          <Link
            href={query.length > 0 ? MESSAGING_ROUTES.inbox : empty.href}
            className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {query.length > 0 ? frMessaging.inbox.searchClear : empty.action}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {rows.map((row) => {
          const name = row.counterpart?.displayName ?? frMessaging.inbox.systemMessage;
          const isActive = row.conversationId === activeConversationId;
          const contextLabel =
            row.contextLabel ??
            (row.contextType !== null ? (frMessaging.context[row.contextType] ?? null) : null);

          return (
            <li key={row.conversationId}>
              <Link
                href={conversationRoute(row.conversationId)}
                aria-current={isActive ? 'true' : undefined}
                className={[
                  'rounded-base flex min-h-[44px] gap-4 border p-4 transition-colors duration-150',
                  'focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2',
                  isActive
                    ? 'border-primary bg-[#EFF6FF]'
                    : 'border-border bg-surface hover:border-primary hover:bg-surface-muted',
                ].join(' ')}
              >
                <Avatar name={name} size={40} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-body-sm text-text-primary truncate font-semibold">
                      {name}
                    </span>
                    <span className="text-caption text-text-muted shrink-0">
                      {formatDate(row.lastMessageAt)}
                    </span>
                  </span>

                  {contextLabel !== null ? (
                    <span className="text-caption text-primary truncate">{contextLabel}</span>
                  ) : null}

                  <span className="text-caption text-text-secondary truncate">
                    {row.preview.deleted
                      ? frMessaging.inbox.deletedMessage
                      : (row.preview.excerpt ?? frMessaging.inbox.noMessageYet)}
                  </span>

                  {row.unreadCount > 0 ? (
                    <span className="mt-1">
                      <Badge tone="info">
                        {tm(
                          row.unreadCount > 1
                            ? frMessaging.inbox.unreadBadgePlural
                            : frMessaging.inbox.unreadBadge,
                          { count: row.unreadCount },
                        )}
                      </Badge>
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {previousHref !== null || nextHref !== null ? (
        <nav aria-label="Pagination des conversations" className="flex gap-3">
          {previousHref !== null ? (
            <Link
              href={previousHref}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] flex-1 items-center justify-center border border-[#CBD5E1] px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Conversations plus récentes
            </Link>
          ) : null}
          {nextHref !== null ? (
            <Link
              href={nextHref}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] flex-1 items-center justify-center border border-[#CBD5E1] px-4 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frMessaging.common.loadMore}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
