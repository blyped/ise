import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAdminCommunities } from '@/i18n/admin-communities';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { CommunityForm } from '../CommunityForm';
import { createCommunityAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCommunities.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** SA-027 — Creation d'une communaute (permission communities.manage). */
export default async function AdminCommunityNewPage() {
  const access = await requireAdminPermission('communities.manage');

  return (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.communities}
      screenTitle={frAdminCommunities.form.createTitle}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.communities} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader title={frAdminCommunities.form.createTitle} subtitle={frAdminCommunities.list.subtitle} />
        </div>

        <SectionCard title={frAdminCommunities.form.createTitle}>
          <CommunityForm action={createCommunityAction} />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
