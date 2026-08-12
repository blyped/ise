import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAdminNews } from '@/i18n/admin-news';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { NewsForm } from '../NewsForm';
import { createNewsAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminNews.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Redaction administrative — creation (0110, permission content.publish). */
export default async function AdminNewsNewPage() {
  const access = await requireAdminPermission('content.publish');

  return (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.news} screenTitle={frAdminNews.form.createTitle}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.news} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader title={frAdminNews.form.createTitle} subtitle={frAdminNews.list.subtitle} />
        </div>

        <SectionCard title={frAdminNews.form.createTitle}>
          <NewsForm action={createNewsAction} />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
