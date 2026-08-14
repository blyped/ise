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

/* ------------------------------------------------------------------ */
/* MODULE DE DON — Stripe & CinetPay (migration 0134)                  */
/* ------------------------------------------------------------------ */

/**
 * CINQ VARIABLES, TOUTES SECRETES, TOUTES SERVEUR, TOUTES OPTIONNELLES.
 *
 * · `STRIPE_SECRET_KEY`      — appel serveur a l'API Stripe (creation de
 *                              la Checkout Session hebergee) ;
 * · `STRIPE_WEBHOOK_SECRET`  — verification de la signature `Stripe-Signature` ;
 * · `CINETPAY_API_KEY`       — appel serveur a l'API CinetPay ;
 * · `CINETPAY_SITE_ID`       — identifiant du site marchand CinetPay ;
 * · `CINETPAY_SECRET_KEY`    — verification du jeton HMAC `x-token` des
 *                              notifications CinetPay.
 *
 * AUCUNE N'EST PREFIXEE `NEXT_PUBLIC_` : elles ne doivent jamais franchir
 * la frontiere du serveur. Le paiement se deroulant sur les pages
 * HEBERGEES des prestataires (redirection), le navigateur n'a besoin
 * d'aucune cle — pas meme d'une cle publiable Stripe.
 *
 * POURQUOI OPTIONNELLES : contrairement a `SUPABASE_SERVICE_ROLE_KEY`,
 * leur absence ne doit pas empecher l'application de demarrer. Un
 * prestataire dont il manque NE SERAIT-CE QU'UNE variable est considere
 * INDISPONIBLE — une configuration a moitie posee produirait des erreurs
 * en plein parcours de paiement, ce qui est pire que de ne rien proposer.
 * Le module de don s'annonce alors indisponible et l'entree de menu
 * disparait, plutot que de mener a un ecran mort (MASTER PROMPT §113).
 */
const donationSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CINETPAY_API_KEY: z.string().optional(),
  CINETPAY_SITE_ID: z.string().optional(),
  CINETPAY_SECRET_KEY: z.string().optional(),
});

export interface StripeDonationEnv {
  readonly secretKey: string;
  readonly webhookSecret: string;
}

export interface CinetpayDonationEnv {
  readonly apiKey: string;
  readonly siteId: string;
  readonly secretKey: string;
}

/**
 * Configuration NORMALISEE du module de don.
 *
 * Volontairement sans propriete optionnelle : `exactOptionalPropertyTypes`
 * est actif, et un `| null` explicite se lit mieux qu'un champ absent.
 * Un prestataire vaut `null` des qu'une seule de ses variables manque.
 */
export interface DonationEnv {
  readonly stripe: StripeDonationEnv | null;
  readonly cinetpay: CinetpayDonationEnv | null;
}

/** Chaine reellement renseignee, ou `null`. Une chaine vide vaut absente. */
function present(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Lecture TOLERANTE : ne leve jamais. Une variable manquante ou vide rend
 * son prestataire indisponible, elle ne casse pas le demarrage.
 */
export function readDonationEnv(source: Record<string, string | undefined>): DonationEnv {
  const parsed = donationSchema.safeParse(source);
  const values = parsed.success ? parsed.data : {};

  const stripeSecretKey = present(values.STRIPE_SECRET_KEY);
  const stripeWebhookSecret = present(values.STRIPE_WEBHOOK_SECRET);
  const cinetpayApiKey = present(values.CINETPAY_API_KEY);
  const cinetpaySiteId = present(values.CINETPAY_SITE_ID);
  const cinetpaySecretKey = present(values.CINETPAY_SECRET_KEY);

  return {
    stripe:
      stripeSecretKey !== null && stripeWebhookSecret !== null
        ? { secretKey: stripeSecretKey, webhookSecret: stripeWebhookSecret }
        : null,
    cinetpay:
      cinetpayApiKey !== null && cinetpaySiteId !== null && cinetpaySecretKey !== null
        ? { apiKey: cinetpayApiKey, siteId: cinetpaySiteId, secretKey: cinetpaySecretKey }
        : null,
  };
}
