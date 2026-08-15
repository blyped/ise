import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signedAvatarUrl } from '@/lib/queries/member-profile';
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
  /**
   * URL signee (courte duree de vie) de la photo de profil du membre
   * connecte, ou `undefined` s'il n'en a pas depose une, si la lecture ou
   * la signature a echoue. `PublicHeader` retombe alors sur les initiales.
   */
  readonly avatarUrl: string | undefined;
  /**
   * D-194 — nombre de notifications non lues (meme RPC
   * `my_notification_summary()` que le centre de notifications membre,
   * ISE-098). `undefined` si non authentifie ou si la lecture a echoue :
   * `PublicHeader` n'affiche alors aucune pastille (§47).
   */
  readonly unreadNotifications: number | undefined;
}

const ANONYMOUS: PublicViewer = {
  authenticated: false,
  displayName: null,
  avatarUrl: undefined,
  unreadNotifications: undefined,
};

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
 * Lit `avatar_path` du profil rattache au compte connecte et le signe.
 *
 * Lecture ADDITIONNELLE et TOLERANTE A L'ECHEC, isolee dans son propre
 * `try/catch` : un membre connecte voit sa photo dans l'en-tete public
 * exactement comme dans l'espace membre, mais aucune panne de cette lecture
 * (base indisponible, Storage indisponible, profil absent) ne doit
 * empecher `readPublicViewer()` de repondre ni la page publique de
 * s'afficher — meme discipline que le reste de ce module (ADDENDUM §47).
 */
async function readAvatarUrl(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
): Promise<string | undefined> {
  try {
    const { data, error } = await supabase
      .from('ise_profiles')
      .select('avatar_path')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !data) return undefined;
    const avatarPath = (data as unknown as { avatar_path: string | null }).avatar_path;
    return await signedAvatarUrl(avatarPath);
  } catch {
    return undefined;
  }
}

/**
 * D-194 — pendant non lu de `readAvatarUrl()` ci-dessus : meme discipline
 * TOLERANTE A L'ECHEC, isolee dans son propre `try/catch`. Reutilise
 * directement `my_notification_summary()` (deja utilisee par
 * `loadNotificationSummary()` cote centre de notifications, ISE-098) sans
 * passer par `lib/queries/notifications.ts` — ce module-la depend de
 * `lib/queries/rpc.ts` et de son `BusinessError`, superflu ici puisque le
 * seul besoin est un compteur qui degrade en silence.
 */
async function readUnreadNotificationCount(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<number | undefined> {
  try {
    const { data, error } = await supabase.rpc('my_notification_summary', {});
    if (error || !data) return undefined;
    const unread = (data as unknown as { unread?: unknown }).unread;
    return typeof unread === 'number' ? unread : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Etat de session vu depuis le site public.
 *
 * Ne lit **que** ce dont l'en-tete a besoin (ADDENDUM §7 : avatar et
 * « Mon espace »). La lecture du nom reste purement issue de la session
 * (`user_metadata`), sans requete sur `ise_profiles` : une panne
 * d'authentification ne doit pas casser PUB-001. La photo, elle, necessite
 * une lecture de profil — elle est donc isolee dans `readAvatarUrl()` et ne
 * peut, par construction, jamais faire echouer cette fonction.
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

    const [avatarUrl, unreadNotifications] = await Promise.all([
      readAvatarUrl(supabase, data.user.id),
      readUnreadNotificationCount(supabase),
    ]);

    return { authenticated: true, displayName, avatarUrl, unreadNotifications };
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
