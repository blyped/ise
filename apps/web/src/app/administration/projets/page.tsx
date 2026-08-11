import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminProjects } from '@/i18n/admin-projects';
import { ADMIN_ROUTES, adminProjectRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminProjects } from '@/lib/admin/queries-projects';
import { formatDate } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminProjects.list.title };

const PROJECT_STATUSES = [
  'draft',
  'recruiting',
  'team_ready',
  'active',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'archived',
] as const;

const PROJECT_TYPES = [
  'mission',
  'tender',
  'consortium',
  'study',
  'research',
  'entrepreneurial',
  'product',
  'publication',
  'working_group',
  'community_initiative',
  'other',
] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-023 — Liste administrative des projets & consortiums : tous
 * statuts, y compris les brouillons (invisibles de `list_projects`,
 * l'ecran membre). Permission `projects.manage` (verifiee ici ET en
 * base par `admin_list_projects`, 0094).
 */
export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('projects.manage');
  const params = await searchParams;
  const query = paramValue(params, 'recherche');
  const status = paramOneOf(params, 'statut', PROJECT_STATUSES);
  const projectType = paramOneOf(params, 'type', PROJECT_TYPES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminProjects({ status, projectType, query }, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.projects} screenTitle={frAdminProjects.list.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAdminProjects.list.title}
      subtitle={frAdminProjects.list.subtitle}
      action={{ href: ADMIN_ROUTES.projectNew, label: frAdminProjects.list.newProject }}
    />
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frAdmin.common.errorTitle}
          description={page.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <FilterBar
        action={ADMIN_ROUTES.projects}
        search={{
          name: 'recherche',
          placeholder: frAdminProjects.list.searchPlaceholder,
          value: query ?? '',
        }}
        selects={[
          {
            name: 'statut',
            label: frAdminProjects.list.filterStatus,
            value: status ?? '',
            options: PROJECT_STATUSES.map((value) => ({
              value,
              label: frAdminProjects.status[value] ?? value,
            })),
          },
          {
            name: 'type',
            label: frAdminProjects.list.filterType,
            value: projectType ?? '',
            options: PROJECT_TYPES.map((value) => ({
              value,
              label: frAdminProjects.projectType[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdminProjects.list.empty} description={frAdminProjects.list.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminProjects.list.title}>
            {rows.map((row) => (
              <RowCard
                key={row.projectId}
                title={row.title}
                meta={[
                  `${frAdminProjects.list.columns.owner} : ${row.owner?.displayName ?? frAdmin.common.none}`,
                  `${frAdminProjects.list.columns.type} : ${frAdminProjects.projectType[row.projectType] ?? row.projectType}`,
                  `${frAdminProjects.list.columns.created} : ${formatDate(row.createdAt)}`,
                ].join(' · ')}
                badges={
                  <StatusBadge status={row.status} label={frAdminProjects.status[row.status] ?? row.status} />
                }
                actions={
                  <Link href={adminProjectRoute(row.projectId)} className={DETAIL_LINK}>
                    {frAdminProjects.list.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.projects,
              { recherche: query, statut: status, type: projectType },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
