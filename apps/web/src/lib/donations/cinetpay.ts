import { createHash } from 'node:crypto';
import { asCleanString, parseAmount } from './cinetpay-utils';

/**
 * CINETPAY v2 — GUICHET HEBERGE, AUTHENTIFICATION OAUTH, REVERIFICATION
 * OBLIGATOIRE DE LA TRANSACTION.
 *
 * CE FICHIER A ETE ENTIEREMENT REECRIT (0135). L'implantation precedente
 * visait l'ANCIENNE plateforme — `api-checkout.cinetpay.com/v2/payment`,
 * couple `apikey` + `site_id`, jeton HMAC `x-token` sur seize champs. Ce
 * n'est PAS la plateforme du porteur : la sienne, deja en service sur son
 * autre produit, est la v2, ou l'on s'authentifie par jeton OAuth et ou
 * `site_id` N'EXISTE PLUS.
 *
 * TROIS APPELS, PAS UN DE PLUS :
 *   1. `POST {base}/v1/oauth/login`   { api_key, api_password } -> jeton ;
 *   2. `POST {base}/v1/payment`       initiation, en-tete Bearer ;
 *   3. `GET  {base}/v1/payment/{mid}` verification, en-tete Bearer.
 *
 * CE QUI N'A PAS BOUGE, ET NE BOUGERA PAS :
 *
 *  · AUCUNE DONNEE DE CARTE NE PASSE PAR NOUS. Le donateur paie sur le
 *    guichet HEBERGE de CinetPay ; nous ne recevons qu'une reference.
 *
 *  · LE STATUT NE VIENT JAMAIS DE LA NOTIFICATION. La v2 ne signe pas ses
 *    notifications ; elle remet a l'initiation un `notify_token` a usage
 *    unique qu'elle renvoie ensuite. Ce jeton etablit — au mieux — que
 *    l'appel n'est pas forge. Il n'etablit PAS l'issue du paiement :
 *    celle-ci ne vient que de `checkCinetpayTransaction()`, appelee A
 *    CHAQUE FOIS, meme quand le jeton concorde.
 *
 *  · AUCUNE ISSUE N'EST INVENTEE. Un statut inconnu, ou une attente de
 *    validation par l'utilisateur, donne `pending` : l'etat du don
 *    n'avance pas. Conclure a l'echec sur un premier appel casse les
 *    paiements par mobile money, qui repondent d'abord « en attente ».
 *
 * BASE URL : `https://api.cinetpay.co` est la PRODUCTION,
 * `https://api.cinetpay.net` est le BAC A SABLE. Le defaut est la
 * production (cf. `packages/config/src/env.ts`) : une variable oubliee ne
 * doit jamais envoyer un paiement reel en bac a sable.
 */

/* ------------------------------------------------------------------ */
/* Bornes imposees par la plateforme                                   */
/* ------------------------------------------------------------------ */

/** `merchant_transaction_id` et notre reference : 30 caracteres au plus. */
export const CINETPAY_MAX_TRANSACTION_ID_LENGTH = 30;
/** `success_url`, `failed_url`, `notify_url` : 120 caracteres au plus. */
export const CINETPAY_MAX_URL_LENGTH = 120;

/** `true` si l'URL tient dans la limite de la plateforme. */
export function isCinetpayUrlAcceptable(url: string): boolean {
  return url.length > 0 && url.length <= CINETPAY_MAX_URL_LENGTH;
}

/** `true` si la reference est utilisable telle quelle comme identifiant marchand. */
export function isCinetpayTransactionIdAcceptable(reference: string): boolean {
  return reference.length > 0 && reference.length <= CINETPAY_MAX_TRANSACTION_ID_LENGTH;
}

/* ------------------------------------------------------------------ */
/* Lecture defensive des reponses                                      */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string | null {
  const cleaned = asCleanString(value);
  return cleaned.length > 0 ? cleaned : null;
}

/** `must_be_redirected` peut arriver en booleen, en nombre ou en chaine. */
function asFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const cleaned = asCleanString(value).toLowerCase();
  return cleaned === 'true' || cleaned === '1' || cleaned === 'yes' || cleaned === 'oui';
}

/**
 * La v2 place tantot l'information a la racine, tantot dans `details`,
 * tantot dans `data`. On regarde les trois, dans cet ordre, plutot que de
 * parier sur une forme unique.
 */
function pick(payload: Record<string, unknown>, key: string): unknown {
  if (payload[key] !== undefined) return payload[key];
  const details = asRecord(payload['details']);
  if (details[key] !== undefined) return details[key];
  const data = asRecord(payload['data']);
  return data[key];
}

/* ------------------------------------------------------------------ */
/* Identifiants et jeton OAuth                                         */
/* ------------------------------------------------------------------ */

export interface CinetpayCredentials {
  /** Racine de l'API, SANS barre oblique finale. Production par defaut. */
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly apiPassword: string;
}

