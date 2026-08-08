import Link from 'next/link';
import { Alert, EmptyState, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { ONBOARDING_MISSING_PROMOTION } from '@/lib/routes/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadPromotions } from '@/lib/queries/reference';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { PromotionForm } from './PromotionForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.promotion.title };

const LINK_CLASS =
  'font-semibold text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-008 — Etape 2 sur 7 : promotion.
 *
 * Les 72 promotions viennent de `public.promotions` (D-64). Aucune annee
 * n'est calculee dans le code : si le referentiel est vide, l'ecran
 * affiche son etat vide au lieu d'inventer une liste.
 */
export default async function OnboardingPromotionPage() {
  const guard = await requireOnboardingStep('promotion');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={2}
        furthestStep={2}
        panelTitle={frOnboarding.promotion.panelTitle}
        panelBody={frOnboarding.promotion.panelBody}
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
  const promotions = await loadPromotions(guard.correlationId);

  return (
    <OnboardingShell
      currentStep={2}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.promotion.panelTitle}
      panelBody={frOnboarding.promotion.panelBody}
      asideTitle={frOnboarding.shell.savedNotice}
      asideBody={frOnboarding.shell.savedHint}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.promotion.title}</h1>
        <p className="text-body text-text-secondary">{frOnboarding.promotion.subtitle}</p>
      </header>

      <Alert variant="info" title={frOnboarding.promotion.noteTitle}>
        {frOnboarding.promotion.noteBody}
      </Alert>

      {!promotions.ok ? (
        <ErrorState
          title={frOnboarding.shell.loadErrorTitle}
          description={promotions.error.userMessage}
          correlationId={guard.correlationId}
        />
      ) : promotions.data.length === 0 ? (
        <EmptyState
          title={frOnboarding.promotion.emptyTitle}
          description={frOnboarding.promotion.emptyBody}
          action={
            <Link href={ONBOARDING_MISSING_PROMOTION} className={LINK_CLASS}>
              {frOnboarding.promotion.missingLink}
            </Link>
          }
        />
      ) : (
        <PromotionForm
          promotions={promotions.data}
          defaultPromotionId={profile.promotionId}
          backHref="/bienvenue/verification"
        />
      )}
    </OnboardingShell>
  );
}
