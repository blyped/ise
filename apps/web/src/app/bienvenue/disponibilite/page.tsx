import { Alert, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadDeclaredAvailabilities } from '@/lib/queries/onboarding';
import { loadAvailabilityTypes, loadVisibilityRules } from '@/lib/queries/reference';
import { loadProfileVisibility } from '@/lib/queries/profile-sections';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { AvailabilityForm } from './AvailabilityForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.availability.title };

/**
 * ISE-013 — Etape 6 sur 7 : disponibilite.
 *
 * Les 14 types viennent de `public.availability_types` (D-65). Le
 * « niveau de disponibilite » de la maquette est enregistre comme un
 * plafond mensuel DECLARE (`max_per_month`) : c'est la seule colonne qui
 * porte cette notion, et elle ne vaut jamais engagement (MASTER PROMPT §20).
 */
export default async function OnboardingAvailabilityPage() {
  const guard = await requireOnboardingStep('disponibilite');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={6}
        furthestStep={6}
        panelTitle={frOnboarding.availability.panelTitle}
        panelBody={frOnboarding.availability.panelBody}
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

  const [types, declared, rules, visibility] = await Promise.all([
    loadAvailabilityTypes(guard.correlationId),
    loadDeclaredAvailabilities(profile.id, guard.correlationId),
    loadVisibilityRules(guard.correlationId),
    loadProfileVisibility(profile.id, guard.correlationId),
  ]);

  const rule = rules.ok
    ? rules.data.find((entry) => entry.fieldKey === 'availabilities')
    : undefined;

  return (
    <OnboardingShell
      currentStep={6}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.availability.panelTitle}
      panelBody={frOnboarding.availability.panelBody}
      asideTitle="Conseil"
      asideBody="Choisissez seulement les formes d’aide que vous pouvez réellement assumer aujourd’hui."
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.availability.title}</h1>
        <p className="text-body text-text-secondary">{frOnboarding.availability.subtitle}</p>
      </header>

      <Alert variant="info" title={frOnboarding.availability.calloutTitle}>
        {frOnboarding.availability.calloutBody}
      </Alert>

      {!types.ok || !declared.ok || rule === undefined ? (
        <ErrorState
          title={frOnboarding.availability.emptyTitle}
          description={frOnboarding.availability.emptyBody}
          correlationId={guard.correlationId}
        />
      ) : (
        <AvailabilityForm
          types={types.data}
          declared={declared.data}
          allowedLevels={rule.allowedLevels}
          defaultVisibility={
            (visibility.ok ? visibility.data['availabilities'] : undefined) ??
            rule.defaultVisibility
          }
          backHref={onboardingRoute('localisation')}
        />
      )}
    </OnboardingShell>
  );
}
