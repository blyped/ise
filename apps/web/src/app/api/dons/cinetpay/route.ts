import { NextResponse, type NextRequest } from 'next/server';
import { newCorrelationId } from '@/lib/correlation';
import { donationEnv } from '@/lib/env';
import { asCleanString } from '@/lib/donations/cinetpay-utils';
import {
  checkCinetpayTransaction,
  cinetpayNotifyTokenDigest,
  isCinetpayTransactionIdAcceptable,
} from '@/lib/donations/cinetpay';
import { donationNotifyTokenMatches, settleDonationNotification } from '@/lib/donations/settle';

/**
 * NOTIFICATION SERVEUR A SERVEUR DE CINETPAY v2 (`notify_url`).
 *
 * CE QUI A CHANGE EN 0135 : l'ancienne plateforme signait ses
 * notifications par un jeton HMAC `x-token` calcule sur seize champs. La
 * v2 — celle qu'utilise reellement le porteur — ne signe pas. Elle remet
 * a l'INITIATION un `notify_token` a usage unique et le renvoie dans la
 * notification. C'est ce jeton qui remplace le HMAC.
 *
 * DEUX CONTROLES, ET LE SECOND EST LE SEUL QUI TRANCHE :
 *
 *  1. AUTHENTICITE (indicative). L'empreinte SHA-256 du `notify_token`
 *     recu est comparee a celle conservee a l'initiation, dans le schema
 *     `private`, hors de portee du navigateur. Une empreinte presente des
 *     deux cotes et DIFFERENTE arrete le traitement.
 *
 *  2. VERITE DU PAIEMENT (decisive). Le corps de la notification NE
 *     DECIDE DE RIEN, jamais, meme si le jeton concorde. On rappelle
 *     CinetPay — `GET /v1/payment/{merchant_transaction_id}` — et c'est
 *     cette reponse-la, et elle seule, qui etablit l'issue. Cette etape
 *     n'est pas facultative et n'a pas de chemin de contournement.
 *
 * IDEMPOTENCE : CinetPay previent que l'url de notification peut etre
 * appelee plusieurs fois et n'emet aucun identifiant d'evenement. On en
 * fabrique un, stable : `<transaction>:<statut constate>`. Une
 * re-livraison du meme etat est donc absorbee par la contrainte unique en
 * base, tandis qu'un veritable changement d'etat passe.
 *
 * GET : CinetPay « ping » l'URL pour verifier qu'elle repond. On renvoie
 * 200 sans rien faire.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/** Corps de la notification : formulaire ou JSON. Les deux ont ete observes. */
async function readPayload(request: NextRequest): Promise<URLSearchParams> {
  const contentType = (request.headers.get('content-type') ?? '').toLowerCase();
  const rawBody = await request.text();

  if (contentType.includes('application/json')) {
    const params = new URLSearchParams();
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (typeof parsed === 'object' && parsed !== null) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          params.set(key, value === null || value === undefined ? '' : String(value));
        }
      }
    } catch {
      // Corps illisible : formulaire vide, le traitement s'arretera faute
      // d'identifiant de transaction.
    }
    return params;
  }

  return new URLSearchParams(rawBody);
}

/**
 * Notre reference EST le `merchant_transaction_id` (0135). Les autres noms
 * sont acceptes par prudence, dans l'ordre du plus specifique au plus
 * general ; `cpm_trans_id` couvre le cas d'une notification emise par
 * l'ancienne plateforme pendant la periode de bascule.
 */
function readReference(payload: URLSearchParams): string {
  const candidates = [
    payload.get('merchant_transaction_id'),
    payload.get('merchantTransactionId'),
    payload.get('transaction_id'),
    payload.get('cpm_trans_id'),
  ];

  for (const candidate of candidates) {
    const cleaned = asCleanString(candidate);
    // Meme forme que la contrainte en base : on n'interroge pas CinetPay
    // avec n'importe quelle chaine venue de l'exterieur.
    if (/^[A-Za-z0-9._-]{8,64}$/.test(cleaned)) return cleaned;
  }

  return '';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const secrets = donationEnv().cinetpay;

  if (secrets === null) {
    console.error('[ISE] don : notification CinetPay recue sans configuration', { correlationId });
    return NextResponse.json({ error: 'Module de don indisponible.' }, { status: 503 });
  }

  const payload = await readPayload(request);
  const reference = readReference(payload);

  // Test de disponibilite de CinetPay : leur procedure envoie un POST
  // minimal et EXIGE un 200. Rien n'est ecrit, rien n'est conclu.
  if (reference.length === 0) {
    return NextResponse.json({ received: true, processed: false });
  }

  const notifyToken = asCleanString(payload.get('notify_token'));

  // --- 1. Controle indicatif du `notify_token` --------------------------
  // Un jeton qui ne correspond pas arrete tout. On repond tout de meme
  // 200 : CinetPay considere comme defaillante une url de notification qui
  // ne repond pas 200, et un acquittement sans effet ne donne rien a un
  // attaquant, la base n'ayant pas bouge d'un octet.
  if (notifyToken.length > 0) {
    const matches = await donationNotifyTokenMatches(
      reference,
      cinetpayNotifyTokenDigest(notifyToken),
      correlationId,
    );
    if (!matches) {
      console.warn('[ISE] don : notify_token CinetPay non concordant', {
        correlationId,
        reference,
      });
      return NextResponse.json({ received: true, processed: false });
    }
  }

  if (!isCinetpayTransactionIdAcceptable(reference)) {
    // Une reference plus longue que ce que la v2 accepte ne peut pas avoir
    // ete emise par nous pour cette plateforme : on ne l'interroge pas.
    console.warn('[ISE] don : reference CinetPay hors format v2', { correlationId, reference });
    return NextResponse.json({ received: true, processed: false });
  }

  // --- 2. LA SEULE PAROLE QUI COMPTE ------------------------------------
  const verification = await checkCinetpayTransaction(
    {
      baseUrl: secrets.baseUrl,
      apiKey: secrets.apiKey,
      apiPassword: secrets.apiPassword,
    },
    reference,
  );

  if (!verification.ok) {
    // On n'invente aucune issue : le don reste dans son etat, et un code
    // non-2xx invite CinetPay a renvoyer la notification plus tard.
    console.error('[ISE] don : verification CinetPay impossible', {
      correlationId,
      reference,
      reason: verification.reason,
    });
    return NextResponse.json({ received: true, processed: false }, { status: 503 });
  }

  const transaction = verification.transaction;

  await settleDonationNotification(
    {
      provider: 'cinetpay',
      // Cle d'idempotence fabriquee : meme transaction + meme statut
      // constate = meme evenement, donc aucun effet la seconde fois.
      externalEventId: `${reference}:${transaction.status || transaction.code}`,
      reference,
      outcome: transaction.outcome,
      providerReference: transaction.paymentMethod,
      providerStatus: transaction.status,
      // Montant CONFIRME PAR CINETPAY. La base le recompare a celui qui a
      // ete enregistre a la creation : un ecart n'est pas un succes.
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      failureReason: transaction.outcome === 'succeeded' ? null : transaction.status,
      payload: { code: transaction.code, status: transaction.status },
    },
    correlationId,
  );

  return NextResponse.json({ received: true });
}
