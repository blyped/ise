import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES, adminCampaignNewRoute, adminCampaignRoute, adminCampaignsRoute, adminPromotionRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCampaigns } from '@/lib/admin/queries-campaigns';
import { formatDate } from '@/lib/admin/format';
import { AdminShell } from '../../../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../../../_components/PageHeader';
import { RowCard, RowList } from '../../../_components/RowCard';
import { nextPageHref, paramValue, type SearchParams } from '@/lib/admin/params';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCampaigns.list.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-012 -- Liste des campagnes d'invitation d'une promotion.
 * Distinct du suivi individuel (SA-011, `.../invitations`).
 */
export default async function AdminCampaignsPage({
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
  const cursor = paramValue(query, 'curseur');
  const correlationId = newCorrelationId();
  const page = Number.isNaN(promotionId)
    ? null
    : await loadAdminCampaigns(promotionId, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.promotions} screenTitle={frAdminCampaigns.list.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <div className="flex flex-col gap-3">
      <Link href={adminPromotionRoute(promotionId)} className={BACK_LINK}>
        ← {frAdmin.common.back}
      </Link>
      <PageHeader title={frAdminCampaigns.list.title} subtitle={frAdminCampaigns.list.subtitle}>
        <Link href={adminCampaignNewRoute(promotionId)} className={BACK_LINK}>
          + {frAdminCampaigns.list.newCampaign}
        </Link>
      </PageHeader>
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
      {rows.length === 0 ? (
        <EmptyState title={frAdminCampaigns.list.empty} description={frAdminCampaigns.list.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminCampaigns.list.title}>
            {rows.map((campaign) => (
              <RowCard
                key={campaign.campaignId}
                title={campaign.name}
                meta={[
                  frAdminCampaigns.list.channel[campaign.channel] ?? campaign.channel,
                  `${campaign.sentCount}/${campaign.totalQuota ?? '∞'}`,
                  formatDate(campaign.createdAt),
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={campaign.status}
                    label={frAdminCampaigns.list.status[campaign.status] ?? campaign.status}
                  />
                }
                actions={
                  <Link href={adminCampaignRoute(promotionId, campaign.campaignId)} className={BACK_LINK}>
                    Ouvrir
                  </Link>
                }
              />
            ))}
          </RowList>
          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(adminCampaignsRoute(promotionId), {}, nextCursor)}
          />
        </>
      )}
    </div>,
  );
}
