import { NextResponse, type NextRequest } from 'next/server';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadDonationByReference } from '@/lib/queries/donations';
import type { DonationStatus } from '@/lib/donations/shared';

/**
 * STATUT CANONIQUE D'UN DON, POUR LE SDK `cinetpay-seamless` (D-218).
 *
 * Le guichet CinetPay peut finaliser un paiement (en particulier un
 * paiement mobile money confirme par code sur le telephone du donateur)
 * SANS jamais envoyer le `postMessage` que la popup utilise normalement
 * pour prevenir la page d'origine. Le SDK sait interroger un point de
 * terminaison HTTP a intervalle regulier (`statusUrl`) pour combler ce
 * trou ; c'est cette route.
 *
 * ELLE NE REINTERROGE PAS CINETPAY : elle relit simplement l'etat que
 * `settle_donation_notification()` a deja pose en base (`lib/donations/
 * settle.ts`), exactement comme la page `/don/retour`. La notification
 * serveur a serveur de CinetPay reste la SEULE source qui fait avancer un
 * don ; cette route ne fait qu'exposer ce qui est deja constate, sous la
 * session du membre — jamais sous la foi d'un parametre d'URL.
 *
 * OWNERSHIP : `get_my_donation()` (appelee par `loadDonationByReference`)
 * ne renvoie que les dons du membre courant, RLS a l'appui. Une reference
 * devinee par un tiers ne renvoie rien.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REFERENCE_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Vocabulaire que le SDK sait reconnaitre (`normalizeStatus`), voir son README. */
function toSeamlessStatus(status: DonationStatus): string {
  switch (status) {
    case 'succeeded':
      return 'ACCEPTED';
    case 'failed':
    case 'cancelled':
      return 'REFUSED';
    case 'pending':
    case 'processing':
    default:
      return 'PENDING';
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const reference = (request.nextUrl.searchParams.get('ref') ?? '').trim();

  if (!REFERENCE_PATTERN.test(reference)) {
    return NextResponse.json({ status: 'UNKNOWN' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Pas de session : ni erreur bruyante, ni fuite d'information. Le SDK
    // continuera de se fier au `postMessage` (ou au lien de secours affiche
    // par le formulaire).
    return NextResponse.json({ status: 'UNKNOWN' }, { status: 401 });
  }

  const result = await loadDonationByReference(reference, correlationId);
  if (!result.ok || result.data === null) {
    return NextResponse.json({ status: 'UNKNOWN' }, { status: 404 });
  }

  return NextResponse.json({
    status: toSeamlessStatus(result.data.status),
    merchant_transaction_id: result.data.reference,
  });
}
