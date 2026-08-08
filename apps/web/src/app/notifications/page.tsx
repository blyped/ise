import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frNotifications, tn } from '@/i18n/notifications';
import { ROUTES } from '@/lib/routes';
import { NOTIFICATION_ROUTES, notificationsRoute } from '@/lib/routes/notifications';
import { SETTINGS_ROUTES } from '@/lib/routes/settings';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNotificationSummary, loadNotifications } from '@/lib/queries/notifications';
import type { NotificationScope } from '@/lib/queries/notifications';
import { AppShell } from '@/components/layout/AppShell';
import { NotificationBulkActions } from '@/components/notifications/NotificationBulkActions';
import { NotificationCard } from '@/components/notifications/NotificationCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNotifications.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const TAB =
  'inline-flex min-h-[44px] items-center rounded-full border px-5 text-body-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function readScope(value: string | string[] | undefined): NotificationScope {
  return value === 'action_required' || value === 'unread' || value === 'archived' ? value : 'all';
}

/**
 * ISE-098 — centre de notifications.
 *
 * D-81 — les onglets « À traiter » et « Non lues » filtrent une
 * PRIORITE et un ETAT ; la categorie est un filtre SEPARE. La base
 * refuse d'ailleurs `action_required` comme categorie : les deux axes ne
 * peuvent pas se confondre, meme en forgeant l'URL.
 *
 * MASTER PROMPT §98 — tous les compteurs viennent de
 * `my_notification_summary()`, calcule sur `public.notifications`.
 * Aucun n'est simule, aucun n'est plafonne.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : le rail droit
 * (« Priorités aujourd’hui », « Boîte maîtrisée ») n'est pas rendu. Il
 * suppose un classement editorial des trois actions du jour, qu'aucune
 * donnee ne produit. Le decompte par categorie, lui, existe reellement
 * et est affiche.
 */
