import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toAdminError, type AdminError } from './errors';

/**
 * Appel RPC mutualisé du back-office « données ».
 *
 * Même contrat que `lib/queries/rpc.ts`, mais avec la traduction d'erreur
 * étendue aux codes propres aux migrations 0080 → 0083 : le message brut
 * de PostgreSQL ne franchit JAMAIS la frontière de l'interface (D-102).
 * Seuls remontent un code métier, sa phrase française et le
 * `correlation_id`.
 *
 * Ce module dépend de `next/headers` : jamais importé côté client.
 */
export type AdminRpcResult<T> = { ok: true; data: T } | { ok: false; error: AdminError };

export async function adminRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<AdminRpcResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] appel RPC admin en échec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toAdminError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}
