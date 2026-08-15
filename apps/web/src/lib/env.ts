import {
  readDonationEnv,
  readPublicEnv,
  readServerEnv,
  type DonationEnv,
  type PublicEnv,
  type ServerEnv,
} from '@ise/config';

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

/**
 * MODULE DE DON (0134, 0135) — secrets des prestataires de paiement.
 *
 * SERVEUR UNIQUEMENT, et sans exception : aucune de ces variables n'est
 * prefixee `NEXT_PUBLIC_`, donc aucune ne peut se retrouver dans le bundle
 * du navigateur. Le paiement se deroulant sur les pages HEBERGEES de Stripe
 * et de CinetPay, le navigateur n'a besoin d'AUCUNE cle.
 *
 * Cette lecture NE LEVE JAMAIS : une variable absente rend simplement son
 * prestataire indisponible. L'application demarre sans elles, et le module
 * de don s'annonce alors indisponible plutot que de planter.
 *
 * CINETPAY v2 (0135) : plus de `CINETPAY_SITE_ID` ni de `CINETPAY_SECRET_KEY`
 * — la v2 n'a ni site marchand ni jeton HMAC. L'authentification est un
 * couple `CINETPAY_API_KEY` / `CINETPAY_API_PASSWORD`. `CINETPAY_BASE_URL`
 * et `CINETPAY_NOTIFY_URL` sont facultatives ; a defaut, la base URL est
 * la PRODUCTION et l'URL de notification est deduite du site.
 */
export function donationEnv(): DonationEnv {
  return readDonationEnv({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    CINETPAY_API_KEY: process.env.CINETPAY_API_KEY,
    CINETPAY_API_PASSWORD: process.env.CINETPAY_API_PASSWORD,
    CINETPAY_BASE_URL: process.env.CINETPAY_BASE_URL,
    CINETPAY_NOTIFY_URL: process.env.CINETPAY_NOTIFY_URL,
  });
}
