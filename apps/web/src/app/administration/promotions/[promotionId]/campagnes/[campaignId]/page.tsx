import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES, adminCampaignsRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCampaign } from '@/lib/admin/queries-campaigns';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../../../_components/PageHeader';
import { ActionButton } from '../../../../_components/ActionButton';
import { ReasonAction } from '../../../../_components/ReasonAction';
import {
  closeCampaignAction,
  launchCampaignBatchAction,
  pauseCampaignAction,
  resumeCampaignAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCampaigns.detail.overview };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const FINAL_STATUSES = new Set(['completed', 'cancelled']);

/**
 * SA-013/SA-014/SA-015 -- Fiche d'une campagne : apercu + lancement de
 * lots (SA-013), suivi des statistiques en cours (SA-014), bilan final
 * une fois cloturee ou annulee (SA-015). Un seul ecran dont le contenu
 * s'adapte au statut plutot que trois pages qui dupliqueraient
 * l'apercu -- coherent avec la fiche promotion (SA-009) deja adaptative.
 */
export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ promotionId: string; campaignId: string }>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const { promotionId: rawId, campaignId } = await params;
  const promotionId = Number.parseInt(rawId, 10);
  const correlationId = newCorrelationId();

  const detail = await loadAdminCampaign(campaignId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdminCampaigns.detail.overview}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <Link href={adminCampaignsRoute(promotionId)} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={detail.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const campaign = detail.data;
  const isFinal = FINAL_STATUSES.has(campaign.status);
  const canLaunchNow = !isFinal && campaign.status !== 'paused' && campaign.channel === 'email';
  const conversionRate =
    campaign.stats.sent > 0 ? Math.round((campaign.stats.claimed / campaign.stats.sent) * 100) : null;

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={adminCampaignsRoute(promotionId)} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={campaign.name} subtitle={campaign.promotionName}>
          <StatusBadge
            status={campaign.status}
            label={frAdminCampaigns.list.status[campaign.status] ?? campaign.status}
          />
        </PageHeader>
      </div>

      <SectionCard title={frAdminCampaigns.detail.overview}>
        <dl className="grid grid-cols-2 gap-5 md:grid-cols-4">
          <KeyValue label={frAdminCampaigns.detail.channel}>
            {frAdminCampaigns.list.channel[campaign.channel] ?? campaign.channel}
          </KeyValue>
          <KeyValue label={frAdminCampaigns.detail.dailyQuota}>{campaign.dailyQuota}</KeyValue>
          <KeyValue label={frAdminCampaigns.detail.totalQuota}>
            {campaign.totalQuota ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdminCampaigns.detail.sentSoFar}>{campaign.sentCount}</KeyValue>
          <KeyValue label={frAdminCampaigns.detail.eligibleTargets}>{campaign.eligibleTargets}</KeyValue>
        </dl>

        {campaign.objective !== null && campaign.objective.length > 0 ? (
          <p className="text-body-sm text-text-secondary">{campaign.objective}</p>
        ) : null}

        {!isFinal ? (
          campaign.channel === 'email' ? (
            canLaunchNow ? (
              <ReasonAction
                action={launchCampaignBatchAction}
                fields={{
                  campaignId: campaign.campaignId,
                  promotionId: String(campaign.promotionId),
                  promotionLabel: campaign.promotionName,
                }}
                triggerLabel={frAdminCampaigns.detail.launch}
                title={frAdminCampaigns.detail.launch}
                description={frAdminCampaigns.detail.launchHelp}
                confirmLabel={frAdminCampaigns.detail.launch}
                withReason={false}
                destructive={false}
              />
            ) : (
              <p className="text-body-sm text-text-secondary">{frAdminCampaigns.detail.pauseBody}</p>
            )
          ) : (
            <p className="text-body-sm text-text-secondary">{frAdminCampaigns.detail.channelNotEmail}</p>
          )
        ) : null}
      </SectionCard>

      {!isFinal ? (
        <SectionCard title={frAdminCampaigns.detail.statsTitle}>
          <dl className="grid grid-cols-2 gap-5 md:grid-cols-5">
            <KeyValue label={frAdminCampaigns.detail.stats.sent}>{campaign.stats.sent}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.opened}>{campaign.stats.opened}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.claimed}>{campaign.stats.claimed}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.expired}>{campaign.stats.expired}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.revoked}>{campaign.stats.revoked}</KeyValue>
          </dl>

          <div className="flex flex-wrap gap-3">
            {campaign.status === 'running' ? (
              <ReasonAction
                action={pauseCampaignAction}
                fields={{ campaignId: campaign.campaignId, promotionId: String(campaign.promotionId) }}
                triggerLabel={frAdminCampaigns.detail.pause}
                title={frAdminCampaigns.detail.pauseTitle}
                description={frAdminCampaigns.detail.pauseBody}
                confirmLabel={frAdminCampaigns.detail.pause}
              />
            ) : null}
            {campaign.status === 'paused' ? (
              <ActionButton
                action={resumeCampaignAction}
                fields={{ campaignId: campaign.campaignId, promotionId: String(campaign.promotionId) }}
                label={frAdminCampaigns.detail.resume}
              />
            ) : null}
            {campaign.status === 'running' || campaign.status === 'paused' ? (
              <ReasonAction
                action={closeCampaignAction}
                fields={{ campaignId: campaign.campaignId, promotionId: String(campaign.promotionId) }}
                triggerLabel={frAdminCampaigns.detail.close}
                title={frAdminCampaigns.detail.closeTitle}
                description={frAdminCampaigns.detail.closeBody}
                confirmLabel={frAdminCampaigns.detail.close}
                destructive
              />
            ) : null}
          </div>
        </SectionCard>
      ) : (
        <SectionCard title={frAdminCampaigns.detail.bilanTitle}>
          <dl className="grid grid-cols-2 gap-5 md:grid-cols-5">
            <KeyValue label={frAdminCampaigns.detail.stats.sent}>{campaign.stats.sent}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.opened}>{campaign.stats.opened}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.claimed}>{campaign.stats.claimed}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.expired}>{campaign.stats.expired}</KeyValue>
            <KeyValue label={frAdminCampaigns.detail.stats.revoked}>{campaign.stats.revoked}</KeyValue>
          </dl>
          {conversionRate !== null ? (
            <p className="text-body-sm text-text-secondary">
              {frAdminCampaigns.detail.conversionRate} : {conversionRate}%
            </p>
          ) : null}
        </SectionCard>
      )}

      <p className="text-caption text-text-muted">
        {formatDate(campaign.createdAt)}
        {campaign.startsAt !== null ? ` · ${formatDateTime(campaign.startsAt)}` : ''}
        {campaign.endsAt !== null ? ` → ${formatDateTime(campaign.endsAt)}` : ''}
      </p>
    </div>,
  );
}
