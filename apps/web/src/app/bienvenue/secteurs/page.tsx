import { Alert, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadSelectedSectorIds } from '@/lib/queries/onboarding';
import { loadSectors } from '@/lib/queries/reference';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { SectorsForm } from './SectorsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.sectors.title };

/**
 * ISE-011 — Etape 4 sur 7 : secteurs.
 *
 * ECART ASSUME : la maquette affiche « Secteurs frequents dans le reseau ».
 * Cette frequence se calcule sur des profils reels ; l'annuaire n'ayant
 * pas encore ete importe, la liste serait vide ou fabriquee. Le
 * referentiel complet (35 secteurs) la remplace, avec un libelle honnete.
 */
export default async function OnboardingSectorsPage() {
  const guard = await requireOnboardingStep('secteurs');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={4}
        furthestStep={4}
        panelTitle={frOnboarding.sectors.panelTitle}
        panelBody={frOnboarding.sectors.panelBody}
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

  const [sectors, selected] = await Promise.all([
    loadSectors(guard.correlationId),
    loadSelectedSectorIds(profile.id, guard.correlationId),
  ]);

  return (
    <OnboardingShell
      currentStep={4}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.sectors.panelTitle}
      panelBody={frOnboarding.sectors.panelBody}
      asideTitle="Bon réflexe"
      asideBody="Sélectionnez les secteurs dans lesquels vous avez réellement travaillé, conseillé ou piloté des projets."
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.sectors.title}</h1>
        <p className="text-body text-text-secondary">
          {frOnboarding.sectors.subtitle.replace('{max}', '5')}
        </p>
      </header>

      <Alert variant="info" title={frOnboarding.sectors.adviceTitle}>
        {frOnboarding.sectors.adviceBody}
      </Alert>

      {!sectors.ok || !selected.ok ? (
        <ErrorState
          title={frOnboarding.shell.loadErrorTitle}
          description={frOnboarding.shell.loadErrorBody}
          correlationId={guard.correlationId}
        />
      ) : (
        <SectorsForm
          sectors={sectors.data}
          selectedIds={selected.data}
          backHref={onboardingRoute('competences')}
        />
      )}
    </OnboardingShell>
  );
}
