import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { frAdminProjects } from '@/i18n/admin-projects';
import { ADMIN_ROUTES, adminMemberRoute } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadAdminConsortiumRequests,
  loadAdminProject,
  loadAdminProjectFinancials,
} from '@/lib/admin/queries-projects';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { ActionButton } from '../../_components/ActionButton';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { CloseProjectForm } from './CloseProjectForm';
import { reviewConsortiumRequestAction, setProjectStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminProjects.detail.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** Cibles non terminales atteignables depuis chaque statut (0094). */
const NON_TERMINAL_TARGETS: Record<string, readonly string[]> = {
  draft: ['recruiting'],
  recruiting: ['team_ready', 'active', 'paused'],
  team_ready: ['active', 'paused'],
  active: ['paused'],
  paused: ['recruiting', 'team_ready', 'active'],
};
const CLOSABLE_STATUSES = new Set(['recruiting', 'team_ready', 'active', 'paused']);
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'archived']);
const CONSORTIUM_TERMINAL = new Set(['selected', 'not_selected', 'withdrawn']);
const CONSORTIUM_REVIEW_OPTIONS = ['reviewing', 'shortlisted', 'selected', 'not_selected'] as const;

/**
 * SA-024/025/026 — Fiche projet, statut adaptatif : un seul ecran couvre
 * la publication (SA-024), la revue des demandes de consortium (SA-025)
 * et la cloture avec bilan (SA-026) — meme principe que la fiche
 * campagne SA-013/014/015 : le detail d'une ressource n'a pas besoin
 * d'etre fragmente en routes distinctes quand son cycle de vie tient
 * sur un seul ecran.
 */
