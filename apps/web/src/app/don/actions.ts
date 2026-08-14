'use server';

import { redirect } from 'next/navigation';
import { newCorrelationId } from '@/lib/correlation';
import { failure, type FormState } from '@/lib/form-state';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { donationEnv, serverEnv } from '@/lib/env';
import { frDonations } from '@/i18n/donations';
import { DONATION_ROUTES, donationFailureRoute, donationReturnRoute } from '@/lib/routes/donations';
import { createStripeCheckoutSession } from '@/lib/donations/stripe';
import { createCinetpayPayment } from '@/lib/donations/cinetpay';
import { isDonationProvider } from '@/lib/donations/shared';
import { loadDonationCurrencyRules } from '@/lib/queries/donations';

/**
 * OUVERTURE DU GUICHET DE PAIEMENT.
 *
 * ORDRE DES OPERATIONS, ET POURQUOI IL EST DANS CET ORDRE :
 *
 *   1. `start_donation()` enregistre l'INTENTION en base et rend une
 *      reference. CinetPay le demande explicitement : « il faut enregistrer
 *      les informations sur le paiement dans la base de donnees avant
 *      d'afficher le guichet ». Sans cela, une notification arriverait sans
 *      rien a quoi la rattacher.
 *
 *   2. LE MONTANT QUI PART CHEZ LE PRESTATAIRE EST CELUI QUE LA BASE A
 *      RENVOYE, pas celui du formulaire. Le navigateur propose ; la base
 *      dispose. `start_donation()` refuse tout montant hors bornes, mal
 *      aligne sur le pas ou dans une devise inconnue, et c'est sa reponse
 *      — relue ci-dessous — qui alimente l'appel au prestataire. Un
 *      formulaire trafique ne peut donc pas faire partir un autre montant
 *      que celui qui est enregistre.
 *
 *   3. `mark_donation_redirected()` note le passage au guichet. Ce n'est PAS
 *      un succes : aucun statut de paiement n'est pose ici, ni maintenant,
 *      ni au retour de l'utilisateur. Seule la notification serveur a
 *      serveur, verifiee, peut declarer un don reussi.
 *
 * Aucune cle n'apparait dans ce fichier : elles sont lues par `donationEnv()`
 * depuis l'environnement, cote serveur uniquement.
 */

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function readInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10);
  return null;
}