type TokenResult =
  { readonly ok: true; readonly token: string } | { readonly ok: false; readonly reason: string };

/**
 * `POST {base}/v1/oauth/login`.
 *
 * Le jeton n'est ni journalise, ni renvoye a l'appelant au-dela de cette
 * couche, ni mis en cache : il est obtenu a chaque operation. Un cache
 * partage entre requetes serverless n'apporterait rien de sur.
 */
async function login(credentials: CinetpayCredentials): Promise<TokenResult> {
  let response: Response;
  try {
    response = await fetch(`${credentials.baseUrl}/v1/oauth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: credentials.apiKey,
        api_password: credentials.apiPassword,
      }),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'auth_network' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: 'auth_invalid_response' };
  }

  const record = asRecord(payload);
  const token = asText(record['access_token']);
  const code = asText(record['code']);

  if (!response.ok || token === null || (code !== null && Number(code) !== 200)) {
    // On ne recopie ni le corps ni le jeton : le motif suffit au diagnostic.
    return { ok: false, reason: `auth_code_${code ?? String(response.status)}` };
  }

  return { ok: true, token };
}

/* ------------------------------------------------------------------ */
/* Initiation du paiement                                              */
/* ------------------------------------------------------------------ */

export interface CinetpayPaymentInput {
  readonly credentials: CinetpayCredentials;
  /**
   * NOTRE reference. Elle part telle quelle comme `merchant_transaction_id`
   * (30 caracteres au plus, cf. 0135) : une seule identite, aucun mappage.
   */
  readonly reference: string;
  /** Entier, en francs CFA. Le XOF n'a pas de sous-unite. */
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  readonly notifyUrl: string;
  readonly successUrl: string;
  readonly failedUrl: string;
  /** Facultatif : CinetPay s'en sert pour le recu, jamais nous. */
  readonly customerEmail: string | null;
}

export interface CinetpayPaymentSession {
  /** URL du guichet HEBERGE. Renseignee uniquement si la v2 demande la redirection. */
  readonly url: string;
  /**
   * D-218 (16/08/2026) — jeton opaque du meme guichet, consomme par le SDK
   * `cinetpay-seamless` (`CinetPaySeamless.open({ paymentToken, paymentUrl })`)
   * pour ouvrir le paiement dans une popup SANS quitter le site, plutot
   * qu'une redirection pleine page vers `url`. Les deux champs decrivent
   * la MEME transaction ; `paymentUrl` reste transmis en priorite au SDK
   * (recommandation officielle), ce jeton n'est qu'un identifiant.
   */
  readonly paymentToken: string | null;
  /** Jeton a usage unique renvoye dans la notification. A CONSERVER. */
  readonly notifyToken: string | null;
  /** Identifiant CinetPay de la transaction (leur cote), a titre de trace. */
  readonly transactionId: string | null;
  readonly merchantTransactionId: string;
  readonly status: string;
}

export type CinetpayPaymentResult =
  | { readonly ok: true; readonly session: CinetpayPaymentSession }
  | { readonly ok: false; readonly reason: string };

/** Statuts que la v2 emploie pour dire « non ». Aucun n'est devine. */
const REFUSED_STATUSES = new Set([
  'FAILED',
  'REFUSED',
  'ERROR',
  'INVALID_PARAMS',
  'INSUFFICIENT_BALANCE',
]);

export async function createCinetpayPayment(
  input: CinetpayPaymentInput,
): Promise<CinetpayPaymentResult> {
  // Garde-fous de format AVANT tout appel reseau : un depassement de
  // longueur ferait echouer l'initiation avec un message obscur, ou pire,
  // ferait tronquer notre reference cote CinetPay et rendrait la
  // notification impossible a rattacher.
  if (!isCinetpayTransactionIdAcceptable(input.reference)) {
    return { ok: false, reason: 'reference_too_long' };
  }
  for (const url of [input.notifyUrl, input.successUrl, input.failedUrl]) {
    if (!isCinetpayUrlAcceptable(url)) return { ok: false, reason: 'url_too_long' };
  }

  const auth = await login(input.credentials);
  if (!auth.ok) return { ok: false, reason: auth.reason };

  let response: Response;
  try {
    response = await fetch(`${input.credentials.baseUrl}/v1/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify({
        // AUCUN `site_id` : il n'existe plus dans la v2.
        currency: input.currency,
        merchant_transaction_id: input.reference,
        amount: input.amount,
        lang: 'fr',
        designation: input.description,
        ...(input.customerEmail === null ? {} : { client_email: input.customerEmail }),
        success_url: input.successUrl,
        failed_url: input.failedUrl,
        notify_url: input.notifyUrl,
        // Notre reference, et rien d'autre : aucune donnee personnelle ne
        // part dans les metadonnees du prestataire.
        metadata: input.reference,
      }),
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

  const record = asRecord(payload);
  const status = asText(pick(record, 'status')) ?? '';
  const code = asText(pick(record, 'code'));

  if (!response.ok || REFUSED_STATUSES.has(status.toUpperCase())) {
    return { ok: false, reason: `code_${code ?? String(response.status)}_${status || 'inconnu'}` };
  }

  const url = asText(record['payment_url']);
  const merchantTransactionId = asText(record['merchant_transaction_id']) ?? input.reference;

  // ON NE REDIRIGE QUE SI LA PLATEFORME LE DEMANDE. `must_be_redirected`
  // faux signifie que le paiement se poursuit hors navigateur (paiement
  // direct par l'operateur) : ce parcours n'existe pas ici, faute de quoi
  // il faudrait collecter un numero de telephone et un code de
  // confirmation. On ne fabrique pas une redirection qui n'a pas ete
  // demandee, et on n'affirme pas non plus un paiement en cours.
  if (!asFlag(pick(record, 'must_be_redirected')) || url === null) {
    return { ok: false, reason: 'not_redirectable' };
  }

  return {
    ok: true,
    session: {
      url,
      paymentToken: asText(record['payment_token']),
      notifyToken: asText(record['notify_token']),
      transactionId: asText(record['transaction_id']),
      merchantTransactionId,
      status,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Verification de transaction — la SEULE source du resultat            */
/* ------------------------------------------------------------------ */

export type CinetpayOutcome = 'succeeded' | 'failed' | 'cancelled' | 'pending';

export interface CinetpayTransaction {
  readonly outcome: CinetpayOutcome;
  /** Statut brut renvoye par CinetPay, conserve pour la tracabilite. */
  readonly status: string;
  readonly code: string;
  /** Montant CONFIRME par CinetPay, entier en unite minimale, ou `null`. */
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly paymentMethod: string | null;
  readonly merchantTransactionId: string | null;
}

export type CinetpayCheckResult =
  | { readonly ok: true; readonly transaction: CinetpayTransaction }
  | { readonly ok: false; readonly reason: string };

/**
 * Traduit le statut v2 en issue interne.
 *
 * `INITIATED`, `PENDING`, `WAITING_FOR_CUSTOMER` et tout statut inconnu
 * donnent `pending`. C'est volontaire : le don n'avance pas, la
 * notification suivante tranchera. Rien n'est suppose.
 */
function mapCinetpayStatus(status: string): CinetpayOutcome {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'ACCEPTED') return 'succeeded';
  if (REFUSED_STATUSES.has(normalized)) return 'failed';
  if (normalized === 'CANCELED' || normalized === 'CANCELLED' || normalized === 'EXPIRED') {
    return 'cancelled';
  }
  return 'pending';
}

/**
 * `GET {base}/v1/payment/{merchant_transaction_id}`.
 *
 * SEULE PAROLE QUI COMPTE. Appelee a chaque notification, et par elle
 * seule : jamais depuis le navigateur, jamais sur la foi d'un parametre
 * d'URL.
 */
export async function checkCinetpayTransaction(
  credentials: CinetpayCredentials,
  merchantTransactionId: string,
): Promise<CinetpayCheckResult> {
  const auth = await login(credentials);
  if (!auth.ok) return { ok: false, reason: auth.reason };

  let response: Response;
  try {
    response = await fetch(
      `${credentials.baseUrl}/v1/payment/${encodeURIComponent(merchantTransactionId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        cache: 'no-store',
      },
    );
  } catch {
    return { ok: false, reason: 'network' };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, reason: 'invalid_response' };
  }

  if (!response.ok) return { ok: false, reason: `http_${response.status}` };

  const record = asRecord(payload);
  const status = asText(pick(record, 'status')) ?? '';
  const code = asText(pick(record, 'code')) ?? '';

  // Ni code ni statut exploitables : on ne conclut rien plutot que de
  // deviner. Le prestataire reessaiera, et le don reste en attente.
  if (code.length === 0 && status.length === 0) {
    return { ok: false, reason: 'invalid_response' };
  }

  return {
    ok: true,
    transaction: {
      outcome: mapCinetpayStatus(status),
      status,
      code,
      // XOF : exposant 0, l'unite minimale EST le franc. `parseAmount`
      // tronque et refuse les valeurs non numeriques (cf. cinetpay-utils).
      amountMinor: parseAmount(pick(record, 'amount')),
      currency: asText(pick(record, 'currency')),
      paymentMethod: asText(pick(record, 'payment_method')),
      merchantTransactionId: asText(pick(record, 'merchant_transaction_id')),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Empreinte du `notify_token`                                          */
/* ------------------------------------------------------------------ */

/**
 * SHA-256 hexadecimal minuscule du `notify_token`.
 *
 * Le jeton en clair ne quitte jamais cette couche : c'est son EMPREINTE
 * qui est conservee (schema `private`, migration 0135) et son EMPREINTE
 * qui est comparee a la reception. Meme une lecture de la table ne
 * permettrait donc pas de fabriquer une notification credible.
 */
export function cinetpayNotifyTokenDigest(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}
