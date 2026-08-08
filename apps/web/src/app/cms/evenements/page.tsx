import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCmsEvents } from '@/lib/cms/queries';
import { formatDateTime } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import { EntityScheduleForm } from '../actualites/NewsScheduleForm';
import {
  scheduleEventAction,
  setEventLandingVisibilityAction,
  toggleEventPinAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.events.title };

/**
 * CMS-005 — Evenements (ADDENDUM §35).
 *
 * La couverture d'un evenement n'est pas modifiable ici : `events` n'a pas
 * de colonne d'image, et en ajouter une pour la vitrine dupliquerait un
 * champ metier. Un evenement se met en avant sur la landing par un
 * epinglage — c'est ce que l'ecran propose, et c'est ce que la base sait
 * faire. On ne montre pas un champ « couverture » qui n'ecrirait nulle part.
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
  const events = await loadCmsEvents(query, correlationId);

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
                status={visible ? 'published' : 'draft'}
                statusText={visible ? frCms.news.landingVisible : frCms.news.landingHidden}
                period={`${formatDateTime(row.startsAt)}${
                  row.endsAt === null ? '' : ` → ${formatDateTime(row.endsAt)}`
                }`}
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
              </RowCard>
            );
          })}
        </RowList>
      )}

      <p className="text-caption text-text-muted max-w-[80ch]">{frCms.events.pinHelp}</p>
    </div>,
  );
}
