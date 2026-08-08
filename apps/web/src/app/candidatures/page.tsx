import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, EmptyState, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyApplications } from '@/lib/queries/opportunities';
import { toMyApplicationGroup } from '@/lib/opportunities-view';
import { AppShell } from '@/components/layout/AppShell';
import { ApplicationsList } from './ApplicationsList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.applications.title };

const LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const TABS = [
  { id: 'in_progress', label: frOpportunities.applications.tabInProgress },
  { id: 'finished', label: frOpportunities.applications.tabFinished },
  { id: 'withdrawn', label: frOpportunities.applications.tabWithdrawn },
] as const;

/**
 * ISE-063 — Mes candidatures.
 *
 * ECART ASSUME : la maquette propose un troisième onglet « Enregistrées ».
 * Les offres enregistrées ne sont PAS des candidatures (D-55) : elles ont
 * leur propre écran, ISE-062. Les mêler ici aurait laissé croire qu'une
 * offre mise de côté engage une démarche.
 */
export default async function ApplicationsPage({
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
  const group = toMyApplicationGroup(params['onglet']);
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, page] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyApplications(group, cursor, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={OPPORTUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const header = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          {frOpportunities.applications.title}
        </h1>
        <p className="text-body text-text-secondary">{frOpportunities.applications.subtitle}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link href={OPPORTUNITY_ROUTES.saved} className={LINK}>
          {frOpportunities.list.savedLink}
        </Link>
        <Link href={OPPORTUNITY_ROUTES.list} className={LINK}>
          {frOpportunities.common.breadcrumb}
        </Link>
      </div>
    </div>
  );

  const tabs = (
    <nav
      aria-label={frOpportunities.applications.title}
      className="border-border overflow-x-auto border-b"
    >
      <ul className="flex min-w-max gap-2">
        {TABS.map((tab) => {
          const isCurrent = tab.id === group;
          return (
            <li key={tab.id}>
              <Link
                href={`${OPPORTUNITY_ROUTES.applications}?onglet=${tab.id}`}
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
          title={frOpportunities.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = page.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {tabs}

      <Alert variant="info" title={frOpportunities.applications.channelExternal}>
        {frOpportunities.applications.channelExternalHint}
      </Alert>

      {rows.length === 0 ? (
        <EmptyState
          title={
            group === 'in_progress'
              ? frOpportunities.applications.emptyInProgressTitle
              : frOpportunities.applications.emptyOtherTitle
          }
          description={
            group === 'in_progress'
              ? frOpportunities.applications.emptyInProgressBody
              : frOpportunities.applications.emptyOtherBody
          }
          action={
            <Link href={OPPORTUNITY_ROUTES.list} className={LINK}>
              {frOpportunities.common.breadcrumb}
            </Link>
          }
        />
      ) : (
        <ApplicationsList
          key={group}
          initialRows={rows}
          initialNextCursor={page.data.nextCursor}
          group={group}
        />
      )}
    </div>,
  );
}
