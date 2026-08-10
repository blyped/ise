import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES, adminPromotionInvitationsRoute, adminPromotionRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminPromotionInvitations } from '@/lib/admin/queries-campaigns';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../../../_components/PageHeader';
import { RowCard, RowList } from '../../../_components/RowCard';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCampaigns.invitations.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const STATUSES = ['sent', 'opened', 'claimed', 'expired', 'revoked'] as const;

/**
 * SA-011 -- Suivi (oversight) de toutes les invitations d'une
 * promotion, individuelles (ISE-070) et de campagne confondues.
 * Distinct de SA-012->015 (creation/pilotage des campagnes elles-memes).
 */
export default async function AdminPromotionInvitationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ promotionId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  const query = await searchParams;
  const status = paramOneOf(query, 'statut', STATUSES);
  const cursor = paramValue(query, 'curseur');
  const correlationId = newCorrelationId();

  const page = Number.isNaN(promotionId)
    ? null
    : await loadAdminPromotionInvitations(promotionId, status, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdminCampaigns.invitations.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <Link href={adminPromotionRoute(promotionId)} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader title={frAdminCampaigns.invitations.title} subtitle={frAdminCampaigns.invitations.subtitle} />
    </div>
  );

  if (page === null || !page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(page !== null && !page.ok ? { description: page.error.userMessage } : {})}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <nav className="flex flex-wrap gap-3" aria-label={frAdminCampaigns.invitations.columns.status}>
        <Link
          href={adminPromotionInvitationsRoute(promotionId)}
          className={`text-caption font-medium ${status === null ? 'text-primary underline' : 'text-text-muted'}`}
        >
          {frAdmin.common.none}
        </Link>
        {STATUSES.map((value) => (
          <Link
            key={value}
            href={`${adminPromotionInvitationsRoute(promotionId)}?statut=${value}`}
            className={`text-caption font-medium ${status === value ? 'text-primary underline' : 'text-text-muted'}`}
          >
            {frAdminCampaigns.invitations.status[value] ?? value}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={frAdminCampaigns.invitations.empty}
          description={frAdminCampaigns.invitations.emptyBody}
        />
      ) : (
        <>
          <RowList label={frAdminCampaigns.invitations.title}>
            {rows.map((row) => (
              <RowCard
                key={row.id}
                title={row.displayName}
                meta={[
                  row.campaignId !== null
                    ? frAdminCampaigns.invitations.campaignOrigin
                    : frAdminCampaigns.invitations.individualOrigin,
                  row.inviterName ?? frAdmin.common.none,
                  formatDateTime(row.createdAt),
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={row.status}
                    label={frAdminCampaigns.invitations.status[row.status] ?? row.status}
                  />
                }
              />
            ))}
          </RowList>
          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(adminPromotionInvitationsRoute(promotionId), { statut: status }, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
