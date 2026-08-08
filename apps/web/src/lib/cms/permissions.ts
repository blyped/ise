import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';

/**
 * AUTORISATION SERVEUR DU BACK-OFFICE CMS (ADDENDUM §29).
 *
 * REGLE CARDINALE : masquer un bouton ne protege rien. L'autorisation
 * reelle est en base — RLS sur les huit tables `cms_*`, verification de
 * permission dans chaque fonction `SECURITY DEFINER`. Ce module ne
 * remplace RIEN de tout cela : il evite seulement d'afficher un ecran que
 * la base refuserait de remplir, et il renvoie vers SYS-006 AVANT le
 * rendu, comme l'exige le brief.
 *
 * La liste des permissions vient de `public.get_my_cms_permissions()`
 * (migration 0067), qui interroge `private.role_permissions` — la meme
 * source que `private.has_permission()`. Aucune matrice n'est recopiee
 * cote application : une copie diverge toujours.
 */

export const CMS_PERMISSIONS = [
  'cms.read',
  'cms.edit',
  'cms.publish',
  'cms.schedule',
  'cms.media.manage',
  'cms.partners.manage',
  'cms.featured_profile.manage',
] as const;

export type CmsPermission = (typeof CMS_PERMISSIONS)[number];

export interface CmsAccess {
  readonly userId: string;
  readonly permissions: ReadonlySet<CmsPermission>;
  /** `true` si la permission est detenue. Sert a l'AFFICHAGE, pas a la securite. */
  can(permission: CmsPermission): boolean;
}

function isCmsPermission(value: unknown): value is CmsPermission {
  return typeof value === 'string' && (CMS_PERMISSIONS as readonly string[]).includes(value);
}

function toAccess(userId: string, codes: readonly CmsPermission[]): CmsAccess {
  const permissions = new Set(codes);
  return {
    userId,
    permissions,
    can: (permission) => permissions.has(permission),
  };
}

/**
 * Lit les permissions CMS de la session courante. Ne redirige pas : sert
 * aux appelants qui veulent decider eux-memes (le layout, une action).
 *
 * Retourne `null` s'il n'y a pas de session.
 */
export async function readCmsAccess(): Promise<CmsAccess | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_my_cms_permissions', {});
  if (error) {
    // Une erreur de lecture n'ouvre jamais l'acces : elle le ferme.
    console.error('[ISE] lecture des permissions CMS en echec', { code: error.code });
    return toAccess(user.id, []);
  }

  const codes = Array.isArray(data) ? data.filter(isCmsPermission) : [];
  return toAccess(user.id, codes);
}

/**
 * Garde d'entree du back-office. Un compte sans `cms.read` n'atteint pas
 * la route : il est redirige vers SYS-006 (`/acces-refuse`).
 *
 * Appelee par `src/app/cms/layout.tsx`, donc par TOUTES les routes du CMS
 * — y compris celles ajoutees plus tard, sans qu'on ait a y penser.
 */
export async function requireCmsAccess(): Promise<CmsAccess> {
  const access = await readCmsAccess();
  if (access === null) redirect(ROUTES.sessionExpired);
  if (!access.can('cms.read')) redirect(ROUTES.accessDenied);
  return access;
}

/**
 * Garde d'une action sensible. Utilisee par les Server Actions AVANT
 * l'appel a la base — la base revalide de son cote, systematiquement.
 * Ce n'est donc pas la barriere : c'est ce qui produit un message
 * comprehensible plutot qu'une erreur 42501 brute.
 */
export async function requireCmsPermission(permission: CmsPermission): Promise<CmsAccess | null> {
  const access = await readCmsAccess();
  if (access === null || !access.can(permission)) return null;
  return access;
}
