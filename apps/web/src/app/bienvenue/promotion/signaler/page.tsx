import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadCountries } from '@/lib/queries/reference';
import { loadMyPromotionSuggestions } from '@/lib/queries/onboarding';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { MissingPromotionForm } from './MissingPromotionForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.missingPromotion.title };

type SuggestionStatus = keyof typeof frOnboarding.missingPromotion.status;

const STATUS_TONES: Record<SuggestionStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  submitted: 'info',
  under_review: 'info',
  accepted: 'success',
  rejected: 'error',
  duplicate: 'neutral',
};

/**
 * ISE-009 — Signaler une promotion absente.
 *
 * Le formulaire alimente reellement `public.promotion_suggestions`
 * (migration 0035) : le signalement est lisible par son auteur et par les
 * porteurs de `promotions.manage`. Aucune promotion n'est creee
 * automatiquement — c'est exactement ce que dit la maquette.
 */
export default async function MissingPromotionPage() {
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

  const countries = await loadCountries(guard.correlationId);
  const suggestions = await loadMyPromotionSuggestions(
    guard.session.profile.id,
    guard.correlationId,
  );

  return (
    <OnboardingShell
      currentStep={2}
      furthestStep={guard.session.progress.furthestStep}
      panelTitle={frOnboarding.promotion.panelTitle}
      panelBody={frOnboarding.promotion.panelBody}
      asideTitle="Pourquoi signaler ?"
      asideBody="Cela nous aide à enrichir l’annuaire sans vous empêcher d’avancer dans votre parcours."
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          {frOnboarding.missingPromotion.title}
        </h1>
        <p className="text-body text-text-secondary">{frOnboarding.missingPromotion.subtitle}</p>
      </header>

      <Alert variant="info" title={frOnboarding.missingPromotion.noBlockTitle}>
        {frOnboarding.missingPromotion.noBlockBody}
      </Alert>

      <MissingPromotionForm countries={countries.ok ? countries.data : []} />

      {suggestions.ok && suggestions.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frOnboarding.missingPromotion.mineTitle}</CardTitle>
          </CardHeader>
          <ul className="flex flex-col gap-4">
            {suggestions.data.map((suggestion) => (
              <li
                key={suggestion.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 border-b pb-4 last:border-b-0 last:pb-0"
              >
                <span className="flex flex-col">
                  <span className="text-body-sm text-text-primary font-medium">
                    {suggestion.promotionLabel}
                  </span>
                  {suggestion.institution ? (
                    <span className="text-caption text-text-muted">{suggestion.institution}</span>
                  ) : null}
                </span>
                <Badge tone={STATUS_TONES[suggestion.status as SuggestionStatus] ?? 'neutral'}>
                  {frOnboarding.missingPromotion.status[suggestion.status as SuggestionStatus] ??
                    suggestion.status}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </OnboardingShell>
  );
}