export default async function NotificationsPage({
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
  const scope = readScope(params['filtre']);
  const rawCategory = params['categorie'];
  const category = typeof rawCategory === 'string' && rawCategory.length > 0 ? rawCategory : null;
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, summary, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNotificationSummary(correlationId),
    loadNotifications(scope, category, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={NOTIFICATION_ROUTES.center}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-2">
      <h1 className="text-h1 text-text-primary font-bold">{frNotifications.title}</h1>
      <p className="text-body text-text-secondary max-md:hidden">{frNotifications.subtitle}</p>
    </div>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frNotifications.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
          action={
            <Link href={NOTIFICATION_ROUTES.center} className={LINK}>
              Réessayer
            </Link>
          }
        />
      </div>,
    );
  }

  const counts = summary.ok ? summary.data : null;
  const rows = page.data.rows;

  const tabs: { key: NotificationScope; label: string; count: number | null }[] = [
    {
      key: 'action_required',
      label: frNotifications.tabActionRequired,
      count: counts?.actionRequired ?? null,
    },
    { key: 'all', label: frNotifications.tabAll, count: counts?.total ?? null },
    { key: 'unread', label: frNotifications.tabUnread, count: counts?.unread ?? null },
    { key: 'archived', label: frNotifications.tabArchived, count: null },
  ];

  const empty =
    scope === 'action_required'
      ? {
          title: frNotifications.emptyActionRequiredTitle,
          body: frNotifications.emptyActionRequiredBody,
        }
      : scope === 'archived'
        ? { title: frNotifications.emptyArchivedTitle, body: frNotifications.emptyArchivedBody }
        : { title: frNotifications.emptyTitle, body: frNotifications.emptyBody };

  return shell(
    <div className="flex flex-col gap-7">
      {header}

      {counts !== null ? (
        <Card className="bg-deep-navy text-white">
          <div className="flex flex-col gap-2">
            <p className="text-h3 font-semibold">
              {counts.unread === 0
                ? frNotifications.noneUnread
                : tn(
                    counts.unread > 1
                      ? frNotifications.unreadSummaryPlural
                      : frNotifications.unreadSummary,
                    { count: counts.unread },
                  )}
            </p>
            {counts.actionRequired > 0 ? (
              <p className="text-body-sm text-white/85">
                {tn(
                  counts.actionRequired > 1
                    ? frNotifications.actionRequiredSummaryPlural
                    : frNotifications.actionRequiredSummary,
                  { count: counts.actionRequired },
                )}
              </p>
            ) : null}
          </div>
        </Card>
      ) : (
        <Alert variant="warning" title="Les compteurs n’ont pas pu être calculés.">
          Référence à communiquer à l’assistance : {correlationId}
        </Alert>
      )}

      <nav aria-label="Filtrer les notifications" className="flex flex-wrap gap-3">
        {tabs.map((tab) => {
          const isActive = tab.key === scope;
          return (
            <Link
              key={tab.key}
              href={notificationsRoute(tab.key, category)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                TAB,
                isActive
                  ? 'border-primary text-primary-hover bg-[#EFF6FF]'
                  : 'bg-surface text-text-secondary hover:border-primary hover:text-text-primary border-[#CBD5E1]',
              ].join(' ')}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 ? (
                <span className="bg-surface-muted text-caption text-text-secondary ml-2 rounded-full px-2 py-[2px]">
                  {tab.count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {counts !== null && counts.byCategory.length > 0 ? (
        <nav aria-label={frNotifications.categoryFilterLabel} className="flex flex-wrap gap-3">
          <Link
            href={notificationsRoute(scope, null)}
            aria-current={category === null ? 'page' : undefined}
            className={[
              TAB,
              category === null
                ? 'border-primary text-primary-hover bg-[#EFF6FF]'
                : 'bg-surface text-text-secondary hover:border-primary border-[#CBD5E1]',
            ].join(' ')}
          >
            {frNotifications.categoryAll}
          </Link>
          {counts.byCategory.map((entry) => (
            <Link
              key={entry.category}
              href={notificationsRoute(scope, entry.category)}
              aria-current={category === entry.category ? 'page' : undefined}
              className={[
                TAB,
                category === entry.category
                  ? 'border-primary text-primary-hover bg-[#EFF6FF]'
                  : 'bg-surface text-text-secondary hover:border-primary border-[#CBD5E1]',
              ].join(' ')}
            >
              {frNotifications.category[entry.category] ?? entry.category}
              <span className="bg-surface-muted text-caption ml-2 rounded-full px-2 py-[2px]">
                {entry.total}
              </span>
            </Link>
          ))}
        </nav>
      ) : null}

      {counts !== null ? (
        <NotificationBulkActions unread={counts.unread} readNotArchived={counts.readNotArchived} />
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section aria-label={frNotifications.title} className="flex min-w-0 flex-col gap-4">
          {rows.length === 0 ? (
            <EmptyState
              title={empty.title}
              description={empty.body}
              action={
                <Link href={notificationsRoute('all', null)} className={LINK}>
                  {frNotifications.tabAll}
                </Link>
              }
            />
          ) : (
            <>
              <ul className="flex flex-col gap-4">
                {rows.map((row) => (
                  <li key={row.notificationId}>
                    <NotificationCard row={row} />
                  </li>
                ))}
              </ul>

              {page.data.nextCursor !== null ? (
                <Link
                  href={`${notificationsRoute(scope, category)}${
                    notificationsRoute(scope, category).includes('?') ? '&' : '?'
                  }curseur=${encodeURIComponent(page.data.nextCursor)}`}
                  className={LINK}
                >
                  {frNotifications.loadMore}
                </Link>
              ) : null}
            </>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNotifications.channelsTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frNotifications.channelsBody}</p>
            <p className="mt-4">
              <Link
                href={SETTINGS_ROUTES.notifications}
                className="text-body-sm text-primary focus-visible:outline-active-blue font-medium underline decoration-transparent hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {frNotifications.preferencesLink}
              </Link>
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
