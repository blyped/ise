import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';
import { ROUTES, isPublicPath } from './lib/routes';

/**
 * Protege toutes les routes applicatives.
 *
 * ADDENDUM §2 : la racine `/` (PUB-001) est desormais **publique**, au meme
 * titre que `/connexion`, `/creer-compte`, `/mot-de-passe-oublie`,
 * `/reinitialiser-mot-de-passe` et les routes systeme. Tout le reste continue
 * d'exiger une session.
 *
 * La session est rafraichie a chaque passage : c'est le seul endroit ou les
 * cookies Supabase sont reecrits pour l'ensemble de l'application.
 *
 * INSTRUMENTATION TEMPORAIRE (a retirer) : un 500 non explique se produit
 * pour /reclamer-mon-profil (digest 1724077822, TypeError: Cannot convert
 * undefined or null to object, at Object.keys). Chaque etape logge un
 * marqueur avant de s'executer pour isoler la ligne exacte en cas de
 * nouvelle occurrence, avec la stack complete de l'erreur.
 */
export async function middleware(request: NextRequest) {
  let step = 'start';
  try {
    step = 'read-nextUrl';
    const { pathname, search } = request.nextUrl;

    step = 'updateSession';
    const { response, user } = await updateSession(request);

    step = 'isPublicPath';
    const isPublic = isPublicPath(pathname);

    if (!user && !isPublic) {
      step = 'build-signin-redirect';
      const target = request.nextUrl.clone();
      target.pathname = ROUTES.signIn;
      target.search = '';
      target.searchParams.set('raison', 'session');
      // ADDENDUM §4 : `redirectTo` est le nom canonique du parametre de retour.
      target.searchParams.set('redirectTo', `${pathname}${search}`);
      step = 'NextResponse.redirect-signin';
      const redirection = NextResponse.redirect(target);
      step = 'set-robots-header-redirect';
      redirection.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
      return redirection;
    }

    // Une session valide n'a rien a faire sur les ecrans de connexion.
    if (user && (pathname === ROUTES.signIn || pathname === ROUTES.signUp)) {
      step = 'build-dashboard-redirect';
      const target = request.nextUrl.clone();
      target.pathname = ROUTES.dashboard;
      target.search = '';
      return NextResponse.redirect(target);
    }

    if (!isPublic) {
      step = 'set-robots-header-response';
      response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    }

    step = 'return-response';
    return response;
  } catch (error) {
    console.error('[ISE][DEBUG middleware]', {
      path: request.nextUrl.pathname,
      step,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    throw error;
  }
}

export const config = {
  matcher: [
    /*
     * Toutes les routes, sauf :
     *  - les ressources internes de Next (`_next/static`, `_next/image`) ;
     *  - les fichiers statiques servis depuis `public/`.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)',
  ],
};
