import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES, experienceRoute } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadExperiences } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { DeleteRowForm } from '@/components/profile/DeleteRowForm';
import { deleteExperienceAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.experiences.title };

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function frenchYear(iso: string | null): string {
  if (iso === null) return '';
  return new Intl.DateTimeFormat('fr-FR', { year: 'numeric' }).format(new Date(iso));
}

/** ISE-018 — Mes experiences. */
export default async function ExperiencesPage() {
  const context = await requireProfile();

  const list = context.ok ? await loadExperiences(context.profile.id, context.correlationId) : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.experiences}
      title={frProfile.experiences.title}
      subtitle={frProfile.experiences.subtitle}
      action={
        <Link href={PROFILE_ROUTES.newExperience} className={PRIMARY_LINK}>
          {frProfile.experiences.add}
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
          title={frProfile.experiences.emptyTitle}
          description={frProfile.experiences.emptyBody}
          action={
            <Link href={PROFILE_ROUTES.newExperience} className={PRIMARY_LINK}>
              {frProfile.experiences.add}
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-body-sm text-text-secondary">
            {frProfile.experiences.count.replace('{count}', String(list.data.length))}
          </p>

          <ul className="flex flex-col gap-5">
            {list.data.map((experience) => (
              <Card as="li" key={experience.id}>
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <h2 className="text-h4 text-text-primary font-semibold">
                      {experience.positionTitle}
                    </h2>
                    <p className="text-body-sm text-primary mt-1 font-medium">
                      {experience.organizationName}
                    </p>
                    <p className="text-caption text-text-secondary mt-1">
                      {[experience.city, experience.countryName].filter(Boolean).join(', ') ||
                        frProfile.common.notProvided}
                    </p>
                    {experience.sectorName ? (
                      <p className="mt-3">
                        <Badge tone="info">{experience.sectorName}</Badge>
                      </p>
                    ) : null}
                    {experience.description ? (
                      <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                        {experience.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <p className="text-caption text-text-muted">
                      {frenchYear(experience.startDate)} —{' '}
                      {experience.isCurrent
                        ? frProfile.experiences.current
                        : frenchYear(experience.endDate)}
                    </p>
                    <Badge tone="neutral">{frProfile.visibility[experience.visibility]}</Badge>
                    <Link href={experienceRoute(experience.id)} className={LINK_CLASS}>
                      {frProfile.common.edit}
                      <span className="sr-only"> — {experience.positionTitle}</span>
                    </Link>
                    <DeleteRowForm
                      action={deleteExperienceAction}
                      fieldName="experienceId"
                      fieldValue={experience.id}
                      confirmLabel={frProfile.experiences.deleteConfirm}
                      itemLabel={experience.positionTitle}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </ul>
        </>
      )}
    </ProfilePage>
  );
}
