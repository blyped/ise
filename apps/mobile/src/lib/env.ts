import { z } from 'zod';

/**
 * Variables d'environnement du mobile, lues et validees au demarrage.
 *
 * MASTER PROMPT §75-76 : echec explicite au demarrage plutot qu'une erreur
 * silencieuse plus tard. `@ise/config` (`readPublicEnv`) n'est pas reutilise
 * ici : son schema fixe des noms de variables `NEXT_PUBLIC_*` propres a
 * Next.js (dont `NEXT_PUBLIC_SITE_URL`, sans equivalent mobile). Expo expose
 * ses variables client sous le prefixe `EXPO_PUBLIC_*` (remplacement fait par
 * Metro a la compilation, comme `NEXT_PUBLIC_*` cote Next.js) : ce module en
 * est l'equivalent mobile, avec le MEME schema Supabase que le web.
 */
const mobilePublicEnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  EXPO_PUBLIC_ENVIRONMENT: z
    .enum(['local', 'development', 'staging', 'production'])
    .default('local'),
});

export type MobilePublicEnv = z.infer<typeof mobilePublicEnvSchema>;

let cached: MobilePublicEnv | undefined;

export function publicEnv(): MobilePublicEnv {
  if (cached) return cached;

  const parsed = mobilePublicEnvSchema.safeParse({
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
  });

  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement mobiles invalides : ${parsed.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}. Copiez apps/mobile/.env.example vers .env.local.`,
    );
  }

  cached = parsed.data;
  return cached;
}
