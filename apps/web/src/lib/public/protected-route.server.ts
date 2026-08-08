import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { protectedHref, type ResourceType } from './protected-route';

/**
 * ADDENDUM §4 — Moitie serveur de la primitive de routage protege.
 *
 * Ce fichier est le seul du lot public a toucher aux cookies : il ne peut donc
 * pas etre importe depuis un composant client, ni depuis une fonction mise en
 * cache. Il est volontairement separe de `protected-route.ts`, qui reste pur.
 */

export interface PublicViewer {
  readonly authenticated: boolean;
  /** Nom affichable dans l'en-tete public, ou `null` si inconnu. */
  readonly displayName: string | null;
}

const ANONYMOUS: PublicViewer = { authenticated: false, displayName: null };

/**
 * Next.js signale ses bascules internes (rendu dynamique, `redirect()`,
 * `notFound()`) en levant une erreur porteuse d'un `digest`. L'avaler
 * empecherait le framework de faire son travail : ces erreurs sont relancees
 * telles quelles, seules les vraies pannes sont absorbees.
 */
function rethrowFrameworkError(cause: unknown): void {
  if (typeof cause === 'object' && cause !== null && 'digest' in cause) throw cause;
}

/**
 * Etat de session vu depuis le site public.
 *
 * Ne lit **que** ce dont l'en-tete a besoin (ADDENDUM §7 : avatar et
 * « Mon espace »). Aucune requete sur `ise_profiles` : la landing n'a pas a
 * declencher une lecture de profil pour afficher un nom, et une panne de la
 * base ne doit pas empecher la page publique de s'afficher.
 */
export async function readPublicViewer(): Promise<PublicViewer> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return ANONYMOUS;

    const metadata = data.user.user_metadata as Record<string, unknown> | null;
    const rawName = metadata?.['display_name'] ?? metadata?.['full_name'] ?? null;
    const displayName =
      typeof rawName === 'string' && rawName.trim().length > 0
        ? rawName.trim()
        : (data.user.email ?? null);

    return { authenticated: true, displayName };
  } catch (cause) {
    rethrowFrameworkError(cause);
    // Une panne d'authentification ne doit pas casser PUB-001 (ADDENDUM §47).
    console.error('[ISE] lecture de session impossible sur le site public', { cause });
    return ANONYMOUS;
  }
}

/**
 * Route a suivre, cote serveur, pour ouvrir une ressource protegee.
 * Renvoie soit la route directe, soit `/connexion?redirectTo=<cible>`.
 */
export async function resolveProtectedRoute(
  target: string,
  resourceType?: ResourceType,
): Promise<string> {
  const viewer = await readPublicViewer();
  return protectedHref(target, {
    authenticated: viewer.authenticated,
    resourceType,
  });
}

/**
 * Variante imperative : redirige immediatement. Utilisable depuis une Server
 * Action ou un Route Handler. Ne retourne jamais.
 */
export async function openProtectedResource(
  target: string,
  resourceType?: ResourceType,
): Promise<never> {
  redirect(await resolveProtectedRoute(target, resourceType));
}
