import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requete D-173 (tache #140) : suivi des clics sur les liens d'e-mail
 * Supabase (`/auth/callback`). Fichier separe de `queries-campaigns.ts` :
 * meme permission (`promotions.manage`) mais une donnee GLOBALE
 * plateforme, pas liee a une promotion ni a une campagne precise.
 */
export interface AdminAuthLinkEventSummaryRow {
  readonly linkType: string;
  readonly outcome: 'success' | 'error';
  readonly eventCount: number;
  readonly distinctUsers: number;
}

interface AuthLinkEventSummaryPayloadRow {
  linkType: string;
  outcome: 'success' | 'error';
  eventCount: number;
  distinctUsers: number;
}

export function loadAdminAuthLinkEvents(
  correlationId: string,
): Promise<AdminRpcResult<readonly AdminAuthLinkEventSummaryRow[]>> {
  return adminRpc('admin_list_auth_link_events', {}, correlationId, (payload) => {
    const rows = (payload as AuthLinkEventSummaryPayloadRow[] | null) ?? [];
    return rows.map((row) => ({
      linkType: row.linkType,
      outcome: row.outcome,
      eventCount: row.eventCount,
      distinctUsers: row.distinctUsers,
    }));
  });
}
