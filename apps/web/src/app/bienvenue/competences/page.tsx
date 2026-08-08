import { Alert, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadSelectedSkills } from '@/lib/queries/onboarding';
import { searchSkills } from '@/lib/queries/reference';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { SkillsForm } from './SkillsForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.skills.title };

/**
 * ISE-010 — Etape 3 sur 7 : competences.
 *
 * ECART ASSUME : la maquette porte « Étape 4 sur 7 » et un rail different
 * de celui d'ISE-009 a ISE-014. Les NOMS DE FICHIERS tranchent (D-01) :
 * `ISE-011_Secteurs_Etape_4` fixe les secteurs a l'etape 4, donc les
 * competences a l'etape 3 — ce que confirme le rail des six autres
 * maquettes de la serie.
 *
 * ECART ASSUME : le bloc « Suggestions pour vous » de la maquette n'est
 * pas rendu. Il supposerait un annuaire peuple pour produire des raisons
 * reelles ; en fabriquer serait un persona en dur (MASTER PROMPT §78).
 * Le referentiel complet, regroupe par domaine, le remplace.
 */
export default async function OnboardingSkillsPage() {
  const guard = await requireOnboardingStep('competences');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={3}
        furthestStep={3}
        panelTitle={frOnboarding.skills.panelTitle}
        panelBody={frOnboarding.skills.panelBody}
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

  const [selected, browse] = await Promise.all([
    loadSelectedSkills(profile.id, guard.correlationId),
    searchSkills(null, 60, guard.correlationId),
  ]);

  const failed = !selected.ok || !browse.ok;

  return (
    <OnboardingShell
      currentStep={3}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.skills.panelTitle}
      panelBody={frOnboarding.skills.panelBody}
      asideTitle={frOnboarding.shell.savedNotice}
      asideBody={frOnboarding.shell.savedHint}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.skills.title}</h1>
        <p className="text-body text-text-secondary">
          {frOnboarding.skills.subtitle.replace('{max}', '5')}
        </p>
      </header>

      <Alert variant="info" title={frOnboarding.skills.declarativeTitle}>
        {frOnboarding.skills.declarativeBody}
      </Alert>

      {failed ? (
        <ErrorState
          title={frOnboarding.shell.loadErrorTitle}
          description={frOnboarding.shell.loadErrorBody}
          correlationId={guard.correlationId}
        />
      ) : (
        <SkillsForm
          selected={selected.ok ? selected.data : []}
          referential={browse.ok ? browse.data : []}
          backHref={onboardingRoute('promotion')}
        />
      )}
    </OnboardingShell>
  );
}
