import Link from 'next/link';
import { Alert, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminReport } from '@/lib/admin/queries';
import { formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ActionButton } from '../../_components/ActionButton';
import { ReasonAction } from '../../_components/ReasonAction';
import { recordModerationActionAction, transitionReportAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.moderation.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

const RESOLUTIONS = [
  'no_violation',
  'content_removed',
  'content_hidden',
  'member_warned',
  'member_suspended',
  'escalated',
  'duplicate',
] as const;

const MODERATION_ACTIONS = ['warn', 'account_suspension', 'lift_suspension', 'escalate'] as const;

/**
 * SA-018 / SA-039 — Examen d'un signalement : dossier, chronologie,
 * actions a effet reel, transitions par la machine d'etats
 * (`transition_report` — un trigger refuse tout UPDATE direct).
 */
export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const access = await requireAdminPermission('profiles.moderate');
  const { reportId } = await params;
  const correlationId = newCorrelationId();
  const detail = await loadAdminReport(reportId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.moderation}
      screenTitle={frAdmin.moderation.detail.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader
          title={frAdmin.moderation.detail.title}
          subtitle={frAdmin.moderation.subtitle}
        />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.moderation} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const report = detail.data;
  const isOpen = report.status === 'open';
  const isReviewing = report.status === 'reviewing';

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.moderation} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={`${frAdmin.moderation.detail.title} — ${report.reasonName}`}
          subtitle={frAdmin.moderation.subtitle}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={report.status}
              label={frAdmin.moderation.status[report.status] ?? report.status}
            />
            <StatusBadge
              status={report.severity}
              label={frAdmin.moderation.severity[report.severity] ?? report.severity}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdmin.moderation.detail.fileTitle}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdmin.moderation.columns.target}>
            {frAdmin.moderation.targetType[report.targetType] ?? report.targetType}
          </KeyValue>
          <KeyValue label={frAdmin.moderation.reportedBy}>
            {report.reporterName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.moderation.detail.targetOwner}>
            {report.targetOwnerId !== null && report.targetOwnerName !== null ? (
              <Link href={adminMemberRoute(report.targetOwnerId)} className={BACK_LINK}>
                {report.targetOwnerName}
              </Link>
            ) : (
              (report.targetOwnerName ?? frAdmin.common.none)
            )}
          </KeyValue>
          <KeyValue label={frAdmin.moderation.detail.reviewer}>
            {report.reviewerName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.moderation.columns.created}>
            {formatDateTime(report.createdAt)}
          </KeyValue>
          {report.resolutionCode !== null ? (
            <KeyValue label={frAdmin.moderation.detail.resolutionLabel}>
              {frAdmin.moderation.resolution[report.resolutionCode] ?? report.resolutionCode}
            </KeyValue>
          ) : null}
        </dl>

        <div className="flex flex-col gap-2">
          <h3 className="text-body-sm text-text-primary font-semibold">
            {frAdmin.moderation.detail.description}
          </h3>
          <p className="text-body-sm text-text-secondary whitespace-pre-wrap">
            {report.description ?? frAdmin.moderation.detail.noDescription}
          </p>
        </div>

        {report.evidence.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-body-sm text-text-primary font-semibold">
              {frAdmin.moderation.detail.evidenceTitle}
            </h3>
            <ul
              className="flex flex-col gap-2"
              aria-label={frAdmin.moderation.detail.evidenceTitle}
            >
              {report.evidence.map((entry) => (
                <li key={entry.evidenceId} className="text-body-sm text-text-secondary">
                  {entry.evidenceKind}
                  {entry.note !== null ? ` — ${entry.note}` : ''} ·{' '}
                  {formatDateTime(entry.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-caption text-text-muted">{frAdmin.moderation.detail.noEvidence}</p>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.moderation.detail.historyTitle}>
        {report.events.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.moderation.detail.noActions}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.moderation.detail.historyTitle}>
            {report.events.map((event, index) => (
              <li key={index} className="border-border rounded-lg border p-4">
                <p className="text-body-sm text-text-primary font-semibold">
                  {(event.fromStatus !== null
                    ? `${frAdmin.moderation.status[event.fromStatus] ?? event.fromStatus} → `
                    : '') + (frAdmin.moderation.status[event.toStatus] ?? event.toStatus)}
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

      <SectionCard title={frAdmin.moderation.detail.actionsTakenTitle}>
        {report.actions.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.moderation.detail.noActions}</p>
        ) : (
          <ul
            className="flex flex-col gap-3"
            aria-label={frAdmin.moderation.detail.actionsTakenTitle}
          >
            {report.actions.map((entry) => (
              <li key={entry.actionId} className="border-border rounded-lg border p-4">
                <p className="text-body-sm text-text-primary font-semibold">
                  {frAdmin.members.actionType[entry.actionType] ?? entry.actionType}
                </p>
                <p className="text-body-sm text-text-secondary mt-1">{entry.reason}</p>
                <p className="text-caption text-text-muted mt-2">
                  {entry.moderator ?? frAdmin.common.none} — {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.moderation.detail.decisionTitle}>
        <Alert variant="info" title={frAdmin.moderation.detail.transitions} />

        <div className="flex flex-wrap items-start gap-4">
          {isOpen ? (
            <ActionButton
              action={transitionReportAction}
              fields={{ reportId: report.reportId, toStatus: 'reviewing' }}
              label={frAdmin.moderation.detail.startReview}
              variant="secondary"
            />
          ) : null}

          {isReviewing ? (
            <>
              <ReasonAction
                action={recordModerationActionAction}
                fields={{ reportId: report.reportId }}
                triggerLabel={frAdmin.moderation.detail.recordAction}
                title={frAdmin.moderation.detail.recordActionTitle}
                description={frAdmin.moderation.detail.recordActionBody}
                confirmLabel={frAdmin.moderation.detail.recordAction}
                reasonLabel={frAdmin.moderation.detail.reasonLabel}
                select={{
                  name: 'actionType',
                  label: frAdmin.moderation.detail.actionLabel,
                  options: MODERATION_ACTIONS.map((value) => ({
                    value,
                    label: frAdmin.moderation.detail.actionOptions[value] ?? value,
                  })),
                }}
              />
              <ReasonAction
                action={transitionReportAction}
                fields={{ reportId: report.reportId, toStatus: 'resolved' }}
                triggerLabel={frAdmin.moderation.detail.resolve}
                title={frAdmin.moderation.detail.resolveTitle}
                description={frAdmin.moderation.detail.resolveBody}
                confirmLabel={frAdmin.moderation.detail.resolve}
                destructive={false}
                reasonLabel={frAdmin.moderation.detail.noteLabel}
                select={{
                  name: 'resolutionCode',
                  label: frAdmin.moderation.detail.resolutionLabel,
                  options: RESOLUTIONS.map((value) => ({
                    value,
                    label: frAdmin.moderation.resolution[value] ?? value,
                  })),
                }}
              />
              <ReasonAction
                action={transitionReportAction}
                fields={{
                  reportId: report.reportId,
                  toStatus: 'dismissed',
                  resolutionCode: 'no_violation',
                }}
                triggerLabel={frAdmin.moderation.detail.dismiss}
                title={frAdmin.moderation.detail.dismissTitle}
                description={frAdmin.moderation.detail.dismissBody}
                confirmLabel={frAdmin.moderation.detail.dismiss}
                reasonLabel={frAdmin.moderation.detail.noteLabel}
              />
            </>
          ) : null}

          {!isOpen && !isReviewing ? (
            <p className="text-body-sm text-text-secondary">
              {report.resolutionNote ?? frAdmin.claims.detail.alreadyDecided}
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>,
  );
}
