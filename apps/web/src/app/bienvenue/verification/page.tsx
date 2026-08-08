import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frOnboarding } from '@/i18n/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { requireOnboardingStep } from '@/lib/onboarding-guard';
import { loadPromotionById } from '@/lib/queries/profile-sections';
import { OnboardingShell } from '@/components/onboarding/OnboardingShell';
import { VerificationForm } from './VerificationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOnboarding.verification.title };

/**
 * Etape 1 sur 7 — Verification.
 *
 * ECART ASSUME (D-03) : la maquette ISE-007 montrait la saisie d'un code a
 * 6 chiffres. Aucun code n'est envoye ici. L'adresse du compte est deja
 * confirmee par Supabase Auth, et l'association du profil a deja ete
 * verifiee a la reclamation : redemander un code verifierait une seconde
 * fois la meme chose (MASTER PROMPT §27 et §113). L'ecran montre donc
 * l'ETAT REEL, lu en base, et demande une confirmation explicite.
 */
export default async function OnboardingVerificationPage() {
  const guard = await requireOnboardingStep('verification');

  if (!guard.ok) {
    return (
      <OnboardingShell
        currentStep={1}
        furthestStep={1}
        panelTitle={frOnboarding.verification.panelTitle}
        panelBody={frOnboarding.verification.panelBody}
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

  // Promotion deja enregistree, s'il y en a une. Aucune valeur de repli :
  // quand la base ne connait pas de promotion, l'ecran le dit.
  let promotion: string | null = null;
  if (profile.promotionId !== null) {
    const found = await loadPromotionById(profile.promotionId, newCorrelationId());
    if (found.ok && found.data !== null) {
      promotion = `${found.data.programCode} ${found.data.graduationYear}`;
    }
  }

  return (
    <OnboardingShell
      currentStep={1}
      furthestStep={progress.furthestStep}
      panelTitle={frOnboarding.verification.panelTitle}
      panelBody={frOnboarding.verification.panelBody}
      asideTitle={frOnboarding.shell.savedNotice}
      asideBody={frOnboarding.shell.savedHint}
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frOnboarding.verification.title}</h1>
        <p className="text-body text-text-secondary">{frOnboarding.verification.subtitle}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{frOnboarding.verification.profileLabel}</CardTitle>
        </CardHeader>

        <dl className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">
              {frOnboarding.verification.accountEmailLabel}
            </dt>
            <dd className="text-body-sm text-text-primary flex items-center gap-3 font-medium">
              <span className="font-mono">{guard.accountEmail}</span>
              <Badge tone={guard.accountConfirmed ? 'success' : 'warning'}>
                {guard.accountConfirmed
                  ? frOnboarding.verification.accountConfirmed
                  : frOnboarding.verification.accountNotConfirmed}
              </Badge>
            </dd>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">
              {frOnboarding.verification.profileLabel}
            </dt>
            <dd className="text-body-sm text-text-primary font-medium">
              {profile.displayName ?? `${profile.firstName} ${profile.lastName}`.trim()}
            </dd>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">
              {frOnboarding.verification.promotionLabel}
            </dt>
            <dd className="text-body-sm text-text-primary font-medium">
              {promotion === null ? frOnboarding.verification.promotionUnknown : promotion}
            </dd>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <dt className="text-body-sm text-text-secondary">
              {frOnboarding.verification.verificationLabel}
            </dt>
            <dd>
              <Badge tone={profile.verificationStatus === 'verified' ? 'success' : 'neutral'}>
                {profile.verificationStatus === 'verified'
                  ? frOnboarding.verification.accountConfirmed
                  : frOnboarding.verification.accountNotConfirmed}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <Alert variant="info" title={frOnboarding.verification.noCodeTitle}>
        {frOnboarding.verification.noCodeBody}
      </Alert>

      <VerificationForm />
    </OnboardingShell>
  );
}
