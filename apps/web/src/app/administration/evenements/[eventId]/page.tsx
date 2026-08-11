import Link from 'next/link';
import { ErrorState, EmptyState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminEvents } from '@/i18n/admin-events';
import { ADMIN_ROUTES, adminEventRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadAdminEvent,
  loadAdminEventFollowup,
  loadAdminEventOnlineUrl,
  loadAdminEventRegistrations,
} from '@/lib/admin/queries-events';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { nextPageHref, paramOneOf, paramValue, type SearchParams } from '@/lib/admin/params';
import { AdminShell } from '../../_components/AdminShell';
import { ActionButton } from '../../_components/ActionButton';
import { CursorPager, KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { RowCard, RowList } from '../../_components/RowCard';
import { EventEditForm } from './EventEditForm';
import { EventFollowupForm } from './EventFollowupForm';
import {
  cancelEventAction,
  recordEventImpactSnapshotAction,
  setEventStatusAction,
  setRegistrationStatusAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminEvents.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Cibles de statut atteignables depuis chaque statut courant, hors annulation (0100/events_status_check). */
const STATUS_TARGETS: Record<string, readonly string[]> = {
  draft: ['pending_review', 'published'],
  pending_review: ['draft', 'published'],
  published: ['full', 'completed'],
  full: ['published', 'completed'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

/** Statuts depuis lesquels une annulation reste possible. */
const CANCELLABLE_FROM = new Set(['draft', 'pending_review', 'published', 'full']);

const REGISTRATION_STATUSES = [
  'registered',
  'pending_approval',
  'waitlisted',
  'cancelled',
  'attended',
  'no_show',
] as const;

function registrationOptionsFor(status: string): readonly string[] {
  return REGISTRATION_STATUSES.filter((value) => value !== status);
}

/**
 * SA-031/032/033 — Fiche evenement, un seul ecran couvre le cycle
 * complet : edition du contenu et de la logistique + transitions de
 * cycle de vie (SA-031), suivi et constation des inscriptions (SA-032),
 * bilan organisateur et instantane d'impact (SA-033) — meme principe
 * que la fiche communaute SA-028/029 et la fiche projet SA-024/025/026 :
 * le cycle de vie d'un evenement tient sur un seul ecran, pas besoin de
 * le fragmenter en routes distinctes.
 */
export default async function AdminEventDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('events.manage');
  const { eventId } = await params;
  const search = await searchParams;
  const registrationStatus = paramOneOf(search, 'estatut', REGISTRATION_STATUSES);
  const registrationCursor = paramValue(search, 'curseur');
  const correlationId = newCorrelationId();

  const detail = await loadAdminEvent(eventId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.events} screenTitle={frAdminEvents.detail.title}>
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminEvents.detail.title} subtitle={frAdminEvents.list.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.events} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const event = detail.data;
  const [followupResult, onlineUrlResult, registrationsResult] = await Promise.all([
    loadAdminEventFollowup(eventId, correlationId),
    loadAdminEventOnlineUrl(eventId, correlationId),
    loadAdminEventRegistrations(eventId, registrationStatus, registrationCursor, correlationId),
  ]);

  const followup = followupResult.ok ? followupResult.data : null;
  const onlineUrl = onlineUrlResult.ok ? onlineUrlResult.data : null;
  const registrationRows = registrationsResult.ok ? registrationsResult.data.rows : [];

  const statusTargets = STATUS_TARGETS[event.status] ?? [];
  const canCancel = CANCELLABLE_FROM.has(event.status);
  const eventImpact = followup?.eventImpact ?? null;

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.events} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={event.title} subtitle={event.description ?? ''}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={event.status} label={frAdminEvents.status[event.status] ?? event.status} />
            <StatusBadge status={event.format} label={frAdminEvents.format[event.format] ?? event.format} />
            <StatusBadge
              status={event.eventTypeCode}
              label={frAdminEvents.eventType[event.eventTypeCode] ?? event.eventTypeCode}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminEvents.detail.contentTitle}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdminEvents.detail.organizer}>
            {event.organizerLabel ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdminEvents.list.columns.registered}>{event.registeredCount}</KeyValue>
          <KeyValue label={frAdminEvents.detail.createdAt}>{formatDateTime(event.createdAt)}</KeyValue>
          <KeyValue label={frAdminEvents.detail.publishedAt}>
            {event.publishedAt !== null ? formatDateTime(event.publishedAt) : frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdminEvents.detail.completedAt}>
            {event.completedAt !== null ? formatDateTime(event.completedAt) : frAdmin.common.none}
          </KeyValue>
          {event.cancelledAt !== null ? (
            <KeyValue label={frAdminEvents.detail.cancelledAt}>{formatDateTime(event.cancelledAt)}</KeyValue>
          ) : null}
          {event.cancellationReason !== null ? (
            <KeyValue label={frAdminEvents.detail.cancellationReason}>{event.cancellationReason}</KeyValue>
          ) : null}
        </dl>
      </SectionCard>

      {statusTargets.length > 0 || canCancel ? (
        <SectionCard title={frAdminEvents.detail.lifecycleTitle}>
          <p className="text-caption text-text-muted">{frAdminEvents.detail.lifecycleHint}</p>
          <div className="flex flex-wrap gap-3">
            {statusTargets.map((target) => (
              <ActionButton
                key={target}
                action={setEventStatusAction}
                fields={{ eventId, status: target }}
                label={`${frAdminEvents.detail.setStatus} : ${frAdminEvents.status[target]}`}
                variant="secondary"
              />
            ))}
            {canCancel ? (
              <ReasonAction
                action={cancelEventAction}
                fields={{ eventId }}
                triggerLabel={frAdminEvents.detail.cancelTrigger}
                title={frAdminEvents.detail.cancelTitle}
                description={frAdminEvents.detail.cancelBody}
                confirmLabel={frAdminEvents.detail.cancelTrigger}
                withReason={true}
                reasonLabel={frAdminEvents.detail.cancelReasonLabel}
                reasonPlaceholder={frAdminEvents.detail.cancelReasonPlaceholder}
                destructive={true}
              />
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={frAdminEvents.form.editTitle}>
        <EventEditForm event={event} onlineUrl={onlineUrl} />
      </SectionCard>

      <SectionCard title={frAdminEvents.detail.registrationsTitle}>
        <p className="text-caption text-text-muted">{frAdminEvents.detail.registrationsSubtitle}</p>
        {registrationRows.length === 0 ? (
          <EmptyState
            title={frAdminEvents.detail.noRegistrations}
            description={frAdminEvents.detail.registrationsSubtitle}
          />
        ) : (
          <>
            <RowList label={frAdminEvents.detail.registrationsTitle}>
              {registrationRows.map((row) => (
                <RowCard
                  key={row.profileId}
                  title={row.profile?.displayName ?? frAdmin.common.none}
                  meta={`${frAdminEvents.detail.registrationsColumns.registered} : ${formatDate(row.registeredAt)}`}
                  badges={
                    <StatusBadge
                      status={row.status}
                      label={frAdminEvents.registrationStatus[row.status] ?? row.status}
                    />
                  }
                  actions={
                    <ReasonAction
                      action={setRegistrationStatusAction}
                      fields={{ eventId, profileId: row.profileId }}
                      triggerLabel={frAdminEvents.detail.markAttendance}
                      title={frAdminEvents.detail.markAttendanceTitle}
                      description={frAdminEvents.detail.markAttendanceBody}
                      confirmLabel={frAdminEvents.detail.markAttendance}
                      withReason={false}
                      destructive={false}
                      select={{
                        name: 'status',
                        label: frAdminEvents.detail.markAttendanceSelectLabel,
                        options: registrationOptionsFor(row.status).map((value) => ({
                          value,
                          label: frAdminEvents.registrationStatus[value] ?? value,
                        })),
                      }}
                    />
                  }
                />
              ))}
            </RowList>

            <CursorPager
              shownCount={registrationRows.length}
              nextHref={nextPageHref(
                `${ADMIN_ROUTES.events}/${encodeURIComponent(eventId)}`,
                { estatut: registrationStatus },
                registrationsResult.ok ? registrationsResult.data.nextCursor : null,
              )}
            />
          </>
        )}
      </SectionCard>

      <SectionCard title={frAdminEvents.detail.followupTitle}>
        <p className="text-caption text-text-muted">{frAdminEvents.detail.followupSubtitle}</p>
        <EventFollowupForm eventId={eventId} followup={followup?.followup ?? null} />
      </SectionCard>

      <SectionCard title={frAdminEvents.detail.impactTitle}>
        <p className="text-caption text-text-muted">{frAdminEvents.detail.impactSubtitle}</p>
        {eventImpact === null ? (
          <EmptyState title={frAdminEvents.detail.impactNoSnapshot} description={frAdminEvents.detail.impactSubtitle} />
        ) : (
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <KeyValue label={frAdminEvents.detail.impactSnapshotAt}>
              {formatDateTime(eventImpact.snapshotAt)}
            </KeyValue>
            <KeyValue label={frAdminEvents.detail.impactRegistered}>{eventImpact.registeredCount}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactAttended}>{eventImpact.attendedCount}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactNoShow}>{eventImpact.noShowCount}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactPromotions}>{eventImpact.promotionsRepresented}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactCountries}>{eventImpact.countriesRepresented}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactConnections}>{eventImpact.connectionsCreated}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactProjects}>{eventImpact.projectsInitiated}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactMentorships}>{eventImpact.mentorshipsInitiated}</KeyValue>
            <KeyValue label={frAdminEvents.detail.impactResources}>{eventImpact.resourcesProduced}</KeyValue>
          </dl>
        )}
        <div>
          <ActionButton
            action={recordEventImpactSnapshotAction}
            fields={{ eventId }}
            label={frAdminEvents.detail.impactRecord}
            variant="secondary"
          />
        </div>
      </SectionCard>
    </div>,
  );
}
