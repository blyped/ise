import { ROUTES } from '@/lib/routes';
import { inspectRedirect } from './safe-redirect';

/**
 * ADDENDUM §4 — Primitive unique de routage protege.
 *
 * `openProtectedResource(target)` du texte d'origine se decompose ici en deux
 * moities qui partagent **le meme calcul** :
 *  - `protectedHref` : pure, sans acces reseau ni cookie. Elle est utilisable
 *    telle quelle cote serveur (rendu du lien) et cote client (`ProtectedLink`).
 *    Les deux cotes produisent donc rigoureusement la meme URL, ce qui evite
 *    toute divergence d'hydratation et fait fonctionner les liens sans
 *    JavaScript ;
 *  - `resolveProtectedRoute` (`protected-route.server.ts`) : lit la session et
 *    delegue a `protectedHref`.
 *
 * Aucune carte, aucune section ne recalcule cette regle pour son compte.
 */

/**
 * Nature de la ressource visee. Elle n'a qu'un role : permettre a ISE-001
 * d'annoncer ce que l'on s'apprete a ouvrir. Elle n'accorde aucun droit et
 * n'entre dans aucune decision de securite.
 */
export type ResourceType =
  'evenement' | 'actualite' | 'opportunite' | 'profil' | 'expertise' | 'appel' | 'espace-membre';

export const RESOURCE_TYPES: readonly ResourceType[] = [
  'evenement',
  'actualite',
  'opportunite',
  'profil',
  'expertise',
  'appel',
  'espace-membre',
];

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === 'string' && (RESOURCE_TYPES as readonly string[]).includes(value);
}

export interface ProtectedHrefOptions {
  /** Etat de session du visiteur. */
  readonly authenticated: boolean;
  /** Nature de la ressource, affichee par ISE-001. */
  readonly resourceType?: ResourceType | undefined;
}

/**
 * Route a suivre pour ouvrir `target` :
 *  - membre authentifie : la route directe ;
 *  - visiteur : `/connexion?redirectTo=<cible encodee>`.
 *
 * La cible est validee **avant** d'etre emise : un lien que `safeRedirect`
 * refuserait apres connexion n'est jamais fabrique. Le controle reste
 * evidemment rejoue a l'arrivee — c'est la ceinture, pas les bretelles.
 */
export function protectedHref(target: string, options: ProtectedHrefOptions): string {
  const inspection = inspectRedirect(target);

  if (!inspection.ok) {
    // Cible interne inconnue : on n'invente pas de redirection. Le visiteur
    // est envoye sur la connexion nue, le membre sur son tableau de bord.
    return options.authenticated ? ROUTES.dashboard : ROUTES.signIn;
  }

  if (options.authenticated) return inspection.path;

  const params = new URLSearchParams({ redirectTo: inspection.path });
  if (options.resourceType !== undefined) params.set('resourceType', options.resourceType);
  return `${ROUTES.signIn}?${params.toString()}`;
}
