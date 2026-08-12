import { sealCursor, unsealCursor } from '@/lib/opaque-cursor';
import { toNewsCard, toNewsDetail, type NewsCard, type NewsDetail } from '@/lib/content-view';
import { adminRpc, type AdminRpcResult } from './rpc';

/**
 * Requetes de la redaction administrative des actualites (0110, tache
 * #83).
 *
 * `admin_list_news` est neuve : seule fonction a lister TOUS les
 * statuts editoriaux, y compris 'draft', qu'aucune fonction membre
 * n'expose. `get_news` (0074) est en revanche REUTILISEE telle quelle,
 * sans wrapper `admin_` : `private.can_see_news` (0046) accorde deja un
 * bypass a `content.publish` — meme principe que SA-031 reutilisant
 * `get_event`.
 */

function rawCursor(sealed: string | null): string | null {
  if (sealed === null || sealed.length === 0) return null;
  return unsealCursor(sealed);
}

export interface AdminNewsPage {
  rows: NewsCard[];
  nextCursor: string | null;
}

export interface AdminNewsFilters {
  status: string | null;
  categoryCode: string | null;
  query: string | null;
}

export function loadAdminNews(
  filters: AdminNewsFilters,
  cursor: string | null,
  correlationId: string,
): Promise<AdminRpcResult<AdminNewsPage>> {
  return adminRpc(
    'admin_list_news',
    {
      p_status: filters.status,
      p_category_code: filters.categoryCode,
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
            const mapped = toNewsCard(row);
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

/** `get_news` existant (0074) : bypass admin deja en base via `can_see_news`. */
export function loadAdminNewsDetail(
  newsId: string,
  correlationId: string,
): Promise<AdminRpcResult<NewsDetail | null>> {
  return adminRpc('get_news', { p_news: newsId }, correlationId, toNewsDetail);
}
