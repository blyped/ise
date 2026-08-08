import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@ise/db-types';
import { publicEnv } from '../env';

/**
 * Client Supabase des Server Components et Server Actions.
 * La cle utilisee est la cle publiable : toutes les lectures et ecritures
 * restent soumises aux politiques RLS de la base (D-100, MASTER PROMPT §11).
 *
 * Dans un Server Component pur, l'ecriture de cookies leve une exception :
 * elle est ignoree, le rafraichissement etant assure par `src/middleware.ts`.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component en lecture seule : rafraichissement delegue au middleware.
          }
        },
      },
    },
  );
}
