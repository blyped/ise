import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Appel RPC mutualise des tranches MESSAGERIE / NOTIFICATIONS /
 * PARAMETRES / SUPPORT (ISE-097 -> ISE-100).
 *
 * Meme contrat que `lib/queries/network.ts`, extrait ici pour ne pas
 * dupliquer la regle D-102 dans quatre modules : le message brut de
 * PostgreSQL ne franchit JAMAIS la frontiere de l'interface. Seuls
 * remontent un code metier et le `correlation_id`.
 *
 * Ce module depend de `next/headers` : il ne doit jamais etre importe
 * par un composant client.
 */
export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
  correlationId: string,
  map: (payload: unknown) => T,
): Promise<QueryResult<T>> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc(name, args);

  if (error) {
    console.error('[ISE] appel RPC en echec', { correlationId, rpc: name, code: error.code });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }
  return { ok: true, data: map(data) };
}
