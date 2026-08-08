import type { ReactNode } from 'react';
import { Alert, Card, StepProgress } from '@ise/ui-web';
import { frOpportunities, to } from '@/i18n/opportunities';

const STEPS = [
  frOpportunities.wizard.step1,
  frOpportunities.wizard.step2,
  frOpportunities.wizard.step3,
] as const;

/** Gabarit commun aux trois étapes de publication (ISE-057 → ISE-059). */
export function OpportunityWizardShell({
  currentStep,
  title,
  subtitle,
  aside,
  children,
}: {
  currentStep: 1 | 2 | 3;
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
        progressLabel={to(frOpportunities.wizard.stepLabel, {
          current: currentStep,
          total: STEPS.length,
        })}
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>{children}</Card>
        <aside className="flex flex-col gap-7">
          {aside ?? null}
          <Alert variant="warning" title={frOpportunities.wizard.noDiscriminationTitle}>
            {frOpportunities.wizard.noDiscriminationBody}
          </Alert>
        </aside>
      </div>
    </div>
  );
}
