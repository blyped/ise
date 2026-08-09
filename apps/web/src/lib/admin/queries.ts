import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import { adminRpc, type AdminRpcResult } from './rpc';
import {
  toAdminCallDetail,
  toAdminCallRow,
  toAdminClaimDetail,
  toAdminClaimRow,
  toAdminDashboard,
  toAdminNoteList,
  toAdminOpportunityDetail,
  toAdminOpportunityRow,
  toAdminProfileDetail,
  toAdminProfileRoleList,
  toAdminProfileRow,
  toAdminPromotionDetail,
  toAdminPromotionRow,
  toAdminPromotionSuggestionRow,
  toAdminReportDetail,
  toAdminReportRow,
  toAdminRoleInfoList,
  toAdminTicketDetail,
  toAdminTicketRow,
  type AdminCallDetail,
  type AdminCallRow,
  type AdminClaimDetail,
  type AdminClaimRow,
  type AdminCursorPage,
  type AdminDashboard,
  type AdminNote,
  type AdminOpportunityDetail,
  type AdminOpportunityRow,
  type AdminProfileDetail,
  type AdminProfileRoleEntry,
  type AdminProfileRow,
  type AdminPromotionDetail,
  type AdminPromotionRow,
  type AdminPromotionSuggestionRow,
  type AdminReportDetail,
  type AdminReportRow,
  type AdminRoleInfo,
  type AdminTicketDetail,
  type AdminTicketRow,
} from './view';

/**
 * Lectures du back-office Superadmin (fonctions `admin_*`, 0076 + 0077).
 *
 * CURSEURS : le curseur brut renvoye par la base (`created_at|id`) est
 * SCELLE (`lib/opaque-cursor.ts`) avant d'atteindre le navigateur, et
 * descelle au retour. Un curseur invalide ou expire vaut simplement
 * « premiere page » : jamais d'erreur, jamais de page blanche (D-93).
 */

function asObjectSafe(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toPage<T>(value: unknown, mapRow: (row: unknown) => T | null): AdminCursorPage<T> {
  const raw = asObjectSafe(value);
  const rows = Array.isArray(raw['rows'])
    ? (raw['rows'] as unknown[]).flatMap((row) => {
        const mapped = mapRow(row);
        return mapped === null ? [] : [mapped];
      })
    : [];
  const nextRaw = raw['next_cursor'];
  return {
    rows,
    nextCursor: typeof nextRaw === 'string' && nextRaw.length > 0 ? sealCursor(nextRaw) : null,
  };
}

/** Descelle un curseur venu de l'URL. Invalide -> premiere page. */
function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

/* ------------------------------------------------------------------ */

export function loadAdminDashboard(correlationId: string): Promise<AdminRpcResult<AdminDashboard>> {
  return adminRpc('admin_dashboard_counters', {}, correlationId, toAdminDashboard);
}

export interface AdminProfileFilters {
  query: string | null;
  status: string | null;
  claim: string | null;
  verification: string | null;
  promotionId: number | null;
}

export function loadAdminProfiles(
  filters: AdminProfileFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminProfileRow>>> {
  return adminRpc(
    'admin_list_profiles',
    {
      p_query: filters.query,
      p_status: filters.status,
      p_claim: filters.claim,
      p_verification: filters.verification,
      p_promotion_id: filters.promotionId,
      p_cursor: rawCursor(cursor),
      p_limit: 25,
    },
    correlationId,
    (payload) => toPage(payload, toAdminProfileRow),
  );
}

export function loadAdminProfile(
  profileId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminProfileDetail | null>> {
  return adminRpc(
    'admin_get_profile',
    { p_profile_id: profileId },
    correlationId,
    toAdminProfileDetail,
  );
}

export function loadAdminRoles(correlationId: string): Promise<AdminRpcResult<AdminRoleInfo[]>> {
  return adminRpc('admin_list_roles', {}, correlationId, toAdminRoleInfoList);
}

export function loadAdminProfileRoles(
  profileId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminProfileRoleEntry[]>> {
  return adminRpc(
    'admin_get_profile_roles',
    { p_profile_id: profileId },
    correlationId,
    toAdminProfileRoleList,
  );
}

export function loadAdminProfileNotes(
  profileId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminNote[]>> {
  return adminRpc(
    'admin_list_profile_notes',
    { p_profile_id: profileId },
    correlationId,
    toAdminNoteList,
  );
}

/* ------------------------------------------------------------------ */

export function loadAdminClaims(
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminClaimRow>>> {
  return adminRpc(
    'admin_list_profile_claims',
    { p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminClaimRow),
  );
}

export function loadAdminClaim(
  claimId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminClaimDetail | null>> {
  return adminRpc(
    'admin_get_profile_claim',
    { p_claim_id: claimId },
    correlationId,
    toAdminClaimDetail,
  );
}

/* ------------------------------------------------------------------ */

export function loadAdminPromotions(
  query: string | null,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminPromotionRow>>> {
  return adminRpc(
    'admin_list_promotions',
    { p_query: query, p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminPromotionRow),
  );
}

export function loadAdminPromotion(
  promotionId: number,
  correlationId: string,
): Promise<AdminRpcResult<AdminPromotionDetail | null>> {
  return adminRpc(
    'admin_get_promotion',
    { p_promotion_id: promotionId },
    correlationId,
    toAdminPromotionDetail,
  );
}

export function loadAdminPromotionSuggestions(
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminPromotionSuggestionRow>>> {
  return adminRpc(
    'admin_list_promotion_suggestions',
    { p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminPromotionSuggestionRow),
  );
}

/* ------------------------------------------------------------------ */

export function loadAdminCalls(
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminCallRow>>> {
  return adminRpc(
    'admin_list_network_calls',
    { p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminCallRow),
  );
}

export function loadAdminCall(
  callId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminCallDetail | null>> {
  return adminRpc(
    'admin_get_network_call',
    { p_call_id: callId },
    correlationId,
    toAdminCallDetail,
  );
}

export function loadAdminOpportunities(
  moderation: string | null,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminOpportunityRow>>> {
  return adminRpc(
    'admin_list_opportunities',
    { p_moderation: moderation, p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminOpportunityRow),
  );
}

export function loadAdminOpportunity(
  opportunityId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminOpportunityDetail | null>> {
  return adminRpc(
    'admin_get_opportunity',
    { p_opportunity_id: opportunityId },
    correlationId,
    toAdminOpportunityDetail,
  );
}

/* ------------------------------------------------------------------ */

export function loadAdminReports(
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminReportRow>>> {
  return adminRpc(
    'admin_list_reports',
    { p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminReportRow),
  );
}

export function loadAdminReport(
  reportId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminReportDetail | null>> {
  return adminRpc(
    'admin_get_report',
    { p_report_id: reportId },
    correlationId,
    toAdminReportDetail,
  );
}

export function loadAdminTickets(
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCursorPage<AdminTicketRow>>> {
  return adminRpc(
    'admin_list_support_tickets',
    { p_status: status, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => toPage(payload, toAdminTicketRow),
  );
}

export function loadAdminTicket(
  ticketId: string,
  correlationId: string,
): Promise<AdminRpcResult<AdminTicketDetail | null>> {
  return adminRpc(
    'admin_get_support_ticket',
    { p_ticket_id: ticketId },
    correlationId,
    toAdminTicketDetail,
  );
}
