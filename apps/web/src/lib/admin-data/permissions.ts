import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROUTES } from '@/lib/routes';

/**
 * AUTORISATION SERVEUR DU BACK-OFFICE « DONNÉES » (SA-040 → SA-050).
 *
 * Même contrat que `lib/cms/permissions.ts` : masquer un écran ne protège
 * rien. La barrière réelle est en base — chaque fonction `admin_*`
 * (migrations 0080 → 0083) vérifie sa permission en tête, en SECURITY
 * DEFINER. Ce module ne fait qu'éviter d'afficher une page que la base
 * refuserait de remplir, et redirige vers SYS-006 AVANT le rendu.
 *
 * DÉFENSE EN PROFONDEUR : la garde est appelée PAR PAGE avec la
 * permission précise de la section — même si un layout commun
 * `/administration` protège déjà l'entrée. La source des permissions est
 * `public.get_my_admin_data_permissions()` (0080), qui interroge
 * `private.role_permissions` : rien n'est recopié côté client (D-31).
 */

export const ADMIN_DATA_PERMISSIONS = [
  'imports.execute',
  'imports.review',
  'analytics.read',
  'settings.manage',
  'audit.read',
] as const;

export type AdminDataPermission = (typeof ADMIN_DATA_PERMISSIONS)[number];

export interface AdminDataAccess {
  readonly userId: string;
  readonly permissions: ReadonlySet<AdminDataPermission>;
  /** Sert à l'AFFICHAGE (montrer/cacher un bouton), jamais à la sécurité. */
  can(permission: AdminDataPermission): boolean;
  canAny(...permissions: AdminDataPermission[]): boolean;
}

function isAdminDataPermission(value: unknown): value is AdminDataPermission {
  return typeof value === 'string' && (ADMIN_DATA_PERMISSIONS as readonly string[]).includes(value);
}

function toAccess(userId: string, codes: readonly AdminDataPermission[]): AdminDataAccess {
  const permissions = new Set(codes);
  return {
    userId,
    permissions,
    can: (permission) => permissions.has(permission),
    canAny: (...list) => list.some((permission) => permissions.has(permission)),
  };
}

/** Permissions du compte courant. `null` s'il n'y a pas de session. */
export async function readAdminDataAccess(): Promise<AdminDataAccess | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('get_my_admin_data_permissions', {});
  if (error) {
    // Une erreur de lecture n'ouvre jamais l'accès : elle le ferme.
    console.error('[ISE] lecture des permissions admin en échec', { code: error.code });
    return toAccess(user.id, []);
  }

  const codes = Array.isArray(data) ? data.filter(isAdminDataPermission) : [];
  return toAccess(user.id, codes);
}

/**
 * Garde d'une page : exige AU MOINS UNE des permissions listées.
 * Sans session -> session expirée ; sans permission -> SYS-006.
 */
export async function requireAdminDataPermission(
  ...permissions: AdminDataPermission[]
): Promise<AdminDataAccess> {
  const access = await readAdminDataAccess();
  if (access === null) redirect(ROUTES.sessionExpired);
  if (!access.canAny(...permissions)) redirect(ROUTES.accessDenied);
  return access;
}

/**
 * Garde d'une Server Action : renvoie `null` plutôt que de rediriger,
 * pour produire un message d'erreur métier. La base revalide de toute
 * façon la permission — ceci n'est pas la barrière.
 */
export async function checkAdminDataPermission(
  ...permissions: AdminDataPermission[]
): Promise<AdminDataAccess | null> {
  const access = await readAdminDataAccess();
  if (access === null || !access.canAny(...permissions)) return null;
  return access;
}
