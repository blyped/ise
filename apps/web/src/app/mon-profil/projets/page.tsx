import Link from 'next/link';
import { Alert, Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES, projectRoute } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadProjects } from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { DeleteRowForm } from '@/components/profile/DeleteRowForm';
import { deleteProjectAction } from '../actions-extras';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.projects.title };

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function frenchYear(iso: string | null): string {
  if (iso === null) return '';
  return new Intl.DateTimeFormat('fr-FR', { year: 'numeric' }).format(new Date(iso));
}

/** ISE-025 — Mes projets & realisations. Visibilite PAR ENTREE (D-73). */
export default async function ProjectsPage() {
  const context = await requireProfile();
  const list = context.ok ? await loadProjects(context.profile.id, context.correlationId) : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.projects}
      title={frProfile.projects.title}
      subtitle={frProfile.projects.subtitle}
      action={
        <Link href={PROFILE_ROUTES.newProject} className={PRIMARY_LINK}>
          {frProfile.projects.add}
        </Link>
      }
    >
      {list === null ? null : !list.ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={list.error.userMessage}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : list.data.length === 0 ? (
        <EmptyState
          title={frProfile.projects.emptyTitle}
          description={frProfile.projects.emptyBody}
          action={
            <Link href={PROFILE_ROUTES.newProject} className={PRIMARY_LINK}>
              {frProfile.projects.add}
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-body-sm text-text-secondary">
            {frProfile.projects.count.replace('{count}', String(list.data.length))}
          </p>

          <ul className="flex flex-col gap-5">
            {list.data.map((project) => (
              <Card as="li" key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex min-w-0 items-start gap-5">
                    {project.startDate !== null ? (
                      <span
                        className="text-body-sm text-primary rounded-base flex h-[56px] w-[56px] shrink-0 items-center justify-center bg-[#EFF6FF] font-semibold"
                        aria-hidden="true"
                      >
                        {frenchYear(project.startDate)}
                      </span>
                    ) : null}
                    <div className="min-w-0">
                      <h2 className="text-h4 text-text-primary font-semibold">{project.title}</h2>
                      <p className="text-body-sm text-primary mt-1 font-medium">
                        {[project.organizationNameRaw, project.role].filter(Boolean).join(' · ') ||
                          frProfile.common.notProvided}
                      </p>
                      {project.countryName ? (
                        <p className="text-caption text-text-secondary mt-1">
                          {project.countryName}
                        </p>
                      ) : null}
                      {project.sectorName ? (
                        <p className="mt-3">
                          <Badge tone="info">{project.sectorName}</Badge>
                        </p>
                      ) : null}
                      {project.summary ? (
                        <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                          {project.summary}
                        </p>
                      ) : null}
                      {project.outcome ? (
                        <p className="text-body-sm mt-3 font-semibold text-[#15803D]">
                          {frProfile.projects.outcomeLabel} {project.outcome}
                        </p>
                      ) : null}
                      {project.linkUrl ? (
                        <p className="mt-3">
                          <a
                            href={project.linkUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className={LINK_CLASS}
                          >
                            {frProfile.projects.linkLabel}
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <p className="text-caption text-text-muted">
                      {[frenchYear(project.startDate), frenchYear(project.endDate)]
                        .filter(Boolean)
                        .join(' — ')}
                    </p>
                    <Badge tone="neutral">{frProfile.visibility[project.visibility]}</Badge>
                    <Link href={projectRoute(project.id)} className={LINK_CLASS}>
                      {frProfile.common.edit}
                      <span className="sr-only"> — {project.title}</span>
                    </Link>
                    <DeleteRowForm
                      action={deleteProjectAction}
                      fieldName="projectId"
                      fieldValue={project.id}
                      confirmLabel={frProfile.projects.deleteConfirm}
                      itemLabel={project.title}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </ul>

          <Alert variant="warning" title={frProfile.projects.adviceTitle}>
            {frProfile.projects.adviceBody}
          </Alert>
        </>
      )}
    </ProfilePage>
  );
}
