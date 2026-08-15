import Link from 'next/link';
import { Badge, ErrorState } from '@ise/ui-web';
import type { BadgeTone } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAnnouncements } from '@/i18n/announcements';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminAnnouncementDetail, type AnnouncementStatus } from '@/lib/admin/queries-announcements';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { ActionButton } from '../../_components/ActionButton';
import { KeyValue, PageHeader, SectionCard } from '../../_components/PageHeader';
import { AnnouncementEditForm } from './AnnouncementEditForm';
import { deleteAnnouncementAction, setAnnouncementPublishedAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAnnouncements.admin.form.editTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const STATUS_TONE: Record<AnnouncementStatus, BadgeTone> = {
  draft: 'info',
  published: 'success',
  expired: 'neutral',
};

const SEVERITY_TONE = { normal: 'info', urgent: 'warning' } as const;

/**
 * Fiche d'une annonce (0145, tache #188) : contenu + cycle de diffusion
 * (publier/depublier/supprimer), un seul ecran — meme principe que la
 * fiche article SA-actualites.
 */
export default async function AdminAnnouncementDetailPage({
  params,
}: {
  params: Promise<{ announcementId: string }>;
}) {
  const access = await requireAdminPermission('communication.announcements.manage');
  const { announcementId } = await params;
  const correlationId = newCorrelationId();

  const detail = await loadAdminAnnouncementDetail(announcementId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.announcements}
      screenTitle={frAnnouncements.admin.form.editTitle}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAnnouncements.admin.form.editTitle} subtitle={frAnnouncements.admin.list.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.announcements} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const announcement = detail.data;
  const isPublished = announcement.status === 'published' || announcement.status === 'expired';

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.announcements} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={frAnnouncements.admin.form.editTitle}
          subtitle={announcement.body.length > 160 ? `${announcement.body.slice(0, 160)}…` : announcement.body}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[announcement.status]}>
              {frAnnouncements.admin.status[announcement.status]}
            </Badge>
            <Badge tone={SEVERITY_TONE[announcement.severity]}>
              {frAnnouncements.admin.severity[announcement.severity]}
            </Badge>
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAnnouncements.admin.detail.contentTitle}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <KeyValue label={frAnnouncements.admin.detail.createdAt}>
            {formatDateTime(announcement.createdAt)}
          </KeyValue>
          <KeyValue label={frAnnouncements.admin.detail.publishedAt}>
            {announcement.publishedAt !== null ? formatDateTime(announcement.publishedAt) : frAdmin.common.none}
          </KeyValue>
        </dl>
      </SectionCard>

      <SectionCard title={frAnnouncements.admin.detail.lifecycleTitle}>
        <p className="text-caption text-text-muted">
          {isPublished
            ? frAnnouncements.admin.detail.unpublishHint
            : frAnnouncements.admin.detail.publishHint}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            action={setAnnouncementPublishedAction}
            fields={{ announcementId: announcement.id, published: isPublished ? 'false' : 'true' }}
            label={isPublished ? frAnnouncements.admin.detail.unpublish : frAnnouncements.admin.detail.publish}
            variant="secondary"
          />
        </div>
      </SectionCard>

      <SectionCard title={frAnnouncements.admin.form.editTitle}>
        <AnnouncementEditForm announcement={announcement} />
      </SectionCard>

      <SectionCard title={frAnnouncements.admin.detail.deleteTitle}>
        <p className="text-caption text-text-muted">{frAnnouncements.admin.detail.deleteHint}</p>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            action={deleteAnnouncementAction}
            fields={{ announcementId: announcement.id }}
            label={frAnnouncements.admin.detail.delete}
            variant="danger"
          />
        </div>
      </SectionCard>
    </div>,
  );
}
