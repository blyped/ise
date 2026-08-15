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
const ALLOWED_CALLBACK_TARGETS: readonly string[] = [
  ROUTES.dashboard,
  ROUTES.resetPassword,
  // D-161 — cible des liens d'activation des comptes pre-crees.
  ROUTES.activateAccount,
];

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
 * D-201 — a la toute premiere connexion Google reussie, rattache
 * automatiquement le compte a un profil ISE `unclaimed` dont l'e-mail
 * correspond EXACTEMENT (apres normalisation) a l'adresse Google, si
 * et seulement si cette adresse est marquee verifiee par Google.
 *
 * Toute la logique de decision et de garde vit cote SQL
 * (`public.match_google_account_to_profile()`, SECURITY DEFINER,
 * n'accepte aucun parametre du client — uniquement `auth.uid()` et
 * `auth.identities` de la session en cours) : ce point d'entree ne
 * fait qu'appeler la RPC et avaler toute exception, exactement comme
 * `runAdminBootstrap`/`logAuthLinkEvent`. No-op silencieux si le
 * compte est deja rattache, si l'utilisateur ne vient pas de Google,
 * si l'e-mail n'est pas verifie, ou si aucun profil ne correspond —
 * dans tous ces cas, l'utilisateur atterrit simplement sur le tableau
 * de bord sans profil rattache (comportement inchange).
 */
async function matchGoogleAccountToProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('match_google_account_to_profile');
    if (error) {
      console.error('[ISE] rattachement automatique du compte Google', {
        correlationId: newCorrelationId(),
        code: error.code,
      });
    }
  } catch (unexpected) {
    console.error('[ISE] rattachement automatique du compte Google — exception avalee', {
      correlationId: newCorrelationId(),
      unexpected,
    });
  }
}

/**
 * Journalise CHAQUE atterrissage sur ce point d'entree (0119, D-173) :
 * `/auth/callback` est le SEUL endroit ou aboutit un clic sur un lien
 * d'e-mail Supabase (confirmation ISE-002, reinitialisation ISE-003,
 * activation D-161), qu'il s'agisse d'un succes ou d'un echec. Avant
 * cela, un lien invalide/expire et un lien jamais clique se
 * confondaient tous deux dans `auth.users.last_sign_in_at = null`.
 *
 * Enveloppe volontairement TOUT : l'insertion est une fonction annexe,
 * jamais un blocage de la redirection reelle. `error.code` (Supabase)
 * est typé `string | undefined` ; il est toujours normalisé en
 * `string | null` avant l'appel RPC (`errorCode ?? null`), pour ne
 * jamais assigner `undefined` à une clé de l'objet d'arguments
 * (`exactOptionalPropertyTypes`).
 */
async function logAuthLinkEvent(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  linkType: string,
  outcome: 'success' | 'error',
  userId: string | null,
  errorCode: string | null | undefined,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('log_auth_link_event', {
      p_link_type: linkType,
      p_outcome: outcome,
      p_user_id: userId,
      p_error_code: errorCode ?? null,
    });
    if (error) {
      console.error('[ISE] journalisation clic lien e-mail en echec', {
        correlationId: newCorrelationId(),
        code: error.code,
      });
    }
  } catch (unexpected) {
    console.error('[ISE] journalisation clic lien e-mail — exception avalee', {
      correlationId: newCorrelationId(),
      unexpected,
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await logAuthLinkEvent(supabase, 'code', 'success', user?.id ?? null, null);
      await runAdminBootstrap(supabase);
      await matchGoogleAccountToProfile(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    await logAuthLinkEvent(supabase, 'code', 'error', null, error.code);
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
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await logAuthLinkEvent(supabase, rawType, 'success', user?.id ?? null, null);
      await runAdminBootstrap(supabase);
      await matchGoogleAccountToProfile(supabase);
      return NextResponse.redirect(new URL(next, origin));
    }
    await logAuthLinkEvent(supabase, rawType, 'error', null, error.code);
    console.error('[ISE] vérification du lien e-mail', {
      correlationId: newCorrelationId(),
      code: error.code,
    });
  }

  return NextResponse.redirect(new URL(`${ROUTES.signIn}?raison=lien-invalide`, origin));
}
