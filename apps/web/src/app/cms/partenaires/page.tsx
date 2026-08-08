import Link from 'next/link';
import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES, partnerCampaignRoute } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadPartnerCampaigns } from '@/lib/cms/queries';
import { formatPeriod } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { publishCampaignAction, rollbackCampaignAction, unpublishCampaignAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.partners.title };

const EDIT_LINK =
  'inline-flex min-h-[44px] items-center rounded-base border border-[#CBD5E1] bg-surface px-4 ' +
  'text-body-sm font-medium text-text-primary hover:border-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * CMS-007 — Partenaires (ADDENDUM §37).
 *
 * Chaque ligne affiche la MENTION DE TRANSPARENCE reelle de la campagne,
 * pas une pastille generique : c'est le texte que verra le visiteur (§26).
 */
export default async function CmsPartnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const campaigns = await loadPartnerCampaigns(query, correlationId);

  const canManage = access.can('cms.partners.manage');
  const canPublish = access.can('cms.publish');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.partners} screenTitle={frCms.partners.title}>
      {children}
    </CmsShell>
  );

  const header = (
    <PageHeader
      title={frCms.partners.title}
      subtitle={frCms.partners.subtitle}
      action={canManage ? { href: CMS_ROUTES.partnersNew, label: frCms.partners.add } : undefined}
    />
  );

  if (!campaigns.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frCms.common.loadError}
          description={campaigns.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = campaigns.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      <SearchField action={CMS_ROUTES.partners} defaultValue={query ?? ''} />

      {rows.length === 0 ? (
        <EmptyState
          title={frCms.partners.emptyTitle}
          description={frCms.partners.emptyBody}
          action={
            canManage ? (
              <Link href={CMS_ROUTES.partnersNew} className={EDIT_LINK}>
                {frCms.partners.add}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <RowList label={frCms.partners.title}>
          {rows.map((campaign) => (
            <RowCard
              key={campaign.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {campaign.organizationName ?? '—'} · {campaign.campaignName}
                  <Badge tone="accent">{campaign.sponsoredLabel}</Badge>
                </span>
              }
              meta={`${frCms.placement[campaign.placement] ?? campaign.placement} · ${
                campaign.isLive ? frCms.partners.active : frCms.partners.outOfPeriod
              }`}
              status={campaign.status}
              period={formatPeriod(campaign.startAt, campaign.endAt)}
              notice={
                campaign.hasUnpublishedChanges ? (
                  <span className="text-caption text-warning">Modifications non publiées.</span>
                ) : null
              }
              actions={
                <>
                  {campaign.status === 'published' ? (
                    <ActionButton
                      action={unpublishCampaignAction}
                      fields={{ campaignId: campaign.id }}
                      label={frCms.actions.unpublish}
                      srLabel={`${frCms.actions.unpublish} — ${campaign.campaignName}`}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  ) : (
                    <ActionButton
                      action={publishCampaignAction}
                      fields={{ campaignId: campaign.id }}
                      label={frCms.actions.publish}
                      srLabel={`${frCms.actions.publish} — ${campaign.campaignName}`}
                      variant="primary"
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  )}
                  {campaign.hasPreviousSnapshot ? (
                    <ActionButton
                      action={rollbackCampaignAction}
                      fields={{ campaignId: campaign.id }}
                      label={frCms.actions.rollback}
                      srLabel={`${frCms.actions.rollback} — ${campaign.campaignName}`}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  ) : null}
                  <Link href={partnerCampaignRoute(campaign.id)} className={EDIT_LINK}>
                    {frCms.actions.edit}
                    <span className="sr-only"> — {campaign.campaignName}</span>
                  </Link>
                </>
              }
            />
          ))}
        </RowList>
      )}

      {!canManage ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}
    </div>,
  );
}
