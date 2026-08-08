import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyNetworkCalls } from '@/lib/queries/calls';
import { toMyCallGroup } from '@/lib/calls-view';
import { AppShell } from '@/components/layout/AppShell';
import { MyCallsList } from './MyCallsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.mine.title };

const LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const TABS = [
  { id: 'active', label: frCalls.mine.tabActive },
  { id: 'resolved', label: frCalls.mine.tabResolved },
  { id: 'drafts', label: frCalls.mine.tabDrafts },
  { id: 'expired', label: frCalls.mine.tabExpired },
] as const;

/** Mes appels — onglets Actifs / Résolus / Brouillons / Expirés (D6 §56). */
export default async function MyCallsPage({
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
  const group = toMyCallGroup(params['onglet']);
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyNetworkCalls(group, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CALL_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frCalls.mine.title}</h1>
        <p className="text-body text-text-secondary">{frCalls.mine.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={CALL_ROUTES.list} className={LINK}>
          {frCalls.common.breadcrumb}
        </Link>
        <Link
          href={CALL_ROUTES.create}
          className="rounded-base bg-primary text-body-sm hover:bg-primary-hover focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-6 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          + {frCalls.list.create}
        </Link>
      </div>
    </div>
  );

  const tabs = (
    <nav aria-label={frCalls.mine.title} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.id === group;
          return (
            <li key={tab.id}>
              <Link
                href={`${CALL_ROUTES.mine}?onglet=${tab.id}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={`text-body-sm focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border-b-2 px-4 focus-visible:outline-2 focus-visible:outline-offset-2 ${
                  isCurrent
                    ? 'border-primary text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border-transparent'
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        {tabs}
        <ErrorState
          title={frCalls.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = page.data.rows;
  const emptyTitle =
    group === 'active'
      ? frCalls.mine.emptyActiveTitle
      : group === 'drafts'
        ? frCalls.mine.emptyDraftsTitle
        : frCalls.mine.emptyOtherTitle;
  const emptyBody =
    group === 'active'
      ? frCalls.mine.emptyActiveBody
      : group === 'drafts'
        ? frCalls.mine.emptyDraftsBody
        : frCalls.mine.emptyOtherBody;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      {rows.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyBody}
          action={
            <Link href={CALL_ROUTES.create} className={LINK}>
              {frCalls.list.create}
            </Link>
          }
        />
      ) : (
        <MyCallsList
          key={group}
          initialRows={rows}
          initialNextCursor={page.data.nextCursor}
          group={group}
        />
      )}
    </div>,
  );
}
