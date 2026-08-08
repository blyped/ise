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
import {
  PROJECT_ROUTES,
  projectContributionRoute,
  projectParticipationRoute,
} from '@/lib/routes/projects';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadProject } from '@/lib/queries/projects';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { InvitationResponseForm } from '@/components/collab/InvitationResponseForm';
import { WithdrawInterestForm } from '@/components/collab/WithdrawInterestForm';
import { ACTION_LINK, CHIP, PRIMARY_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProjects.common.breadcrumb };

/**
 * ISE-089 — Détail d'un projet ou d'un consortium.
 *
 * Trois faits distincts cohabitent en haut de page sans jamais se
 * confondre (MASTER PROMPT §32) : une proposition déposée, une
 * invitation reçue, une appartenance confirmée. Chacun a son libellé et
 * son action ; aucun n'implique l'autre.
 *
 * Les conditions financières d'un rôle ne s'affichent que lorsque le
 * palier de divulgation est atteint — un fait constaté, jamais une
 * supposition. Le reste du temps, l'écran dit à quel moment elles le
 * seront, plutôt que de laisser un vide.
 */
export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { projectId } = await params;
  const correlationId = newCorrelationId();

  const [viewer, project] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadProject(projectId, correlationId),
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

  if (!project.ok) {
    return shell(
      <ErrorState
        title={frProjects.common.loadErrorTitle}
        description={project.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const detail = project.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frProjects.common.notFoundTitle}
        description={frProjects.common.notFoundBody}
        action={
          <Link href={PROJECT_ROUTES.list} className={ACTION_LINK}>
            {frProjects.common.breadcrumb}
          </Link>
        }
      />,
    );
  }

  const relevance =
    detail.relevanceLabel === null
      ? null
      : (frProjects.relevance[
          detail.relevanceLabel as 'very_relevant' | 'relevant' | 'close_profile'
        ] ?? null);

  const disclosureNotice = (roleMode: string): string => {
    if (roleMode === 'applied') return frProjects.compensation.disclosureApplied;
    if (roleMode === 'shortlisted') return frProjects.compensation.disclosureShortlisted;
    if (roleMode === 'selected') return frProjects.compensation.disclosureSelected;
    return frProjects.compensation.disclosureTeam;
  };

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <span>{frProjects.common.collaborate}</span> <span aria-hidden="true">›</span>{' '}
        <Link href={PROJECT_ROUTES.list} className="text-primary hover:underline">
          {frProjects.common.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{detail.title}</span>
      </nav>

      <header className="rounded-base bg-[#0F172A] p-7 text-white max-md:p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-white/70">
          {frProjects.projectType[detail.projectType as keyof typeof frProjects.projectType] ??
            detail.projectType}
        </p>
        <h1 className="text-h1 mt-3 max-w-[40ch] font-bold">{detail.title}</h1>
        <p className="text-body-sm mt-3 text-white/85">
          {frProjects.status[detail.status as keyof typeof frProjects.status] ?? detail.status}
          {detail.owner === null ? '' : ` · ${detail.owner.displayName}`}
          {detail.applicationDeadline === null
            ? ''
            : ` · ${frProjects.detail.infoDeadline} : ${formatDay(detail.applicationDeadline) ?? ''}`}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {relevance === null ? null : (
            <span className="text-caption rounded-full bg-white/15 px-3 py-[5px]">{relevance}</span>
          )}

          {detail.myMembership?.status === 'active' ? (
            <Link
              href={projectParticipationRoute(projectId)}
              className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frProjects.detail.openParticipation}
            </Link>
          ) : detail.myMembership !== null ? (
            <Link
              href={projectParticipationRoute(projectId)}
              className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frProjects.detail.confirmNeeded}
            </Link>
          ) : detail.myApplication !== null &&
            ['submitted', 'reviewing', 'shortlisted', 'selected'].includes(
              detail.myApplication.status,
            ) ? (
            <span className="text-body-sm text-white/90">
              {frProjects.detail.myInterest} {formatDay(detail.myApplication.submittedAt) ?? ''} —{' '}
              {frProjects.detail.myInterestStatus} : {detail.myApplication.status}
            </span>
          ) : detail.isOwner ? (
            <span className="text-body-sm text-white/90">{frProjects.list.groupCoordinating}</span>
          ) : (
            <Link
              href={projectContributionRoute(projectId)}
              className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frProjects.contribution.title}
            </Link>
          )}
        </div>
      </header>

      {detail.myInvitation !== null &&
      ['sent', 'question_asked'].includes(detail.myInvitation.status) ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frProjects.detail.myInvitation}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary mb-4">
            {frProjects.detail.invitationDeclineHelp}
          </p>
          <InvitationResponseForm
            projectId={projectId}
            invitationId={detail.myInvitation.invitationId}
          />
        </Card>
      ) : null}

      {detail.myApplication !== null && detail.myApplication.status === 'submitted' ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frProjects.list.groupInterests}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary mb-4">
            {frProjects.contribution.noticeBody}
          </p>
          <WithdrawInterestForm
            projectId={projectId}
            applicationId={detail.myApplication.applicationId}
          />
        </Card>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.detail.projectTitle}</CardTitle>
            </CardHeader>
            {detail.isRestricted ? (
              <Alert variant="info" title={frProjects.detail.restrictedTitle}>
                {frProjects.detail.restrictedBody}
              </Alert>
            ) : null}
            <p className="text-body-sm text-text-secondary mt-3 whitespace-pre-line">
              {detail.summary}
            </p>
            {detail.description === null ? null : (
              <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                {detail.description}
              </p>
            )}
            {detail.expectedOutcome === null ? null : (
              <div className="border-border mt-5 border-t pt-4">
                <h3 className="text-body-sm text-text-primary font-semibold">
                  {frProjects.detail.expectedOutcome}
                </h3>
                <p className="text-body-sm text-text-secondary mt-1">{detail.expectedOutcome}</p>
              </div>
            )}
            {detail.qualificationCriteria === null ? null : (
              <div className="border-border mt-4 border-t pt-4">
                <h3 className="text-body-sm text-text-primary font-semibold">
                  {frProjects.detail.criteria}
                </h3>
                <p className="text-body-sm text-text-secondary mt-1 whitespace-pre-line">
                  {detail.qualificationCriteria}
                </p>
              </div>
            )}
            {detail.requiresNda ? (
              <p className="text-caption text-text-muted mt-4">{frProjects.detail.infoNda}</p>
            ) : null}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.detail.teamTitle}</CardTitle>
            </CardHeader>
            {detail.team.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                Aucun membre confirmé pour le moment.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.team.map((member) => (
                  <li
                    key={member.memberId}
                    className="border-border rounded-base flex flex-wrap items-center gap-3 border px-4 py-3"
                  >
                    <Avatar name={member.profile?.displayName ?? '—'} size={32} />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary font-medium">
                        {member.profile?.displayName ?? '—'}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {member.roleTitle ?? frProjects.detail.teamVacant}
                      </p>
                    </div>
                    <Badge
                      tone={
                        member.membershipStatus === 'active'
                          ? 'success'
                          : member.membershipStatus === 'pending_confirmation'
                            ? 'warning'
                            : 'neutral'
                      }
                    >
                      {member.membershipStatus === 'active'
                        ? frProjects.detail.teamConfirmed
                        : member.membershipStatus === 'pending_confirmation'
                          ? frProjects.detail.teamPending
                          : frProjects.detail.teamInvited}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.detail.rolesTitle}</CardTitle>
            </CardHeader>
            {detail.roles.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                Aucun rôle n’est actuellement ouvert sur ce projet.
              </p>
            ) : (
              <ul className="flex flex-col gap-5">
                {detail.roles.map((role) => (
                  <li key={role.roleId} className="border-border rounded-base border p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="text-body text-text-primary font-semibold">{role.title}</h3>
                      <Badge tone={role.status === 'filled' ? 'neutral' : 'info'}>
                        {role.filledSeats}/{role.seats} {frProjects.detail.roleSeats}{' '}
                        {frProjects.detail.roleFilled}
                      </Badge>
                    </div>

                    {role.description === null ? null : (
                      <p className="text-body-sm text-text-secondary mt-2">{role.description}</p>
                    )}

                    {role.skills.length > 0 ? (
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {role.skills.map((skill) => (
                          <li key={skill.name} className={CHIP}>
                            {skill.name} —{' '}
                            {frProjects.requirement[
                              skill.requirement as keyof typeof frProjects.requirement
                            ] ?? skill.requirement}
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    <dl className="text-caption text-text-secondary mt-4 grid gap-1 sm:grid-cols-2">
                      {role.experienceMinYears === null ? null : (
                        <div>
                          <dt className="inline font-medium">
                            {frProjects.detail.roleExperience} :{' '}
                          </dt>
                          <dd className="inline">
                            {role.experienceMinYears} {frProjects.detail.roleYears}
                          </dd>
                        </div>
                      )}
                      {role.workloadDays === null ? null : (
                        <div>
                          <dt className="inline font-medium">
                            {frProjects.detail.roleWorkload} :{' '}
                          </dt>
                          <dd className="inline">
                            {role.workloadDays} {frProjects.detail.roleDays}
                          </dd>
                        </div>
                      )}
                      {role.commitmentType === null ? null : (
                        <div>
                          <dt className="inline font-medium">Engagement : </dt>
                          <dd className="inline">
                            {frProjects.commitment[
                              role.commitmentType as keyof typeof frProjects.commitment
                            ] ?? role.commitmentType}
                          </dd>
                        </div>
                      )}
                      {role.languages.length === 0 ? null : (
                        <div>
                          <dt className="inline font-medium">
                            {frProjects.detail.roleLanguages} :{' '}
                          </dt>
                          <dd className="inline">
                            {role.languages
                              .map(
                                (language) =>
                                  `${language.name}${language.isMandatory ? ' (obligatoire)' : ''}`,
                              )
                              .join(' · ')}
                          </dd>
                        </div>
                      )}
                    </dl>

                    <p className="text-caption text-text-secondary mt-3">
                      <span className="font-medium">{frProjects.compensation.label} : </span>
                      {frProjects.compensation[
                        (role.compensationType ??
                          detail.compensationType) as keyof typeof frProjects.compensation
                      ] ?? role.compensationType}
                    </p>

                    {role.compensationDisclosed && role.compensation !== null ? (
                      <p className="text-caption text-text-primary mt-1">
                        {role.compensation.details ?? ''}
                        {role.compensation.amountMin === null
                          ? ''
                          : ` ${role.compensation.amountMin}–${role.compensation.amountMax ?? ''} ${role.compensation.currency ?? ''}`}
                      </p>
                    ) : (
                      <p className="text-caption text-text-muted mt-1">
                        {frProjects.compensation.notDisclosed} {disclosureNotice('applied')}
                      </p>
                    )}

                    <div className="mt-4">
                      {role.applicationMode === 'invitation_only' ? (
                        <p className="text-caption text-text-muted">
                          {frProjects.detail.roleInvitationOnly}
                        </p>
                      ) : detail.isOwner || detail.myMembership?.status === 'active' ? null : (
                        <Link
                          href={`${projectContributionRoute(projectId)}?role=${encodeURIComponent(role.roleId)}`}
                          className={PRIMARY_LINK}
                        >
                          {frProjects.detail.roleApply}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {detail.links.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.detail.linksTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-2">
                {detail.links.map((link) => (
                  <li key={link.linkId} className="text-body-sm">
                    <a
                      href={link.url}
                      rel="noreferrer noopener"
                      target="_blank"
                      className="text-primary focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {link.label}
                    </a>
                    {link.isConfidential ? (
                      <span className="text-caption text-text-muted">
                        {' '}
                        — {frProjects.detail.linksConfidential}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.closure === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.detail.closureTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frProjects.detail.closureAchieved} :{' '}
                {frProjects.detail.achieved[
                  detail.closure.expectedOutcomeAchieved as 'yes' | 'partially' | 'no'
                ] ?? detail.closure.expectedOutcomeAchieved}
              </p>
              {detail.closure.deliverableTitle === null ? null : (
                <p className="text-body-sm text-text-primary mt-2">
                  {detail.closure.deliverableTitle}
                </p>
              )}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.detail.infoTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-2">
              {[
                [
                  frProjects.detail.infoType,
                  frProjects.projectType[
                    detail.projectType as keyof typeof frProjects.projectType
                  ] ?? detail.projectType,
                ],
                [frProjects.detail.infoSector, detail.sector ?? '—'],
                [
                  frProjects.detail.infoCountries,
                  detail.countries.length === 0 ? '—' : detail.countries.join(' · '),
                ],
                [frProjects.detail.infoStart, formatDay(detail.startDate) ?? '—'],
                [frProjects.detail.infoDeadline, formatDay(detail.applicationDeadline) ?? '—'],
                [frProjects.detail.infoEnd, formatDay(detail.targetEndDate) ?? '—'],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-4">
                  <dt className="text-caption text-text-secondary">{label}</dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {detail.reasons.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.relevance.title}</CardTitle>
              </CardHeader>
              <ul className="text-body-sm text-text-secondary flex flex-col gap-2">
                {detail.reasons.map((reason) => (
                  <li key={reason.code}>
                    ✓ {(frProjects.reason as Record<string, string>)[reason.code] ?? reason.code}
                    {reason.label === null ? '' : ` — ${reason.label}`}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {detail.owner === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Porteur du projet</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-3">
                <Avatar name={detail.owner.displayName} size={48} />
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary font-medium">
                    {detail.owner.displayName}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {[detail.owner.currentPosition, detail.owner.promotionLabel]
                      .filter((value) => value !== null)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <p className="mt-4">
                <Link href={memberProfileRoute(detail.owner.profileId)} className={ACTION_LINK}>
                  {frProjects.common.seeProfile}
                </Link>
              </p>
            </Card>
          )}

          <Alert variant="info" title={frProjects.contribution.noticeTitle}>
            {frProjects.contribution.noticeBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
