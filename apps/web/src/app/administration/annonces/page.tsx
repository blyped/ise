import Link from 'next/link';
import { Badge, EmptyState, ErrorState } from '@ise/ui-web';
import type { BadgeTone } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAnnouncements } from '@/i18n/announcements';
import { ADMIN_ROUTES, adminAnnouncementRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminAnnouncements, type AnnouncementStatus } from '@/lib/admin/queries-announcements';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../_components/AdminShell';
import { PageHeader } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAnnouncements.admin.list.title };

const DETAIL_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const STATUS_TONE: Record<AnnouncementStatus, BadgeTone> = {
  draft: 'info',
  published: 'success',
  expired: 'neutral',
};

const SEVERITY_TONE = { normal: 'info', urgent: 'warning' } as const;

/**
 * Liste administrative des annonces du tableau de bord membre (0145,
 * tache #188). Permission `communication.announcements.manage`, verifiee
 * ici ET en base par `admin_list_dashboard_announcements`.
 *
 * Pas de pagination par curseur ni de filtre de recherche : le volume
 * attendu (quelques annonces actives a la fois) ne le justifie pas — la
 * tache demande explicitement de ne pas sur-ingenierier cette partie.
 */
export default async function AdminAnnouncementsPage() {
  const access = await requireAdminPermission('communication.announcements.manage');
  const correlationId = newCorrelationId();

  const page = await loadAdminAnnouncements(correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.announcements}
      screenTitle={frAnnouncements.admin.list.title}
    >
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader
      title={frAnnouncements.admin.list.title}
      subtitle={frAnnouncements.admin.list.subtitle}
      action={{ href: ADMIN_ROUTES.announcementNew, label: frAnnouncements.admin.list.newAnnouncement }}
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

  const rows = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      {rows.length === 0 ? (
        <EmptyState
          title={frAnnouncements.admin.list.empty}
          description={frAnnouncements.admin.list.emptyBody}
        />
      ) : (
        <RowList label={frAnnouncements.admin.list.title}>
          {rows.map((row) => (
            <RowCard
              key={row.id}
              title={row.body.length > 120 ? `${row.body.slice(0, 120)}…` : row.body}
              meta={
                row.publishedAt !== null
                  ? `${frAnnouncements.admin.list.columns.published} : ${formatDateTime(row.publishedAt)}`
                  : frAnnouncements.admin.list.columns.noWindow
              }
              badges={
                <>
                  <Badge tone={STATUS_TONE[row.status]}>
                    {frAnnouncements.admin.status[row.status]}
                  </Badge>
                  <Badge tone={SEVERITY_TONE[row.severity]}>
                    {frAnnouncements.admin.severity[row.severity]}
                  </Badge>
                </>
              }
              actions={
                <Link href={adminAnnouncementRoute(row.id)} className={DETAIL_LINK}>
                  {frAnnouncements.admin.list.open}
                </Link>
              }
            />
          ))}
        </RowList>
      )}
    </div>,
  );
}
