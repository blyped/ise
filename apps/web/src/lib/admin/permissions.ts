import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';

/**
 * AUTORISATION SERVEUR DU BACK-OFFICE SUPERADMIN (/administration).
 *
 * REGLE CARDINALE : masquer un menu ne protege rien. L'autorisation
 * reelle est dans la base — chaque fonction `admin_*` (migration 0076)
 * verifie `private.has_permission()` avant de lire ou d'ecrire, et la
 * RLS reste active partout. Ce module ne remplace rien de tout cela :
 * il redirige vers SYS-006 AVANT le rendu d'un ecran que la base
 * refuserait de remplir.
 *
 * La liste des permissions vient de `public.get_my_admin_permissions()`
 * (0076), qui interroge `private.role_permissions` — la meme source que
 * `private.has_permission()`. Aucune matrice recopiee cote application.
 */

export const ADMIN_PERMISSIONS = [
  'profiles.read',
  'profiles.edit',
  'profiles.moderate',
  'profiles.verify',
  'promotions.manage',
  'calls.moderate',
  'opportunities.manage',
  'communities.manage',
  'projects.manage',
  'mentorship.manage',
  'events.manage',
  'content.publish',
  'imports.execute',
  'imports.review',
  'support.manage',
  'analytics.read',
  'settings.manage',
  'audit.read',
  'roles.manage',
  /** 0134 — registre des dons. Accordee au seul superadmin. */
  'donations.read',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export interface AdminAccess {
  readonly userId: string;
  readonly permissions: ReadonlySet<AdminPermission>;
  /** `true` si la permission est detenue. Sert a l'AFFICHAGE, pas a la securite. */
  can(permission: AdminPermission): boolean;
  /** `true` si AU MOINS une des permissions est detenue. */
  canAny(permissions: readonly AdminPermission[]): boolean;
}

function isAdminPermission(value: unknown): value is AdminPermission {
  return typeof value === 'string' && (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

function toAccess(userId: string, codes: readonly AdminPermission[]): AdminAccess {
  const permissions = new Set(codes);
  return {
    userId,
    permissions,
    can: (permission) => permissions.has(permission),
    canAny: (list) => list.some((permission) => permissions.has(permission)),
  };
}

/** Permissions administratives de la session courante. `null` sans session. */
export async function readAdminAccess(): Promise<AdminAccess | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_my_admin_permissions', {});
  if (error) {
    // Une erreur de lecture n'ouvre jamais l'acces : elle le ferme.
    console.error('[ISE] lecture des permissions admin en echec', { code: error.code });
    return toAccess(user.id, []);
  }

  const codes = Array.isArray(data) ? data.filter(isAdminPermission) : [];
  return toAccess(user.id, codes);
}

/**
 * Garde d'entree du back-office, appelee par `app/administration/layout.tsx`
 * — donc par TOUTES les routes `/administration/**`, y compris celles du
 * lot imports / analytics / parametres / audit. Un compte sans aucune
 * permission d'administration est renvoye vers SYS-006.
 */
export async function requireAdminAccess(): Promise<AdminAccess> {
  const access = await readAdminAccess();
  if (access === null) redirect(ROUTES.sessionExpired);
  if (access.permissions.size === 0) redirect(ROUTES.accessDenied);
  return access;
}

/**
 * Garde d'une SECTION : chaque ecran exige sa permission precise
 * (`profiles.verify` pour les reclamations, `support.manage` pour le
 * support…). Sans elle -> SYS-006. La base revalide de toute facon.
 */
export async function requireAdminPermission(
  ...permissions: readonly AdminPermission[]
): Promise<AdminAccess> {
  const access = await requireAdminAccess();
  if (!access.canAny(permissions)) redirect(ROUTES.accessDenied);
  return access;
}
