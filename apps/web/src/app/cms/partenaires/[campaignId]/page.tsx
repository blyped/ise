import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import {
  loadCampaignMetrics,
  loadMediaOptions,
  loadOrganizations,
  loadPartnerCampaign,
} from '@/lib/cms/queries';
import { formatPeriod, statusLabel, statusTone } from '@/lib/cms/format';
import { CmsShell } from '../../_components/CmsShell';
import { PageHeader } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { DangerAction } from '../../_components/DangerAction';
import { CampaignForm } from '../CampaignForm';
import {
  deleteCampaignAction,
  publishCampaignAction,
  rollbackCampaignAction,
  unpublishCampaignAction,
  updateCampaignAction,
} from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.partners.title };

/**
 * CMS-007 — Fiche d'une campagne.
 *
 * Les mesures viennent de `get_partner_campaign_metrics()`, qui compte des
 * evenements REELLEMENT enregistres. Sans impression, aucun CTR n'est
 * affiche — pas « 0 % », pas « — % » : la phrase dit qu'il n'y a rien a
 * calculer (§51).
 */
export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const access = await requireCmsAccess();
  const { campaignId } = await params;
  const correlationId = newCorrelationId();

  const [campaign, organizations, media, metrics] = await Promise.all([
    loadPartnerCampaign(campaignId, correlationId),
    loadOrganizations(correlationId),
    loadMediaOptions(correlationId),
    loadCampaignMetrics(campaignId, correlationId),
  ]);

  const canManage = access.can('cms.partners.manage');
  const canPublish = access.can('cms.publish');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.partners} screenTitle={frCms.partners.title}>
      {children}
    </CmsShell>
  );

  if (!campaign.ok) {
    return shell(
      <ErrorState
        title={frCms.common.loadError}
        description={campaign.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }
  if (campaign.data === null) notFound();

  const row = campaign.data;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`${row.organizationName ?? '—'} · ${row.campaignName}`}
        subtitle={frCms.partners.subtitle}
      />

      <p>
        <Link
          href={CMS_ROUTES.partners}
          className="text-body-sm text-primary inline-flex min-h-[44px] items-center hover:underline"
        >
          ← {frCms.partners.title}
        </Link>
      </p>

      <section
        aria-label="État de la campagne"
        className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-5"
      >
        <Badge tone={statusTone(row.status)}>{statusLabel(row.status)}</Badge>
        <Badge tone="accent">{row.sponsoredLabel}</Badge>
        <span className="text-caption text-text-secondary">
          {formatPeriod(row.startAt, row.endAt)}
        </span>
        <span className="text-caption text-text-muted">
          {row.isLive ? frCms.partners.active : frCms.partners.outOfPeriod}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          {row.status === 'published' ? (
            <ActionButton
              action={unpublishCampaignAction}
              fields={{ campaignId: row.id }}
              label={frCms.actions.unpublish}
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : (
            <ActionButton
              action={publishCampaignAction}
              fields={{ campaignId: row.id }}
              label={frCms.actions.publish}
              variant="primary"
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          )}
          {row.hasPreviousSnapshot ? (
            <ActionButton
              action={rollbackCampaignAction}
              fields={{ campaignId: row.id }}
              label={frCms.actions.rollback}
              disabled={!canPublish}
              {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
            />
          ) : null}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.partners.metricsTitle}</CardTitle>
        </CardHeader>
        {!metrics.ok ? (
          <Alert variant="info" title="Mesures indisponibles">
            Les mesures ne sont pas accessibles avec vos permissions actuelles.
          </Alert>
        ) : metrics.data === null || metrics.data.impressions === 0 ? (
          <p className="text-body-sm text-text-secondary">{frCms.partners.metricsNone}</p>
        ) : (
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-caption text-text-muted">{frCms.partners.metricsImpressions}</dt>
              <dd className="text-h3 text-text-primary font-bold">{metrics.data.impressions}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">{frCms.partners.metricsClicks}</dt>
              <dd className="text-h3 text-text-primary font-bold">{metrics.data.clicks}</dd>
            </div>
            <div>
              <dt className="text-caption text-text-muted">{frCms.partners.metricsCtr}</dt>
              <dd className="text-h3 text-text-primary font-bold">
                {metrics.data.ctr === null
                  ? frCms.common.none
                  : `${(metrics.data.ctr * 100).toFixed(1).replace('.', ',')} %`}
              </dd>
            </div>
          </dl>
        )}
        <p className="text-caption text-text-muted mt-4">{frCms.partners.metricsNote}</p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.actions.edit}</CardTitle>
        </CardHeader>
        <CampaignForm
          action={updateCampaignAction}
          submitLabel={frCms.common.save}
          campaign={row}
          organizations={organizations.ok ? organizations.data : []}
          mediaOptions={media.ok ? media.data : []}
          canManage={canManage}
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frCms.partners.deleteTitle}</CardTitle>
        </CardHeader>
        <DangerAction
          action={deleteCampaignAction}
          fields={{ campaignId: row.id }}
          triggerLabel={frCms.actions.delete}
          title={frCms.partners.deleteTitle}
          description={frCms.partners.deleteBody}
          confirmLabel={frCms.partners.deleteConfirm}
          disabled={!canManage}
          disabledReason={frCms.common.forbidden}
        />
      </Card>
    </div>,
  );
}
