import Link from 'next/link';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES, educationRoute } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadEducations } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { DeleteRowForm } from '@/components/profile/DeleteRowForm';
import { deleteEducationAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.educations.title };

const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-020 — Mes formations. */
export default async function EducationsPage() {
  const context = await requireProfile();
  const list = context.ok ? await loadEducations(context.profile.id, context.correlationId) : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.educations}
      title={frProfile.educations.title}
      subtitle={frProfile.educations.subtitle}
      action={
        <Link href={PROFILE_ROUTES.newEducation} className={PRIMARY_LINK}>
          {frProfile.educations.add}
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
          title={frProfile.educations.emptyTitle}
          description={frProfile.educations.emptyBody}
          action={
            <Link href={PROFILE_ROUTES.newEducation} className={PRIMARY_LINK}>
              {frProfile.educations.add}
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-body-sm text-text-secondary">
            {frProfile.educations.count.replace('{count}', String(list.data.length))}
          </p>

          <ul className="flex flex-col gap-5">
            {list.data.map((education) => (
              <Card as="li" key={education.id}>
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="min-w-0">
                    <h2 className="text-h4 text-text-primary font-semibold">
                      {education.degree ?? education.institution}
                    </h2>
                    <p className="text-body-sm text-primary mt-1 font-medium">
                      {education.institution}
                    </p>
                    <p className="text-caption text-text-secondary mt-1">
                      {[education.fieldOfStudy, education.city, education.countryName]
                        .filter(Boolean)
                        .join(' · ') || frProfile.common.notProvided}
                    </p>
                    <p className="mt-3 flex flex-wrap gap-3">
                      <Badge tone="info">
                        {education.educationType === 'certification'
                          ? frProfile.educations.typeCertification
                          : frProfile.educations.typeAcademic}
                      </Badge>
                      <Badge tone="neutral">{frProfile.visibility[education.visibility]}</Badge>
                    </p>
                    {education.description ? (
                      <p className="text-body-sm text-text-secondary mt-4 whitespace-pre-line">
                        {education.description}
                      </p>
                    ) : null}
                    {education.credentialUrl ? (
                      <p className="text-caption mt-3">
                        <a
                          href={education.credentialUrl}
                          rel="noreferrer noopener nofollow"
                          target="_blank"
                          className={LINK_CLASS}
                        >
                          {frProfile.educationForm.credentialLabel}
                        </a>
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <p className="text-caption text-text-muted">
                      {[education.startYear, education.endYear].filter(Boolean).join(' — ')}
                    </p>
                    <Link href={educationRoute(education.id)} className={LINK_CLASS}>
                      {frProfile.common.edit}
                      <span className="sr-only">
                        {' '}
                        — {education.degree ?? education.institution}
                      </span>
                    </Link>
                    <DeleteRowForm
                      action={deleteEducationAction}
                      fieldName="educationId"
                      fieldValue={education.id}
                      confirmLabel={frProfile.educations.deleteConfirm}
                      itemLabel={education.degree ?? education.institution}
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
