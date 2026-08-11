import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import {
  toCommunityCard,
  toCommunityDetail,
  toCommunityPostCard,
  type CommunityCard,
  type CommunityDetail,
  type CommunityPostCard,
} from '@/lib/communities-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes SA-027->029 (communautes, admin).
 *
 * `admin_list_communities` est neuve (0099) : seule fonction a lister
 * TOUTES les communautes, tous statuts (y compris 'draft', 'archived')
 * et visibilites (y compris 'private'), que `list_communities`
 * (l'ecran membre) exclut par construction via `private.can_see_community`
 * (une communaute privee n'est visible que de ses membres). `get_community`
 * est en revanche REUTILISEE telle quelle, sans wrapper `admin_` : sa
 * verification interne (`private.can_see_community` -> `is_community_member`)
 * accorde deja un bypass a `communities.manage` (0044) — meme principe que
 * SA-024 reutilisant `get_project`. Les mappers (`toCommunityCard`,
 * `toCommunityDetail`, `toCommunityPostCard`) viennent de
 * `lib/communities-view.ts` (module pur, sans dependance serveur) : meme
 * forme de reponse cote membre et cote admin, pas de duplication.
 *
 * `admin_list_community_posts` est neuve (0099) : seule fonction a
 * lister TOUS les statuts de publication (pending_review, flagged,
 * hidden, removed…), necessaire a la file de moderation SA-029 —
 * `list_community_posts` ne renvoie que les publications 'published'.
 */

function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

export interface AdminCommunityPage {
  rows: CommunityCard[];
  nextCursor: string | null;
}

export interface AdminCommunityFilters {
  status: string | null;
  communityType: string | null;
  visibility: string | null;
  query: string | null;
}

export function loadAdminCommunities(
  filters: AdminCommunityFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCommunityPage>> {
  return adminRpc(
    'admin_list_communities',
    {
      p_status: filters.status,
      p_community_type: filters.communityType,
      p_visibility: filters.visibility,
      p_query: filters.query,
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
            const mapped = toCommunityCard(row);
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

/** SA-028/029 — `get_community` existant (0072) : bypass admin deja en base. */
export function loadAdminCommunity(
  communityId: string,
  correlationId: string,
): Promise<AdminRpcResult<CommunityDetail | null>> {
  return adminRpc('get_community', { p_community: communityId }, correlationId, toCommunityDetail);
}

export interface AdminCommunityPostPage {
  rows: CommunityPostCard[];
  nextCursor: string | null;
}

/** SA-029 — File de moderation des publications d'une communaute, tous statuts. */
export function loadAdminCommunityPosts(
  communityId: string,
  status: string | null,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminCommunityPostPage>> {
  return adminRpc(
    'admin_list_community_posts',
    { p_community_id: communityId, p_status: status, p_post_type: null, p_cursor: rawCursor(cursor), p_limit: 25 },
    correlationId,
    (payload) => {
      const raw =
        payload !== null && typeof payload === 'object'
          ? (payload as { rows?: unknown[]; next_cursor?: unknown })
          : {};
      const rows = Array.isArray(raw.rows)
        ? raw.rows.flatMap((row) => {
            const mapped = toCommunityPostCard(row);
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
