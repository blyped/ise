import type { ReactNode } from 'react';
import { Alert, Card, CardHeader, CardTitle, StepProgress } from '@ise/ui-web';
import { frCalls, tc } from '@/i18n/calls';

const STEPS = [
  frCalls.wizard.step1,
  frCalls.wizard.step2,
  frCalls.wizard.step3,
  frCalls.wizard.step4,
] as const;

/**
 * Gabarit commun aux quatre etapes de l'assistant (ISE-049 -> ISE-052).
 *
 * La progression est rendue par `StepProgress`, deja utilise par
 * l'onboarding : meme composant, meme comportement clavier, meme
 * annonce vocale. Le rail lateral porte les conseils, jamais une
 * action : il ne doit pas concurrencer le bouton de l'etape.
 */
export function CallWizardShell({
  currentStep,
  title,
  subtitle,
  aside,
  children,
}: {
  currentStep: 1 | 2 | 3 | 4;
  title: string;
  subtitle: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
        <p className="text-body text-text-secondary">{subtitle}</p>
      </div>

      <StepProgress
        current={currentStep}
        total={STEPS.length}
        label={STEPS[currentStep - 1] ?? ''}
        progressLabel={tc(frCalls.wizard.stepLabel, {
          current: currentStep,
          total: STEPS.length,
        })}
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>{children}</Card>

        <aside className="flex flex-col gap-7">
          {aside ?? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frCalls.wizard.tipsTitle}</CardTitle>
              </CardHeader>
              <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
                <li>{frCalls.wizard.tip1}</li>
                <li>{frCalls.wizard.tip2}</li>
                <li>{frCalls.wizard.tip3}</li>
                <li>{frCalls.wizard.tip4}</li>
              </ul>
            </Card>
          )}

          <Alert variant="info" title={frCalls.detail.privacyTitle}>
            {frCalls.detail.privacyBody}
          </Alert>
        </aside>
      </div>
    </div>
  );
}
