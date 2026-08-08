import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCarouselItem, loadMediaOptions, loadPartnerCampaigns } from '@/lib/cms/queries';
import { formatLongDateTime, formatPeriod, statusLabel, statusTone } from '@/lib/cms/format';
import { CmsShell } from '../../_components/CmsShell';
import { PageHeader } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { DangerAction } from '../../_components/DangerAction';
import { CarouselForm } from '../CarouselForm';
import {
  deleteSlideAction,
  publishSlideAction,
  rollbackSlideAction,
  transitionSlideAction,
  updateSlideAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.carousel.title };

/**
 * CMS-002 — Fiche d'une slide : edition du BROUILLON, apercu, transitions.
 *
 * L'apercu (§32) montre le brouillon en cours. Il ne publie rien : la
 * landing continue de servir l'instantane publie tant que « Publier »
 * n'a pas ete actionne (§48).
 */
export default async function CarouselItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const access = await requireCmsAccess();
  const { itemId } = await params;
  const correlationId = newCorrelationId();

  const [item, media, campaigns] = await Promise.all([
    loadCarouselItem(itemId, correlationId),
    loadMediaOptions(correlationId),
    loadPartnerCampaigns(null, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.carousel} screenTitle={frCms.carousel.title}>
      {children}
    </CmsShell>
  );

  if (!item.ok) {
    return shell(
      <ErrorState
        title={frCms.common.loadError}
        description={item.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }
  if (item.data === null) notFound();

  const slide = item.data;
  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={slide.title} subtitle={frCms.carousel.subtitle} />

      <p>
        <Link
          href={CMS_ROUTES.carousel}
          className="text-body-sm text-primary inline-flex min-h-[44px] items-center hover:underline"
        >
          ← {frCms.carousel.title}
        </Link>
      </p>

      <section
        aria-label="État de la slide"
        className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-5"
      >
        <Badge tone={statusTone(slide.status)}>{statusLabel(slide.status)}</Badge>
        <span className="text-caption text-text-secondary">
          {formatPeriod(slide.startAt, slide.endAt)}
        </span>
        <span className="text-caption text-text-muted">
          {slide.publishedAt === null
            ? 'Jamais publiée'
            : `Publiée le ${formatLongDateTime(slide.publishedAt)}`}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          {slide.status === 'published' ? (
            <ActionButton
              action={transitionSlideAction}
              fields={{ itemId: slide.id, toStatus: 'expired' }}
              label={frCms.actions.unpublish}
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : (
            <ActionButton
              action={publishSlideAction}
              fields={{ itemId: slide.id }}
              label={frCms.actions.publish}
              variant="primary"
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          )}
          {slide.hasPreviousSnapshot ? (
            <ActionButton
              action={rollbackSlideAction}
              fields={{ itemId: slide.id }}
              label={frCms.actions.rollback}
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : null}
          {slide.status !== 'archived' ? (
            <ActionButton
              action={transitionSlideAction}
              fields={{ itemId: slide.id, toStatus: 'archived' }}
              label={frCms.actions.archive}
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : null}
        </div>
      </section>

      {slide.hasUnpublishedChanges ? (
        <Alert variant="warning" title="Brouillon non publié">
          Le brouillon a été modifié après la dernière publication. La landing sert toujours la
          version publiée : c’est la séparation brouillon / publié (§48).
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.carousel.previewTitle}</CardTitle>
        </CardHeader>
        <div className="rounded-lg bg-[#0B1B32] p-8 text-white">
          <p className="text-h2 font-bold">{slide.title}</p>
          {slide.subtitle !== null ? (
            <p className="text-body-sm mt-2 opacity-80">{slide.subtitle}</p>
          ) : null}
          {slide.description !== null ? (
            <p className="text-body-sm mt-3 max-w-[60ch] opacity-70">{slide.description}</p>
          ) : null}
          {slide.ctaLabel !== null ? (
            <p className="mt-5">
              <span className="rounded-base inline-flex min-h-[44px] items-center bg-[#D9A441] px-5 font-semibold text-[#0B1B32]">
                {slide.ctaLabel}
              </span>
            </p>
          ) : null}
          {slide.isSponsored ? (
            <p className="text-caption mt-4 opacity-80">
              {slide.sponsoredLabel ?? frCms.carousel.sponsoredBadge}
            </p>
          ) : null}
        </div>
        <dl className="text-caption text-text-muted mt-4 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="inline font-medium">{frCms.carousel.fieldMedia} : </dt>
            <dd className="inline">{slide.mediaAlt ?? frCms.carousel.noMedia}</dd>
          </div>
          <div>
            <dt className="inline font-medium">{frCms.carousel.fieldMobileMedia} : </dt>
            <dd className="inline">{slide.mobileMediaAlt ?? frCms.carousel.noMedia}</dd>
          </div>
        </dl>
        <p className="text-caption text-text-muted mt-3">{frCms.carousel.previewNote}</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.actions.edit}</CardTitle>
        </CardHeader>
        <CarouselForm
          action={updateSlideAction}
          submitLabel={frCms.common.save}
          item={slide}
          mediaOptions={media.ok ? media.data : []}
          campaignOptions={
            campaigns.ok
              ? campaigns.data.map((campaign) => ({
                  id: campaign.id,
                  campaignName: campaign.campaignName,
                  sponsoredLabel: campaign.sponsoredLabel,
                }))
              : []
          }
          canEdit={canEdit}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.carousel.deleteTitle}</CardTitle>
        </CardHeader>
        <DangerAction
          action={deleteSlideAction}
          fields={{ itemId: slide.id, confirmed: 'true' }}
          triggerLabel={frCms.actions.delete}
          title={frCms.carousel.deleteTitle}
          description={frCms.carousel.deleteBody}
          confirmLabel={frCms.carousel.deleteConfirm}
          disabled={!canPublish}
          disabledReason={frCms.common.forbidden}
        />
      </Card>
    </div>,
  );
}
