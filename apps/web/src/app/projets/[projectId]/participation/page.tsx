import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frProjects } from '@/i18n/projects';
import { ROUTES } from '@/lib/routes';
import { PROJECT_ROUTES, projectRoute } from '@/lib/routes/projects';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMyParticipation, loadProjectFinancials } from '@/lib/queries/projects';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { ConfirmMembershipForm } from '@/components/collab/ConfirmMembershipForm';
import { MilestoneStatusForm } from '@/components/collab/MilestoneStatusForm';
import { WithdrawMembershipForm } from '@/components/collab/WithdrawMembershipForm';
import { ACTION_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProjects.participation.title };

/**
 * ISE-091 — Ma participation au consortium.
 *
 * Tant que la personne n'a pas confirmé, l'écran le dit en toutes
 * lettres et n'affiche ni jalon à tenir ni impact : elle n'est pas
 * engagée (CA-PROJ-05).
 *
 * Les éléments financiers sont demandés par une fonction distincte, qui
 * refuse tout appelant hors équipe (42501). Ils ne transitent jamais par
 * la fiche publique du projet (DIGEST D 5.6).
 *
 * ÉCART ASSUMÉ : le bloc « Dernière activité de l'équipe » de la
 * maquette n'est pas rendu. Aucun journal d'activité de projet n'existe
 * en base ; le reconstituer à partir des dates de modification
 * fabriquerait un fil d'événements approximatif (MASTER PROMPT §98).
 */
