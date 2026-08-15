import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsEvents, loadMediaOptions } from '@/lib/cms/queries';
import { formatDateTime, landingBlockedLabel, LANDING_BLOCKED_STATUS } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { CoverMediaForm } from '../_components/CoverMediaForm';
import { EntityScheduleForm } from '../actualites/NewsScheduleForm';
import {
  scheduleEventAction,
  setEventCoverMediaAction,
  setEventLandingVisibilityAction,
  toggleEventPinAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.events.title };

/**
 * CMS-005 — Evenements (ADDENDUM §35).
 *
 * Le CMS pilote la visibilite landing, la priorite, l'epinglage temporaire,
 * et depuis 0113 le visuel de couverture (`cover_media_id`, FK vers la
 * mediatheque publique — jamais un chemin recopie a la main). Aucun autre
 * champ metier (titre, lieu, dates, statut) n'est modifiable ici.
 */
export default async function CmsEventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const [events, mediaOptionsResult] = await Promise.all([
    loadCmsEvents(query, correlationId),
    loadMediaOptions(correlationId),
  ]);
  const mediaOptions = mediaOptionsResult.ok ? mediaOptionsResult.data : [];

  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');
  const canSchedule = access.can('cms.schedule');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.events} screenTitle={frCms.events.title}>
      {children}
    </CmsShell>
  );

  if (!events.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.events.title} subtitle={frCms.events.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={events.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = events.data.rows;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.events.title} subtitle={frCms.events.subtitle} />
      <Alert variant="info" title="Ce que le CMS pilote ici">
        {frCms.events.scopeNote}
      </Alert>
      <SearchField action={CMS_ROUTES.events} defaultValue={query ?? ''} />

      {rows.length === 0 ? (
        <EmptyState title={frCms.events.emptyTitle} description={frCms.events.emptyBody} />
      ) : (
        <RowList label={frCms.events.title}>
          {rows.map((row) => {
            const visible = row.landingVisibility === 'visible';
            /**
             * 0137 — l'écran ne peut plus annoncer « Visible sur la landing »
             * pour un événement que la landing n'affichera pas.
             *
             * Le motif est calculé en base par le prédicat même dont
             * `get_landing_events()` se sert pour filtrer : les deux ne
             * peuvent plus diverger. On ne l'affiche que si l'exposition est
             * demandée — un événement volontairement masqué n'est pas une
             * contradiction, et sa pastille « Masqué » suffit.
             */
            const blockedReason = visible ? row.landingBlockedReason : null;
            return (
              <RowCard
                key={row.id}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {row.title}
                    {row.isPinned ? <Badge tone="accent">{frCms.events.pinned}</Badge> : null}
                    {row.cancelledAt !== null ? (
                      <Badge tone="error">{frCms.events.cancelled}</Badge>
                    ) : null}
                  </span>
                }
                meta={`${row.format} · ${row.city ?? '—'} · ${
                  row.isUpcoming ? frCms.events.upcoming : frCms.events.past
                } · ${row.status}`}
                status={
                  blockedReason !== null
                    ? LANDING_BLOCKED_STATUS
                    : visible
                      ? 'published'
                      : 'draft'
                }
                statusText={
                  blockedReason !== null
                    ? frCms.landingBlocked.label
                    : visible
                      ? frCms.news.landingVisible
                      : frCms.news.landingHidden
                }
                period={`${formatDateTime(row.startsAt)}${
                  row.endsAt === null ? '' : ` → ${formatDateTime(row.endsAt)}`
                }`}
                notice={
                  blockedReason !== null || row.pendingSchedule !== null ? (
                    <span className="flex flex-col gap-1">
                      {blockedReason !== null ? (
                        <span className="text-caption text-warning">
                          {frCms.landingBlocked.label} : {landingBlockedLabel(blockedReason)}
                        </span>
                      ) : null}
                      {row.pendingSchedule !== null ? (
                        <span className="text-caption text-warning">
                          {frCms.news.pendingSchedule}
                          {row.pendingSchedule.publishAt !== null
                            ? ` · ${formatDateTime(row.pendingSchedule.publishAt)}`
                            : ''}
                        </span>
                      ) : null}
                    </span>
                  ) : null
                }
                actions={
                  <>
                    <ActionButton
                      action={setEventLandingVisibilityAction}
                      fields={{ eventId: row.id, visible: visible ? 'false' : 'true' }}
                      label={visible ? frCms.news.hide : frCms.news.show}
                      srLabel={`${visible ? frCms.news.hide : frCms.news.show} — ${row.title}`}
                      variant={visible ? 'secondary' : 'primary'}
                      disabled={!canPublish}
                      {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                    <ActionButton
                      action={toggleEventPinAction}
                      fields={{ eventId: row.id, pin: row.isPinned ? 'false' : 'true' }}
                      label={row.isPinned ? frCms.events.unpin : frCms.events.pin}
                      srLabel={`${row.isPinned ? frCms.events.unpin : frCms.events.pin} — ${row.title}`}
                      disabled={!canEdit}
                      {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                    />
                  </>
                }
              >
                <EntityScheduleForm
                  action={scheduleEventAction}
                  idFieldName="eventId"
                  entityId={row.id}
                  label={row.title}
                  canSchedule={canSchedule}
                />
                <CoverMediaForm
                  action={setEventCoverMediaAction}
                  idFieldName="eventId"
                  entityId={row.id}
                  label={row.title}
                  currentMediaId={row.coverMediaId}
                  mediaOptions={mediaOptions}
                  fieldLabel={frCms.events.coverMedia}
                  fieldHint={frCms.events.coverHelp}
                  noMediaLabel={frCms.events.coverMediaNone}
                  submitLabel={frCms.events.coverSubmit}
                  summaryLabel={frCms.events.coverLabel}
                  canEdit={canEdit}
                />
              </RowCard>
            );
          })}
        </RowList>
      )}

      <p className="text-caption text-text-muted max-w-[80ch]">{frCms.events.pinHelp}</p>
    </div>,
  );
}
