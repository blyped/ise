import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * CINETPAY — guichet de paiement HEBERGE, jeton HMAC `x-token` et
 * REVERIFICATION obligatoire de la transaction.
 *
 * LE POINT LE PLUS IMPORTANT DE CE FICHIER : CinetPay n'envoie JAMAIS le
 * statut du paiement dans sa notification. Sa documentation le dit
 * explicitement — « CinetPay ne vous enverra pas les informations sur le
 * statut de la transaction pour eviter certaine faille de securite comme le
 * man in the middle », et « il faudra toujours effectuer un appel a l'API de
 * Verification de transaction pour avoir les vraies valeurs du paiement ».
 * On appelle donc systematiquement `/v2/payment/check` avant de conclure
 * quoi que ce soit, meme quand le jeton HMAC est valide.
 *
 * AUCUNE DONNEE DE CARTE NE PASSE PAR NOUS : on cree un lien de paiement,
 * le donateur paie sur le guichet CinetPay.
 *
 * Reference : https://docs.cinetpay.com/api/1.0-fr/checkout/initialisation
 *             https://docs.cinetpay.com/api/1.0-fr/checkout/notification
 *             https://docs.cinetpay.com/api/1.0-fr/checkout/hmac
 *             https://docs.cinetpay.com/api/1.0-fr/checkout/verification
 */

const CINETPAY_PAYMENT_URL = 'https://api-checkout.cinetpay.com/v2/payment';
const CINETPAY_CHECK_URL = 'https://api-checkout.cinetpay.com/v2/payment/check';

/**
 * ORDRE EXACT de concatenation du jeton HMAC, tel que documente. Une seule
 * permutation, un seul champ oublie, et toute notification legitime serait
 * rejetee — ou pire, une contrefacon acceptee.
 */
export const CINETPAY_TOKEN_FIELDS = [
  'cpm_site_id',
  'cpm_trans_id',
  'cpm_trans_date',
  'cpm_amount',
  'cpm_currency',
  'signature',
  'payment_method',
  'cel_phone_num',
  'cpm_phone_prefixe',
  'cpm_language',
  'cpm_version',
  'cpm_payment_config',
  'cpm_page_action',
  'cpm_custom',
  'cpm_designation',
  'cpm_error_message',
] as const;

export interface CinetpayPaymentInput {
  readonly apiKey: string;
  readonly siteId: string;
  /** NOTRE reference : elle devient le `transaction_id` de CinetPay. */
  readonly reference: string;
  /** Entier, en francs CFA. Doit etre un multiple de 5 (impose par CinetPay). */
  readonly amount: number;
  readonly currency: string;
  readonly description: string;
  readonly notifyUrl: string;
  readonly returnUrl: string;
}

export type CinetpayPaymentResult =
  | { readonly ok: true; readonly url: string; readonly token: string }
  | { readonly ok: false; readonly reason: string };

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export async function createCinetpayPayment(
  input: CinetpayPaymentInput,
): Promise<CinetpayPaymentResult> {
  let response: Response;
  try {
    response = await fetch(CINETPAY_PAYMENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: input.apiKey,
        site_id: input.siteId,
        transaction_id: input.reference,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        notify_url: input.notifyUrl,
        return_url: input.returnUrl,
        // ALL : mobile money ET carte bancaire, c'est au donateur de choisir
        // sur le guichet. Aucune coordonnee ne revient chez nous.
        channels: 'ALL',
        lang: 'fr',
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
  const code = asString(record['code']);
  if (code !== '201') {
    return { ok: false, reason: `code_${code ?? 'inconnu'}` };
  }

  const data = asRecord(record['data']);
  const url = asString(data['payment_url']);
  const token = asString(data['payment_token']);
  if (url === null || token === null) return { ok: false, reason: 'invalid_response' };

  return { ok: true, url, token };
}

/* ------------------------------------------------------------------ */
/* Jeton HMAC `x-token`                                                */
/* ------------------------------------------------------------------ */

function hexEquals(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Verifie le jeton HMAC place par CinetPay dans l'en-tete `x-token`.
 *
 * Le message signe est la CONCATENATION SANS SEPARATEUR des seize champs
 * du corps, dans l'ordre documente, un champ absent comptant pour une
 * chaine vide. La cle est la « Secret Key » du compte marchand.
 *
 * Ce controle etablit l'AUTHENTICITE de l'appel. Il n'etablit PAS le
 * resultat du paiement : celui-ci ne vient que de `checkCinetpayTransaction`.
 */
export function verifyCinetpayToken(
  form: URLSearchParams,
  receivedToken: string | null,
  secretKey: string,
): boolean {
  if (receivedToken === null) return false;
  const received = receivedToken.trim().toLowerCase();
  if (received.length === 0) return false;

  const data = CINETPAY_TOKEN_FIELDS.map((field) => form.get(field) ?? '').join('');
  const expected = createHmac('sha256', secretKey).update(data, 'utf8').digest('hex');

  return hexEquals(expected, received);
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
}

export type CinetpayCheckResult =
  | { readonly ok: true; readonly transaction: CinetpayTransaction }
  | { readonly ok: false; readonly reason: string };

/**
 * Traduit le statut CinetPay en issue interne.
 *
 * AUCUNE ISSUE N'EST INVENTEE. Un statut inconnu, ou une attente de
 * validation par l'utilisateur, donne `pending` : l'etat du don n'avance
 * pas. CinetPay avertit explicitement qu'un premier appel peut arriver en
 * `WAITING_FOR_CUSTOMER` et que conclure a l'echec a ce moment-la casse les
 * paiements par mobile money.
 */
function mapCinetpayStatus(status: string): CinetpayOutcome {
  const normalized = status.trim().toUpperCase();
  if (normalized === 'ACCEPTED') return 'succeeded';
  if (normalized === 'REFUSED') return 'failed';
  if (normalized === 'CANCELED' || normalized === 'CANCELLED') return 'cancelled';
  return 'pending';
}

/** Montant renvoye par CinetPay : chaine ou nombre, toujours en unite minimale. */
function parseAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\s ]/g, '');
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

export async function checkCinetpayTransaction(
  apiKey: string,
  siteId: string,
  transactionId: string,
): Promise<CinetpayCheckResult> {
  let response: Response;
  try {
    response = await fetch(CINETPAY_CHECK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: transactionId }),
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
  const code = asString(record['code']) ?? '';
  const data = asRecord(record['data']);
  const status = asString(data['status']) ?? '';

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
      amountMinor: parseAmount(data['amount']),
      currency: asString(data['currency']),
      paymentMethod: asString(data['payment_method']),
    },
  };
}
