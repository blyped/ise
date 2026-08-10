import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-011->015 (invitations d'une promotion, campagnes
 * d'invitation en masse). Fichier separe de `queries.ts` (jamais relu
 * en integralite avant cette livraison), meme discipline que
 * `queries-dedup.ts` (SA-005).
 */
export interface AdminCampaignSummary {
  readonly campaignId: string;
  readonly name: string;
  readonly status: string;
  readonly channel: string;
  readonly dailyQuota: number;
  readonly totalQuota: number | null;
  readonly sentCount: number;
  readonly createdAt: string;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
}

export interface AdminCampaignStats {
  readonly sent: number;
  readonly opened: number;
  readonly claimed: number;
  readonly expired: number;
  readonly revoked: number;
}

export interface AdminCampaignDetail {
  readonly campaignId: string;
  readonly promotionId: number;
  readonly promotionName: string;
  readonly name: string;
  readonly objective: string | null;
  readonly channel: string;
  readonly status: string;
  readonly dailyQuota: number;
  readonly totalQuota: number | null;
  readonly sentCount: number;
  readonly startsAt: string | null;
  readonly endsAt: string | null;
  readonly createdAt: string;
  readonly stats: AdminCampaignStats;
  readonly eligibleTargets: number;
}

export interface AdminPromotionInvitationRow {
  readonly id: string;
  readonly status: string;
  readonly createdAt: string;
  readonly openedAt: string | null;
  readonly claimedAt: string | null;
  readonly expiresAt: string;
  readonly campaignId: string | null;
  readonly profileId: string;
  readonly displayName: string;
  readonly inviterName: string | null;
}

interface CampaignListRow {
  id: string;
  name: string;
  status: string;
  channel: string;
  daily_quota: number;
  total_quota: number | null;
  sent_count: number;
  created_at: string;
  starts_at: string | null;
  ends_at: string | null;
}

interface InvitationListRow {
  id: string;
  status: string;
  created_at: string;
  opened_at: string | null;
  claimed_at: string | null;
  expires_at: string;
  campaign_id: string | null;
  profile_id: string;
  display_name: string;
  inviter_name: string | null;
}

function toCampaignSummary(row: CampaignListRow): AdminCampaignSummary {
  return {
    campaignId: row.id,
    name: row.name,
    status: row.status,
    channel: row.channel,
    dailyQuota: row.daily_quota,
    totalQuota: row.total_quota,
    sentCount: row.sent_count,
    createdAt: row.created_at,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

function toInvitationRow(row: InvitationListRow): AdminPromotionInvitationRow {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    openedAt: row.opened_at,
    claimedAt: row.claimed_at,
    expiresAt: row.expires_at,
    campaignId: row.campaign_id,
    profileId: row.profile_id,
    displayName: row.display_name,
    inviterName: row.inviter_name,
  };
}

export function loadAdminCampaigns(
  promotionId: number,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<{ rows: readonly AdminCampaignSummary[]; nextCursor: string | null }>> {
  return adminRpc(
    'admin_list_campaigns',
    { p_promotion_id: promotionId, p_cursor: cursor, p_limit: 25 },
    correlationId,
    (payload) => {
      const data = payload as { rows: CampaignListRow[]; next_cursor: string | null };
      return {
        rows: (data.rows ?? []).map(toCampaignSummary),
        nextCursor: data.next_cursor ?? null,
      };
    },
  );
}

export function loadAdminCampaign(
  campaignId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminCampaignDetail>> {
  return adminRpc(
    'admin_get_campaign',
    { p_campaign_id: campaignId },
    correlationId,
    (payload) => payload as AdminCampaignDetail,
  );
}

export function loadAdminPromotionInvitations(
  promotionId: number,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<{ rows: readonly AdminPromotionInvitationRow[]; nextCursor: string | null }>> {
  return adminRpc(
    'admin_list_promotion_invitations',
    { p_promotion_id: promotionId, p_status: status, p_cursor: cursor, p_limit: 25 },
    correlationId,
    (payload) => {
      const data = payload as { rows: InvitationListRow[]; next_cursor: string | null };
      return {
        rows: (data.rows ?? []).map(toInvitationRow),
        nextCursor: data.next_cursor ?? null,
      };
    },
  );
}