function readText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function startDonationAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const correlationId = newCorrelationId();

  const provider = readText(formData.get('provider'));
  if (!isDonationProvider(provider)) {
    return failure(frDonations.form.errorProvider, correlationId, {
      provider: frDonations.form.errorProvider,
    });
  }

  const secrets = donationEnv();
  const providerSecrets = provider === 'stripe' ? secrets.stripe : secrets.cinetpay;
  if (providerSecrets === null) {
    return failure(frDonations.form.errorProviderUnavailable, correlationId);
  }

  const requestedAmount = readInteger(readText(formData.get('amountMinor')));
  if (requestedAmount === null || requestedAmount <= 0) {
    return failure(frDonations.form.errorAmount, correlationId, {
      amountMinor: frDonations.form.errorAmount,
    });
  }

  // La devise n'est JAMAIS choisie par le navigateur : elle decoule du
  // prestataire, d'apres le referentiel (une devise = un prestataire).
  const rules = await loadDonationCurrencyRules();
  const rule = rules.find((candidate) => candidate.provider === provider);
  if (rule === undefined) {
    return failure(frDonations.form.errorProviderUnavailable, correlationId);
  }

  const isAnonymous = formData.get('isAnonymous') !== null;
  const message = readText(formData.get('message'));

  const supabase = await createSupabaseServerClient();

  // --- 1. Intention enregistree, montant revalide en base ---------------
  const { data: created, error: startError } = await supabase.rpc('start_donation', {
    p_amount_minor: requestedAmount,
    p_currency: rule.currency,
    p_is_anonymous: isAnonymous,
    p_message: message.length > 0 ? message : null,
  });

  if (startError) {
    console.error('[ISE] don : creation refusee', { correlationId, code: startError.code });
    return failure(frDonations.form.errorAmount, correlationId, {
      amountMinor: frDonations.form.errorAmount,
    });
  }

  const rows = Array.isArray(created) ? created : [];
  const row = asRecord(rows[0]);
  const donationId = typeof row['donation_id'] === 'string' ? row['donation_id'] : null;
  const reference = typeof row['reference'] === 'string' ? row['reference'] : null;
  // --- 2. Montant FAISANT FOI : celui que la base a accepte -------------
  const authoritativeAmount = readInteger(row['amount_minor']);
  const authoritativeCurrency =
    typeof row['currency'] === 'string' ? row['currency'].trim().toUpperCase() : null;

  if (
    donationId === null ||
    reference === null ||
    authoritativeAmount === null ||
    authoritativeCurrency === null
  ) {
    console.error('[ISE] don : reponse de creation inexploitable', { correlationId });
    return failure(frDonations.form.errorGateway, correlationId);
  }

  const siteUrl = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  let gatewayUrl: string | null = null;
  let providerReference: string | null = null;

  if (provider === 'stripe' && secrets.stripe !== null) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const email = user?.email;

    const session = await createStripeCheckoutSession({
      secretKey: secrets.stripe.secretKey,
      amountMinor: authoritativeAmount,
      currency: authoritativeCurrency,
      reference,
      // Stripe renvoie le donateur par une navigation GET vers notre propre
      // origine : les cookies de session repartent normalement.
      successUrl: `${siteUrl}${donationReturnRoute(reference)}`,
      cancelUrl: `${siteUrl}${donationFailureRoute(reference)}`,
      customerEmail: typeof email === 'string' && email.length > 0 ? email : null,
      productName: frDonations.title,
    });

    if (!session.ok) {
      console.error('[ISE] don : guichet Stripe indisponible', {
        correlationId,
        reason: session.reason,
      });
      return failure(frDonations.form.errorGateway, correlationId);
    }
    gatewayUrl = session.url;
    providerReference = session.sessionId;
  }

  if (provider === 'cinetpay' && secrets.cinetpay !== null) {
    const payment = await createCinetpayPayment({
      apiKey: secrets.cinetpay.apiKey,
      siteId: secrets.cinetpay.siteId,
      reference,
      amount: authoritativeAmount,
      currency: authoritativeCurrency,
      description: frDonations.title,
      notifyUrl: `${siteUrl}${DONATION_ROUTES.cinetpayWebhook}`,
      // CinetPay renvoie le donateur par un POST INTER-SITES : on passe par
      // la passerelle publique, qui redirige ensuite en GET (cf.
      // `lib/routes/donations.ts`).
      returnUrl: `${siteUrl}${DONATION_ROUTES.returnBridge}`,
    });

    if (!payment.ok) {
      console.error('[ISE] don : guichet CinetPay indisponible', {
        correlationId,
        reason: payment.reason,
      });
      return failure(frDonations.form.errorGateway, correlationId);
    }
    gatewayUrl = payment.url;
    providerReference = payment.token;
  }

  if (gatewayUrl === null) {
    return failure(frDonations.form.errorGateway, correlationId);
  }

  // --- 3. Passage au guichet constate. Toujours pas un paiement. --------
  const { error: markError } = await supabase.rpc('mark_donation_redirected', {
    p_donation_id: donationId,
    p_provider_reference: providerReference,
  });
  if (markError) {
    // Non bloquant : le guichet est ouvert, la notification saura rattacher
    // le don par sa reference. On journalise, on n'annule rien.
    console.warn('[ISE] don : suivi de redirection non enregistre', {
      correlationId,
      code: markError.code,
    });
  }

  // `redirect` leve : rien ne doit suivre, et surtout aucun `try` autour.
  redirect(gatewayUrl);
}
