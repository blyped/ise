import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toAdminError, type AdminError } from './errors';

/**
 * Appel RPC mutualise du back-office Superadmin (lot « coeur »).
 *
 * Meme contrat que `lib/admin-data/rpc.ts` (lot livre en parallele) :
 * le message brut de PostgreSQL ne franchit JAMAIS la frontiere de
 * l'interface (D-102). Seuls remontent un code metier, sa phrase
 * francaise et le `correlation_id`.
 *
 * Ce module depend de `next/headers` : jamais importe cote client.
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
    console.error('[ISE] appel RPC admin en echec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toAdminError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}
