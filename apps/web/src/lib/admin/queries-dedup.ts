import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-005 (fusion de doublons). Fichier separe de `queries.ts`
 * (jamais relu en integralite avant cette livraison) pour ne pas y
 * ajouter du code sans avoir vu le fichier complet.
 */
export interface DuplicateProfileSummary {
  readonly profileId: string;
  readonly displayName: string;
  readonly profileStatus: string;
  readonly claimStatus: string;
  readonly currentPosition: string | null;
  readonly organization: string | null;
  readonly city: string | null;
}

export interface DuplicateCandidate {
  readonly profileIdA: string;
  readonly profileIdB: string;
  readonly score: number;
  readonly signals: Readonly<Record<string, boolean>>;
  readonly profileA: DuplicateProfileSummary;
  readonly profileB: DuplicateProfileSummary;
}

export interface DuplicateCandidatesPage {
  readonly rows: readonly DuplicateCandidate[];
  readonly nextCursor: string | null;
}

function toProfileSummary(raw: Record<string, unknown>): DuplicateProfileSummary {
  return {
    profileId: String(raw.profileId),
    displayName: String(raw.displayName),
    profileStatus: String(raw.profileStatus),
    claimStatus: String(raw.claimStatus),
    currentPosition: (raw.currentPosition as string | null) ?? null,
    organization: (raw.organization as string | null) ?? null,
    city: (raw.city as string | null) ?? null,
  };
}

export function loadAdminDuplicateCandidates(
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<DuplicateCandidatesPage>> {
  return adminRpc(
    'admin_list_profile_duplicate_candidates',
    { p_cursor: cursor, p_limit: 25 },
    correlationId,
    (payload) => {
      const data = payload as {
        rows: Array<Record<string, unknown>>;
        next_cursor: string | null;
      };
      return {
        rows: (data.rows ?? []).map((row) => ({
          profileIdA: String(row.profileIdA),
          profileIdB: String(row.profileIdB),
          score: Number(row.score),
          signals: (row.signals as Record<string, boolean>) ?? {},
          profileA: toProfileSummary(row.profileA as Record<string, unknown>),
          profileB: toProfileSummary(row.profileB as Record<string, unknown>),
        })),
        nextCursor: data.next_cursor ?? null,
      };
    },
  );
}
