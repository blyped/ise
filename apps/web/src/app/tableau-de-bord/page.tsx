import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import type { ClaimStatus, VerificationStatus } from '@ise/db-types';
import { fr, t } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { ONBOARDING_ROOT } from '@/lib/routes/onboarding';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadMemberContext, type MemberProfile } from '@/lib/queries/profile';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: fr.nav.home };

const CLAIM_TONES: Record<ClaimStatus, 'neutral' | 'info' | 'success'> = {
  unclaimed: 'neutral',
  claim_pending: 'info',
  claimed: 'success',
};

const VERIFICATION_TONES: Record<VerificationStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  unverified: 'neutral',
  pending: 'info',
  verified: 'success',
  rejected: 'error',
};

/** Section de contenu dont le module n'est pas encore ouvert. */
function PendingSection({ title }: { title: string }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={`section-${title}`}>
      <h2 id={`section-${title}`} className="text-h3 text-text-primary font-semibold">
        {title}
      </h2>
      <EmptyState
        title={fr.dashboard.moduleUnavailableTitle}
        description={fr.dashboard.moduleUnavailableBody}
      />
    </section>
  );
}

function ProfileCard({ profile }: { profile: MemberProfile }) {
  const completion = profile.profile_completion;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{fr.dashboard.profileCardTitle}</CardTitle>
      </CardHeader>

      {/*
        Le score de completion est prive (D-72). S'il n'a pas pu etre lu, on le
        dit : afficher « 0 % » ferait passer une lecture manquee pour un profil
        vide (MASTER PROMPT §98).
      */}
      {completion === null ? (
        <p className="text-body text-text-secondary">{fr.dashboard.profileCompletionUnknown}</p>
      ) : (
        <>
          <p className="text-h2 text-text-primary font-bold">
            {t(fr.dashboard.profileCompletion, { value: completion })}
          </p>
          <div
            className="bg-surface-muted mt-3 h-[6px] w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={completion}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={fr.dashboard.profileCardTitle}
          >
            <span
              className="bg-primary block h-full rounded-full"
              style={{ width: `${completion}%` }}
            />
          </div>
          <p className="text-caption text-text-muted mt-3">{fr.dashboard.profileCompletionHint}</p>
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <Badge tone={CLAIM_TONES[profile.claim_status]}>
          {fr.dashboard.claimStatus[profile.claim_status]}
        </Badge>
        <Badge tone={VERIFICATION_TONES[profile.verification_status]}>
          {fr.dashboard.verificationStatus[profile.verification_status]}
        </Badge>
      </div>
    </Card>
  );
}

/** ISE-015 — Tableau de bord membre. Coquille alimentee uniquement par la base. */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // Pose par ISE-007 apres une reclamation approuvee : le bandeau confirme
  // l'association a l'arrivee, sans laisser l'utilisateur sur un ecran d'attente.
  const claimApproved = params['reclamation'] === 'approuvee';

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense en profondeur : le middleware a deja filtre, on ne s'y fie pas seul.
  if (!user) redirect(ROUTES.sessionExpired);

  const { profile, promotion, failed } = await loadMemberContext(user.id);

  // Un profil reclame mais dont l'onboarding n'est pas termine part le
  // finir : la position exacte est relue en base par `/bienvenue`
  // (ISE-008 -> ISE-014). Aucune etape n'est refaite inutilement.
  if (profile && profile.onboarding_completed_at === null) redirect(ONBOARDING_ROOT);

  const accountEmail = user.email ?? '';
  const displayName = profile
    ? (profile.display_name ?? `${profile.first_name} ${profile.last_name}`.trim())
    : accountEmail;
  const promotionLine = promotion
    ? `${promotion.program_code} ${promotion.graduation_year}`
    : undefined;

  return (
    <AppShell currentPath={ROUTES.dashboard} displayName={displayName} contextLine={promotionLine}>
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">
            {profile
              ? t(fr.dashboard.greeting, { firstName: profile.first_name })
              : fr.dashboard.greetingFallback}
          </h1>
          <p className="text-body text-text-secondary">{fr.dashboard.subtitle}</p>
        </header>

        {claimApproved && profile ? (
          <Alert variant="success" title={fr.dashboard.claimApprovedTitle}>
            {fr.dashboard.claimApprovedBody}
          </Alert>
        ) : null}

        {failed ? (
          <ErrorState
            title={fr.dashboard.loadErrorTitle}
            description={fr.dashboard.loadErrorBody}
            correlationId={newCorrelationId()}
          />
        ) : null}

        {!failed && !profile ? (
          <Alert
            variant="info"
            title={fr.dashboard.noProfileTitle}
            action={
              <Link
                href={ROUTES.claimSearch}
                className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {fr.dashboard.noProfileAction}
              </Link>
            }
          >
            {fr.dashboard.noProfileBody}
          </Alert>
        ) : null}

        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-8">
            <PendingSection title={fr.dashboard.networkNeedsYou} />
            <PendingSection title={fr.dashboard.opportunitiesForYou} />
            <PendingSection title={fr.dashboard.peopleYouMayKnow} />
          </div>

          <aside className="flex flex-col gap-7" aria-label={fr.dashboard.profileCardTitle}>
            {profile ? <ProfileCard profile={profile} /> : null}

            <Card>
              <CardHeader>
                <CardTitle as="h2">{fr.dashboard.promotionCardTitle}</CardTitle>
              </CardHeader>
              {promotion ? (
                <>
                  <p className="text-h4 text-text-primary font-semibold">{promotion.name}</p>
                  <p className="text-body-sm text-text-secondary mt-1">
                    {promotion.program_code} · {promotion.graduation_year}
                  </p>
                </>
              ) : (
                <EmptyState
                  title={fr.dashboard.promotionUnknownTitle}
                  description={fr.dashboard.promotionUnknownBody}
                />
              )}
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
