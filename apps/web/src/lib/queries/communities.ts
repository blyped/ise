import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sealCursor } from '@/lib/opaque-cursor';
import { asArray, asObject, str } from '@/lib/network-view';
import {
  toCommunityCard,
  toCommunityDetail,
  toCommunityMemberRow,
  toCommunityPostCard,
  toCommunityPostDetail,
  toCommunityPostTracking,
  type CommunityCard,
  type CommunityDetail,
  type CommunityMemberRow,
  type CommunityPostCard,
  type CommunityPostDetail,
  type CommunityPostTracking,
  type CommunityScope,
  type Page,
} from '@/lib/communities-view';

/**
 * Lectures et ecritures de la tranche COMMUNAUTES (ISE-084 -> ISE-087).
 *
 * TOUT passe par les RPC de la migration 0072 : aucune table n'est
 * interrogee directement, aucun `select('*')` n'existe ici.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export * from '@/lib/communities-view';

async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] communautés — RPC en échec', {
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

function toPage<T>(payload: unknown, map: (entry: unknown) => T | null): Page<T> {
  const raw = asObject(payload);
  return {
    rows: asArray(raw['rows']).flatMap((entry) => {
      const row = map(entry);
      return row === null ? [] : [row];
    }),
    nextCursor: sealed(raw['next_cursor']),
  };
}

export interface CommunityFilters {
  scope: CommunityScope;
  query: string | null;
  communityType: string | null;
  countryCode: string | null;
  sectorId: number | null;
}

/** ISE-084 — quatre onglets, chacun avec ses raisons explicites. */
export async function loadCommunities(
  filters: CommunityFilters,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CommunityCard>>> {
  return callRpc(
    'list_communities',
    {
      p_scope: filters.scope,
      p_query: filters.query,
      p_community_type: filters.communityType,
      p_country_code: filters.countryCode,
      p_sector_id: filters.sectorId,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toCommunityCard),
  );
}

/** ISE-085 — fiche complete. */
export async function loadCommunity(
  communityId: string,
  correlationId: string,
): Promise<QueryResult<CommunityDetail | null>> {
  return callRpc('get_community', { p_community: communityId }, correlationId, toCommunityDetail);
}

/** ISE-085 — fil de la communaute. */
export async function loadCommunityPosts(
  communityId: string,
  postType: string | null,
  query: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CommunityPostCard>>> {
  return callRpc(
    'list_community_posts',
    {
      p_community: communityId,
      p_post_type: postType,
      p_query: query,
      p_cursor: rawCursor,
      p_limit: 20,
    },
    correlationId,
    (payload) => toPage(payload, toCommunityPostCard),
  );
}

/** ISE-085 — onglet « Membres », reserve aux membres. */
export async function loadCommunityMembers(
  communityId: string,
  query: string | null,
  rawCursor: string | null,
  correlationId: string,
): Promise<QueryResult<Page<CommunityMemberRow>>> {
  return callRpc(
    'list_community_members',
    { p_community: communityId, p_query: query, p_cursor: rawCursor, p_limit: 20 },
    correlationId,
    (payload) => toPage(payload, toCommunityMemberRow),
  );
}

/** ISE-087 — publication et fil de reponses. */
export async function loadCommunityPost(
  postId: string,
  correlationId: string,
): Promise<QueryResult<CommunityPostDetail | null>> {
  return callRpc('get_community_post', { p_post: postId }, correlationId, toCommunityPostDetail);
}

/** ISE-087 — suivi, reserve a l'auteur et aux moderateurs. */
export async function loadCommunityPostTracking(
  postId: string,
  correlationId: string,
): Promise<QueryResult<CommunityPostTracking | null>> {
  return callRpc(
    'get_community_post_tracking',
    { p_post: postId },
    correlationId,
    toCommunityPostTracking,
  );
}

/* ------------------------------------------------------------------ */
/* Ecritures                                                           */
/* ------------------------------------------------------------------ */

/** Adhesion. La base decide de l'etat : `active`, `pending`, ou refus. */
export async function joinCommunity(
  communityId: string,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'join_community',
    { p_community: communityId },
    correlationId,
    (data) => str(asObject(data)['membership_status']) ?? 'active',
  );
}

export async function leaveCommunity(
  communityId: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc('leave_community', { p_community: communityId }, correlationId, () => null);
}

export async function setCommunityNotification(
  communityId: string,
  level: string,
  digest: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'set_community_notification',
    { p_community: communityId, p_level: level, p_digest: digest },
    correlationId,
    () => null,
  );
}

export interface CreatePostResult {
  postId: string;
  status: string;
  requiresReview: boolean;
}

/** ISE-086 — publier. La moderation prealable depend de la communaute. */
export async function createCommunityPost(
  input: {
    communityId: string;
    postType: string;
    title: string;
    body: string | null;
    visibility: string;
    skillIds: number[];
  },
  correlationId: string,
): Promise<QueryResult<CreatePostResult>> {
  return callRpc(
    'create_community_post',
    {
      p_community: input.communityId,
      p_post_type: input.postType,
      p_title: input.title,
      p_body: input.body,
      p_visibility: input.visibility,
      p_skill_ids: input.skillIds.length > 0 ? input.skillIds : null,
    },
    correlationId,
    (data) => {
      const raw = asObject(data);
      return {
        postId: str(raw['post_id']) ?? '',
        status: str(raw['status']) ?? 'published',
        requiresReview: raw['requires_review'] === true,
      };
    },
  );
}

export async function addCommunityComment(
  postId: string,
  body: string,
  parentId: string | null,
  correlationId: string,
): Promise<QueryResult<string>> {
  return callRpc(
    'add_community_comment',
    { p_post: postId, p_body: body, p_parent: parentId },
    correlationId,
    (data) => str(asObject(data)['comment_id']) ?? '',
  );
}

/** ISE-087 — « Réponse utile ». Marqueur binaire, jamais un vote. */
export async function markCommentHelpful(
  commentId: string,
  helpful: boolean,
  correlationId: string,
): Promise<QueryResult<boolean>> {
  return callRpc(
    'mark_comment_helpful',
    { p_comment: commentId, p_helpful: helpful },
    correlationId,
    (data) => asObject(data)['is_helpful'] === true,
  );
}

/** ISE-087 — publier la synthese et cloturer. */
export async function resolveCommunityPost(
  postId: string,
  summary: string,
  correlationId: string,
): Promise<QueryResult<null>> {
  return callRpc(
    'resolve_community_post',
    { p_post: postId, p_summary: summary },
    correlationId,
    () => null,
  );
}