export default async function ProjectParticipationPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { projectId } = await params;
  const correlationId = newCorrelationId();

  const [viewer, participation] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMyParticipation(projectId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROJECT_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!participation.ok) {
    return shell(
      <EmptyState
        title={frProjects.participation.notParticipantTitle}
        description={`${frProjects.participation.notParticipantBody} ${participation.error.userMessage}`}
        action={
          <Link href={projectRoute(projectId)} className={ACTION_LINK}>
            {frProjects.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const detail = participation.data;
  if (detail === null) {
    return shell(
      <ErrorState
        title={frProjects.common.notFoundTitle}
        description={frProjects.common.notFoundBody}
        correlationId={correlationId}
      />,
    );
  }

  const isActive = detail.myParticipation?.membershipStatus === 'active' || detail.isOwner;
  const financials = isActive ? await loadProjectFinancials(projectId, correlationId) : null;
  const financialsData = financials !== null && financials.ok ? financials.data : null;

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <span>{frProjects.common.collaborate}</span> <span aria-hidden="true">›</span>{' '}
        <Link href={PROJECT_ROUTES.list} className="text-primary hover:underline">
          {frProjects.common.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <Link href={projectRoute(projectId)} className="text-primary hover:underline">
          {detail.title}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{frProjects.participation.title}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frProjects.participation.title}</h1>
        <p className="text-body text-text-secondary">{frProjects.participation.subtitle}</p>
      </div>

      <header className="rounded-base bg-[#0F172A] p-7 text-white max-md:p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-white/70">
          {frProjects.status[detail.status as keyof typeof frProjects.status] ?? detail.status}
        </p>
        <h2 className="text-h2 mt-2 font-bold">{detail.title}</h2>
        <p className="text-body-sm mt-2 text-white/85">
          {frProjects.participation.myRole} :{' '}
          {detail.myParticipation?.roleTitle ?? frProjects.list.groupCoordinating}
        </p>
        {detail.myParticipation?.confirmedAt === null ||
        detail.myParticipation?.confirmedAt === undefined ? null : (
          <p className="text-caption mt-1 text-white/70">
            {frProjects.participation.confirmedAt}{' '}
            {formatDay(detail.myParticipation.confirmedAt) ?? ''}
          </p>
        )}
      </header>

      {detail.myParticipation !== null && detail.myParticipation.membershipStatus !== 'active' ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frProjects.participation.notConfirmedTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary mb-4">
            {frProjects.participation.notConfirmedBody}
          </p>
          <ConfirmMembershipForm
            projectId={projectId}
            roleTitle={detail.myParticipation.roleTitle ?? ''}
            compensation={
              frProjects.compensation[
                detail.compensationType as keyof typeof frProjects.compensation
              ] ?? detail.compensationType
            }
          />
        </Card>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          {isActive ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.participation.myMilestonesTitle}</CardTitle>
              </CardHeader>
              {detail.myMilestones.length === 0 ? (
                <p className="text-body-sm text-text-secondary">
                  Aucun jalon ne vous est assigné pour le moment.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {detail.myMilestones.map((milestone) => (
                    <li
                      key={milestone.milestoneId}
                      className="border-border rounded-base flex flex-wrap items-center gap-3 border px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-body-sm text-text-primary font-medium">
                          {milestone.title}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {milestone.dueDate === null
                            ? '—'
                            : `${frProjects.participation.nextMilestone} : ${formatDay(milestone.dueDate) ?? ''}`}
                        </p>
                      </div>
                      <MilestoneStatusForm
                        projectId={projectId}
                        milestoneId={milestone.milestoneId}
                        status={milestone.status}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.participation.milestonesTitle}</CardTitle>
            </CardHeader>
            {detail.milestones.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {frProjects.participation.milestoneEmpty}
              </p>
            ) : (
              <ol className="flex flex-col gap-2">
                {detail.milestones.map((milestone) => (
                  <li
                    key={milestone.milestoneId}
                    className="text-body-sm text-text-secondary flex flex-wrap items-center gap-3"
                  >
                    <Badge
                      tone={
                        milestone.status === 'done'
                          ? 'success'
                          : milestone.status === 'blocked'
                            ? 'error'
                            : milestone.status === 'in_progress'
                              ? 'info'
                              : 'neutral'
                      }
                    >
                      {frProjects.participation.milestoneStatus[
                        milestone.status as 'todo' | 'in_progress' | 'done' | 'blocked'
                      ] ?? milestone.status}
                    </Badge>
                    <span className="text-text-primary">{milestone.title}</span>
                    {milestone.dueDate === null ? null : (
                      <span className="text-caption text-text-muted">
                        {formatDay(milestone.dueDate)}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.participation.teamTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-3">
              {detail.team.map((member) => (
                <li key={member.memberId} className="flex items-center gap-3">
                  <Avatar name={member.profile?.displayName ?? '—'} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm text-text-primary font-medium">
                      {member.profile?.displayName ?? '—'}
                    </p>
                    <p className="text-caption text-text-secondary">{member.roleTitle ?? '—'}</p>
                  </div>
                  <Badge tone={member.membershipStatus === 'active' ? 'success' : 'warning'}>
                    {member.membershipStatus === 'active'
                      ? frProjects.detail.teamConfirmed
                      : frProjects.detail.teamPending}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>

          {detail.myParticipation === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.participation.agreedTermsTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frProjects.participation.agreedTermsBody}
              </p>
              <div className="mt-5">
                <WithdrawMembershipForm projectId={projectId} />
                <p className="text-caption text-text-muted mt-2">
                  {frProjects.participation.withdrawHelp}
                </p>
              </div>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.participation.impactTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              <li className="text-body-sm text-text-secondary">
                <span className="text-h3 text-primary font-bold">
                  {detail.impact.membersConfirmed}
                </span>{' '}
                {frProjects.participation.impactMembers}
              </li>
              <li className="text-body-sm text-text-secondary">
                <span className="text-h3 text-primary font-bold">{detail.impact.rolesFilled}</span>{' '}
                {frProjects.participation.impactRoles} {detail.impact.rolesTotal}
              </li>
              <li className="text-body-sm text-text-secondary">
                <span className="text-h3 text-primary font-bold">
                  {detail.impact.milestonesDone}
                </span>{' '}
                {frProjects.participation.impactMilestones} {detail.impact.milestonesTotal}
              </li>
            </ul>
            <p className="text-caption text-text-muted mt-4">
              {frProjects.participation.impactHelp}
            </p>
          </Card>

          {detail.nextMilestone === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.participation.nextMilestone}</CardTitle>
              </CardHeader>
              <p className="text-h3 text-text-primary font-semibold">
                {formatDay(detail.nextMilestone.dueDate) ?? '—'}
              </p>
              <p className="text-body-sm text-text-secondary mt-1">{detail.nextMilestone.title}</p>
            </Card>
          )}

          {isActive ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.participation.financialsTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary mb-4">
                {frProjects.participation.financialsBody}
              </p>
              {financialsData === null ? (
                <p className="text-caption text-text-muted">
                  {frProjects.participation.financialsEmpty}
                </p>
              ) : (
                <dl className="flex flex-col gap-2">
                  {[
                    [frProjects.participation.financialsClient, financialsData.clientName],
                    [frProjects.participation.financialsFunder, financialsData.funderName],
                    [
                      frProjects.participation.financialsBudget,
                      financialsData.budgetEstimate === null
                        ? null
                        : `${financialsData.budgetEstimate} ${financialsData.budgetCurrency ?? ''}`,
                    ],
                    [
                      frProjects.participation.financialsRevenue,
                      financialsData.revenueGenerated === null
                        ? null
                        : `${financialsData.revenueGenerated} ${financialsData.revenueCurrency ?? ''}`,
                    ],
                    [frProjects.participation.financialsNotes, financialsData.financialNotes],
                  ]
                    .filter(([, value]) => value !== null && value !== '')
                    .map(([label, value]) => (
                      <div key={String(label)}>
                        <dt className="text-caption text-text-secondary">{label}</dt>
                        <dd className="text-body-sm text-text-primary">{value}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </Card>
          ) : (
            <Alert variant="info" title={frProjects.participation.notConfirmedTitle}>
              {frProjects.participation.notConfirmedBody}
            </Alert>
          )}
        </aside>
      </div>
    </div>,
  );
}
