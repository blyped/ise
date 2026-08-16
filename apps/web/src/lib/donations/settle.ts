import { createClient } from '@supabase/supabase-js';
import type { Database } from '@ise/db-types';
import { serverEnv } from '@/lib/env';
import { sendEmail } from '@/lib/email/resend';
import { frDonations, tdon } from '@/i18n/donations';
import { DONATION_ROUTES } from '@/lib/routes/donations';
import { formatDonationAmount, type DonationProvider } from './shared';

/** Echappement minimal avant interpolation dans un corps d'e-mail HTML (meme fonction que `app/promotions/actions.ts`). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * UNIQUE point d'ecriture du resultat d'un paiement.
 *
 * POURQUOI LE ROLE SERVEUR ET PAS LA SESSION DU DONATEUR :
 * `public.settle_donation_notification()` est REVOQUEE pour `anon` et pour
 * `authenticated` (migration 0134). Personne, meme connecte, ne peut la
 * declencher depuis un navigateur — c'est ce qui rend impossible de
 * s'auto-declarer donateur en rejouant une URL de retour. Seul le role
 * serveur, utilise ici et nulle part ailleurs dans le module de don, y a
 * acces, et uniquement APRES verification de la signature du prestataire.
 *
 * IDEMPOTENCE : la fonction absorbe elle-meme les re-livraisons grace a la
 * contrainte unique (prestataire, identifiant d'evenement). Ce module n'a
 * donc rien a dedupliquer : il transmet, et lit le verdict.
 */

export type DonationOutcome = 'succeeded' | 'failed' | 'cancelled' | 'pending';

export interface SettleDonationInput {
  readonly provider: DonationProvider;
  /**
   * Identifiant d'evenement du prestataire. Stripe fournit `evt_...`, stable
   * a travers ses reessais. CinetPay n'en fournit aucun : l'appelant compose
   * une cle stable a partir de la transaction et du statut CONSTATE, de
   * sorte qu'une re-livraison du meme etat ne produise aucun effet.
   */
  readonly externalEventId: string;
  readonly reference: string;
  readonly outcome: DonationOutcome;
  readonly providerReference: string | null;
  readonly providerStatus: string | null;
  /** Montant CONFIRME par le prestataire. La base le recompare au montant enregistre. */
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly failureReason: string | null;
  readonly payload: Record<string, unknown>;
}

export interface SettleDonationResult {
  readonly ok: boolean;
  /**
   * Verdict de la base : `updated`, `duplicate`, `already_succeeded`,
   * `still_pending`, `unchanged`, `unknown_reference`, `amount_mismatch`,
   * `amount_unverifiable`, ou `error` si l'appel lui-meme a echoue.
   */
  readonly result: string;
}

/**
 * Client Supabase au role serveur. Cree a la demande, sans session : il ne
 * sert QUE dans les gestionnaires de notification, jamais dans un rendu.
 */
function createServiceRoleClient() {
  const env = serverEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}


/**
 * D-219 (16/08/2026) — e-mail de remerciement, envoye UNE SEULE FOIS par
 * don : seulement quand `settle_donation_notification()` vient de faire
 * franchir ce don precis a `succeeded` (jamais sur une relivraison, jamais
 * sur `already_succeeded`). `donation_receipt_info()` est, comme cette
 * fonction, reservee a `service_role` (0156) : ni un navigateur donateur,
 * ni un administrateur connecte ne peut la lire directement.
 *
 * Un e-mail introuvable (profil sans adresse connue) ou un envoi en echec
 * n'annulent RIEN : le don reste `succeeded`, seul le courrier manque. On
 * journalise, on ne relance pas — la page « Mes dons » reste la source de
 * verite, quoi qu'il arrive du cote de la boite mail.
 */
