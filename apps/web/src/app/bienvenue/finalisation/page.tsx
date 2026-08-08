import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import {
  loadDeclaredAvailabilities,
  loadExperienceCountryCodes,
  loadMissingItems,
  loadMyCompletion,
  loadSelectedSectorIds,
  loadSelectedSkills,
} from '@/lib/queries/onboarding';
import { loadCountries, loadSectors } from '@/lib/queries/reference';
import { loadPromotionById } from '@/lib/queries/profile-sections';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { FinalizeForm } from './FinalizeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.finalize.title };

const LINK_CLASS =
  'text-body-sm font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function SummaryRow({
  label,
  value,
  href,
  badge,
}: {
  label: string;
  value: string;
  href: string;
  badge?: string;
}) {
  return (
    <li className="rounded-base border-border bg-surface flex flex-wrap items-center justify-between gap-4 border px-5 py-4">
      <span className="flex min-w-0 flex-col">
        <span className="text-caption text-text-muted uppercase tracking-[0.04em]">{label}</span>
        <span className="text-body-sm text-text-primary font-medium">{value}</span>
      </span>
      <span className="flex items-center gap-4">
        {badge ? <Badge tone="info">{badge}</Badge> : null}
        <Link href={href} className={LINK_CLASS}>
          {frOnboarding.finalize.edit}
          <span className="sr-only"> — {label}</span>
        </Link>
      </span>
    </li>
  );
}

/**
 * ISE-014 — Etape 7 sur 7 : finalisation.
 *
 * Le recapitulatif est integralement LU EN BASE. Le score de completion
 * passe par `my_profile_completion()` et les manques par
 * `my_profile_missing_items()` : jamais par lecture directe de la colonne
 * (D-72). Aucune valeur n'est estimee.
 */
