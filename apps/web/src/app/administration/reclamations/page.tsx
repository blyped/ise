import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminClaimRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminClaims } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.claims.title };

const CLAIM_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
  'expired',
] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-006 — File des reclamations de profil (`admin_list_profile_claims`,
 * permission `profiles.verify`). Sans filtre, la file montre ce qui
 * ATTEND une decision : submitted + under_review. C'est l'ecran par
 * lequel toute reclamation non automatique doit passer.
 */
export default async function AdminClaimsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('profiles.verify');
  const params = await searchParams;
  const status = paramOneOf(params, 'statut', CLAIM_STATUSES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminClaims(status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.claims}
      screenTitle={frAdmin.claims.title}
    >
      {children}
    </AdminShell>
  );

  const header = <PageHeader title={frAdmin.claims.title} subtitle={frAdmin.claims.subtitle} />;

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.claims}
        selects={[
          {
            name: 'statut',
            label: frAdmin.claims.filterLabel,
            value: status ?? '',
            options: CLAIM_STATUSES.map((value) => ({
              value,
              label: frAdmin.claims.status[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.claims.empty} description={frAdmin.claims.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.claims.title}>
            {rows.map((row) => (
              <RowCard
                key={row.claimId}
                title={row.profileName}
                meta={[
                  row.claimantEmail ?? frAdmin.common.none,
                  frAdmin.claims.method[row.claimMethod] ?? row.claimMethod,
                  formatDateTime(row.submittedAt),
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={row.status}
                    label={frAdmin.claims.status[row.status] ?? row.status}
                  />
                }
                actions={
                  <Link href={adminClaimRoute(row.claimId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(ADMIN_ROUTES.claims, { statut: status }, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
