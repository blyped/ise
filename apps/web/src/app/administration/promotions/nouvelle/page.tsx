import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { PromotionForm } from '../PromotionForm';
import { upsertPromotionAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.promotions.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** SA-008 — Creation d'une promotion (permission promotions.manage). */
export default async function AdminPromotionNewPage() {
  const access = await requireAdminPermission('promotions.manage');

  return (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdmin.promotions.form.createTitle}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.promotions} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader
            title={frAdmin.promotions.form.createTitle}
            subtitle={frAdmin.promotions.subtitle}
          />
        </div>

        <SectionCard title={frAdmin.promotions.form.createTitle}>
          <PromotionForm
            action={upsertPromotionAction}
            defaults={{
              promotionId: null,
              name: '',
              graduationYear: null,
              description: '',
              estimatedSize: null,
              status: 'active',
            }}
          />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
