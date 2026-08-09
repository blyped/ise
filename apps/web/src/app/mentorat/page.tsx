import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorRoute, mentorshipRoute } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorshipHome } from '@/lib/queries/mentorship';
import { formatDate } from '@/lib/collaborate-view';
import {
  mentorshipFormatLabel,
  mentorshipObjectiveLabel,
  mentorshipStatusBadge,
} from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  ReasonList,
  RelevanceBadge,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.home.title };

const SUCCESS: Record<string, string> = {
  mentor_saved: frMentorship.becomeMentor.done,
  need_saved: frMentorship.need.done,
};

const RELEVANCE_LABELS: Record<string, string> = frMentorship.relevance;

/**
 * ISE-078 — Espace mentorat.
 *
 * Quatre volets : mon besoin, mes demandes, mes mentorats (mentoré ET
 * mentor), devenir mentor. Aucun chiffre de popularité, aucun score
 * (MASTER PROMPT §30) : les mentors recommandés portent un libellé
 * qualitatif et des raisons.
 */
export default async function MentorshipHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, home] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorshipHome(correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={PROMOTION_ROUTES.hub}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  const crumbs = (
    <Breadcrumb
      label={frMentorship.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.mentorshipTitle, href: null },
      ]}
    />
  );

  if (!home.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frMentorship.common.loadErrorTitle}
          description={home.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const { need, mentorProfile, asMentee, asMentor, recommended } = home.data;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader title={frMentorship.home.title} subtitle={frMentorship.home.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} successCatalog={SUCCESS} />

      {/* Double bandeau : chercher un mentor / devenir mentor. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex h-full flex-col gap-3">
          <p className="text-caption text-primary font-semibold tracking-wide">
            {frMentorship.home.seekKicker}
          </p>
          <h2 className="text-h3 text-text-primary font-semibold">{frMentorship.home.seekTitle}</h2>
          <p className="text-body-sm text-text-secondary">{frMentorship.home.seekBody}</p>
          <p className="mt-auto pt-3">
            <Link href={MENTORSHIP_ROUTES.need} className={PRIMARY_BUTTON}>
              {frMentorship.home.seekAction}
            </Link>
          </p>
        </Card>

        <Card className="flex h-full flex-col gap-3">
          <p className="text-caption text-primary font-semibold tracking-wide">
            {frMentorship.home.giveKicker}
          </p>
          <h2 className="text-h3 text-text-primary font-semibold">{frMentorship.home.giveTitle}</h2>
          <p className="text-body-sm text-text-secondary">{frMentorship.home.giveBody}</p>
          <p className="mt-auto pt-3">
            <Link href={MENTORSHIP_ROUTES.becomeMentor} className={LINK_BUTTON}>
              {frMentorship.home.giveAction}
            </Link>
          </p>
        </Card>
      </div>

      {/* Mon besoin actuel. */}
      {need === null ? null : (
        <Card className="flex flex-col gap-2">
          <CardHeader>
            <CardTitle as="h2">{frMentorship.home.objectiveTitle}</CardTitle>
          </CardHeader>
          <p className="text-body text-text-primary">« {need.objectiveText} »</p>
          <p className="text-caption text-text-secondary">
            {mentorshipObjectiveLabel(need.objectiveType)}
          </p>
          <p className="flex flex-wrap gap-3 pt-3">
            <Link href={MENTORSHIP_ROUTES.need} className={LINK_BUTTON}>
              {frMentorship.home.objectiveEdit}
            </Link>
            <Link href={MENTORSHIP_ROUTES.recommendations} className={LINK_BUTTON}>
              {frMentorship.home.recommendedAll}
            </Link>
          </p>
        </Card>
      )}

      {/* Mentor : etat du profil, demandes a examiner. */}
      {mentorProfile === null ? null : (
        <Card className="flex flex-col gap-2">
          <CardHeader>
            <CardTitle as="h2">{frMentorship.home.mentorSpaceTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary">
            {frMentorship.home.mentorSpaceBody
              .replace('{active}', String(mentorProfile.activeMentorships))
              .replace('{pending}', String(mentorProfile.pendingRequests))}
          </p>
          <p className="flex flex-wrap gap-3 pt-3">
            <Link href={MENTORSHIP_ROUTES.requests} className={LINK_BUTTON}>
              {frMentorship.home.mentorSpaceAction}
            </Link>
            <Link href={MENTORSHIP_ROUTES.becomeMentor} className={LINK_BUTTON}>
              {frMentorship.home.giveAction}
            </Link>
          </p>
        </Card>
      )}

      {/* Mes mentorats en cours (mentore et mentor). */}
      <section aria-label={frMentorship.home.myMentorshipTitle} className="flex flex-col gap-5">
        <h2 className="text-h3 text-text-primary font-semibold">
          {frMentorship.home.myMentorshipTitle}
        </h2>
        {asMentee.length === 0 && asMentor.length === 0 ? (
          <Card>
            <p className="text-body text-text-primary font-semibold">
              {frMentorship.home.noMentorshipTitle}
            </p>
            <p className="text-body-sm text-text-secondary mt-2">
              {frMentorship.home.noMentorshipBody}
            </p>
          </Card>
        ) : (
          <ul className="grid gap-5 lg:grid-cols-2">
            {[...asMentee, ...asMentor].map((mentorship) => (
              <li key={mentorship.mentorshipId}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="text-body text-text-primary font-semibold">
                      {mentorship.counterpartName}
                    </p>
                    <Badge tone={mentorship.status === 'active' ? 'success' : 'neutral'}>
                      {mentorshipStatusBadge(mentorship.status)}
                    </Badge>
                  </div>
                  <p className="text-body-sm text-text-secondary">{mentorship.objective}</p>
                  <p className="text-caption text-text-secondary">
                    {mentorshipFormatLabel(mentorship.format)}
                    {mentorship.startDate === null
                      ? ''
                      : ` · ${formatDate(mentorship.startDate) ?? ''}`}
                  </p>
                  <p className="mt-auto pt-2">
                    <Link href={mentorshipRoute(mentorship.mentorshipId)} className={LINK_BUTTON}>
                      {frMentorship.home.open}
                    </Link>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mentors recommandes. */}
      <section aria-label={frMentorship.home.recommendedTitle} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-h3 text-text-primary font-semibold">
              {frMentorship.home.recommendedTitle}
            </h2>
            <p className="text-body-sm text-text-secondary">
              {frMentorship.home.recommendedSubtitle}
            </p>
          </div>
          <Link href={MENTORSHIP_ROUTES.recommendations} className={LINK_BUTTON}>
            {frMentorship.home.recommendedAll}
          </Link>
        </div>

        {recommended.length === 0 ? (
          <Card>
            <p className="text-body-sm text-text-secondary">{frMentorship.home.objectiveNone}</p>
          </Card>
        ) : (
          <ul className="grid gap-5 lg:grid-cols-2">
            {recommended.slice(0, 4).map((mentor) => (
              <li key={mentor.profileId}>
                <Card className="flex h-full flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-col">
                      <p className="text-body text-text-primary font-semibold">
                        {mentor.displayName}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {[mentor.position, mentor.organization, mentor.promotion]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <RelevanceBadge relevance={mentor.relevance} labels={RELEVANCE_LABELS} />
                  </div>
                  <ReasonList
                    title={frMentorship.recommendations.whyTitle}
                    reasons={mentor.relevance.reasons.slice(0, 2)}
                  />
                  <p className="mt-auto pt-2">
                    <Link href={mentorRoute(mentor.profileId)} className={LINK_BUTTON}>
                      {frMentorship.recommendations.seeProfile}
                    </Link>
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frMentorship.home.howTitle}</CardTitle>
          </CardHeader>
          <ol className="flex flex-col gap-2">
            {frMentorship.home.howSteps.map((step, index) => (
              <li key={step} className="text-body-sm text-text-secondary flex items-start gap-3">
                <span aria-hidden="true" className="text-primary font-semibold">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frMentorship.home.ethicsTitle}</CardTitle>
          </CardHeader>
          <p className="text-body-sm text-text-secondary">{frMentorship.home.ethicsBody}</p>
        </Card>
      </div>
    </div>,
  );
}
