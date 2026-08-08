import type { ReactNode } from 'react';
import Link from 'next/link';
import { cx, StepProgress } from '@ise/ui-web';
import { ONBOARDING_STEPS } from '@ise/validation';
import { frOnboarding } from '@/i18n/onboarding';
import { onboardingRoute } from '@/lib/routes/onboarding';
import { BrandLogo } from '@/components/layout/BrandLogo';

const TOTAL = ONBOARDING_STEPS.length;

const STEP_LABELS: readonly string[] = [
  frOnboarding.steps.verification,
  frOnboarding.steps.promotion,
  frOnboarding.steps.competences,
  frOnboarding.steps.secteurs,
  frOnboarding.steps.localisation,
  frOnboarding.steps.disponibilite,
  frOnboarding.steps.finalisation,
];

export interface OnboardingShellProps {
  /** 1..7 — l'ordre vient des noms de fichiers des maquettes (D-01, D-70). */
  currentStep: number;
  /** Etape la plus avancee atteinte : au-dela, la navigation est fermee. */
  furthestStep: number;
  panelTitle: string;
  panelBody: string;
  /** Encart de bas de rail (« Conseil », « Bon à savoir »…). */
  asideTitle?: string;
  asideBody?: string;
  children: ReactNode;
}

/**
 * Gabarit de l'onboarding (maquettes ISE-009 -> ISE-014) : rail sombre a
 * gauche avec les 7 etapes, compteur et barre de progression en haut.
 *
 * Une etape non encore atteinte n'est PAS un lien : proposer un lien qui
 * refuse d'aboutir serait un bouton decoratif (MASTER PROMPT §113). Son
 * etat est annonce en toutes lettres aux lecteurs d'ecran, jamais par la
 * seule couleur (D-90).
 */
export function OnboardingShell({
  currentStep,
  furthestStep,
  panelTitle,
  panelBody,
  asideTitle,
  asideBody,
  children,
}: OnboardingShellProps) {
  const counter = frOnboarding.shell.stepCounter
    .replace('{current}', String(currentStep))
    .replace('{total}', String(TOTAL));

  return (
    <div className="bg-background min-h-dvh lg:flex">
      <a className="skip-link" href="#contenu-principal">
        Aller au contenu principal
      </a>

      <aside className="bg-deep-navy shrink-0 px-7 py-8 lg:min-h-dvh lg:w-[332px] lg:px-9 lg:py-9">
        <BrandLogo tone="light" />

        <p className="text-caption text-ise-gold mt-9 font-semibold uppercase tracking-[0.08em]">
          {frOnboarding.shell.kicker}
        </p>
        <h1 className="text-h2 text-text-inverse mt-3 font-bold">{panelTitle}</h1>
        <p className="text-body-sm mt-4 text-[#C7D2E5]">{panelBody}</p>

        <nav aria-label={frOnboarding.shell.stepsLabel} className="mt-9">
          <ol className="flex flex-col gap-2">
            {STEP_LABELS.map((label, index) => {
              const step = index + 1;
              const isCurrent = step === currentStep;
              const isDone = step < currentStep;
              const isReachable = step <= furthestStep && !isCurrent;

              const state = isCurrent
                ? frOnboarding.shell.stepCurrent
                : isDone
                  ? frOnboarding.shell.stepDone
                  : isReachable
                    ? ''
                    : frOnboarding.shell.stepLocked;

              const bullet = (
                <span
                  aria-hidden="true"
                  className={cx(
                    'text-caption inline-flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full font-semibold',
                    isCurrent
                      ? 'bg-primary text-primary-foreground'
                      : isDone
                        ? 'text-ise-gold bg-[#1E3A66]'
                        : 'bg-[#12315F] text-[#8FA6C8]',
                  )}
                >
                  {isDone ? '✓' : step}
                </span>
              );

              const body = (
                <>
                  {bullet}
                  <span className="flex flex-col leading-tight">
                    <span>{label}</span>
                    {state ? <span className="sr-only"> — {state}</span> : null}
                  </span>
                </>
              );

              const row =
                'flex items-center gap-4 rounded-base px-4 py-3 text-body-sm min-h-[44px]';

              return (
                <li key={label}>
                  {isReachable ? (
                    <Link
                      href={onboardingRoute(step)}
                      className={cx(
                        row,
                        'hover:text-text-inverse text-[#C7D2E5] transition-colors duration-150 hover:bg-[#12315F]',
                        'focus-visible:outline-ise-gold focus-visible:outline-2 focus-visible:outline-offset-2',
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <span
                      aria-current={isCurrent ? 'step' : undefined}
                      className={cx(
                        row,
                        isCurrent
                          ? 'text-text-inverse bg-[#12315F] font-semibold'
                          : 'text-[#8FA6C8]',
                      )}
                    >
                      {body}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        {asideTitle ? (
          <div className="mt-9 border-t border-[#1E3A66] pt-6">
            <p className="text-caption text-ise-gold font-semibold">{asideTitle}</p>
            {asideBody ? <p className="text-caption mt-2 text-[#8FA6C8]">{asideBody}</p> : null}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface flex h-[var(--layout-topbar)] shrink-0 items-center justify-end border-b px-7 max-md:px-5">
          <StepProgress
            current={currentStep}
            total={TOTAL}
            label={counter}
            progressLabel={frOnboarding.shell.progressLabel}
            className="w-[220px]"
          />
        </header>

        <main id="contenu-principal" className="flex-1 px-7 py-8 max-md:px-5 max-md:py-6">
          <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