export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const access = await requireAdminPermission('projects.manage');
  const { projectId } = await params;
  const correlationId = newCorrelationId();

  const detail = await loadAdminProject(projectId, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.projects} screenTitle={frAdminProjects.detail.title}>
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdminProjects.detail.title} subtitle={frAdminProjects.list.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.projects} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const project = detail.data;

  const [financials, consortiums] = await Promise.all([
    loadAdminProjectFinancials(projectId, correlationId),
    loadAdminConsortiumRequests(projectId, null, null, correlationId),
  ]);

  const consortiumRows = consortiums.ok ? consortiums.data.rows : [];
  const nonTerminalTargets = NON_TERMINAL_TARGETS[project.status] ?? [];

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.projects} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader title={project.title} subtitle={project.summary}>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} label={frAdminProjects.status[project.status] ?? project.status} />
            <StatusBadge
              status={project.projectType}
              label={frAdminProjects.projectType[project.projectType] ?? project.projectType}
            />
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdminProjects.detail.contentTitle}>
        <p className="text-body-sm text-text-primary whitespace-pre-wrap">
          {project.description ?? project.summary}
        </p>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdminProjects.detail.owner}>
            {project.owner !== null ? (
              <Link href={adminMemberRoute(project.owner.profileId)} className={BACK_LINK}>
                {project.owner.displayName}
              </Link>
            ) : (
              frAdmin.common.none
            )}
          </KeyValue>
          <KeyValue label={frAdminProjects.detail.sector}>{project.sector ?? frAdmin.common.none}</KeyValue>
          <KeyValue label={frAdminProjects.detail.compensationTitle}>
            {frAdminProjects.compensationType[project.compensationType] ?? project.compensationType}
          </KeyValue>
          <KeyValue label={frAdminProjects.detail.createdAt}>{formatDateTime(project.createdAt)}</KeyValue>
          <KeyValue label={frAdminProjects.detail.publishedAt}>{formatDateTime(project.publishedAt)}</KeyValue>
          {project.closure !== null ? (
            <KeyValue label={frAdminProjects.detail.closedAt}>
              {formatDateTime(project.closure.closedAt)}
            </KeyValue>
          ) : null}
        </dl>
      </SectionCard>

      {!TERMINAL_STATUSES.has(project.status) && nonTerminalTargets.length > 0 ? (
        <SectionCard title={frAdminProjects.detail.lifecycleTitle}>
          <p className="text-caption text-text-muted">{frAdminProjects.detail.statusActionsHint}</p>
          <div className="flex flex-wrap gap-3">
            {nonTerminalTargets.map((target) => (
              <ActionButton
                key={target}
                action={setProjectStatusAction}
                fields={{ projectId, status: target }}
                label={
                  project.status === 'draft' && target === 'recruiting'
                    ? frAdminProjects.detail.publish
                    : `${frAdminProjects.detail.setStatus} : ${frAdminProjects.status[target]}`
                }
                variant="secondary"
              />
            ))}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={frAdminProjects.detail.consortiumsTitle}>
        {consortiumRows.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdminProjects.detail.noConsortiums}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdminProjects.detail.consortiumsTitle}>
            {consortiumRows.map((row) => (
              <li key={row.id} className="border-border flex flex-col gap-2 rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-body-sm text-text-primary font-semibold">
                    {row.organizationName ?? frAdmin.common.none}
                  </p>
                  <StatusBadge
                    status={row.status}
                    label={frAdminProjects.consortium.status[row.status] ?? row.status}
                  />
                </div>
                <p className="text-caption text-text-muted">
                  {frAdminProjects.consortium.partnerRole[row.partnerRole] ?? row.partnerRole} —{' '}
                  {formatDate(row.submittedAt)}
                </p>
                {row.message !== null ? (
                  <p className="text-body-sm text-text-secondary">{row.message}</p>
                ) : null}
                {!CONSORTIUM_TERMINAL.has(row.status) ? (
                  <ReasonAction
                    action={reviewConsortiumRequestAction}
                    fields={{ requestId: row.id, projectId }}
                    triggerLabel={frAdminProjects.detail.reviewConsortium}
                    title={frAdminProjects.consortium.reviewTitle}
                    description={frAdminProjects.consortium.reviewBody}
                    confirmLabel={frAdminProjects.detail.reviewConsortium}
                    withReason={false}
                    destructive={false}
                    select={{
                      name: 'status',
                      label: frAdminProjects.detail.reviewConsortium,
                      options: CONSORTIUM_REVIEW_OPTIONS.map((value) => ({
                        value,
                        label: frAdminProjects.consortium.status[value],
                      })),
                    }}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {project.closure !== null ? (
        <SectionCard title={frAdminProjects.detail.closureTitle}>
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <KeyValue label={frAdminProjects.closure.outcomeStatus}>
              {frAdminProjects.closure.outcomeStatusOptions[project.closure.outcomeStatus] ??
                project.closure.outcomeStatus}
            </KeyValue>
            <KeyValue label={frAdminProjects.closure.expectedOutcomeAchieved}>
              {frAdminProjects.closure.expectedOutcomeAchievedOptions[
                project.closure.expectedOutcomeAchieved
              ] ?? project.closure.expectedOutcomeAchieved}
            </KeyValue>
            {project.closure.deliverableTitle !== null ? (
              <KeyValue label={frAdminProjects.closure.deliverableTitle}>
                {project.closure.deliverableTitle}
              </KeyValue>
            ) : null}
          </dl>
        </SectionCard>
      ) : null}

      {financials.ok && financials.data !== null ? (
        <SectionCard title={frAdminProjects.detail.financialsTitle}>
          <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {financials.data.clientName !== null ? (
              <KeyValue label={frAdminProjects.closure.clientName}>{financials.data.clientName}</KeyValue>
            ) : null}
            {financials.data.funderName !== null ? (
              <KeyValue label={frAdminProjects.closure.funderName}>{financials.data.funderName}</KeyValue>
            ) : null}
            {financials.data.budgetEstimate !== null ? (
              <KeyValue label={frAdminProjects.closure.budgetEstimate}>
                {financials.data.budgetEstimate} {financials.data.budgetCurrency?.trim() ?? ''}
              </KeyValue>
            ) : null}
            {financials.data.revenueGenerated !== null ? (
              <KeyValue label={frAdminProjects.closure.revenueGenerated}>
                {financials.data.revenueGenerated} {financials.data.revenueCurrency?.trim() ?? ''}
              </KeyValue>
            ) : null}
          </dl>
        </SectionCard>
      ) : null}

      {CLOSABLE_STATUSES.has(project.status) ? (
        <SectionCard title={frAdminProjects.closure.title}>
          <p className="text-body-sm text-text-secondary">{frAdminProjects.closure.subtitle}</p>
          <CloseProjectForm projectId={projectId} />
        </SectionCard>
      ) : null}
    </div>,
  );
}
