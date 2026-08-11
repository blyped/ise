import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAdminProjects } from '@/i18n/admin-projects';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { ProjectForm } from '../ProjectForm';
import { createProjectAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminProjects.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** SA-023 — Creation d'un projet (permission projects.manage). */
export default async function AdminProjectNewPage() {
  const access = await requireAdminPermission('projects.manage');

  return (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.projects}
      screenTitle={frAdminProjects.form.createTitle}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.projects} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader title={frAdminProjects.form.createTitle} subtitle={frAdminProjects.list.subtitle} />
        </div>

        <SectionCard title={frAdminProjects.form.createTitle}>
          <ProjectForm action={createProjectAction} />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
