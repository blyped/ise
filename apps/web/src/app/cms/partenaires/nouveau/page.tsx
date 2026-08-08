import Link from 'next/link';
import { Alert, Card, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadMediaOptions, loadOrganizations } from '@/lib/cms/queries';
import { CmsShell } from '../../_components/CmsShell';
import { PageHeader } from '../../_components/PageHeader';
import { CampaignForm } from '../CampaignForm';
import { createCampaignAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.partners.add };

/** CMS-007 — Creation d'une campagne. Elle nait en `draft`. */
export default async function NewCampaignPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [organizations, media] = await Promise.all([
    loadOrganizations(correlationId),
    loadMediaOptions(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.partners} screenTitle={frCms.partners.add}>
      {children}
    </CmsShell>
  );

  if (!organizations.ok) {
    return shell(
      <ErrorState
        title={frCms.common.loadError}
        description={organizations.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.partners.add} subtitle={frCms.partners.subtitle} />
      <p>
        <Link
          href={CMS_ROUTES.partners}
          className="text-body-sm text-primary inline-flex min-h-[44px] items-center hover:underline"
        >
          ← {frCms.partners.title}
        </Link>
      </p>

      {!access.can('cms.partners.manage') ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}

      <Card>
        <CampaignForm
          action={createCampaignAction}
          submitLabel={frCms.common.save}
          organizations={organizations.data}
          mediaOptions={media.ok ? media.data : []}
          canManage={access.can('cms.partners.manage')}
        />
      </Card>
    </div>,
  );
}
