import { NextResponse, type NextRequest } from 'next/server';
import {
  DONATION_REFERENCE_PARAM,
  DONATION_ROUTES,
  donationReturnRoute,
} from '@/lib/routes/donations';

/**
 * PASSERELLE DE RETOUR DU DONATEUR.
 *
 * POURQUOI ELLE EXISTE : CinetPay ramene le donateur sur `return_url` par
 * une requete POST INTER-SITES. Les cookies de session Supabase sont
 * `SameSite=Lax` — ils ne partent PAS sur un POST venu d'un autre site. Sans
 * cette passerelle, le donateur atterrirait sur `/don/retour` sans session,
 * serait renvoye vers l'ecran de connexion en plein retour de paiement, et
 * croirait que quelque chose a echoue.
 *
 * CE QU'ELLE FAIT : elle lit la reference, et rien d'autre. Puis elle
 * redirige en 303 vers `/don/retour` — une navigation GET de premier niveau
 * vers notre propre origine, ou les cookies repartent normalement.
 *
 * CE QU'ELLE NE FAIT PAS : elle ne lit aucune base, n'ecrit rien, et ne
 * decide d'AUCUN statut de paiement. Elle est publique, donc appelable par
 * n'importe qui : c'est sans consequence, puisqu'elle ne fait que rediriger.
 * Le statut affiche a l'arrivee est relu en base sous la session du membre.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reference plausible uniquement : meme forme que la contrainte en base. */
function sanitizeReference(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return /^[A-Za-z0-9._-]{8,64}$/.test(trimmed) ? trimmed : null;
}

function destination(request: NextRequest, reference: string | null): URL {
  const path = reference === null ? DONATION_ROUTES.return : donationReturnRoute(reference);
  return new URL(path, request.nextUrl.origin);
}

export function GET(request: NextRequest): NextResponse {
  const reference =
    sanitizeReference(request.nextUrl.searchParams.get(DONATION_REFERENCE_PARAM)) ??
    sanitizeReference(request.nextUrl.searchParams.get('cpm_trans_id')) ??
    sanitizeReference(request.nextUrl.searchParams.get('transaction_id'));

  return NextResponse.redirect(destination(request, reference), 303);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let fromBody: string | null = null;
  try {
    const body = await request.text();
    const form = new URLSearchParams(body);
    fromBody =
      sanitizeReference(form.get('cpm_trans_id')) ?? sanitizeReference(form.get('transaction_id'));
  } catch {
    fromBody = null;
  }

  const reference =
    fromBody ?? sanitizeReference(request.nextUrl.searchParams.get(DONATION_REFERENCE_PARAM));

  // 303 : la suite est une navigation GET, meme si l'on arrive par POST.
  return NextResponse.redirect(destination(request, reference), 303);
}
