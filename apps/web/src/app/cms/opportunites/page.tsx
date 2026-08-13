import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsOpportunities, loadMediaOptions } from '@/lib/cms/queries';
import { formatDateTime } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { CoverMediaForm } from '../_components/CoverMediaForm';
import { EntityScheduleForm } from '../actualites/NewsScheduleForm';
import {
  scheduleOpportunityAction,
  setOpportunityCoverMediaAction,
  setOpportunityLandingVisibilityAction,
  toggleOpportunityPinAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.opportunities.title };

/**
 * CMS-006bis — Opportunites (0113, ADDENDUM §13/§43).
 *
 * Miroir exact de CMS-005 (Evenements) sur un autre module source. Le CMS
 * pilote la visibilite landing, la priorite, l'epinglage temporaire, et le
 * visuel de couverture. Ni le statut de l'offre, ni sa moderation, ni sa
 * description, remuneration, contact ou URL de candidature ne transitent
 * jamais ici : ce sont des champs metier de `public.opportunities`.
 */
export default async function CmsOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const [opportunities, mediaOptionsResult] = await Promise.all([
    loadCmsOpportunities(query, correlationId),
    loadMediaOptions(correlationId),
  ]);
  const mediaOptions = mediaOptionsResult.ok ? mediaOptionsResult.data : [];

  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');
  const canSchedule = access.can('cms.schedule');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.opportunities} screenTitle={frCms.opportunities.title}>
      {children}
    </CmsShell>
  );

  if (!opportunities.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.opportunities.title} subtitle={frCms.opportunities.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={opportunities.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = opportunities.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.opportunities.title} subtitle={frCms.opportunities.subtitle} />
      <Alert variant="info" title="Ce que le CMS pilote ici">
        {frCms.opportunities.scopeNote}
      </Alert>
      <SearchField action={CMS_ROUTES.opportunities} defaultValue={query ?? ''} />

      {rows.length === 0 ? (
        <EmptyState
          title={frCms.opportunities.emptyTitle}
          description={frCms.opportunities.emptyBody}
        />
      ) : (
        <RowList label={frCms.opportunities.title}>
          {rows.map((row) => {
            const visible = row.landingVisibility === 'visible';
            const metaParts = [
              row.opportunityType ?? '—',
              row.contractType ?? '—',
              row.city ?? row.countryCode ?? '—',
              row.remoteAllowed ? 'Télétravail possible' : null,
              row.organization ?? '—',
            ].filter((part): part is string => part !== null);
            return (
              <RowCard
                key={row.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {row.title}
                    {row.isPinned ? (
                      <Badge tone="accent">{frCms.opportunities.pinned}</Badge>
                    ) : null}
                  </span>
                }
                meta={metaParts.join(' · ')}
                status={visible ? 'published' : 'draft'}
                statusText={visible ? frCms.news.landingVisible : frCms.news.landingHidden}
                period={
                  row.deadline !== null
                    ? `Échéance : ${formatDateTime(row.deadline)}`
                    : 'Sans échéance'
                }
                notice={
                  row.pendingSchedule !== null ? (
                    <span className="text-caption text-warning">
                      {frCms.news.pendingSchedule}
                      {row.pendingSchedule.publishAt !== null
                        ? ` · ${formatDateTime(row.pendingSchedule.publishAt)}`
                        : ''}
                    </span>
                  ) : null
                }
                actions={
                  <>
                    <ActionButton
                      action={setOpportunityLandingVisibilityAction}
                      fields={{ opportunityId: row.id, visible: visible ? 'false' : 'true' }}
                      label={visible ? frCms.news.hide : frCms.news.show}
                      srLabel={`${visible ? frCms.news.hide : frCms.news.show} — ${row.title}`}
                      variant={visible ? 'secondary' : 'primary'}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                    <ActionButton
                      action={toggleOpportunityPinAction}
                      fields={{ opportunityId: row.id, pin: row.isPinned ? 'false' : 'true' }}
                      label={row.isPinned ? frCms.opportunities.unpin : frCms.opportunities.pin}
                      srLabel={`${row.isPinned ? frCms.opportunities.unpin : frCms.opportunities.pin} — ${row.title}`}
                      disabled={!canEdit}
                      {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  </>
                }
              >
                <EntityScheduleForm
                  action={scheduleOpportunityAction}
                  idFieldName="opportunityId"
                  entityId={row.id}
                  label={row.title}
                  canSchedule={canSchedule}
                />
                <CoverMediaForm
                  action={setOpportunityCoverMediaAction}
                  idFieldName="opportunityId"
                  entityId={row.id}
                  label={row.title}
                  currentMediaId={row.coverMediaId}
                  mediaOptions={mediaOptions}
                  fieldLabel={frCms.opportunities.coverMedia}
                  fieldHint={frCms.opportunities.coverHelp}
                  noMediaLabel={frCms.opportunities.coverMediaNone}
                  submitLabel={frCms.opportunities.coverSubmit}
                  summaryLabel={frCms.opportunities.coverLabel}
                  canEdit={canEdit}
                />
              </RowCard>
            );
          })}
        </RowList>
      )}

      <p className="text-caption text-text-muted max-w-[80ch]">{frCms.opportunities.pinHelp}</p>
    </div>,
  );
}
