import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { loadProject } from '@/lib/queries/profile-extras';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { ProjectForm } from '../ProjectForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.projectForm.editTitle };

const LINK_CLASS =
  'text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-026 — Modifier un projet existant. */
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadProject(context.profile.id, projectId, context.correlationId),
        loadSectors(context.correlationId),
        loadCountries(context.correlationId),
      ])
    : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.projects}
      title={frProfile.projectForm.editTitle}
      subtitle={frProfile.projectForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.projects} className={LINK_CLASS}>
          ← {frProfile.projectForm.backLink}
        </Link>
      }
    >
      {data === null ? null : !data[0].ok || !data[1].ok || !data[2].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : data[0].data === null ? (
        <EmptyState
          title={frProfile.projectForm.notFoundTitle}
          description={frProfile.projectForm.notFoundBody}
          action={
            <Link href={PROFILE_ROUTES.projects} className={LINK_CLASS}>
              {frProfile.projectForm.backLink}
            </Link>
          }
        />
      ) : (
        <ProjectForm project={data[0].data} sectors={data[1].data} countries={data[2].data} />
      )}
    </ProfilePage>
  );
}
