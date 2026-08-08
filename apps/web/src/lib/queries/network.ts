import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import {
  asArray,
  asObject,
  bool,
  num,
  str,
  strings,
  toIntroductionStatus,
  toPathLabel,
  toProfileCard,
  toRequestStatus,
  toRole,
  type ConnectionRequestDetail,
  type ConnectionRequestRow,
  type ConnectionRequestStatus,
  type ConnectionRow,
  type IntroductionDetail,
  type IntroductionPathsView,
  type IntroductionRow,
  type NetworkSummary,
  type Page,
} from '@/lib/network-view';

/**
 * Lectures de la tranche RELATIONS & INTRODUCTIONS (ISE-038 -> ISE-046).
 *
 * TOUT passe par les RPC de la migration 0039. Aucun `select` n'est fait
 * ici sur `ise_profiles` — depuis 0028 le privilege est retire au niveau
 * table — ni sur `connections` / `connection_requests` /
 * `introduction_requests`, pour une raison plus forte : ces tables ne
 * portent pas la visibilite par CHAMP. Composer un profil cote
 * application reviendrait a « renvoyer puis masquer », ce que le
 * MASTER PROMPT §47 interdit.
 *
 * Les curseurs keyset renvoyes par la base sont SCELLES avant de quitter
 * le serveur (`lib/opaque-cursor.ts`) : le navigateur ne manipule qu'un
 * jeton chiffre et authentifie.
 *
 * Les TYPES et les conversions pures vivent dans `lib/network-view.ts` :
 * ce module-ci depend de `next/headers` et ne doit jamais etre importe
 * par un composant client.
 */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/network-view';

