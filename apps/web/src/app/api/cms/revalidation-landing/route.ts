import { NextResponse, type NextRequest } from 'next/server';
import { newCorrelationId } from '@/lib/correlation';
import { revalidateLanding } from '@/lib/public/revalidate-landing';

/**
 * ADDENDUM §46 — Point d'invalidation HTTP du cache de PUB-001.
 *
 * Contrat : `POST` avec l'en-tete `x-ise-revalidation-secret`. Il n'y a
 * volontairement **aucune** session : c'est un appel machine, emis par le CMS
 * apres une publication ou par une tache planifiee. Le CMS ne l'appelle pas
 * encore ; le point existe pour qu'il n'ait rien a inventer le jour venu.
 *
 * Securite :
 *  - le secret est lu dans l'environnement serveur. S'il n'est pas configure,
 *    la route repond 503 : elle n'est jamais ouverte « par defaut » ;
 *  - la comparaison est a temps constant, pour ne pas fuir le secret ;
 *  - `GET` n'est pas expose : une invalidation est un effet de bord.
 */

export const dynamic = 'force-dynamic';

const SECRET_HEADER = 'x-ise-revalidation-secret';

/** Comparaison a temps constant, sans dependance externe. */
function secretMatches(expected: string, received: string): boolean {
  if (expected.length !== received.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return difference === 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = newCorrelationId();
  const expected = process.env.CMS_REVALIDATION_SECRET ?? '';

  if (expected.length === 0) {
    console.error('[ISE] CMS_REVALIDATION_SECRET absent : invalidation refusée', {
      correlationId,
    });
    return NextResponse.json(
      { error: 'Invalidation indisponible.', correlationId },
      { status: 503 },
    );
  }

  const received = request.headers.get(SECRET_HEADER) ?? '';
  if (!secretMatches(expected, received)) {
    console.warn('[ISE] invalidation de landing refusée', { correlationId });
    return NextResponse.json({ error: 'Accès refusé.', correlationId }, { status: 401 });
  }

  const { revalidatedAt } = await revalidateLanding();
  console.info('[ISE] landing invalidée', { correlationId, revalidatedAt });
  return NextResponse.json({ revalidated: true, revalidatedAt, correlationId });
}
