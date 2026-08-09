import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminProfiles } from '@/lib/admin/queries';
import { formatDate } from '@/lib/admin/format';
import {
  nextPageHref,
  paramInteger,
  paramOneOf,
  paramValue,
  type SearchParams,
} from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.members.title };

const PROFILE_STATUSES = ['referenced', 'active', 'suspended', 'archived'] as const;
const CLAIM_STATUSES = ['unclaimed', 'claim_pending', 'claimed'] as const;
const VERIFICATION_STATUSES = ['unverified', 'pending', 'verified', 'rejected'] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-002 — Membres & profils : liste paginee par curseur (D-44), filtres
 * statut / reclamation / verification / promotion, recherche tolerante
 * par nom (`admin_list_profiles`, permission `profiles.read`).
 * Aucun total global ni pagination numerotee (D-151).
 */
export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('profiles.read');
  const params = await searchParams;

  const filters = {
    query: paramValue(params, 'recherche'),
    status: paramOneOf(params, 'statut', PROFILE_STATUSES),
    claim: paramOneOf(params, 'reclamation', CLAIM_STATUSES),
    verification: paramOneOf(params, 'verification', VERIFICATION_STATUSES),
    promotionId: paramInteger(params, 'promotion'),
  };
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminProfiles(filters, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.members}
      screenTitle={frAdmin.members.title}
    >
      {children}
    </AdminShell>
  );

  const header = <PageHeader title={frAdmin.members.title} subtitle={frAdmin.members.subtitle} />;

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
  const filterValues: Record<string, string | null> = {
    recherche: filters.query,
    statut: filters.status,
    reclamation: filters.claim,
    verification: filters.verification,
    promotion: filters.promotionId !== null ? String(filters.promotionId) : null,
  };

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.members}
        search={{
          name: 'recherche',
          placeholder: frAdmin.members.searchPlaceholder,
          value: filters.query ?? '',
        }}
        selects={[
          {
            name: 'statut',
            label: frAdmin.members.filterStatus,
            value: filters.status ?? '',
            options: PROFILE_STATUSES.map((value) => ({
              value,
              label: frAdmin.profileStatus[value] ?? value,
            })),
          },
          {
            name: 'reclamation',
            label: frAdmin.members.filterClaim,
            value: filters.claim ?? '',
            options: CLAIM_STATUSES.map((value) => ({
              value,
              label: frAdmin.claimStatusOfProfile[value] ?? value,
            })),
          },
          {
            name: 'verification',
            label: frAdmin.members.filterVerification,
            value: filters.verification ?? '',
            options: VERIFICATION_STATUSES.map((value) => ({
              value,
              label: frAdmin.verificationStatus[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdmin.members.empty} description={frAdmin.members.emptyBody} />
      ) : (
        <>
          <RowList label={frAdmin.members.title}>
            {rows.map((row) => (
              <RowCard
                key={row.profileId}
                title={row.displayName}
                meta={[
                  row.promotionName ?? frAdmin.common.none,
                  row.organization ?? frAdmin.common.none,
                  `${frAdmin.members.columns.created} ${formatDate(row.createdAt)}`,
                ].join(' · ')}
                badges={
                  <>
                    <StatusBadge
                      status={row.profileStatus}
                      label={frAdmin.profileStatus[row.profileStatus] ?? row.profileStatus}
                    />
                    <StatusBadge
                      status={row.claimStatus}
                      label={frAdmin.claimStatusOfProfile[row.claimStatus] ?? row.claimStatus}
                    />
                    <StatusBadge
                      status={row.verificationStatus}
                      label={
                        frAdmin.verificationStatus[row.verificationStatus] ?? row.verificationStatus
                      }
                    />
                  </>
                }
                actions={
                  <Link href={adminMemberRoute(row.profileId)} className={DETAIL_LINK}>
                    {frAdmin.members.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(ADMIN_ROUTES.members, filterValues, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