/* ------------------------------------------------------------------ */
/* Appel RPC mutualise                                                */
/* ------------------------------------------------------------------ */

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    // Jamais le message brut de PostgreSQL vers l'interface (D-102).
    console.error('[ISE] lecture reseau en echec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

/* ------------------------------------------------------------------ */
/* ISE-040 — Mes relations                                            */
/* ------------------------------------------------------------------ */

export async function loadNetworkSummary(
  correlationId: string,
): Promise<QueryResult<NetworkSummary>> {
  return callRpc('my_network_summary', {}, correlationId, (payload) => {
    const raw = asObject(payload);
    return {
      connections: num(raw['connections']) ?? 0,
      promotions: num(raw['promotions']) ?? 0,
      countries: num(raw['countries']) ?? 0,
      availableToHelp: num(raw['available_to_help']) ?? 0,
      byAvailability: asArray(raw['by_availability']).flatMap((entry) => {
        const item = asObject(entry);
        const code = str(item['code']);
        const name = str(item['name']);
        const count = num(item['count']);
        return code !== null && name !== null && count !== null ? [{ code, name, count }] : [];
      }),
      pendingReceived: num(raw['pending_received']) ?? 0,
      pendingSent: num(raw['pending_sent']) ?? 0,
    };
  });
}

export async function loadConnections(
  query: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ConnectionRow>>> {
  return callRpc(
    'list_my_connections',
    { p_query: query, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return {
        rows: asArray(raw['rows']).flatMap((entry) => {
          const card = toProfileCard(entry);
          if (card === null) return [];
          const item = asObject(entry);
          return [
            {
              profile: card,
              connectedAt: str(item['connected_at']),
              context: str(item['context']),
            },
          ];
        }),
        nextCursor: sealed(raw['next_cursor']),
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* ISE-039 / ISE-041 / ISE-042 — Demandes de connexion                */
/* ------------------------------------------------------------------ */

export async function loadConnectionRequests(
  direction: 'received' | 'sent',
  status: ConnectionRequestStatus,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<ConnectionRequestRow>>> {
  return callRpc(
    'list_connection_requests',
    { p_direction: direction, p_status: status, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return {
        rows: asArray(raw['rows']).flatMap((entry) => {
          const item = asObject(entry);
          const requestId = str(item['request_id']);
          const card = toProfileCard(item['profile']);
          if (requestId === null || card === null) return [];
          return [
            {
              requestId,
              status: toRequestStatus(item['status']),
              context: str(item['context']),
              message: str(item['message']),
              createdAt: str(item['created_at']),
              expiresAt: str(item['expires_at']),
              respondedAt: str(item['responded_at']),
              profile: card,
            },
          ];
        }),
        nextCursor: sealed(raw['next_cursor']),
      };
    },
  );
}

export async function loadConnectionRequest(
  requestId: string,
  correlationId: string,
): Promise<QueryResult<ConnectionRequestDetail | null>> {
  return callRpc(
    'get_connection_request',
    { p_request_id: requestId },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      const id = str(raw['request_id']);
      const card = toProfileCard(raw['profile']);
      if (id === null || card === null) return null;

      const common = asObject(raw['common_ground']);
      return {
        requestId: id,
        status: toRequestStatus(raw['status']),
        context: str(raw['context']),
        message: str(raw['message']),
        createdAt: str(raw['created_at']),
        expiresAt: str(raw['expires_at']),
        respondedAt: str(raw['responded_at']),
        profile: card,
        myRole:
          str(raw['my_role']) === 'requester' ? ('requester' as const) : ('addressee' as const),
        commonGround: {
          sharesPromotion: bool(common['shares_promotion']),
          sharedOrganization: str(common['shared_organization']),
          mutualConnections: asArray(common['mutual_connections']).flatMap((entry) => {
            const item = asObject(entry);
            const profileId = str(item['profile_id']);
            const displayName = str(item['display_name']);
            return profileId !== null && displayName !== null ? [{ profileId, displayName }] : [];
          }),
        },
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* ISE-043 — Chemins d'introduction                                   */
/* ------------------------------------------------------------------ */

export async function loadIntroductionPaths(
  targetProfileId: string,
  correlationId: string,
): Promise<QueryResult<IntroductionPathsView | null>> {
  return callRpc(
    'suggest_introduction_paths',
    { p_target_profile_id: targetProfileId, p_limit: 10 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      const target = toProfileCard(raw['target']);
      if (target === null) return null;

      return {
        target,
        alreadyConnected: bool(raw['already_connected']),
        paths: asArray(raw['paths']).flatMap((entry) => {
          const item = asObject(entry);
          const intermediary = toProfileCard(item['intermediary']);
          if (intermediary === null) return [];
          return [
            {
              intermediary,
              label: toPathLabel(item['label']),
              reasons: strings(item['reasons']),
              connectedSince: str(item['connected_since']),
              targetLinkSince: str(item['target_link_since']),
              targetLinkContext: str(item['target_link_context']),
              pendingRequestId: str(item['pending_request_id']),
            },
          ];
        }),
      };
    },
  );
}

/* ------------------------------------------------------------------ */
/* ISE-044 / ISE-045 / ISE-046 — Introductions                        */
/* ------------------------------------------------------------------ */

export async function loadIntroductions(
  scope: 'all' | 'requester' | 'intermediary' | 'target',
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<IntroductionRow>>> {
  return callRpc(
    'list_my_introductions',
    { p_scope: scope, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      return {
        rows: asArray(raw['rows']).flatMap((entry) => {
          const item = asObject(entry);
          const id = str(item['introduction_id']);
          if (id === null) return [];
          return [
            {
              introductionId: id,
              status: toIntroductionStatus(item['status']),
              purpose: str(item['purpose']) ?? 'other',
              myRole: toRole(item['my_role']),
              createdAt: str(item['created_at']),
              requester: toProfileCard(item['requester']),
              intermediary: toProfileCard(item['intermediary']),
              target: toProfileCard(item['target']),
            },
          ];
        }),
        nextCursor: sealed(raw['next_cursor']),
      };
    },
  );
}

export async function loadIntroduction(
  introductionId: string,
  correlationId: string,
): Promise<QueryResult<IntroductionDetail | null>> {
  return callRpc(
    'get_introduction_request',
    { p_introduction_id: introductionId },
    correlationId,
    (payload) => {
      const raw = asObject(payload);
      const id = str(raw['introduction_id']);
      if (id === null) return null;

      return {
        introductionId: id,
        status: toIntroductionStatus(raw['status']),
        purpose: str(raw['purpose']) ?? 'other',
        myRole: toRole(raw['my_role']),
        createdAt: str(raw['created_at']),
        expiresAt: str(raw['expires_at']),
        intermediaryRespondedAt: str(raw['intermediary_responded_at']),
        introducedAt: str(raw['introduced_at']),
        targetRespondedAt: str(raw['target_responded_at']),
        completedAt: str(raw['completed_at']),
        outcome: str(raw['outcome']),
        outcomeNote: str(raw['outcome_note']),
        outcomeDeclaredAt: str(raw['outcome_declared_at']),
        outcomeDeclaredByRole: str(raw['outcome_declared_by_role']),
        messageToIntermediary: str(raw['message_to_intermediary']),
        messageToTarget: str(raw['message_to_target']),
        declineReason: str(raw['decline_reason']),
        requester: toProfileCard(raw['requester']),
        intermediary: toProfileCard(raw['intermediary']),
        target: toProfileCard(raw['target']),
        events: asArray(raw['events']).flatMap((entry) => {
          const item = asObject(entry);
          const eventType = str(item['event_type']);
          if (eventType === null) return [];
          return [
            {
              eventType,
              toStatus: str(item['to_status']),
              actorRole: str(item['actor_role']) ?? 'system',
              createdAt: str(item['created_at']),
            },
          ];
        }),
      };
    },
  );
}
