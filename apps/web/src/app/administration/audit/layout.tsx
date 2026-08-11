import type { ReactNode } from 'react';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';

/**
 * Garde de la section Journal d'audit (SA-049/050) : `audit.read`.
 * Le layout commun `/administration` (lot « cœur ») s'y superpose sans la
 * remplacer — chaque fonction `admin_*` (0083) revérifie de toute façon
 * la permission en base avant de lire quoi que ce soit.
 */
export default async function AdminAuditLayout({ children }: { children: ReactNode }) {
  await requireAdminDataPermission('audit.read');
  return children;
}
