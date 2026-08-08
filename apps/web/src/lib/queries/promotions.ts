import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import {
  asArray,
  asObject,
  num,
  str,
  toInvitationRow,
  toPromotionMemberCard,
  toPromotionOverview,
  toReferencedMember,
  type InvitationRow,
  type Page,
  type PromotionMemberCard,
  type PromotionOverview,
  type ReferencedMember,
} from '@/lib/collaborate-view';

/**
 * Lectures et ecritures de la tranche PROMOTIONS (ISE-067 -> ISE-071).
 *
 * TOUT passe par les RPC de la migration 0070. Aucun `select` direct :
 * la fonction de base est le seul endroit ou l'on decide ce qui sort,
 * et notamment ce qui ne sort JAMAIS — l'indice de contact d'un tiers
 * et le jeton d'invitation (CA-PROMO-04, [U 110]).
 *
 * Ce module depend de `next/headers` : jamais importe par un composant
 * client.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] promotions — RPC en échec', {
      correlationId,
      rpc: name,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}

function sealed(raw: unknown): string | null {
  const cursor = str(raw);
  return cursor === null ? null : sealCursor(cursor);
}

/** ISE-067 — `promotionId` nul : la promotion du membre connecte. */
export async function loadPromotionOverview(
  promotionId: number | null,
  correlationId: string,
): Promise<QueryResult<PromotionOverview | null>> {
  return callRpc(
    'get_promotion_overview',
    { p_promotion_id: promotionId },
    correlationId,
    toPromotionOverview,
  );
}

export interface PromotionMemberFilters {
  query: string | null;
  countryCode: string | null;
  sectorId: number | null;
  skillId: number | null;
  status: 'all' | 'claimed' | 'to_find' | 'can_help';
}

export interface PromotionMemberPage extends Page<PromotionMemberCard> {
  facets: { all: number; claimed: number; toFind: number; canHelp: number };
}

/** ISE-068 — annuaire de la promotion, pagination par curseur (D-44). */
export async function loadPromotionMembers(
  promotionId: number,
  filters: PromotionMemberFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<PromotionMemberPage>> {
  return callRpc(
    'list_promotion_members',
    {
      p_promotion_id: promotionId,
      p_query: filters.query,
      p_country_code: filters.countryCode,
      p_sector_id: filters.sectorId,
      p_skill_id: filters.skillId,
      p_status: filters.status,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      const facets = asObject(value['facets']);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const card = toPromotionMemberCard(entry);
          return card === null ? [] : [card];
        }),
        nextCursor: sealed(value['next_cursor']),
        facets: {
          all: num(facets['all']) ?? 0,
          claimed: num(facets['claimed']) ?? 0,
          toFind: num(facets['to_find']) ?? 0,
          canHelp: num(facets['can_help']) ?? 0,
        },
      };
    },
  );
}

/** ISE-069 — fiche d'un profil reference. */
export async function loadReferencedMember(
  profileId: string,
  correlationId: string,
): Promise<QueryResult<ReferencedMember | null>> {
  return callRpc(
    'get_promotion_referenced_member',
    { p_profile_id: profileId },
    correlationId,
    toReferencedMember,
  );
}

export interface MissingMemberResult {
  suggestionId: string | null;
  contactHintStored: boolean;
  createsProfile: boolean;
  possibleDuplicates: { profileId: string; displayName: string; claimStatus: string }[];
}

/** ISE-069 — signaler un camarade absent. L'indice part en schema prive. */
export async function suggestMissingMember(
  promotionId: number,
  input: {
    firstName: string;
    lastName: string;
    countryCode: string | null;
    contactHint: string | null;
  },
  correlationId: string,
): Promise<QueryResult<MissingMemberResult>> {
  return callRpc(
    'suggest_missing_member',
    {
      p_promotion_id: promotionId,
      p_first_name: input.firstName,
      p_last_name: input.lastName,
      p_country_code: input.countryCode,
      p_contact_hint: input.contactHint,
    },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        suggestionId: str(value['suggestion_id']),
        contactHintStored: value['contact_hint_stored'] === true,
        createsProfile: value['creates_profile'] === true,
        possibleDuplicates: asArray(value['possible_duplicates']).flatMap((entry) => {
          const d = asObject(entry);
          const profileId = str(d['profile_id']);
          if (profileId === null) return [];
          return [
            {
              profileId,
              displayName: str(d['display_name']) ?? '',
              claimStatus: str(d['claim_status']) ?? 'unclaimed',
            },
          ];
        }),
      };
    },
  );
}

export interface CreatedInvitation {
  invitationId: string | null;
  channel: string;
  expiresAt: string | null;
  /** Unique et derniere apparition du jeton en clair ([U 110]). */
  token: string | null;
  createsAccount: boolean;
}

/** ISE-070 — creer une invitation a reclamer un profil. */
export async function createPromotionInvitation(
  profileId: string,
  channel: 'link' | 'email',
  email: string | null,
  correlationId: string,
): Promise<QueryResult<CreatedInvitation>> {
  return callRpc(
    'create_promotion_invitation',
    { p_profile_id: profileId, p_channel: channel, p_email: email },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      return {
        invitationId: str(value['invitation_id']),
        channel: str(value['channel']) ?? 'link',
        expiresAt: str(value['expires_at']),
        token: str(value['token']),
        createsAccount: value['creates_account'] === true,
      };
    },
  );
}

export async function revokePromotionInvitation(
  invitationId: string,
  correlationId: string,
): Promise<QueryResult<{ status: string }>> {
  return callRpc(
    'revoke_promotion_invitation',
    { p_invitation_id: invitationId },
    correlationId,
    (payload) => ({ status: str(asObject(payload)['status']) ?? 'revoked' }),
  );
}

export interface InvitationPage extends Page<InvitationRow> {
  summary: {
    toFind: number;
    sent: number;
    opened: number;
    claimed: number;
    estimated: number | null;
  };
}

/** ISE-071 — suivi des invitations. */
export async function loadPromotionInvitations(
  promotionId: number,
  scope: 'to_follow' | 'claimed' | 'to_find' | 'all',
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<InvitationPage>> {
  return callRpc(
    'list_promotion_invitations',
    { p_promotion_id: promotionId, p_scope: scope, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => {
      const value = asObject(payload);
      const summary = asObject(value['summary']);
      return {
        rows: asArray(value['rows']).flatMap((entry) => {
          const row = toInvitationRow(entry);
          return row === null ? [] : [row];
        }),
        nextCursor: sealed(value['next_cursor']),
        summary: {
          toFind: num(summary['to_find']) ?? 0,
          sent: num(summary['sent']) ?? 0,
          opened: num(summary['opened']) ?? 0,
          claimed: num(summary['claimed']) ?? 0,
          estimated: num(summary['estimated']),
        },
      };
    },
  );
}
