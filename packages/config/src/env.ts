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
/* MODULE DE DON — Stripe & CinetPay v2 (migrations 0134, 0135)        */
/* ------------------------------------------------------------------ */

/**
 * LA BASE URL DE CINETPAY N'EST PAS UN DETAIL.
 *
 * `https://api.cinetpay.co` est la PRODUCTION.
 * `https://api.cinetpay.net` est le BAC A SABLE.
 *
 * Les deux ne different que par le domaine de premier niveau, et les
 * intervertir ne provoque AUCUNE erreur visible : le paiement part
 * simplement dans le vide. C'est deja arrive sur un autre produit du
 * porteur. Le defaut est donc la PRODUCTION : une variable oubliee ne peut
 * pas envoyer un paiement reel en bac a sable. Pour tester, il faut poser
 * explicitement `CINETPAY_BASE_URL=https://api.cinetpay.net`.
 */
export const CINETPAY_PRODUCTION_BASE_URL = 'https://api.cinetpay.co';
export const CINETPAY_SANDBOX_BASE_URL = 'https://api.cinetpay.net';

/**
 * SIX VARIABLES, TOUTES SERVEUR, TOUTES OPTIONNELLES.
 *
 * · `STRIPE_SECRET_KEY`       — appel serveur a l'API Stripe (creation de
 *                               la Checkout Session hebergee) ;
 * · `STRIPE_WEBHOOK_SECRET`   — verification de la signature `Stripe-Signature` ;
 * · `CINETPAY_API_KEY`        — premier terme de l'authentification OAuth v2 ;
 * · `CINETPAY_API_PASSWORD`   — second terme de la meme authentification ;
 * · `CINETPAY_BASE_URL`       — FACULTATIVE, defaut PRODUCTION (ci-dessus) ;
 * · `CINETPAY_NOTIFY_URL`     — FACULTATIVE, defaut `<site>/api/dons/cinetpay`.
 *
 * DISPARUES EN 0135, ET IL FAUT LES RETIRER DE L'ENVIRONNEMENT :
 * · `CINETPAY_SITE_ID`    — la v2 n'a plus de notion de site marchand ;
 * · `CINETPAY_SECRET_KEY` — elle ne servait qu'au jeton HMAC `x-token` de
 *                           l'ancienne plateforme, que la v2 n'emet pas.
 * Les laisser posees serait sans effet, mais laisserait croire qu'elles
 * comptent encore.
 *
 * AUCUNE N'EST PREFIXEE `NEXT_PUBLIC_` : elles ne doivent jamais franchir
 * la frontiere du serveur. Le paiement se deroulant sur les pages
 * HEBERGEES des prestataires (redirection), le navigateur n'a besoin
 * d'aucune cle — pas meme d'une cle publiable Stripe.
 *
 * POURQUOI OPTIONNELLES : contrairement a `SUPABASE_SERVICE_ROLE_KEY`,
 * leur absence ne doit pas empecher l'application de demarrer. Un
 * prestataire dont il manque une variable REQUISE est considere
 * INDISPONIBLE — une configuration a moitie posee produirait des erreurs
 * en plein parcours de paiement, ce qui est pire que de ne rien proposer.
 * Le module de don s'annonce alors indisponible et l'entree de menu
 * disparait, plutot que de mener a un ecran mort (MASTER PROMPT §113).
 */
const donationSchema = z.object({
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CINETPAY_API_KEY: z.string().optional(),
  CINETPAY_API_PASSWORD: z.string().optional(),
  CINETPAY_BASE_URL: z.string().optional(),
  CINETPAY_NOTIFY_URL: z.string().optional(),
});

export interface StripeDonationEnv {
  readonly secretKey: string;
  readonly webhookSecret: string;
}

export interface CinetpayDonationEnv {
  readonly apiKey: string;
  readonly apiPassword: string;
  /** Racine de l'API, sans barre oblique finale. PRODUCTION par defaut. */
  readonly baseUrl: string;
  /** `null` = on deduit l'URL de notification de `NEXT_PUBLIC_SITE_URL`. */
  readonly notifyUrl: string | null;
}

/**
 * Configuration NORMALISEE du module de don.
 *
 * Volontairement sans propriete optionnelle : `exactOptionalPropertyTypes`
 * est actif, et un `| null` explicite se lit mieux qu'un champ absent.
 * Un prestataire vaut `null` des qu'une seule de ses variables REQUISES
 * manque.
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
 * URL absolue en `https`, sans barre oblique finale, ou `null`.
 * On refuse tout le reste plutot que de le transmettre tel quel : une
 * base URL mal formee ferait echouer chaque appel avec un message opaque.
 */
function absoluteUrl(value: string | null): string | null {
  if (value === null) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    return value.replace(/\/+$/, '');
  } catch {
    return null;
  }
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
  const cinetpayApiPassword = present(values.CINETPAY_API_PASSWORD);
  // Une base URL illisible retombe sur la PRODUCTION, jamais sur le bac a
  // sable : dans le doute, on prefere un appel qui echoue bruyamment a un
  // paiement reel qui part dans un environnement de test.
  const cinetpayBaseUrl =
    absoluteUrl(present(values.CINETPAY_BASE_URL)) ?? CINETPAY_PRODUCTION_BASE_URL;
  const cinetpayNotifyUrl = absoluteUrl(present(values.CINETPAY_NOTIFY_URL));

  return {
    stripe:
      stripeSecretKey !== null && stripeWebhookSecret !== null
        ? { secretKey: stripeSecretKey, webhookSecret: stripeWebhookSecret }
        : null,
    cinetpay:
      cinetpayApiKey !== null && cinetpayApiPassword !== null
        ? {
            apiKey: cinetpayApiKey,
            apiPassword: cinetpayApiPassword,
            baseUrl: cinetpayBaseUrl,
            notifyUrl: cinetpayNotifyUrl,
          }
        : null,
  };
}
