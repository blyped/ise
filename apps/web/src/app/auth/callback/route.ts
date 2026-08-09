import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { newCorrelationId } from '@/lib/correlation';
import { MEMBER_ROUTE_PREFIXES, matchesRoutePrefix, ROUTES } from '@/lib/routes';

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

/**
 * ADDENDUM Google OAuth — la connexion par mot de passe (ISE-001) autorise
 * n'importe quelle route membre en retour via `safeRedirect` ; ce point
 * d'atterrissage restait limite a deux cibles fixes (email de confirmation,
 * reinitialisation). Un flux OAuth transite lui aussi par ici et doit
 * pouvoir revenir sur la ressource demandee avant la redirection vers
 * Google : la liste blanche des prefixes membre couvre ce cas, sans rouvrir
 * de redirection ouverte (toujours liste blanche, jamais l'entree brute).
 */
function safeNext(value: string | null): string {
  if (value === null) return ROUTES.dashboard;
  if (ALLOWED_CALLBACK_TARGETS.includes(value)) return value;
  return matchesRoutePrefix(value, MEMBER_ROUTE_PREFIXES) ? value : ROUTES.dashboard;
}

/**
 * Amorce le tout premier compte administrateur (migration 0086) si l'e-mail
 * qui vient de se connecter figure dans la liste blanche
 * `private.platform_bootstrap_admins`. No-op silencieux pour tout autre
 * compte : le tri se fait cote SQL, ceci n'est qu'un appel systematique et
 * inoffensif apres toute connexion reussie (mot de passe, Google, lien).
 */
async function runAdminBootstrap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<void> {
  const { error } = await supabase.rpc('bootstrap_admin_profile');
  if (error) {
    console.error('[ISE] amorçage admin', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  }
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
    if (!error) {
      await runAdminBootstrap(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error('[ISE] échange du code de session', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  } else if (tokenHash && rawType && OTP_TYPES.includes(rawType as EmailOtpType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType as EmailOtpType,
      token_hash: tokenHash,
    });
    if (!error) {
      await runAdminBootstrap(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    console.error('[ISE] vérification du lien e-mail', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  }

  return NextResponse.redirect(new URL(`${ROUTES.signIn}?raison=lien-invalide`, origin));
}
