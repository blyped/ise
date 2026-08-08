import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import {
  loadCountries,
  loadJobFunctions,
  loadSectors,
  loadVisibilityRules,
} from '@/lib/queries/reference';
import { loadExperience } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { ExperienceForm } from '../ExperienceForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.experienceForm.editTitle };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-019 — Modifier une experience. */
export default async function EditExperiencePage({
  params,
}: {
  params: Promise<{ experienceId: string }>;
}) {
  const { experienceId } = await params;
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <ProfilePage
        context={context}
        currentPath={PROFILE_ROUTES.experiences}
        title={frProfile.experienceForm.editTitle}
      >
        {null}
      </ProfilePage>
    );
  }

  const [experience, sectors, jobFunctions, countries, rules] = await Promise.all([
    loadExperience(context.profile.id, experienceId, context.correlationId),
    loadSectors(context.correlationId),
    loadJobFunctions(context.correlationId),
    loadCountries(context.correlationId),
    loadVisibilityRules(context.correlationId),
  ]);

  const rule = rules.ok ? rules.data.find((entry) => entry.fieldKey === 'experiences') : undefined;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.experiences}
      title={frProfile.experienceForm.editTitle}
      subtitle={frProfile.experienceForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.experiences} className={LINK_CLASS}>
          ← {frProfile.experienceForm.backLink}
        </Link>
      }
    >
      {!experience.ok || !sectors.ok || !jobFunctions.ok || !countries.ok || rule === undefined ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.correlationId}
        />
      ) : experience.data === null ? (
        <EmptyState
          title={frProfile.experienceForm.notFoundTitle}
          description={frProfile.experienceForm.notFoundBody}
          action={
            <Link href={PROFILE_ROUTES.experiences} className={LINK_CLASS}>
              {frProfile.experienceForm.backLink}
            </Link>
          }
        />
      ) : (
        <ExperienceForm
          experience={experience.data}
          sectors={sectors.data}
          jobFunctions={jobFunctions.data}
          countries={countries.data}
          visibilityRule={rule}
        />
      )}
    </ProfilePage>
  );
}
