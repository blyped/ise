import { readPublicEnv, readServerEnv, type PublicEnv, type ServerEnv } from '@ise/config';

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

/**
 * Lecture validee des variables serveur (D-100 : jamais importe par un
 * composant client — ce module n'est appele que depuis des Server Actions,
 * des Route Handlers ou des Server Components).
 */
export function serverEnv(): ServerEnv {
  return readServerEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_API_KEY: process.env.EMAIL_API_KEY,
  });
}
