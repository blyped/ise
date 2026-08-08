import { z } from 'zod';

/**
 * Validation stricte des variables d'environnement.
 * MASTER PROMPT §75, §76 : aucun secret cote client, echec au demarrage
 * plutot qu'une erreur silencieuse en production.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_ENVIRONMENT: z
    .enum(['local', 'development', 'staging', 'production'])
    .default('local'),
});

const serverSchema = publicSchema.extend({
  /** JAMAIS exposee au navigateur ni au bundle mobile (D-100). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  EMAIL_PROVIDER: z.enum(['console', 'resend', 'sendgrid', 'ses']).default('console'),
  EMAIL_FROM: z.string().min(3),
  EMAIL_API_KEY: z.string().optional(),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function readPublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const parsed = publicSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement publiques invalides : ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    );
  }
  return parsed.data;
}

export function readServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(
      `Variables d'environnement serveur invalides : ${parsed.error.issues
        .map((i) => i.path.join('.'))
        .join(', ')}`,
    );
  }
  return parsed.data;
}
