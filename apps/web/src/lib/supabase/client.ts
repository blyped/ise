'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@ise/db-types';
import { publicEnv } from '../env';

/**
 * Client Supabase du navigateur.
 * La session vit dans des cookies geres par `@supabase/ssr` — jamais dans
 * `localStorage` — afin que le serveur puisse la lire et la rafraichir.
 * Seule la cle publiable est utilisee ici ; `service_role` n'existe pas
 * cote client (D-100).
 */
export function createSupabaseBrowserClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
