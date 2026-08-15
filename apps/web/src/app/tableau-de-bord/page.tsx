import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import type { ClaimStatus, VerificationStatus } from '@ise/db-types';
import { fr, t } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { ONBOARDING_ROOT, PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { OPPORTUNITY_ROUTES } from '@/lib/routes/opportunities';
import { SEARCH_ROUTES, searchResultsRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadMemberContext, type MemberProfile } from '@/lib/queries/profile';
import { loadNetworkCalls } from '@/lib/queries/calls';
import { loadOpportunities } from '@/lib/queries/opportunities';
import { loadPeopleYouMayKnow } from '@/lib/queries/dashboard';
import { loadActiveAnnouncements } from '@/lib/queries/announcements';
import { AppShell } from '@/components/layout/AppShell';
import { AnnouncementsBanner } from './AnnouncementsBanner';
import { CallCardView } from '@/components/calls/CallCardView';
import { OpportunityCardView } from '@/components/opportunities/OpportunityCardView';
import { ResultCard } from '@/components/search/ResultCard';

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

const SEE_ALL_LINK =
  'text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue shrink-0 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

/** En-tete commun aux trois modules : titre + lien « Voir tout » (D-199). */
function ModuleHeader({
  id,
  title,
  seeAllHref,
}: {
  id: string;
  title: string;
  seeAllHref: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id={id} className="text-h3 text-text-primary font-semibold">
        {title}
      </h2>
      {seeAllHref !== null ? (
        <Link href={seeAllHref} className={SEE_ALL_LINK}>
          {fr.dashboard.seeAll}
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Module affiche quand aucun profil n'est rattache au compte : les trois
 * lectures personnalisees ne sont meme pas lancees (MASTER PROMPT §47 —
 * un module sans donnee source n'a rien a demander a la base), voir
 * `DashboardPage` ci-dessous.
 */
function ProfileRequiredSection({ id, title }: { id: string; title: string }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby={id}>
      <ModuleHeader id={id} title={title} seeAllHref={null} />
      <EmptyState
        title={fr.dashboard.modulesRequireProfileTitle}
        description={fr.dashboard.modulesRequireProfileBody}
      />
    </section>
  );
}

/**
 * ISE-047 (« Le réseau a besoin de vous ») — memes 3-4 premiers appels
 * ouverts que l'onglet « Pour moi » de `/appels` (`scope: 'for_me'`),
 * reutilisant `CallCardView` a l'identique (D-199).
 */
function NetworkCallsSection({
  result,
}: {
  result: Awaited<ReturnType<typeof loadNetworkCalls>>;
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="section-appels">
      <ModuleHeader
        id="section-appels"
        title={fr.dashboard.networkNeedsYou}
        seeAllHref={`${CALL_ROUTES.list}?onglet=for_me`}
      />

      {!result.ok ? (
        <ErrorState
          title={fr.dashboard.callsErrorTitle}
          description={result.error.userMessage}
          correlationId={result.error.correlationId ?? '—'}
        />
      ) : result.data.rows.length === 0 ? (
        <EmptyState title={fr.dashboard.callsEmptyTitle} description={fr.dashboard.callsEmptyBody} />
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.rows.slice(0, 3).map((call) => (
            <li key={call.callId}>
              <CallCardView call={call} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * ISE-055 (« Opportunités pour vous ») — memes 3-4 premieres offres que
 * l'onglet « Pour vous » de `/opportunites` (`scope: 'for_you'`),
 * reutilisant `OpportunityCardView` a l'identique (D-199).
 */
function OpportunitiesSection({
  result,
}: {
  result: Awaited<ReturnType<typeof loadOpportunities>>;
}) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="section-opportunites">
      <ModuleHeader
        id="section-opportunites"
        title={fr.dashboard.opportunitiesForYou}
        seeAllHref={`${OPPORTUNITY_ROUTES.list}?onglet=for_you`}
      />

      {!result.ok ? (
        <ErrorState
          title={fr.dashboard.opportunitiesErrorTitle}
          description={result.error.userMessage}
          correlationId={result.error.correlationId ?? '—'}
        />
      ) : result.data.rows.length === 0 ? (
        <EmptyState
          title={fr.dashboard.opportunitiesEmptyTitle}
          description={fr.dashboard.opportunitiesEmptyBody}
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.rows.slice(0, 3).map((opportunity) => (
            <li key={opportunity.opportunityId}>
              <OpportunityCardView opportunity={opportunity} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * « ISE que vous pourriez connaître » (D-199) — criteres derives du profil
 * (secteur et/ou pays), relations existantes exclues, memes cartes que
 * `/rechercher/resultats` (`ResultCard`). Voir `lib/queries/dashboard.ts`
 * pour le detail du choix produit et docs/decisions.md pour D-199.
 */
function PeopleYouMayKnowSection({
  result,
}: {
  result: Awaited<ReturnType<typeof loadPeopleYouMayKnow>>;
}) {
  const seeAllHref =
    result.ok && result.data.queryString.length > 0
      ? searchResultsRoute(result.data.queryString)
      : SEARCH_ROUTES.find;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="section-personnes">
      <ModuleHeader
        id="section-personnes"
        title={fr.dashboard.peopleYouMayKnow}
        seeAllHref={seeAllHref}
      />

      {!result.ok ? (
        <ErrorState
          title={fr.dashboard.peopleErrorTitle}
          description={result.error.userMessage}
          correlationId={result.error.correlationId ?? '—'}
        />
      ) : result.data.noCriteria ? (
        <EmptyState
          title={fr.dashboard.peopleEmptyTitleNoCriteria}
          description={fr.dashboard.peopleEmptyBodyNoCriteria}
          action={
            <Link
              href={PROFILE_ROUTES.header}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Compléter mon profil
            </Link>
          }
        />
      ) : result.data.rows.length === 0 ? (
        <EmptyState title={fr.dashboard.peopleEmptyTitle} description={fr.dashboard.peopleEmptyBody} />
      ) : (
        <ul className="flex flex-col gap-4">
          {result.data.rows.slice(0, 3).map((row) => (
            <ResultCard key={row.profileId} row={row} />
          ))}
        </ul>
      )}
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

/** ISE-015 — Tableau de bord membre. */
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

  const correlationId = newCorrelationId();

  // Les trois modules personnalises n'ont rien a lire sans profil : on ne
  // lance meme pas les requetes (MASTER PROMPT §47), voir `ProfileRequiredSection`.
  const [callsResult, opportunitiesResult, peopleResult] = profile
    ? await Promise.all([
        loadNetworkCalls(
          {
            scope: 'for_me',
            query: null,
            callType: null,
            skillId: null,
            sectorId: null,
            countryCode: null,
            urgency: null,
            status: 'open',
          },
          null,
          correlationId,
        ),
        loadOpportunities(
          {
            scope: 'for_you',
            query: null,
            opportunityType: null,
            sectorId: null,
            countryCode: null,
            experienceLevel: null,
            remoteOnly: false,
            newGraduates: false,
            status: 'open',
          },
          null,
          correlationId,
        ),
        loadPeopleYouMayKnow(user.id, profile.id, correlationId, 4),
      ])
    : [null, null, null];

  // Bandeau d'annonces (0145, tache #188) : lecture INDEPENDANTE du
  // profil (visible meme sans profil rattache) et tolerante a l'echec —
  // un echec de lecture degrade silencieusement en « aucun bandeau »
  // (MASTER PROMPT §47), voir `AnnouncementsBanner`.
  const announcementsResult = await loadActiveAnnouncements(correlationId);
  const announcements = announcementsResult.ok ? announcementsResult.data : [];

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

        <AnnouncementsBanner announcements={announcements} />

        {claimApproved && profile ? (
          <Alert variant="success" title={fr.dashboard.claimApprovedTitle}>
            {fr.dashboard.claimApprovedBody}
          </Alert>
        ) : null}

        {failed ? (
          <ErrorState
            title={fr.dashboard.loadErrorTitle}
            description={fr.dashboard.loadErrorBody}
            correlationId={correlationId}
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
            {profile && callsResult && opportunitiesResult && peopleResult ? (
              <>
                <NetworkCallsSection result={callsResult} />
                <OpportunitiesSection result={opportunitiesResult} />
                <PeopleYouMayKnowSection result={peopleResult} />
              </>
            ) : (
              <>
                <ProfileRequiredSection id="section-appels" title={fr.dashboard.networkNeedsYou} />
                <ProfileRequiredSection
                  id="section-opportunites"
                  title={fr.dashboard.opportunitiesForYou}
                />
                <ProfileRequiredSection id="section-personnes" title={fr.dashboard.peopleYouMayKnow} />
              </>
            )}
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
