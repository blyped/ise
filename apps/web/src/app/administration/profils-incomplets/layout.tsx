import type { ReactNode } from 'react';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';

/**
 * Garde de la section Profils incomplets (SA-043).
 *
 * Anciennement sous `/administration/imports` (garde `imports.execute`
 * ou `imports.review`) : l'import en masse est abandonné (décision C-06,
 * docs/decisions.md), seule la revue de complétude reste, donc la garde
 * ne retient que `imports.review` — le code de permission garde ce nom
 * en base pour éviter une migration RBAC pour un simple renommage
 * cosmétique (rien ne change fonctionnellement pour les détenteurs du
 * rôle).
 *
 * NOTE D'INTÉGRATION : le layout commun `/administration` appartient au
 * lot « cœur ». Cette garde de SECTION reste nécessaire même une fois ce
 * layout en place (défense en profondeur) : la base revérifie de toute
 * façon (fonction `admin_list_incomplete_profiles`, SECURITY DEFINER).
 */
export default async function AdminIncompleteProfilesLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminDataPermission('imports.review');
  return children;
}
