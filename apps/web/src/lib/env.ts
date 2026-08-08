import { readPublicEnv, type PublicEnv } from '@ise/config';

/**
 * Lecture validee des variables publiques. Les references sont ecrites en
 * toutes lettres : Next.js remplace `process.env.NEXT_PUBLIC_*` a la
 * compilation uniquement sur un acces statique.
 *
 * Aucune cle n'est ecrite dans le code : tout vient de l'environnement (§76).
 */
export function publicEnv(): PublicEnv {
  return readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
  });
}
