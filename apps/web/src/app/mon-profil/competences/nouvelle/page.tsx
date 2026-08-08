import Link from 'next/link';
import { ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { searchSkills } from '@/lib/queries/reference';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { ProfileSkillForm } from '../ProfileSkillForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.skillForm.addTitle };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-023 — Ajouter une competence. */
export default async function NewProfileSkillPage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <ProfilePage
        context={context}
        currentPath={PROFILE_ROUTES.skills}
        title={frProfile.skillForm.addTitle}
      >
        {null}
      </ProfilePage>
    );
  }

  const referential = await searchSkills(null, 60, context.correlationId);

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.skills}
      title={frProfile.skillForm.addTitle}
      subtitle={frProfile.skillForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.skills} className={LINK_CLASS}>
          ← {frProfile.skillForm.backLink}
        </Link>
      }
    >
      {!referential.ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={referential.error.userMessage}
          correlationId={context.correlationId}
        />
      ) : (
        <ProfileSkillForm skill={null} referential={referential.data} evidenceCount={0} />
      )}
    </ProfilePage>
  );
}
