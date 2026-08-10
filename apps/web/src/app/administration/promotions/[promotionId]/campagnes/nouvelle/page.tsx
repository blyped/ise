import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAdminCampaigns } from '@/i18n/admin-campaigns';
import { ADMIN_ROUTES, adminCampaignsRoute } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../../../_components/AdminShell';
import { PageHeader } from '../../../../_components/PageHeader';
import { createCampaignAction } from '../actions';
import { CampaignForm } from './CampaignForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminCampaigns.create.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** SA-012 -- Creation d'une campagne d'invitation (statut initial : brouillon). */
export default async function AdminCampaignNewPage({
  params,
}: {
  params: Promise<{ promotionId: string }>;
}) {
  const access = await requireAdminPermission('promotions.manage');
  const { promotionId: rawId } = await params;
  const promotionId = Number.parseInt(rawId, 10);

  return (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.promotions}
      screenTitle={frAdminCampaigns.create.title}
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={adminCampaignsRoute(promotionId)} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader title={frAdminCampaigns.create.title} subtitle={frAdminCampaigns.create.subtitle} />
        </div>
        <CampaignForm action={createCampaignAction} promotionId={promotionId} />
      </div>
    </AdminShell>
  );
}