export default async function OnboardingFinalizePage() {
  const guard = await requireOnboardingStep('finalisation');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={7}
        furthestStep={7}
        panelTitle={frOnboarding.finalize.panelTitle}
        panelBody={frOnboarding.finalize.panelBody}
      >
        <ErrorState
          title={frOnboarding.shell.loadErrorTitle}
          description={guard.message}
          correlationId={guard.correlationId}
        />
      </OnboardingShell>
    );
  }

  const { profile, progress } = guard.session;

  const [skills, sectorIds, sectors, zones, countries, availabilities, missing, completion] =
    await Promise.all([
      loadSelectedSkills(profile.id, guard.correlationId),
      loadSelectedSectorIds(profile.id, guard.correlationId),
      loadSectors(guard.correlationId),
      loadExperienceCountryCodes(profile.id, guard.correlationId),
      loadCountries(guard.correlationId),
      loadDeclaredAvailabilities(profile.id, guard.correlationId),
      loadMissingItems(guard.correlationId),
      loadMyCompletion(),
    ]);

  let promotionLabel: string = frOnboarding.finalize.nothingYet;
  if (profile.promotionId !== null) {
    const found = await loadPromotionById(profile.promotionId, guard.correlationId);
    if (found.ok && found.data !== null) {
      promotionLabel = `${found.data.programCode} ${found.data.graduationYear}`;
    }
  }

  const skillNames = skills.ok ? skills.data.map((skill) => skill.name) : [];
  const sectorNames =
    sectors.ok && sectorIds.ok
      ? sectors.data
          .filter((sector) => sectorIds.data.includes(sector.id))
          .map((sector) => sector.name)
      : [];
  const countryNames =
    countries.ok && zones.ok
      ? countries.data
          .filter((country) => zones.data.includes(country.code))
          .map((country) => country.name)
      : [];
  const availabilityNames = availabilities.ok
    ? availabilities.data.filter((entry) => entry.active).map((entry) => entry.availabilityType)
    : [];

  const locationLabel = [profile.currentCity, ...countryNames].filter(Boolean).join(' · ');

  return (
    <OnboardingShell
      currentStep={7}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.finalize.panelTitle}
      panelBody={frOnboarding.finalize.panelBody}
      asideTitle={frOnboarding.finalize.afterTitle}
      asideBody={frOnboarding.finalize.afterBody}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.finalize.title}</h1>
        <p className="text-body text-text-secondary">{frOnboarding.finalize.subtitle}</p>
      </header>

      {profile.promotionId === null ? (
        <Alert
          variant="warning"
          title={frOnboarding.finalize.promotionRequiredTitle}
          action={
            <Link href={onboardingRoute('promotion')} className={LINK_CLASS}>
              {frOnboarding.finalize.promotionRequiredAction}
            </Link>
          }
        >
          {frOnboarding.finalize.promotionRequiredBody}
        </Alert>
      ) : null}

      <section aria-labelledby="recap" className="flex flex-col gap-4">
        <h2 id="recap" className="text-h4 text-text-primary font-semibold">
          {frOnboarding.finalize.summaryTitle}
        </h2>
        <ul className="flex flex-col gap-3">
          <SummaryRow
            label={frOnboarding.finalize.promotionLabel}
            value={promotionLabel}
            href={onboardingRoute('promotion')}
          />
          <SummaryRow
            label={frOnboarding.finalize.skillsLabel}
            value={
              skillNames.length > 0 ? skillNames.join(' · ') : frOnboarding.finalize.nothingYet
            }
            badge={frOnboarding.finalize.countLabel.replace('{count}', String(skillNames.length))}
            href={onboardingRoute('competences')}
          />
          <SummaryRow
            label={frOnboarding.finalize.sectorsLabel}
            value={
              sectorNames.length > 0 ? sectorNames.join(' · ') : frOnboarding.finalize.nothingYet
            }
            badge={frOnboarding.finalize.countLabel.replace('{count}', String(sectorNames.length))}
            href={onboardingRoute('secteurs')}
          />
          <SummaryRow
            label={frOnboarding.finalize.locationLabel}
            value={locationLabel.length > 0 ? locationLabel : frOnboarding.finalize.nothingYet}
            href={onboardingRoute('localisation')}
          />
          <SummaryRow
            label={frOnboarding.finalize.availabilityLabel}
            value={
              availabilityNames.length > 0
                ? frOnboarding.availability.selectedCount.replace(
                    '{count}',
                    String(availabilityNames.length),
                  )
                : frOnboarding.finalize.nothingYet
            }
            href={onboardingRoute('disponibilite')}
          />
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOnboarding.finalize.completionLabel}</CardTitle>
        </CardHeader>

        {completion === null ? (
          <p className="text-body text-text-secondary">{frOnboarding.finalize.completionUnknown}</p>
        ) : (
          <>
            <p className="text-h2 text-text-primary font-bold">
              {frOnboarding.finalize.completionValue.replace('{value}', String(completion))}
            </p>
            <div
              className="bg-surface-muted mt-3 h-[6px] w-full overflow-hidden rounded-full"
              role="progressbar"
              aria-valuenow={completion}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={frOnboarding.finalize.completionLabel}
            >
              <span
                className="bg-primary block h-full rounded-full"
                style={{ width: `${completion}%` }}
              />
            </div>
          </>
        )}

        {missing.ok && missing.data.length > 0 ? (
          <div className="mt-6 flex flex-col gap-3">
            <h3 className="text-body-sm text-text-primary font-semibold">
              {frOnboarding.finalize.missingTitle}
            </h3>
            <p className="text-caption text-text-muted">{frOnboarding.finalize.missingHint}</p>
            <ul className="flex flex-wrap gap-3">
              {missing.data.map((item) => (
                <li key={item.blockKey}>
                  <Badge tone="neutral">
                    {item.label} · {Math.round(item.completionRatio * 100)} %
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <FinalizeForm
        backHref={onboardingRoute('disponibilite')}
        promotionMissing={profile.promotionId === null}
      />
    </OnboardingShell>
  );
}
