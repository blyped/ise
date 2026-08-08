import Link from 'next/link';
import { frMessaging, tm } from '@/i18n/messaging';
import { MESSAGING_ROUTES } from '@/lib/routes/messaging';
import { NOTIFICATION_ROUTES } from '@/lib/routes/notifications';
import type { InboxScope } from '@/lib/queries/messaging';

/** Lecture defensive du filtre porte par l'URL. */
export function readScope(value: string | string[] | undefined): InboxScope {
  return value === 'unread' || value === 'archived' ? value : 'all';
}

export function inboxHref(scope: InboxScope, query: string, sealedCursor: string | null): string {
  const params = new URLSearchParams();
  if (scope !== 'all') params.set('filtre', scope);
  if (query.length > 0) params.set('recherche', query);
  if (sealedCursor !== null) params.set('curseur', sealedCursor);
  const search = params.toString();
  return search.length > 0 ? `${MESSAGING_ROUTES.inbox}?${search}` : MESSAGING_ROUTES.inbox;
}

const CHIP =
  'inline-flex min-h-[44px] items-center rounded-full border px-5 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-097 — en-tete de la boite de reception : titre, recherche et
 * filtres. Les compteurs affiches a cote des filtres sont ceux de la
 * base : `unread_total` et `archived_total` viennent de
 * `list_my_conversations()`, aucun n'est estime.
 */
export function InboxHeader({
  scope,
  query,
  unreadTotal,
  archivedTotal,
}: {
  scope: InboxScope;
  query: string;
  unreadTotal: number;
  archivedTotal: number;
}) {
  const filters: { key: InboxScope; label: string; count: number | null }[] = [
    { key: 'all', label: frMessaging.inbox.filterAll, count: null },
    { key: 'unread', label: frMessaging.inbox.filterUnread, count: unreadTotal },
    { key: 'archived', label: frMessaging.inbox.filterArchived, count: archivedTotal },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frMessaging.inbox.title}</h1>
        <p className="text-body text-text-secondary max-md:hidden">{frMessaging.inbox.subtitle}</p>
        <p aria-live="polite" className="text-body-sm text-text-secondary">
          {unreadTotal === 0
            ? 'Aucun message non lu.'
            : tm(
                unreadTotal > 1
                  ? frMessaging.inbox.unreadBadgePlural
                  : frMessaging.inbox.unreadBadge,
                { count: unreadTotal },
              )}
        </p>
      </div>

      <form method="get" action={MESSAGING_ROUTES.inbox} className="flex flex-col gap-2">
        {scope !== 'all' ? <input type="hidden" name="filtre" value={scope} /> : null}
        <label
          htmlFor="recherche-conversations"
          className="text-body-sm text-text-primary font-medium"
        >
          {frMessaging.inbox.searchLabel}
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="recherche-conversations"
            name="recherche"
            type="search"
            defaultValue={query}
            placeholder={frMessaging.inbox.searchPlaceholder}
            className="rounded-base bg-surface text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-active-blue h-[44px] min-w-0 flex-1 border border-[#CBD5E1] px-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <button
            type="submit"
            className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frMessaging.inbox.searchSubmit}
          </button>
        </div>
      </form>

      {/* ISE-098 n'a pas encore d'entree dans la navigation principale :
          la barre superieure et la sidebar appartiennent au socle commun.
          Ce lien evite qu'un ecran livre reste injoignable. */}
      <p>
        <Link
          href={NOTIFICATION_ROUTES.center}
          className="text-body-sm text-primary focus-visible:outline-active-blue font-medium underline decoration-transparent hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Ouvrir le centre de notifications
        </Link>
      </p>

      <nav aria-label="Filtrer les conversations" className="flex flex-wrap gap-3">
        {filters.map((filter) => {
          const isActive = filter.key === scope;
          return (
            <Link
              key={filter.key}
              href={inboxHref(filter.key, query, null)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                CHIP,
                isActive
                  ? 'border-primary text-primary-hover bg-[#EFF6FF]'
                  : 'bg-surface text-text-secondary hover:border-primary hover:text-text-primary border-[#CBD5E1]',
              ].join(' ')}
            >
              {filter.label}
              {filter.count !== null && filter.count > 0 ? (
                <span className="bg-surface-muted text-caption ml-2 rounded-full px-2 py-[2px]">
                  {filter.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
