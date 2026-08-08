import { ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadExperienceCountryCodes } from '@/lib/queries/onboarding';
import { loadCountries, loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileVisibility } from '@/lib/queries/profile-sections';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { LocationForm } from './LocationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.location.title };

/**
 * ISE-012 — Etape 5 sur 7 : localisation.
 *
 * Les 249 pays viennent de `public.countries` (D-64). Le commutateur
 * « Afficher ma ville » de la maquette est rendu par un choix a 4 niveaux
 * (D-73) : un interrupteur binaire ne saurait pas exprimer « ma promotion
 * seulement », et le choix est REELLEMENT enregistre dans
 * `profile_visibility`.
 */
export default async function OnboardingLocationPage() {
  const guard = await requireOnboardingStep('localisation');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={5}
        furthestStep={5}
        panelTitle={frOnboarding.location.panelTitle}
        panelBody={frOnboarding.location.panelBody}
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

  const [countries, zones, rules, visibility] = await Promise.all([
    loadCountries(guard.correlationId),
    loadExperienceCountryCodes(profile.id, guard.correlationId),
    loadVisibilityRules(guard.correlationId),
    loadProfileVisibility(profile.id, guard.correlationId),
  ]);

  const cityRule = rules.ok ? rules.data.find((rule) => rule.fieldKey === 'city') : undefined;

  return (
    <OnboardingShell
      currentStep={5}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.location.panelTitle}
      panelBody={frOnboarding.location.panelBody}
      asideTitle="Bon à savoir"
      asideBody="Votre ville actuelle et vos zones d’expérience sont distinctes. Vous gardez le contrôle de leur visibilité."
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.location.title}</h1>
        <p className="text-body text-text-secondary">{frOnboarding.location.subtitle}</p>
      </header>

      {!countries.ok || !zones.ok || cityRule === undefined ? (
        <ErrorState
          title={frOnboarding.shell.loadErrorTitle}
          description={frOnboarding.shell.loadErrorBody}
          correlationId={guard.correlationId}
        />
      ) : (
        <LocationForm
          countries={countries.data}
          selectedZones={zones.data}
          currentCountryCode={profile.currentCountryCode}
          currentCity={profile.currentCity}
          cityVisibility={
            (visibility.ok ? visibility.data['city'] : undefined) ?? cityRule.defaultVisibility
          }
          allowedLevels={cityRule.allowedLevels}
          backHref={onboardingRoute('secteurs')}
        />
      )}
    </OnboardingShell>
  );
}
