import type { ReactNode } from 'react';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';

/**
 * Garde de la section Paramètres plateforme (SA-048) : `settings.manage`.
 * Le layout commun `/administration` (lot « cœur ») s'y superpose sans la
 * remplacer — la base revérifie de toute façon (0082, 0084).
 */
export default async function AdminSettingsLayout({ children }: { children: ReactNode }) {
  await requireAdminDataPermission('settings.manage');
  return children;
}
