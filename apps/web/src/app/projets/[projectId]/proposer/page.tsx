import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Avatar, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frProjects } from '@/i18n/projects';
import { ROUTES } from '@/lib/routes';
import { PROJECT_ROUTES, projectRoute } from '@/lib/routes/projects';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadProject } from '@/lib/queries/projects';
import { AppShell } from '@/components/layout/AppShell';
import { ContributionForm } from '@/components/collab/ContributionForm';
import { ACTION_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProjects.contribution.title };

const one = (value: string | string[] | undefined): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * ISE-090 — Proposer ma contribution.
 *
 * L'écran ne parle jamais de « candidature retenue » ni d'« adhésion » :
 * ce qui part d'ici est une proposition, et la base le confirme en
 * renvoyant `creates_membership: false` (MASTER PROMPT §32).
 *
 * ÉCART ASSUMÉ : la maquette propose de joindre un CV et des références
 * de projet. Le dépôt de document n'est pas ouvert dans cette tranche ;
 * en revanche la case de consentement CV est bien présente, car elle
 * conditionne l'usage des documents déjà présents au profil (F §82).
 */
export default async function ProjectContributionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { projectId } = await params;
  const query = await searchParams;
  const preselectedRole = one(query['role']);

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

  const pending =
    detail.myApplication !== null &&
    ['submitted', 'reviewing', 'shortlisted', 'selected'].includes(detail.myApplication.status);

  if (detail.isOwner || pending) {
    return shell(
      <EmptyState
        title={
          detail.isOwner ? frProjects.list.groupCoordinating : frProjects.contribution.alreadyTitle
        }
        description={
          detail.isOwner
            ? 'Vous coordonnez ce projet : vous ne pouvez pas y proposer votre propre contribution.'
            : frProjects.contribution.alreadyBody
        }
        action={
          <Link href={projectRoute(projectId)} className={ACTION_LINK}>
            {detail.title}
          </Link>
        }
      />,
    );
  }

  const openRoles = detail.roles.filter(
    (role) => role.applicationMode === 'open' && role.status !== 'closed',
  );

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
        <span aria-hidden="true">›</span> <span>{frProjects.contribution.title}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frProjects.contribution.title}</h1>
        <p className="text-body text-text-secondary">{frProjects.contribution.subtitle}</p>
      </div>

      <div className="rounded-base bg-[#0F172A] p-6 text-white max-md:p-5">
        <p className="text-caption font-semibold uppercase tracking-wide text-white/70">
          {frProjects.projectType[detail.projectType as keyof typeof frProjects.projectType] ??
            detail.projectType}
        </p>
        <h2 className="text-h3 mt-2 font-semibold">{detail.title}</h2>
        <p className="text-caption mt-2 text-white/80">
          {frProjects.compensation[
            detail.compensationType as keyof typeof frProjects.compensation
          ] ?? detail.compensationType}
          {detail.compensationStatement === null ? '' : ` — ${detail.compensationStatement}`}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <ContributionForm
          projectId={projectId}
          preselectedRole={preselectedRole}
          roles={openRoles.map((role) => ({ id: role.roleId, title: role.title }))}
        />

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frProjects.contribution.noticeTitle}>
            {frProjects.contribution.noticeBody}
          </Alert>

          {detail.owner === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProjects.contribution.reviewersTitle}</CardTitle>
              </CardHeader>
              <div className="flex items-center gap-3">
                <Avatar name={detail.owner.displayName} size={32} />
                <div className="min-w-0">
                  <p className="text-body-sm text-text-primary font-medium">
                    {detail.owner.displayName}
                  </p>
                  <p className="text-caption text-text-secondary">
                    {frProjects.list.groupCoordinating}
                  </p>
                </div>
              </div>
              <p className="text-caption text-text-muted mt-4">
                {frProjects.contribution.reviewersBody}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frProjects.contribution.afterTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frProjects.contribution.afterBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
