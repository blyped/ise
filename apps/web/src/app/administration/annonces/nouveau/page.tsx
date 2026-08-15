import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAnnouncements } from '@/i18n/announcements';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { AnnouncementForm } from '../AnnouncementForm';
import { createAnnouncementAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAnnouncements.admin.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Creation d'une annonce (0145, tache #188, permission communication.announcements.manage). */
export default async function AdminAnnouncementNewPage() {
  const access = await requireAdminPermission('communication.announcements.manage');

  return (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.announcements}
      screenTitle={frAnnouncements.admin.form.createTitle}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.announcements} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader
            title={frAnnouncements.admin.form.createTitle}
            subtitle={frAnnouncements.admin.list.subtitle}
          />
        </div>

        <SectionCard title={frAnnouncements.admin.form.createTitle}>
          <AnnouncementForm
            action={createAnnouncementAction}
            submitLabel={frAnnouncements.admin.form.submitCreate}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
