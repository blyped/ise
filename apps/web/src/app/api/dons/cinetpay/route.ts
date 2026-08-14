import { NextResponse, type NextRequest } from 'next/server';
import { newCorrelationId } from '@/lib/correlation';
import { donationEnv } from '@/lib/env';
import { checkCinetpayTransaction, verifyCinetpayToken } from '@/lib/donations/cinetpay';
import { settleDonationNotification } from '@/lib/donations/settle';

/**
 * NOTIFICATION SERVEUR A SERVEUR DE CINETPAY (`notify_url`).
 *
 * DEUX CONTROLES, PAS UN SEUL — et c'est la recommandation explicite de
 * CinetPay :
 *
 *  1. AUTHENTICITE : le jeton HMAC `x-token` est recalcule a partir des
 *     seize champs du corps, dans l'ordre documente, avec la « Secret Key »
 *     du compte marchand, et compare a temps constant.
 *
 *  2. VERITE DU PAIEMENT : le corps de la notification NE CONTIENT PAS le
 *     statut. CinetPay le retient volontairement « pour eviter certaine
 *     faille de securite comme le man in the middle » et demande de
 *     « toujours effectuer un appel a l'API de Verification de transaction
 *     pour avoir les vraies valeurs du paiement ». On appelle donc
 *     `/v2/payment/check` A CHAQUE FOIS, meme quand le jeton est valide.
 *     Rien de ce que contient la notification ne decide de l'issue.
 *
 * IDEMPOTENCE : CinetPay previent que « l'url de notification peut etre
 * appelee plusieurs fois » et n'emet aucun identifiant d'evenement. On en
 * fabrique un, stable : `<transaction>:<statut constate>`. Une re-livraison
 * du meme etat est donc absorbee par la contrainte unique en base, tandis
 * qu'un veritable changement d'etat passe.
 *
 * GET : CinetPay « ping » l'URL pour verifier qu'elle repond. On renvoie 200
 * sans rien faire — c'est exige par leur procedure de validation.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(): NextResponse {
  return new NextResponse('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

/** Corps de la notification : formulaire (documente) ou JSON, par prudence. */
async function readForm(request: NextRequest): Promise<URLSearchParams> {
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
      // Corps illisible : on renvoie un formulaire vide, le traitement
      // s'arretera faute de `cpm_trans_id`.
    }
    return params;
  }

  return new URLSearchParams(rawBody);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const secrets = donationEnv().cinetpay;

  if (secrets === null) {
    console.error('[ISE] don : notification CinetPay recue sans configuration', { correlationId });
    return NextResponse.json({ error: 'Module de don indisponible.' }, { status: 503 });
  }

  const form = await readForm(request);
  const transactionId = (form.get('cpm_trans_id') ?? '').trim();

  // Test de disponibilite de CinetPay : leur procedure envoie un POST
  // minimal et EXIGE un 200. Rien n'est ecrit, rien n'est conclu.
  if (transactionId.length === 0) {
    return NextResponse.json({ received: true, processed: false });
  }

  // Jeton HMAC invalide : aucun traitement. On repond tout de meme 200,
  // parce que CinetPay considere comme defaillante une url de notification
  // qui ne repond pas 200 — et un acquittement sans effet ne donne rien a
  // un attaquant, la base n'ayant pas bouge d'un octet.
  if (!verifyCinetpayToken(form, request.headers.get('x-token'), secrets.secretKey)) {
    console.warn('[ISE] don : jeton HMAC CinetPay invalide', { correlationId, transactionId });
    return NextResponse.json({ received: true, processed: false });
  }

  const verification = await checkCinetpayTransaction(
    secrets.apiKey,
    secrets.siteId,
    transactionId,
  );

  if (!verification.ok) {
    // On n'invente aucune issue : le don reste dans son etat, et un code
    // non-2xx invite CinetPay a renvoyer la notification plus tard.
    console.error('[ISE] don : verification CinetPay impossible', {
      correlationId,
      transactionId,
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
      externalEventId: `${transactionId}:${transaction.status || transaction.code}`,
      reference: transactionId,
      outcome: transaction.outcome,
      providerReference: transaction.paymentMethod,
      providerStatus: transaction.status,
      amountMinor: transaction.amountMinor,
      currency: transaction.currency,
      failureReason: transaction.outcome === 'succeeded' ? null : transaction.status,
      payload: { code: transaction.code, status: transaction.status },
    },
    correlationId,
  );

  return NextResponse.json({ received: true });
}
