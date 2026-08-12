/** Chemins de l'application Web, en francais (MASTER PROMPT §66). */
export const ROUTES = {
  /**
   * PUB-001 — Landing publique (ADDENDUM §2).
   * La racine n'est plus l'ecran de connexion : elle est ouverte a tous.
   */
  home: '/',
  signIn: '/connexion',
  signUp: '/creer-compte',
  forgotPassword: '/mot-de-passe-oublie',
  resetPassword: '/reinitialiser-mot-de-passe',
  /**
   * D-161 — Activation d'un compte pre-cree (provisioning du recensement).
   * Cible du lien d'invitation Supabase : la session est ouverte par
   * `/auth/callback` (type=invite), l'ecran fait choisir le mot de passe
   * puis conduit au tableau de bord — le profil est deja lie et rempli.
   */
  activateAccount: '/activer-mon-compte',
  signOut: '/deconnexion',
  authCallback: '/auth/callback',
  dashboard: '/tableau-de-bord',
  sessionExpired: '/session-expiree',
  accessDenied: '/acces-refuse',

  /** ISE-005 — Rechercher son profil reference. */
  claimSearch: '/reclamer-mon-profil',
  /** ISE-007 — Etat de la reclamation en cours. */
  claimVerification: '/reclamer-mon-profil/verification',

  /**
   * ISE-070 (suite) — Recuperation d'une invitation de promotion. Route
   * membre (pas publique) : la personne invitee doit d'abord avoir un
   * compte pour que le jeton puisse etre rattache a son `user_id`.
   */
  invitation: '/invitation',

  /**
   * ADDENDUM §46 — Point d'invalidation ciblee du cache de PUB-001.
   * Appelable par le CMS apres une publication. Protege par un secret
   * partage, jamais par une session : c'est un appel machine.
   */
  landingRevalidation: '/api/cms/revalidation-landing',
} as const;

/** ISE-006 — Confirmer l'association d'un profil precis. */
export function claimConfirmRoute(profileId: string): string {
  return `${ROUTES.claimSearch}/${encodeURIComponent(profileId)}`;
}

/** ISE-070 (suite) — Ecran de recuperation d'une invitation, jeton en clair. */
export function invitationRoute(token: string): string {
  return `${ROUTES.invitation}/${encodeURIComponent(token)}`;
}

/**
 * Routes accessibles sans session. Tout le reste est protege par
 * `src/middleware.ts`.
 *
 * ADDENDUM §2 : `ROUTES.home` a rejoint cette liste. Elle est traitee a part
 * dans `isPublicPath` — un prefixe `/` rendrait tout le site public.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  ROUTES.home,
  ROUTES.signIn,
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  // D-161 — publique pour pouvoir DIRE « lien expire » a un visiteur sans
  // session, au lieu de le rebondir muettement vers l'ecran de connexion.
  // Avec session, l'ecran montre le choix du mot de passe ; sans session,
  // il n'expose rien d'autre que le message et un lien de recuperation.
  ROUTES.activateAccount,
];

/** Ecrans systeme : joignables dans tous les cas, connecte ou non. */
export const SYSTEM_ROUTES: readonly string[] = [
  ROUTES.authCallback,
  ROUTES.sessionExpired,
  ROUTES.accessDenied,
  ROUTES.landingRevalidation,
];

/**
 * Prefixes des ecrans d'authentification. Une cible `redirectTo` qui pointe
 * vers l'un d'eux serait une boucle : ils sont refuses par `safeRedirect`
 * (ADDENDUM §5).
 */
export const AUTH_ROUTE_PREFIXES: readonly string[] = [
  ROUTES.signIn,
  ROUTES.signUp,
  ROUTES.forgotPassword,
  ROUTES.resetPassword,
  ROUTES.activateAccount,
  ROUTES.signOut,
  ROUTES.authCallback,
  ROUTES.sessionExpired,
];

/**
 * Liste blanche des cibles de redirection apres authentification.
 *
 * ADDENDUM §5 exige une « route autorisee », pas seulement un chemin
 * relatif : une cible inconnue est refusee, meme si elle est syntaxiquement
 * interne. Cette liste enumere les prefixes reels de l'espace membre ;
 * elle grandit avec les tranches verticales.
 */
export const MEMBER_ROUTE_PREFIXES: readonly string[] = [
  '/tableau-de-bord',
  '/mon-profil',
  '/ma-disponibilite',
  '/profil',
  '/rechercher',
  '/reseau',
  '/appels',
  '/opportunites',
  '/candidatures',
  '/messages',
  '/notifications',
  '/parametres',
  '/aide',
  '/bienvenue',
  '/reclamer-mon-profil',
  '/invitation',
  '/collaborer',
  '/promotions',
  '/stages',
  '/mentorat',
  '/communautes',
  '/projets',
  '/actualites',
  '/evenements',
  '/administration',
];

/** Retire la barre finale, sauf sur la racine. */
function withoutTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

/** `true` si `pathname` est exactement l'un des prefixes, ou l'un de leurs descendants. */
export function matchesRoutePrefix(pathname: string, prefixes: readonly string[]): boolean {
  const path = withoutTrailingSlash(pathname).toLowerCase();
  return prefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isPublicPath(pathname: string): boolean {
  const path = withoutTrailingSlash(pathname);
  if (path === ROUTES.home) return true;

  const prefixes = [...PUBLIC_ROUTES, ...SYSTEM_ROUTES].filter((route) => route !== ROUTES.home);
  return matchesRoutePrefix(path, prefixes);
}
