import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminNews } from '@/i18n/admin-news';
import { ADMIN_ROUTES, adminNewsRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminNews } from '@/lib/admin/queries-news';
import { formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../_components/AdminShell';
import { CursorPager, PageHeader, StatusBadge } from '../_components/PageHeader';
import { FilterBar } from '../_components/FilterBar';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminNews.list.title };

const NEWS_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'published',
  'rejected',
  'archived',
  'duplicate',
] as const;

const NEWS_CATEGORIES = [
  'ise_spotlight',
  'appointment',
  'new_position',
  'distinction',
  'publication',
  'entrepreneurship',
  'project',
  'research',
  'international',
  'major_mission',
  'career_path',
  'network_achievement',
  'promotion_life',
  'community_life',
  'network_life',
  'event_report',
  'other',
] as const;

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * Redaction administrative des actualites (0110, tache #83). Permission
 * `content.publish` (verifiee ici ET en base par `admin_list_news`).
 *
 * Frontiere D-128 : cet ecran ne montre ni ne modifie
 * `landing_visibility`/`landing_priority`/`is_featured` — ces trois
 * champs restent le domaine exclusif de `/cms/actualites`, une fois
 * l'article publie ici.
 */
export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('content.publish');
  const params = await searchParams;
  const query = paramValue(params, 'recherche');
  const status = paramOneOf(params, 'statut', NEWS_STATUSES);
  const categoryCode = paramOneOf(params, 'categorie', NEWS_CATEGORIES);
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();

  const page = await loadAdminNews({ status, categoryCode, query }, cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.news} screenTitle={frAdminNews.list.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAdminNews.list.title}
      subtitle={frAdminNews.list.subtitle}
      action={{ href: ADMIN_ROUTES.newsNew, label: frAdminNews.list.newNews }}
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
        action={ADMIN_ROUTES.news}
        search={{
          name: 'recherche',
          placeholder: frAdminNews.list.searchPlaceholder,
          value: query ?? '',
        }}
        selects={[
          {
            name: 'statut',
            label: frAdminNews.list.filterStatus,
            value: status ?? '',
            options: NEWS_STATUSES.map((value) => ({
              value,
              label: frAdminNews.status[value] ?? value,
            })),
          },
          {
            name: 'categorie',
            label: frAdminNews.list.filterCategory,
            value: categoryCode ?? '',
            options: NEWS_CATEGORIES.map((value) => ({
              value,
              label: frAdminNews.category[value] ?? value,
            })),
          },
        ]}
      />

      {rows.length === 0 ? (
        <EmptyState title={frAdminNews.list.empty} description={frAdminNews.list.emptyBody} />
      ) : (
        <>
          <RowList label={frAdminNews.list.title}>
            {rows.map((row) => (
              <RowCard
                key={row.newsId}
                title={row.title}
                meta={[
                  `${frAdminNews.list.columns.category} : ${frAdminNews.category[row.categoryCode] ?? row.categoryCode}`,
                  row.publishedAt !== null
                    ? `${frAdminNews.list.columns.published} : ${formatDateTime(row.publishedAt)}`
                    : frAdmin.common.none,
                ].join(' · ')}
                badges={
                  <StatusBadge
                    status={row.editorialStatus}
                    label={frAdminNews.status[row.editorialStatus] ?? row.editorialStatus}
                  />
                }
                actions={
                  <Link href={adminNewsRoute(row.newsId)} className={DETAIL_LINK}>
                    {frAdminNews.list.open}
                  </Link>
                }
              />
            ))}
          </RowList>

          <CursorPager
            shownCount={rows.length}
            nextHref={nextPageHref(
              ADMIN_ROUTES.news,
              { recherche: query, statut: status, categorie: categoryCode },
              nextCursor,
            )}
          />
        </>
      )}
    </div>,
  );
}
