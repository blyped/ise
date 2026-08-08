import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadVisibilityRules } from '@/lib/queries/reference';
import { loadEducation } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { EducationForm } from '../EducationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.educationForm.editTitle };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-021 — Modifier une formation. */
export default async function EditEducationPage({
  params,
}: {
  params: Promise<{ educationId: string }>;
}) {
  const { educationId } = await params;
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <ProfilePage
        context={context}
        currentPath={PROFILE_ROUTES.educations}
        title={frProfile.educationForm.editTitle}
      >
        {null}
      </ProfilePage>
    );
  }

  const [education, countries, rules] = await Promise.all([
    loadEducation(context.profile.id, educationId, context.correlationId),
    loadCountries(context.correlationId),
    loadVisibilityRules(context.correlationId),
  ]);

  const rule = rules.ok ? rules.data.find((entry) => entry.fieldKey === 'educations') : undefined;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.educations}
      title={frProfile.educationForm.editTitle}
      subtitle={frProfile.educationForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.educations} className={LINK_CLASS}>
          ← {frProfile.educationForm.backLink}
        </Link>
      }
    >
      {!education.ok || !countries.ok || rule === undefined ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.correlationId}
        />
      ) : education.data === null ? (
        <EmptyState
          title={frProfile.educationForm.notFoundTitle}
          description={frProfile.educationForm.notFoundBody}
          action={
            <Link href={PROFILE_ROUTES.educations} className={LINK_CLASS}>
              {frProfile.educationForm.backLink}
            </Link>
          }
        />
      ) : (
        <EducationForm
          education={education.data}
          countries={countries.data}
          visibilityRule={rule}
        />
      )}
    </ProfilePage>
  );
}
