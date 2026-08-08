import Link from 'next/link';
import { redirect } from 'next/navigation';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frOpportunities } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadOpportunities } from '@/lib/queries/opportunities';
import { AppShell } from '@/components/layout/AppShell';
import { OpportunitiesList } from '../OpportunitiesList';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.saved.title };

const LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-062 — Opportunités enregistrées. */
export default async function SavedOpportunitiesPage({
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
    loadOpportunities(
      {
        scope: 'saved',
        query: null,
        opportunityType: null,
        sectorId: null,
        countryCode: null,
        experienceLevel: null,
        remoteOnly: false,
        newGraduates: false,
        status: 'all',
      },
      cursor,
      correlationId,
    ),
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
    <div className="flex flex-col gap-2">
      <h1 className="text-h1 text-text-primary font-bold">{frOpportunities.saved.title}</h1>
      <p className="text-body text-text-secondary">{frOpportunities.saved.subtitle}</p>
    </div>
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frOpportunities.common.loadErrorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {page.data.rows.length === 0 ? (
        <EmptyState
          title={frOpportunities.list.emptySavedTitle}
          description={frOpportunities.list.emptySavedBody}
          action={
            <Link href={OPPORTUNITY_ROUTES.list} className={LINK}>
              {frOpportunities.common.breadcrumb}
            </Link>
          }
        />
      ) : (
        <OpportunitiesList
          initialRows={page.data.rows}
          initialNextCursor={page.data.nextCursor}
          scope="saved"
          filters={{ statut: 'all' }}
        />
      )}
    </div>,
  );
}
