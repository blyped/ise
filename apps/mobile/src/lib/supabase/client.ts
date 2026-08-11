import type { Database } from '@ise/db-types';
import { createClient } from '@supabase/supabase-js';

import { publicEnv } from '../env';
import { secureSessionStorage } from './secure-store-adapter';

/**
 * Client Supabase mobile. Equivalent de `apps/web/src/lib/supabase/client.ts`,
 * mais sans `@supabase/ssr` : il n'y a pas de cookies ni de serveur de rendu
 * cote mobile, seulement ce client unique, garde en memoire pour toute la vie
 * de l'application.
 *
 * Seule la cle publiable (anon) est utilisee ici — jamais `service_role`
 * (D-100) — et tous les acces restent soumis aux memes politiques RLS que le
 * web : le mobile ne contourne aucune regle de securite serveur.
 */
let client: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseClient() {
  if (client) return client;

  const env = publicEnv();
  client = createClient<Database>(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Pas de flux OAuth via URL de redirection navigateur sur mobile pour
      // cette premiere tranche (voir README apps/mobile) : desactive plutot
      // qu'ignore silencieusement.
      detectSessionInUrl: false,
    },
  });

  return client;
}
