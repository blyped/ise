import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminCall } from '@/lib/admin/queries';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { moderateCallAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.calls.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-017 — Detail d'un appel pour decision de moderation : contenu
 * publie, signalements, chronologie, decision MOTIVEE (approbation /
 * retrait / restauration) via `moderate_network_call` (0077).
 */
export default async function AdminCallDetailPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const access = await requireAdminPermission('calls.moderate');
  const { callId } = await params;
  const correlationId = newCorrelationId();
  const detail = await loadAdminCall(callId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.calls}
      screenTitle={frAdmin.calls.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.calls.detail.title} subtitle={frAdmin.calls.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.calls} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const call = detail.data;
  const isModerated = call.status === 'moderated';

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.calls} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={call.title} subtitle={frAdmin.calls.subtitle}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={call.status}
              label={frAdmin.calls.status[call.status] ?? call.status}
            />
            {call.urgency === 'deadline_soon' ? (
              <StatusBadge
                status="deadline_soon"
                label={frAdmin.calls.urgency[call.urgency] ?? call.urgency}
              />
            ) : null}
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdmin.calls.detail.content}>
        <p className="text-body-sm text-text-primary whitespace-pre-wrap">{call.description}</p>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdmin.calls.detail.author}>
            {call.authorProfileId !== null ? (
              <Link href={adminMemberRoute(call.authorProfileId)} className={BACK_LINK}>
                {call.authorName}
              </Link>
            ) : (
              call.authorName
            )}
          </KeyValue>
          <KeyValue label={frAdmin.calls.detail.sector}>
            {call.sector ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.calls.detail.location}>
            {[call.city, call.country].filter(Boolean).join(', ') || frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.calls.detail.deadline}>{formatDate(call.deadline)}</KeyValue>
          {call.context !== null ? (
            <KeyValue label={frAdmin.calls.detail.context}>{call.context}</KeyValue>
          ) : null}
          {call.wantedProfile !== null ? (
            <KeyValue label={frAdmin.calls.detail.wantedProfile}>{call.wantedProfile}</KeyValue>
          ) : null}
        </dl>
      </SectionCard>

      <SectionCard title={frAdmin.calls.detail.reportsTitle}>
        {call.reports.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.calls.detail.noReports}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.calls.detail.reportsTitle}>
            {call.reports.map((report) => (
              <li
                key={report.reportId}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-4"
              >
                <StatusBadge
                  status={report.status}
                  label={frAdmin.moderation.status[report.status] ?? report.status}
                />
                <StatusBadge
                  status={report.severity}
                  label={frAdmin.moderation.severity[report.severity] ?? report.severity}
                />
                <span className="text-body-sm text-text-secondary">
                  {report.reasonName ?? report.reasonCode} — {formatDateTime(report.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.calls.detail.historyTitle}>
        {call.events.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.calls.detail.noHistory}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.calls.detail.historyTitle}>
            {call.events.map((event, index) => (
              <li key={index} className="border-border rounded-lg border p-4">
                <p className="text-body-sm text-text-primary font-semibold">
                  {(event.fromStatus !== null
                    ? `${frAdmin.calls.status[event.fromStatus] ?? event.fromStatus} → `
                    : '') + (frAdmin.calls.status[event.toStatus ?? ''] ?? event.toStatus ?? '')}
                </p>
                {event.note !== null ? (
                  <p className="text-body-sm text-text-secondary mt-1">{event.note}</p>
                ) : null}
                <p className="text-caption text-text-muted mt-2">
                  {event.actorName ?? frAdmin.common.none} — {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.calls.detail.decisionTitle}>
        <div className="flex flex-wrap items-start gap-4">
          <ReasonAction
            action={moderateCallAction}
            fields={{ callId: call.callId, decision: 'approved' }}
            triggerLabel={
              isModerated ? frAdmin.calls.detail.approveModerated : frAdmin.calls.detail.approve
            }
            title={
              isModerated
                ? frAdmin.calls.detail.approveModeratedTitle
                : frAdmin.calls.detail.approveTitle
            }
            description={
              isModerated
                ? frAdmin.calls.detail.approveModeratedBody
                : frAdmin.calls.detail.approveBody
            }
            confirmLabel={
              isModerated ? frAdmin.calls.detail.approveModerated : frAdmin.calls.detail.approve
            }
            reasonLabel={frAdmin.calls.detail.reasonLabel}
            reasonPlaceholder={frAdmin.calls.detail.reasonPlaceholder}
            destructive={false}
          />
          {!isModerated ? (
            <ReasonAction
              action={moderateCallAction}
              fields={{ callId: call.callId, decision: 'rejected' }}
              triggerLabel={frAdmin.calls.detail.reject}
              title={frAdmin.calls.detail.rejectTitle}
              description={frAdmin.calls.detail.rejectBody}
              confirmLabel={frAdmin.calls.detail.reject}
              reasonLabel={frAdmin.calls.detail.reasonLabel}
              reasonPlaceholder={frAdmin.calls.detail.reasonPlaceholder}
            />
          ) : null}
        </div>
      </SectionCard>
    </div>,
  );
}
