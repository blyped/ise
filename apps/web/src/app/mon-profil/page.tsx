import Link from 'next/link';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { frDocuments } from '@/i18n/profile-documents';
import { ROUTES } from '@/lib/routes';
import { ONBOARDING_ROOT, PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { requireProfile } from '@/lib/profile-guard';
import { loadMissingItems, loadMyCompletion } from '@/lib/queries/onboarding';
import { loadCountries } from '@/lib/queries/reference';
import {
  loadEducations,
  loadExperiences,
  loadNamedAvailabilities,
  loadProfileSectors,
  loadProfileSkills,
  loadPromotionById,
} from '@/lib/queries/profile-sections';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.overview.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function frenchYear(iso: string | null): string {
  if (iso === null) return '';
  return new Intl.DateTimeFormat('fr-FR', { year: 'numeric' }).format(new Date(iso));
}

/**
 * ISE-016 — Mon profil.
 *
 * Chaque bloc est alimente par la base. Un bloc vide affiche un etat vide
 * avec une action de sortie (D-93) : jamais de contenu de demonstration.
 * Le score de completion passe par `my_profile_completion()` et les
 * manques par `my_profile_missing_items()` (D-72).
 */
export default async function MyProfilePage() {
  const context = await requireProfile();

  if (!context.ok) {
    return (
      <AppShell currentPath={PROFILE_ROUTES.overview} displayName={frProfile.overview.title}>
        {context.noProfile ? (
          <Alert
            variant="info"
            title={frProfile.overview.noProfileTitle}
            action={
              <Link href={ROUTES.claimSearch} className={LINK_CLASS}>
                {frProfile.overview.noProfileAction}
              </Link>
            }
          >
            {frProfile.overview.noProfileBody}
          </Alert>
        ) : (
          <ErrorState
            title={frProfile.common.loadErrorTitle}
            description={context.message}
            correlationId={context.correlationId}
          />
        )}
      </AppShell>
    );
  }

  const { profile, correlationId } = context;

  const [experiences, educations, skills, sectors, availabilities, missing, completion] =
    await Promise.all([
      loadExperiences(profile.id, correlationId),
      loadEducations(profile.id, correlationId),
      loadProfileSkills(profile.id, correlationId),
      loadProfileSectors(profile.id, correlationId),
      loadNamedAvailabilities(profile.id, correlationId),
      loadMissingItems(correlationId),
      loadMyCompletion(),
    ]);

  let promotionLabel: string | null = null;
  if (profile.promotionId !== null) {
    const found = await loadPromotionById(profile.promotionId, correlationId);
    if (found.ok && found.data !== null) {
      promotionLabel = `${found.data.programCode} ${found.data.graduationYear}`;
    }
  }

  // Le pays est affiche par son libelle francais, jamais par son code ISO :
  // « CI » n'est pas une information lisible pour un membre.
  let countryName: string | null = null;
  if (profile.currentCountryCode !== null) {
    const countries = await loadCountries(correlationId);
    if (countries.ok) {
      countryName =
        countries.data.find((country) => country.code === profile.currentCountryCode)?.name ?? null;
    }
  }

  const displayName = profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim();
  const location = [profile.currentCity, countryName].filter(Boolean).join(', ');
  const primarySkills = skills.ok ? skills.data.filter((skill) => skill.isPrimary) : [];

  return (
    <AppShell
      currentPath={PROFILE_ROUTES.overview}
      displayName={displayName}
      contextLine={promotionLabel ?? undefined}
    >
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frProfile.overview.title}</h1>
          <p className="text-body text-text-secondary">{frProfile.overview.subtitle}</p>
        </header>

        {profile.onboardingCompletedAt === null ? (
          <Alert
            variant="action"
            title={frProfile.common.onboardingPendingTitle}
            action={
              <Link href={ONBOARDING_ROOT} className={LINK_CLASS}>
                {frProfile.common.onboardingPendingAction}
              </Link>
            }
          >
            {frProfile.common.onboardingPendingBody}
          </Alert>
        ) : null}

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-7">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="flex min-w-0 items-start gap-5">
                  <Avatar name={displayName} size={64} decorative />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-h3 text-text-primary font-bold">{displayName}</h2>
                      <Badge
                        tone={profile.verificationStatus === 'verified' ? 'success' : 'neutral'}
                      >
                        {profile.verificationStatus === 'verified'
                          ? frProfile.overview.verified
                          : frProfile.overview.unverified}
                      </Badge>
                    </div>
                    <p className="text-body-sm text-text-secondary mt-1">
                      {[profile.headline, promotionLabel].filter(Boolean).join(' · ') ||
                        frProfile.common.notProvided}
                    </p>
                    {location.length > 0 ? (
                      <p className="text-body-sm text-text-secondary mt-1">{location}</p>
                    ) : null}

                    {primarySkills.length > 0 ? (
                      <ul className="mt-4 flex flex-wrap gap-3">
                        {primarySkills.map((skill) => (
                          <li key={skill.skillId}>
                            <Chip selected>{skill.name}</Chip>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </div>

                <Link href={PROFILE_ROUTES.header} className={LINK_CLASS}>
                  {frProfile.overview.editHeader}
                </Link>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <CardTitle as="h2">{frProfile.overview.aboutTitle}</CardTitle>
                  <Link href={PROFILE_ROUTES.header} className={LINK_CLASS}>
                    {frProfile.common.edit}
                  </Link>
                </div>
              </CardHeader>
              <p className="text-body text-text-secondary whitespace-pre-line">
                {profile.bio ?? frProfile.overview.aboutEmpty}
              </p>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <CardTitle as="h2">{frProfile.overview.experienceTitle}</CardTitle>
                  <Link href={PROFILE_ROUTES.experiences} className={LINK_CLASS}>
                    {frProfile.overview.experienceAll}
                  </Link>
                </div>
              </CardHeader>

              {!experiences.ok ? (
                <ErrorState
                  title={frProfile.common.loadErrorTitle}
                  description={experiences.error.userMessage}
                  correlationId={correlationId}
                />
              ) : experiences.data.length === 0 ? (
                <EmptyState
                  title={frProfile.overview.experienceEmpty}
                  description={frProfile.experiences.emptyBody}
                  action={
                    <Link href={PROFILE_ROUTES.newExperience} className={LINK_CLASS}>
                      {frProfile.experiences.add}
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-5">
                  {experiences.data.slice(0, 3).map((experience) => (
                    <li key={experience.id} className="flex flex-wrap justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-body-sm text-text-primary font-semibold">
                          {experience.positionTitle}
                        </span>
                        <span className="text-caption text-text-secondary">
                          {experience.organizationName}
                        </span>
                      </span>
                      <span className="text-caption text-text-muted">
                        {frenchYear(experience.startDate)} —{' '}
                        {experience.isCurrent
                          ? frProfile.experiences.current
                          : frenchYear(experience.endDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <CardTitle as="h2">{frProfile.overview.educationTitle}</CardTitle>
                  <Link href={PROFILE_ROUTES.educations} className={LINK_CLASS}>
                    {frProfile.overview.educationAll}
                  </Link>
                </div>
              </CardHeader>

              {!educations.ok ? (
                <ErrorState
                  title={frProfile.common.loadErrorTitle}
                  description={educations.error.userMessage}
                  correlationId={correlationId}
                />
              ) : educations.data.length === 0 ? (
                <EmptyState
                  title={frProfile.overview.educationEmpty}
                  description={frProfile.educations.emptyBody}
                  action={
                    <Link href={PROFILE_ROUTES.newEducation} className={LINK_CLASS}>
                      {frProfile.educations.add}
                    </Link>
                  }
                />
              ) : (
                <ul className="flex flex-col gap-5">
                  {educations.data.slice(0, 3).map((education) => (
                    <li key={education.id} className="flex flex-wrap justify-between gap-3">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-body-sm text-text-primary font-semibold">
                          {education.degree ?? education.institution}
                        </span>
                        <span className="text-caption text-text-secondary">
                          {education.institution}
                        </span>
                      </span>
                      <span className="text-caption text-text-muted">
                        {education.endYear ?? education.startYear ?? ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <aside className="flex flex-col gap-7" aria-label={frProfile.overview.completionTitle}>
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProfile.overview.completionTitle}</CardTitle>
              </CardHeader>

              {completion === null ? (
                <p className="text-body text-text-secondary">
                  {frProfile.overview.completionUnknown}
                </p>
              ) : (
                <>
                  <p className="text-h2 text-text-primary font-bold">
                    {frProfile.overview.completionValue.replace('{value}', String(completion))}
                  </p>
                  <div
                    className="bg-surface-muted mt-3 h-[6px] w-full overflow-hidden rounded-full"
                    role="progressbar"
                    aria-valuenow={completion}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={frProfile.overview.completionTitle}
                  >
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                  <p className="text-caption text-text-muted mt-3">
                    {frProfile.overview.completionHint}
                  </p>
                </>
              )}

              <h3 className="text-body-sm text-text-primary mt-6 font-semibold">
                {frProfile.overview.missingTitle}
              </h3>
              {missing.ok && missing.data.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-2">
                  {missing.data.map((item) => (
                    <li key={item.blockKey} className="text-caption text-text-secondary">
                      {item.label} — {Math.round(item.completionRatio * 100)} %
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-caption text-text-muted mt-3">
                  {frProfile.overview.missingEmpty}
                </p>
              )}
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <CardTitle as="h2">{frProfile.overview.skillsTitle}</CardTitle>
                  <Link href={PROFILE_ROUTES.skills} className={LINK_CLASS}>
                    {frProfile.overview.skillsManage}
                  </Link>
                </div>
              </CardHeader>

              {!skills.ok || skills.data.length === 0 ? (
                <p className="text-body-sm text-text-secondary">{frProfile.overview.skillsEmpty}</p>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {skills.data.slice(0, 6).map((skill) => (
                      <li
                        key={skill.skillId}
                        className="text-body-sm flex items-center justify-between gap-3"
                      >
                        <span className="text-text-primary">{skill.name}</span>
                        <Badge tone="info">
                          {skill.level === null
                            ? frProfile.skillForm.level.none
                            : frProfile.skillForm.level[skill.level]}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                  <p className="text-caption text-text-muted mt-4">
                    {frProfile.overview.skillsCount.replace('{count}', String(skills.data.length))}
                  </p>
                </>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProfile.overview.sectorsTitle}</CardTitle>
              </CardHeader>
              {sectors.ok && sectors.data.length > 0 ? (
                <ul className="flex flex-wrap gap-3">
                  {sectors.data.map((sector) => (
                    <li key={sector.sectorId}>
                      <Chip>{sector.name}</Chip>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-text-secondary">
                  {frProfile.overview.sectorsEmpty}
                </p>
              )}
            </Card>

            {/* Entree de navigation vers le depot de documents (migration
                0127). Elle vit ici, dans l'index de /mon-profil, parce que
                c'est le seul endroit ou les sections du profil sont
                reellement listees pour le membre. */}
            <Card>
              <CardHeader>
                <div className="flex items-baseline justify-between gap-4">
                  <CardTitle as="h2">{frDocuments.navLabel}</CardTitle>
                  <Link href={PROFILE_ROUTES.documents} className={LINK_CLASS}>
                    {frDocuments.manage}
                  </Link>
                </div>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frDocuments.navHint}</p>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{frProfile.overview.availabilityTitle}</CardTitle>
              </CardHeader>
              {availabilities.ok && availabilities.data.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {availabilities.data.map((entry) => (
                    <li
                      key={entry.code}
                      className="text-body-sm flex items-center justify-between gap-3"
                    >
                      <span className="text-text-primary">{entry.name}</span>
                      <Badge tone="neutral">{frProfile.visibility[entry.visibility]}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-body-sm text-text-secondary">
                  {frProfile.overview.availabilityEmpty}
                </p>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
