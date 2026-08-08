import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { profileSkillIdSchema } from '@ise/validation';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import {
  countSkillEvidence,
  loadExperiences,
  loadProfileSkill,
} from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { ProfileSkillForm } from '../ProfileSkillForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.skillForm.editTitle };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-023 — Gerer une competence deja declaree. */
export default async function EditProfileSkillPage({
  params,
}: {
  params: Promise<{ skillId: string }>;
}) {
  const { skillId } = await params;
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <ProfilePage
        context={context}
        currentPath={PROFILE_ROUTES.skills}
        title={frProfile.skillForm.editTitle}
      >
        {null}
      </ProfilePage>
    );
  }

  const parsed = profileSkillIdSchema.safeParse({ skillId });

  const notFound = (
    <EmptyState
      title={frProfile.skillForm.notFoundTitle}
      description={frProfile.skillForm.notFoundBody}
      action={
        <Link href={PROFILE_ROUTES.skills} className={LINK_CLASS}>
          {frProfile.skillForm.backLink}
        </Link>
      }
    />
  );

  const shell = (children: React.ReactNode) => (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.skills}
      title={frProfile.skillForm.editTitle}
      subtitle={frProfile.skillForm.subtitle}
      action={
        <Link href={PROFILE_ROUTES.skills} className={LINK_CLASS}>
          ← {frProfile.skillForm.backLink}
        </Link>
      }
    >
      {children}
    </ProfilePage>
  );

  if (!parsed.success) return shell(notFound);

  const [skill, experiences] = await Promise.all([
    loadProfileSkill(context.profile.id, parsed.data.skillId, context.correlationId),
    loadExperiences(context.profile.id, context.correlationId),
  ]);

  if (!skill.ok) {
    return shell(
      <ErrorState
        title={frProfile.common.loadErrorTitle}
        description={skill.error.userMessage}
        correlationId={context.correlationId}
      />,
    );
  }

  if (skill.data === null) return shell(notFound);

  const evidenceCount = experiences.ok ? countSkillEvidence(skill.data.name, experiences.data) : 0;

  return shell(
    <ProfileSkillForm skill={skill.data} referential={[]} evidenceCount={evidenceCount} />,
  );
}
