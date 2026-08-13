import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsNews, loadMediaOptions } from '@/lib/cms/queries';
import { formatDate, formatDateTime } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { CoverMediaForm } from '../_components/CoverMediaForm';
import { EntityScheduleForm } from './NewsScheduleForm';
import {
  scheduleNewsAction,
  setNewsCoverHasTextAction,
  setNewsCoverMediaAction,
  setNewsFeaturedAction,
  setNewsLandingVisibilityAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.news.title };

/**
 * CMS-004 — Actualites (ADDENDUM §34).
 *
 * AUCUNE TABLE N'EST CREEE. L'ecran lit `public.news` a travers
 * `list_cms_news()`, qui enumere ses colonnes et laisse `body` de cote.
 * Il ecrit uniquement `landing_visibility`, `landing_priority` et
 * `is_featured` — trois colonnes qui existaient deja (§34, D-128).
 */
export default async function CmsNewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const [news, mediaOptionsResult] = await Promise.all([
    loadCmsNews(query, correlationId),
    loadMediaOptions(correlationId),
  ]);
  const mediaOptions = mediaOptionsResult.ok ? mediaOptionsResult.data : [];

  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');
  const canSchedule = access.can('cms.schedule');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.news} screenTitle={frCms.news.title}>
      {children}
    </CmsShell>
  );

  if (!news.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.news.title} subtitle={frCms.news.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={news.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = news.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.news.title} subtitle={frCms.news.subtitle} />
      <Alert variant="info" title="Ce que le CMS pilote ici">
        {frCms.news.scopeNote}
      </Alert>
      <SearchField action={CMS_ROUTES.news} defaultValue={query ?? ''} />

      {rows.length === 0 ? (
        <EmptyState title={frCms.news.emptyTitle} description={frCms.news.emptyBody} />
      ) : (
        <RowList label={frCms.news.title}>
          {rows.map((row) => {
            const visible = row.landingVisibility === 'visible';
            return (
              <RowCard
                key={row.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {row.title}
                    {row.isFeatured ? <Badge tone="accent">{frCms.news.featured}</Badge> : null}
                  </span>
                }
                meta={`${row.categoryCode} · ${frCms.news.editorialStatus} : ${row.editorialStatus} · ${
                  row.coverMediaId === null ? frCms.news.noCover : frCms.news.cover
                } · priorité ${row.landingPriority}`}
                statusText={visible ? frCms.news.landingVisible : frCms.news.landingHidden}
                status={visible ? 'published' : 'draft'}
                period={
                  row.publishedAt === null
                    ? frCms.common.notScheduled
                    : `Publiée le ${formatDate(row.publishedAt)}`
                }
                notice={
                  row.pendingSchedule !== null ? (
                    <span className="text-caption text-warning">
                      {frCms.news.pendingSchedule} :{' '}
                      {row.pendingSchedule.publishAt !== null
                        ? `${frCms.schedule.publishAt} ${formatDateTime(row.pendingSchedule.publishAt)}`
                        : ''}
                      {row.pendingSchedule.unpublishAt !== null
                        ? ` · ${frCms.schedule.unpublishAt} ${formatDateTime(row.pendingSchedule.unpublishAt)}`
                        : ''}
                    </span>
                  ) : null
                }
                actions={
                  <>
                    <ActionButton
                      action={setNewsLandingVisibilityAction}
                      fields={{ newsId: row.id, visible: visible ? 'false' : 'true' }}
                      label={visible ? frCms.news.hide : frCms.news.show}
                      srLabel={`${visible ? frCms.news.hide : frCms.news.show} — ${row.title}`}
                      variant={visible ? 'secondary' : 'primary'}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                    <ActionButton
                      action={setNewsFeaturedAction}
                      fields={{ newsId: row.id, featured: row.isFeatured ? 'false' : 'true' }}
                      label={row.isFeatured ? frCms.news.unsetFeatured : frCms.news.setFeatured}
                      srLabel={`${row.isFeatured ? frCms.news.unsetFeatured : frCms.news.setFeatured} — ${row.title}`}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  </>
                }
              >
                <EntityScheduleForm
                  action={scheduleNewsAction}
                  idFieldName="newsId"
                  entityId={row.id}
                  label={row.title}
                  canSchedule={canSchedule}
                />
                <CoverMediaForm
                  action={setNewsCoverMediaAction}
                  idFieldName="newsId"
                  entityId={row.id}
                  label={row.title}
                  currentMediaId={row.coverMediaId}
                  mediaOptions={mediaOptions}
                  fieldLabel={frCms.news.coverMedia}
                  fieldHint={frCms.news.coverHelp}
                  noMediaLabel={frCms.news.coverMediaNone}
                  submitLabel={frCms.news.coverSubmit}
                  summaryLabel={frCms.news.coverLabel}
                  canEdit={canEdit}
                />
                {row.coverMediaId !== null ? (
                  <div className="border-border mt-4 flex flex-wrap items-center gap-3 rounded-lg border p-4">
                    <div className="flex flex-col gap-1">
                      <p className="text-body-sm text-text-primary font-medium">
                        {frCms.news.coverHasText}
                      </p>
                      <p className="text-caption text-text-muted max-w-[60ch]">
                        {frCms.news.coverHasTextHelp}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {row.coverHasText ? frCms.news.coverHasTextOn : frCms.news.coverHasTextOff}
                      </p>
                    </div>
                    <ActionButton
                      action={setNewsCoverHasTextAction}
                      fields={{
                        newsId: row.id,
                        mediaId: row.coverMediaId,
                        hasText: row.coverHasText ? 'false' : 'true',
                      }}
                      label={
                        row.coverHasText ? frCms.news.coverHasTextOff : frCms.news.coverHasTextOn
                      }
                      srLabel={`${
                        row.coverHasText ? frCms.news.coverHasTextOff : frCms.news.coverHasTextOn
                      } — ${row.title}`}
                      disabled={!canEdit}
                      {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  </div>
                ) : null}
              </RowCard>
            );
          })}
        </RowList>
      )}

      <p className="text-caption text-text-muted">{frCms.news.coverHelp}</p>
    </div>,
  );
}
