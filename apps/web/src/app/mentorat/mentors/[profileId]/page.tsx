import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, Chip, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorshipRequestRoute } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorProfile } from '@/lib/queries/mentorship';
import { formatDate } from '@/lib/collaborate-view';
import {
  mentorshipFormatLabel,
  mentorshipFrequencyLabel,
  mentorshipTopicLabel,
} from '@/lib/collaborate-status';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  ReasonList,
  RelevanceBadge,
} from '@/components/collaborate/CollaborateUI';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.recommendations.seeProfile };

const RELEVANCE_LABELS: Record<string, string> = frMentorship.relevance;

/**
 * ISE-081 — Fiche mentor.
 *
 * AUCUN compteur de popularité : ni note, ni nombre de demandes reçues,
 * ni « 2/3 mentorés » ([U 30], [U 33], [U 45]). Les seuls faits rendus
 * sont déclaratifs : « N accompagnements terminés », « mentor depuis ».
 * Capacité atteinte = fiche visible mais non sollicitable ([F 32]) :
 * le bouton de demande disparaît, remplacé par l'explication.
 */
export default async function MentorProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorProfile(profileId, correlationId),
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
        { label: frPromotions.hub.mentorshipTitle, href: MENTORSHIP_ROUTES.home },
        { label: frMentorship.recommendations.title, href: MENTORSHIP_ROUTES.recommendations },
        { label: frMentorship.recommendations.seeProfile, href: null },
      ]}
    />
  );

  if (!result.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frMentorship.common.loadErrorTitle}
          description={result.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const mentor = result.data;
  if (mentor === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frMentorship.errors.profile_not_found}
          description={frMentorship.recommendations.notFoundBody}
          action={
            <Link href={MENTORSHIP_ROUTES.recommendations} className={LINK_BUTTON}>
              {frMentorship.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const available = mentor.availability === 'available';

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={mentor.displayName}
        subtitle={[mentor.position, mentor.organization, mentor.city ?? mentor.countryName]
          .filter(Boolean)
          .join(' · ')}
        actions={
          mentor.isSelf ? (
            <Link href={MENTORSHIP_ROUTES.becomeMentor} className={LINK_BUTTON}>
              {frMentorship.mentor.selfAction}
            </Link>
          ) : mentor.canRequest && available ? (
            <Link href={mentorshipRequestRoute(mentor.profileId)} className={PRIMARY_BUTTON}>
              {frMentorship.mentor.request}
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {mentor.isSelf ? (
            <Card>
              <p className="text-body-sm text-text-secondary">{frMentorship.mentor.selfTitle}</p>
            </Card>
          ) : null}

          {mentor.relevance.reasons.length === 0 ? null : (
            <Card className="flex flex-col gap-3">
              <CardHeader>
                <CardTitle as="h2">{frMentorship.mentor.whyTitle}</CardTitle>
              </CardHeader>
              <div>
                <RelevanceBadge relevance={mentor.relevance} labels={RELEVANCE_LABELS} />
              </div>
              <ReasonList reasons={mentor.relevance.reasons} />
            </Card>
          )}

          {mentor.statement === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frMentorship.mentor.approachTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary whitespace-pre-line">
                {mentor.statement}
              </p>
            </Card>
          )}

          {mentor.helpTopics.length === 0 &&
          mentor.topics.length === 0 &&
          mentor.expertises.length === 0 ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frMentorship.mentor.helpTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-wrap gap-2">
                {[
                  ...mentor.helpTopics,
                  ...mentor.topics.map(mentorshipTopicLabel),
                  ...mentor.expertises,
                ]
                  .filter((item, index, list) => list.indexOf(item) === index)
                  .map((item) => (
                    <li key={item}>
                      <Chip>{item}</Chip>
                    </li>
                  ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.mentor.experienceTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              {/* Des FAITS déclaratifs, pas une note ([F 30]). */}
              <li className="text-body-sm text-text-secondary">
                {frMentorship.mentor.completed.replace(
                  '{count}',
                  String(mentor.completedMentorships),
                )}
              </li>
              {mentor.mentorSince === null ? null : (
                <li className="text-body-sm text-text-secondary">
                  {frMentorship.mentor.since.replace(
                    '{date}',
                    formatDate(mentor.mentorSince) ?? '',
                  )}
                </li>
              )}
            </ul>
            <p className="text-caption text-text-muted mt-4">
              {frMentorship.mentor.experienceNote}
            </p>
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card className="flex flex-col gap-3">
            <CardHeader>
              <CardTitle as="h2">{frMentorship.mentor.availabilityTitle}</CardTitle>
            </CardHeader>
            <div>
              <Badge tone={available ? 'success' : 'neutral'}>
                {available ? frMentorship.mentor.available : frMentorship.mentor.capacityReached}
              </Badge>
            </div>
            {available ? null : (
              <p className="text-body-sm text-text-secondary">{frMentorship.mentor.capacityNote}</p>
            )}
            <dl className="flex flex-col gap-3 pt-2">
              {mentor.frequency === null ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frMentorship.mentor.frequency}
                  </dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">
                    {mentorshipFrequencyLabel(mentor.frequency)}
                  </dd>
                </div>
              )}
              {mentor.formats.length === 0 ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frMentorship.mentor.formats}
                  </dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">
                    {mentor.formats.map(mentorshipFormatLabel).join(' · ')}
                  </dd>
                </div>
              )}
              {mentor.languages.length === 0 ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frMentorship.mentor.languages}
                  </dt>
                  <dd className="text-body-sm text-text-primary text-right font-medium">
                    {mentor.languages.join(' · ')}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {mentor.isSelf || !mentor.canRequest || !available ? null : (
            <Card className="flex flex-col gap-3">
              <p className="text-body-sm text-text-secondary">
                {frMentorship.request.freedomBody.replace('{name}', mentor.displayName)}
              </p>
              <p>
                <Link href={mentorshipRequestRoute(mentor.profileId)} className={PRIMARY_BUTTON}>
                  {frMentorship.mentor.request}
                </Link>
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>,
  );
}
