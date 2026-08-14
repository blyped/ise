import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * STRIPE — page de paiement HEBERGEE (Checkout Session) et verification de
 * la signature des notifications.
 *
 * POURQUOI PAS LE PAQUET `stripe` : deux raisons. D'abord, l'integration se
 * limite a UN appel HTTP et a UNE verification HMAC — la bibliotheque
 * apporterait une dependance et un verrou de version pour cela. Ensuite, le
 * bac a sable de ce projet ne peut pas regenerer `pnpm-lock.yaml` de facon
 * fiable, et un verrou incoherent casse le build Vercel. On s'en tient donc
 * a `fetch` et a `node:crypto`, tous deux dans la plateforme.
 *
 * AUCUNE DONNEE DE CARTE NE PASSE PAR NOUS. On cree une session, on renvoie
 * son URL, le donateur saisit sa carte chez Stripe. Nous restons hors du
 * perimetre PCI-DSS.
 *
 * Reference : https://docs.stripe.com/api/checkout/sessions/create
 *             https://docs.stripe.com/webhooks (verification manuelle)
 */

const STRIPE_CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';

/** Tolerance de rejeu recommandee par Stripe : 5 minutes. Jamais 0. */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export interface StripeCheckoutInput {
  readonly secretKey: string;
  /** Entier, en plus petite unite monetaire. Recalcule par la base, pas par le navigateur. */
  readonly amountMinor: number;
  /** Code ISO a trois lettres, tel qu'enregistre (majuscules). */
  readonly currency: string;
  /** NOTRE reference, transmise en `client_reference_id` ET en metadonnee. */
  readonly reference: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly customerEmail: string | null;
  readonly productName: string;
}

export type StripeCheckoutResult =
  | { readonly ok: true; readonly url: string; readonly sessionId: string }
  | { readonly ok: false; readonly reason: string };

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput,
): Promise<StripeCheckoutResult> {
  const body = new URLSearchParams();
  body.set('mode', 'payment');
  // Le bouton du guichet affiche « Faire un don » plutot que « Payer ».
  body.set('submit_type', 'donate');
  body.set('locale', 'fr');
  body.set('success_url', input.successUrl);
  body.set('cancel_url', input.cancelUrl);
  // Deux emplacements pour la meme reference : `client_reference_id` est
  // repris tel quel sur l'objet Session recu en notification, la metadonnee
  // survit si l'on doit un jour lire l'evenement autrement.
  body.set('client_reference_id', input.reference);
  body.set('metadata[donation_reference]', input.reference);
  body.set('payment_intent_data[metadata][donation_reference]', input.reference);
  body.set('line_items[0][quantity]', '1');
  body.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  body.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
  body.set('line_items[0][price_data][product_data][name]', input.productName);
  if (input.customerEmail !== null) {
    body.set('customer_email', input.customerEmail);
  }

  let response: Response;
  try {
    response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        // Idempotence COTE STRIPE : un double envoi de la meme tentative
        // (double-clic, reprise reseau) ne cree pas deux sessions.
        'Idempotency-Key': `don-${input.reference}`,
      },
      body: body.toString(),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'network' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_response' };
  }

  if (!response.ok) {
    // Le message brut de Stripe ne franchit jamais la frontiere de
    // l'interface (D-102) : on ne remonte qu'un code.
    return { ok: false, reason: `http_${response.status}` };
  }

  const record = (payload ?? {}) as Record<string, unknown>;
  const url = asString(record['url']);
  const sessionId = asString(record['id']);
  if (url === null || sessionId === null) return { ok: false, reason: 'invalid_response' };

  return { ok: true, url, sessionId };
}

/* ------------------------------------------------------------------ */
/* Verification de la signature des notifications                      */
/* ------------------------------------------------------------------ */

/** Comparaison a temps constant de deux chaines hexadecimales. */
function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verifie l'en-tete `Stripe-Signature`.
 *
 * Procedure exacte de la documentation Stripe :
 *   1. decouper l'en-tete sur `,` puis chaque element sur `=` ;
 *   2. composer `signed_payload = timestamp + "." + corps BRUT` ;
 *   3. HMAC-SHA256 avec le secret du point de terminaison ;
 *   4. comparer a temps constant, et verifier l'anciennete du timestamp.
 *
 * TOUT SCHEMA AUTRE QUE `v1` EST IGNORE — Stripe emet aussi un `v0` factice
 * pour les tests, et l'accepter serait une attaque par retrogradation.
 *
 * Le corps doit etre le TEXTE BRUT recu, jamais un objet re-serialise :
 * une seule espace de difference invalide la signature.
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean {
  if (signatureHeader === null) return false;

  let timestamp: string | null = null;
  const candidates: string[] = [];

  for (const element of signatureHeader.split(',')) {
    const separator = element.indexOf('=');
    if (separator <= 0) continue;
    const key = element.slice(0, separator).trim();
    const value = element.slice(separator + 1).trim();
    if (key === 't') timestamp = value;
    // Plusieurs `v1` peuvent coexister pendant une rotation de secret.
    else if (key === 'v1') candidates.push(value);
  }

  if (timestamp === null || candidates.length === 0) return false;

  const issuedAt = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(issuedAt)) return false;
  if (Math.abs(nowSeconds - issuedAt) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`, 'utf8')
    .digest('hex');

  return candidates.some((candidate) => hexEquals(expected, candidate.toLowerCase()));
}
