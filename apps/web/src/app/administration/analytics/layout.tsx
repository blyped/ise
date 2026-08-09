import type { ReactNode } from 'react';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';

/**
 * Garde de la section Analytics (SA-046, SA-047) : `analytics.read`.
 * Le layout commun `/administration` (lot « cœur ») s'y superpose sans la
 * remplacer — la base revérifie de toute façon (0081).
 */
export default async function AdminAnalyticsLayout({ children }: { children: ReactNode }) {
  await requireAdminDataPermission('analytics.read');
  return children;
}
