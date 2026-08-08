import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadCountries, loadVisibilityRules } from '@/lib/queries/reference';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { EducationForm } from '../EducationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.educationForm.addTitle };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-021 — Ajouter une formation. */
export default async function NewEducationPage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <ProfilePage
        context={context}
        currentPath={PROFILE_ROUTES.educations}
        title={frProfile.educationForm.addTitle}
      >
        {null}
      </ProfilePage>
    );
  }

  const [countries, rules] = await Promise.all([
    loadCountries(context.correlationId),
    loadVisibilityRules(context.correlationId),
  ]);

  const rule = rules.ok ? rules.data.find((entry) => entry.fieldKey === 'educations') : undefined;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.educations}
      title={frProfile.educationForm.addTitle}
      subtitle={frProfile.educationForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.educations} className={LINK_CLASS}>
          ← {frProfile.educationForm.backLink}
        </Link>
      }
    >
      {!countries.ok || rule === undefined ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={frProfile.common.loadErrorBody}
          correlationId={context.correlationId}
        />
      ) : (
        <EducationForm education={null} countries={countries.data} visibilityRule={rule} />
      )}
    </ProfilePage>
  );
}
