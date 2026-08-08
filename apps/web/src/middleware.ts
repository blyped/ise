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
 */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, user } = await updateSession(request);

  const isPublic = isPublicPath(pathname);

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = ROUTES.signIn;
    target.search = '';
    target.searchParams.set('raison', 'session');
    // ADDENDUM §4 : `redirectTo` est le nom canonique du parametre de retour.
    target.searchParams.set('redirectTo', `${pathname}${search}`);
    const redirection = NextResponse.redirect(target);
    redirection.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
    return redirection;
  }

  // Une session valide n'a rien a faire sur les ecrans de connexion.
  if (user && (pathname === ROUTES.signIn || pathname === ROUTES.signUp)) {
    const target = request.nextUrl.clone();
    target.pathname = ROUTES.dashboard;
    target.search = '';
    return NextResponse.redirect(target);
  }

  /*
   * ADDENDUM §53 : aucune ressource privee ne doit etre indexee. Le layout
   * racine pose deja `robots: noindex`, mais une reponse non HTML (fichier,
   * flux, reponse d'API) ne porte pas de balise `<meta>`. L'en-tete, lui, les
   * couvre toutes.
   */
  if (!isPublic) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }

  return response;
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
