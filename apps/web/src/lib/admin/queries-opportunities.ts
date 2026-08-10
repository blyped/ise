import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import {
  toCandidateOptions,
  toReceivedApplication,
  type CandidateOption,
  type ReceivedApplication,
} from '@/lib/opportunities-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-021 (candidatures recues, supervision) et SA-022
 * (candidats proposables a la cloture) d'une opportunite.
 *
 * Ces RPC (`list_opportunity_applications`, `list_opportunity_candidates`)
 * ne sont PAS prefixees `admin_` : elles verifient deja en base
 * `private.is_opportunity_manager()` (auteur OU `opportunities.manage`),
 * exactement comme `moderate_opportunity` pour SA-020. Les mappers
 * (`toReceivedApplication`, `toCandidateOptions`) sont ceux du flux
 * auteur ISE-060/061 (`lib/opportunities-view.ts`, module pur sans
 * dependance serveur) : meme forme de reponse, pas de duplication.
 */

function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

export interface AdminApplicationPage {
  rows: ReceivedApplication[];
  nextCursor: string | null;
}

export function loadAdminOpportunityApplications(
  opportunityId: string,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminApplicationPage>> {
  return adminRpc(
    'list_opportunity_applications',
    {
      p_opportunity_id: opportunityId,
      p_status: status,
      p_cursor: rawCursor(cursor),
      p_limit: 25,
    },
    correlationId,
    (payload) => {
      const raw =
        payload !== null && typeof payload === 'object'
          ? (payload as { rows?: unknown[]; next_cursor?: unknown })
          : {};
      const rows = Array.isArray(raw.rows)
        ? raw.rows.flatMap((row) => {
            const mapped = toReceivedApplication(row);
            return mapped === null ? [] : [mapped];
          })
        : [];
      const nextRaw = raw.next_cursor;
      return {
        rows,
        nextCursor: typeof nextRaw === 'string' && nextRaw.length > 0 ? sealCursor(nextRaw) : null,
      };
    },
  );
}

export function loadAdminOpportunityCandidates(
  opportunityId: string,
  correlationId: string,
): Promise<AdminRpcResult<CandidateOption[]>> {
  return adminRpc(
    'list_opportunity_candidates',
    { p_opportunity_id: opportunityId },
    correlationId,
    (payload) => toCandidateOptions(payload),
  );
}
