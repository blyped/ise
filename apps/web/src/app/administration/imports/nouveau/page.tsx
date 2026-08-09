import { Alert, Card } from '@ise/ui-web';
import { frAdminData } from '@/i18n/admin-data';
import { requireAdminDataPermission } from '@/lib/admin-data/permissions';
import { ADMIN_DATA_ROUTES } from '@/lib/routes/admin-data';
import { AdminPageHeader } from '../_components/AdminPageHeader';
import { UploadForm } from './UploadForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminData.imports.new.title };

const t = frAdminData.imports.new;

/**
 * SA-039 — Nouvel import d'annuaire (upload + staging, §37).
 * La règle « jamais de compte utilisateur » est affichée à l'endroit même
 * où l'on téléverse : elle appartient à l'opérateur, pas qu'aux
 * migrations (D-104).
 */
export default async function NewImportPage() {
  await requireAdminDataPermission('imports.execute');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <AdminPageHeader
        title={t.title}
        subtitle={t.subtitle}
        backHref={ADMIN_DATA_ROUTES.imports}
        backLabel={frAdminData.imports.title}
      />
      <Alert variant="info" title={frAdminData.imports.title}>
        {t.neverAccounts}
      </Alert>
      <Card>
        <UploadForm />
      </Card>
    </div>
  );
}
