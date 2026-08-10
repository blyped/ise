import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { frAdminDedup } from '@/i18n/admin-dedup';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader } from '../../_components/PageHeader';
import { CreateProfileForm } from './CreateProfileForm';
import { createReferencedProfileAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminDedup.create.title };

/**
 * SA-007 — Creation d'un profil individuel reference/unclaimed, sur le
 * meme modele que le recensement importe en migration (decision C-06,
 * `0088_import_ise_census_part1..6`). Aucun compte n'est cree.
 */
export default async function AdminCreateMemberPage() {
  const access = await requireAdminPermission('profiles.edit');
  return (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.members} screenTitle={frAdminDedup.create.title}>
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminDedup.create.title} subtitle={frAdminDedup.create.subtitle} />
        <CreateProfileForm action={createReferencedProfileAction} />
      </div>
    </AdminShell>
  );
}
