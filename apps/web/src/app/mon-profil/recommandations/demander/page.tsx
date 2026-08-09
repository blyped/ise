import Link from 'next/link';
import { EmptyState, ErrorState } from '@ise/ui-web';
import { frProfile } from '@/i18n/profile';
import { PROFILE_ROUTES } from '@/lib/routes/onboarding';
import { NETWORK_ROUTES } from '@/lib/routes/network';
import { requireProfile } from '@/lib/profile-guard';
import { loadConnections } from '@/lib/queries/network';
import { loadProfileSkills } from '@/lib/queries/profile-sections';
import { ProfilePage } from '@/components/profile/ProfilePage';
import { RequestRecommendationForm } from './RequestRecommendationForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frProfile.recommendationRequest.title };

const t = frProfile.recommendationRequest;

const LINK_CLASS =
  'text-body-sm font-medium text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';
const PRIMARY_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-029 — Demander une recommandation.
 * Le destinataire est choisi parmi les RELATIONS ACCEPTEES (RPC
 * `list_my_connections`) : une recommandation vient d'une relation
 * professionnelle reelle, jamais d'un annuaire froid.
 */
export default async function RequestRecommendationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = typeof params['q'] === 'string' && params['q'].length > 0 ? params['q'] : null;

  const context = await requireProfile();

  const data = context.ok
    ? await Promise.all([
        loadConnections(query, null, context.correlationId),
        loadProfileSkills(context.profile.id, context.correlationId),
      ])
    : null;

  return (
    <ProfilePage
      context={context}
      currentPath={PROFILE_ROUTES.recommendations}
      title={t.title}
      subtitle={t.subtitle}
      action={
        <Link href={PROFILE_ROUTES.recommendations} className={LINK_CLASS}>
          ← {t.backLink}
        </Link>
      }
    >
      {data === null ? null : !data[0].ok ? (
        <ErrorState
          title={frProfile.common.loadErrorTitle}
          description={data[0].error.userMessage}
          correlationId={context.ok ? context.correlationId : ''}
        />
      ) : data[0].data.rows.length === 0 && query === null ? (
        <EmptyState
          title={t.recipientEmpty}
          description={frProfile.recommendations.qualityBody}
          action={
            <Link href={NETWORK_ROUTES.connections} className={PRIMARY_LINK}>
              {frProfile.overview.title}
            </Link>
          }
        />
      ) : (
        <RequestRecommendationForm
          connections={data[0].data.rows.map((row) => ({
            profileId: row.profile.profileId,
            displayName: row.profile.displayName,
            headline: row.profile.headline,
            promotionLabel: row.profile.promotionLabel,
          }))}
          skills={data[1].ok ? data[1].data : []}
          query={query}
        />
      )}
    </ProfilePage>
  );
}
