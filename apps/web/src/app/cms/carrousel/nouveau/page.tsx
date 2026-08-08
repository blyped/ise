import Link from 'next/link';
import { Alert, Card, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadMediaOptions, loadPartnerCampaigns } from '@/lib/cms/queries';
import { CmsShell } from '../../_components/CmsShell';
import { PageHeader } from '../../_components/PageHeader';
import { CarouselForm } from '../CarouselForm';
import { createSlideAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.carousel.createdTitle };

/** CMS-002 — Creation d'une slide. Elle nait en `draft` : le trigger l'impose. */
export default async function NewCarouselItemPage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [media, campaigns] = await Promise.all([
    loadMediaOptions(correlationId),
    loadPartnerCampaigns(null, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.carousel} screenTitle={frCms.carousel.createdTitle}>
      {children}
    </CmsShell>
  );

  if (!media.ok) {
    return shell(
      <ErrorState
        title={frCms.common.loadError}
        description={media.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.carousel.createdTitle} subtitle={frCms.carousel.createdBody} />
      <p>
        <Link
          href={CMS_ROUTES.carousel}
          className="text-body-sm text-primary inline-flex min-h-[44px] items-center hover:underline"
        >
          ← {frCms.carousel.title}
        </Link>
      </p>

      {!access.can('cms.edit') ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}

      <Card>
        <CarouselForm
          action={createSlideAction}
          submitLabel={frCms.common.save}
          mediaOptions={media.data}
          campaignOptions={
            campaigns.ok
              ? campaigns.data.map((campaign) => ({
                  id: campaign.id,
                  campaignName: campaign.campaignName,
                  sponsoredLabel: campaign.sponsoredLabel,
                }))
              : []
          }
          canEdit={access.can('cms.edit')}
        />
      </Card>
    </div>,
  );
}