async function sendDonationReceiptEmail(
  client: ReturnType<typeof createServiceRoleClient>,
  donationId: string,
  correlationId: string,
): Promise<void> {
  const { data, error } = await client.rpc('donation_receipt_info', {
    p_donation_id: donationId,
  });

  if (error) {
    console.warn('[ISE] don : lecture des coordonnees du recu impossible', {
      correlationId,
      code: error.code,
    });
    return;
  }

  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const donorEmail = typeof record['donor_email'] === 'string' ? record['donor_email'] : null;
  const reference = typeof record['reference'] === 'string' ? record['reference'] : null;
  const amountMinor = typeof record['amount_minor'] === 'number' ? record['amount_minor'] : null;
  const currency = typeof record['currency'] === 'string' ? record['currency'] : null;
  const exponent =
    typeof record['minor_unit_exponent'] === 'number' ? record['minor_unit_exponent'] : 0;
  const donorName =
    typeof record['donor_display_name'] === 'string' ? record['donor_display_name'] : null;

  if (donorEmail === null || reference === null || amountMinor === null || currency === null) {
    console.warn('[ISE] don : recu non envoye (coordonnees incompletes)', {
      correlationId,
      donationId,
    });
    return;
  }

  const amountLabel = formatDonationAmount(amountMinor, currency, exponent);
  const greeting = donorName !== null ? `Bonjour ${escapeHtml(donorName)},` : 'Bonjour,';
  const bodyText = tdon(frDonations.receiptEmail.body, { amount: amountLabel, reference });
  const siteUrl = serverEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const link = `${siteUrl}${DONATION_ROUTES.home}`;

  const sent = await sendEmail({
    to: donorEmail,
    subject: frDonations.receiptEmail.subject,
    html:
      `<p>${greeting}</p>` +
      `<p>${escapeHtml(bodyText)}</p>` +
      `<p><a href="${link}">${escapeHtml(frDonations.receiptEmail.cta)}</a></p>`,
    text: `${bodyText}\n\n${frDonations.receiptEmail.cta} : ${link}`,
  });

  if (!sent.ok) {
    console.warn('[ISE] don : envoi du recu en echec', { correlationId, donationId });
  }
}

export async function settleDonationNotification(
  input: SettleDonationInput,
  correlationId: string,
): Promise<SettleDonationResult> {
  let client: ReturnType<typeof createServiceRoleClient>;
  try {
    client = createServiceRoleClient();
  } catch {
    // Variables serveur incompletes : on le dit, on n'invente rien.
    console.error('[ISE] don : configuration serveur incomplete', { correlationId });
    return { ok: false, result: 'error' };
  }

  const { data, error } = await client.rpc('settle_donation_notification', {
    p_provider: input.provider,
    p_external_event_id: input.externalEventId,
    p_reference: input.reference,
    p_outcome: input.outcome,
    p_provider_reference: input.providerReference,
    p_provider_status: input.providerStatus,
    p_amount_minor: input.amountMinor,
    p_currency: input.currency,
    p_failure_reason: input.failureReason,
    p_payload: input.payload,
  });

  if (error) {
    console.error('[ISE] don : reglement de notification en echec', {
      correlationId,
      provider: input.provider,
      code: error.code,
    });
    return { ok: false, result: 'error' };
  }

  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const result = typeof record['result'] === 'string' ? record['result'] : 'unknown';

  console.info('[ISE] don : notification traitee', {
    correlationId,
    provider: input.provider,
    outcome: input.outcome,
    result,
  });

  // D-219 — recu envoye seulement au VRAI franchissement vers `succeeded`.
  if (result === 'updated' && record['status'] === 'succeeded') {
    const donationId = typeof record['donation_id'] === 'string' ? record['donation_id'] : null;
    if (donationId !== null) {
      await sendDonationReceiptEmail(client, donationId, correlationId);
    }
  }

  return { ok: true, result };
}

/**
 * PREMIER CONTROLE D'AUTHENTICITE D'UNE NOTIFICATION CINETPAY v2 (0135).
 *
 * La v2 ne signe pas ses notifications : elle remet a l'initiation un
 * `notify_token` a usage unique et le renvoie ensuite. On en a conserve
 * l'EMPREINTE dans le schema prive ; on compare des empreintes, jamais des
 * jetons.
 *
 * Comme `settle_donation_notification()`, la fonction appelee ici est
 * REVOQUEE pour `anon` et `authenticated` : seul le role serveur y accede.
 *
 * TOLERANCE ASSUMEE : `true` quand il n'y a rien a comparer (aucune
 * empreinte conservee). Refuser dans ce cas ferait perdre des paiements
 * REELS, alors que ce controle n'a jamais eu vocation a etablir l'issue —
 * c'est la reverification aupres de CinetPay qui tranche, et elle n'est
 * jamais facultative. En revanche, une erreur d'appel renvoie `false` : on
 * ne traite pas une notification qu'on n'a pas pu qualifier.
 */
export async function donationNotifyTokenMatches(
  reference: string,
  digest: string,
  correlationId: string,
): Promise<boolean> {
  let client: ReturnType<typeof createServiceRoleClient>;
  try {
    client = createServiceRoleClient();
  } catch {
    console.error('[ISE] don : configuration serveur incomplete', { correlationId });
    return false;
  }

  const { data, error } = await client.rpc('donation_notify_token_matches', {
    p_reference: reference,
    p_digest: digest,
  });

  if (error) {
    console.error('[ISE] don : controle du notify_token impossible', {
      correlationId,
      code: error.code,
    });
    return false;
  }

  return data === true;
}
