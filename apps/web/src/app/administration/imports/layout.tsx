import type { ReactNode } from 'react';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';

/**
 * Garde de la section Imports & qualité (SA-040 → SA-045).
 *
 * NOTE D'INTÉGRATION : le layout commun `/administration` appartient au
 * lot « cœur ». Cette garde de SECTION reste nécessaire même une fois ce
 * layout en place (défense en profondeur) : chaque écran exige la
 * permission précise de sa section, et la base revérifie de toute façon
 * (fonctions 0080, SECURITY DEFINER).
 */
export default async function AdminImportsLayout({ children }: { children: ReactNode }) {
  await requireAdminDataPermission('imports.execute', 'imports.review');
  return children;
}
