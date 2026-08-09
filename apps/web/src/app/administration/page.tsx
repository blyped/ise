import Link from 'next/link';
import { Card, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminAccess } from '@/lib/admin/permissions';
import { loadAdminDashboard } from '@/lib/admin/queries';
import type { AdminCounterBlock } from '@/lib/admin/view';
import { AdminShell } from './_components/AdminShell';
import { PageHeader } from './_components/PageHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.dashboard.title };

const QUEUE_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-001 -> SA-004 — Tableau de bord Superadmin.
 *
 * INDICATEURS REELS UNIQUEMENT (MASTER PROMPT §98) : chaque chiffre vient
 * de `admin_dashboard_counters()` (0076), qui compte les lignes
 * existantes, bloc par bloc de permission. Un bloc dont la permission
 * manque n'est pas rendu ; un compteur a zero affiche zero. Aucun KPI
 * invente, aucun graphe sans source.
 */
export default async function AdminDashboardPage() {
  const access = await requireAdminAccess();
  const correlationId = newCorrelationId();
  const dashboard = await loadAdminDashboard(correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.root}
      screenTitle={frAdmin.dashboard.title}
    >
      {children}
    </AdminShell>
  );

  if (!dashboard.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.dashboard.title} subtitle={frAdmin.dashboard.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={dashboard.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const data = dashboard.data;

  const blocks: { block: AdminCounterBlock | null; title: string; href: string }[] = [
    { block: data.profiles, title: frAdmin.dashboard.profilesTitle, href: ADMIN_ROUTES.members },
    { block: data.claims, title: frAdmin.dashboard.claimsTitle, href: ADMIN_ROUTES.claims },
    { block: data.reports, title: frAdmin.dashboard.reportsTitle, href: ADMIN_ROUTES.moderation },
    { block: data.tickets, title: frAdmin.dashboard.ticketsTitle, href: ADMIN_ROUTES.support },
    {
      block: data.promotions,
      title: frAdmin.dashboard.promotionsTitle,
      href: ADMIN_ROUTES.promotions,
    },
  ];

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frAdmin.dashboard.title} subtitle={frAdmin.dashboard.subtitle} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {blocks.map(({ block, title, href }) =>
          block === null ? null : (
            <Card key={block.key} className="flex flex-col gap-4 p-6">
              <h2 className="text-h3 text-text-primary font-semibold">{title}</h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {block.entries.map((entry) => (
                  <div key={entry.key} className="flex items-baseline justify-between gap-3">
                    <dt className="text-body-sm text-text-secondary">
                      {frAdmin.dashboard.counters[entry.key] ?? entry.key}
                    </dt>
                    <dd className="text-body text-text-primary font-semibold tabular-nums">
                      {entry.value}
                    </dd>
                  </div>
                ))}
              </dl>
              <Link href={href} className={QUEUE_LINK}>
                {frAdmin.dashboard.openQueue}
              </Link>
            </Card>
          ),
        )}
      </div>
    </div>,
  );
}
