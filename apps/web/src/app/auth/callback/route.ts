import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { newCorrelationId } from '@/lib/correlation';
import { ROUTES } from '@/lib/routes';

const OTP_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
];

/**
 * ADDENDUM §5 — Liste blanche stricte des destinations de ce point d'entree.
 *
 * `safeRedirect` n'est volontairement **pas** utilisee ici : elle refuse les
 * ecrans d'authentification pour eviter les boucles, alors que la
 * recuperation de mot de passe doit precisement aboutir sur
 * `/reinitialiser-mot-de-passe`. Deux destinations sont emises par
 * l'application (ISE-002 et ISE-003) ; aucune autre n'est acceptee.
 */
const ALLOWED_CALLBACK_TARGETS: readonly string[] = [ROUTES.dashboard, ROUTES.resetPassword];

function safeNext(value: string | null): string {
  if (value === null) return ROUTES.dashboard;
  return ALLOWED_CALLBACK_TARGETS.includes(value) ? value : ROUTES.dashboard;
}

/**
 * Point d'atterrissage des liens envoyes par e-mail : confirmation d'adresse
 * (ISE-002) et recuperation de mot de passe (ISE-003 vers ISE-004).
 *
 * Les deux formats emis par Supabase sont acceptes : `?code=` (PKCE) et
 * `?token_hash=&type=` (lien classique).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('redirectTo') ?? searchParams.get('suivant'));
  const supabase = await createSupabaseServerClient();

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type');

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error('[ISE] échange du code de session', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  } else if (tokenHash && rawType && OTP_TYPES.includes(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) return NextResponse.redirect(new URL(next, origin));
    console.error('[ISE] vérification du lien e-mail', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  }

  return NextResponse.redirect(new URL(`${ROUTES.signIn}?raison=lien-invalide`, origin));
}
