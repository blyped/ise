import { NextResponse, type NextRequest } from 'next/server';
import { newCorrelationId } from '@/lib/correlation';
import { donationEnv } from '@/lib/env';
import { verifyStripeSignature } from '@/lib/donations/stripe';
import { settleDonationNotification, type DonationOutcome } from '@/lib/donations/settle';

/**
 * NOTIFICATION SERVEUR A SERVEUR DE STRIPE.
 *
 * C'est la SEULE facon dont un don Stripe peut devenir « reussi ». La page
 * de retour du donateur ne prouve rien : son URL est publique et rejouable.
 *
 * TROIS GARANTIES :
 *
 *  1. AUTHENTICITE — l'en-tete `Stripe-Signature` est verifie contre le
 *     secret du point de terminaison, sur le corps BRUT (`request.text()`,
 *     jamais un objet re-serialise), avec une tolerance de 5 minutes contre
 *     le rejeu. Signature invalide -> 400, et rien n'est ecrit.
 *
 *  2. IDEMPOTENCE — l'identifiant d'evenement (`evt_...`), stable a travers
 *     les reessais de Stripe, sert de cle unique en base. Une meme
 *     notification recue deux fois ne cree pas deux dons.
 *
 *  3. MONTANT — c'est `amount_total` renvoye par Stripe qui est transmis a
 *     la base, qui le recompare au montant enregistre avant de conclure.
 *
 * Aucune donnee de carte n'arrive ici : Stripe n'en envoie pas, et nous n'en
 * demandons pas.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Types d'evenement REELLEMENT traites. Tout le reste est acquitte sans
 * effet : ecouter large chargerait le serveur pour rien, et surtout
 * conduirait a interpreter des evenements dont le sens ne nous concerne pas.
 */
function outcomeFor(eventType: string, session: Record<string, unknown>): DonationOutcome | null {
  switch (eventType) {
    case 'checkout.session.completed':
      // Un paiement differe (virement, prelevement) revient ici NON paye :
      // on ne conclut donc pas au succes sur le seul fait que la session
      // soit « completee ».
      return session['payment_status'] === 'paid' ? 'succeeded' : 'pending';
    case 'checkout.session.async_payment_succeeded':
      return 'succeeded';
    case 'checkout.session.async_payment_failed':
      return 'failed';
    case 'checkout.session.expired':
      return 'cancelled';
    default:
      return null;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const secrets = donationEnv().stripe;

  if (secrets === null) {
    // Module non configure : la route existe mais ne peut rien verifier.
    // On le dit franchement plutot que d'accepter n'importe quoi.
    console.error('[ISE] don : notification Stripe recue sans configuration', { correlationId });
    return NextResponse.json({ error: 'Module de don indisponible.' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!verifyStripeSignature(rawBody, signature, secrets.webhookSecret)) {
    console.warn('[ISE] don : signature Stripe invalide', { correlationId });
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Charge utile illisible.' }, { status: 400 });
  }

  const record = asRecord(event);
  const eventId = asText(record['id']);
  const eventType = asText(record['type']);
  const session = asRecord(asRecord(record['data'])['object']);

  if (eventId === null || eventType === null) {
    return NextResponse.json({ error: 'Charge utile incomplete.' }, { status: 400 });
  }

  const outcome = outcomeFor(eventType, session);
  if (outcome === null) {
    // Acquitte, sans effet : Stripe cesse de reessayer, la base est intacte.
    return NextResponse.json({ received: true, processed: false });
  }

  const reference =
    asText(session['client_reference_id']) ??
    asText(asRecord(session['metadata'])['donation_reference']);

  if (reference === null) {
    console.warn('[ISE] don : notification Stripe sans reference', { correlationId, eventType });
    return NextResponse.json({ received: true, processed: false });
  }

  const amountTotal = session['amount_total'];
  const currency = asText(session['currency']);

  await settleDonationNotification(
    {
      provider: 'stripe',
      externalEventId: eventId,
      reference,
      outcome,
      providerReference: asText(session['id']),
      providerStatus: asText(session['payment_status']) ?? asText(session['status']),
      amountMinor: typeof amountTotal === 'number' ? Math.round(amountTotal) : null,
      currency: currency === null ? null : currency.toUpperCase(),
      failureReason: outcome === 'succeeded' ? null : eventType,
      payload: { event_type: eventType, event_id: eventId },
    },
    correlationId,
  );

  // On repond toujours 200 apres traitement : le verdict metier (doublon,
  // ecart de montant…) est journalise cote base, il ne se traduit pas par
  // un echec HTTP qui ferait reessayer Stripe indefiniment.
  return NextResponse.json({ received: true });
}
