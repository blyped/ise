import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorshipRoute } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorship } from '@/lib/queries/mentorship';
import { canSubmitMentorshipFeedback } from '@/lib/collaborate-status';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { submitFeedbackAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.review.title };

const OUTCOMES = Object.entries(frMentorship.outcome) as [string, string][];

/**
 * ISE-083 (bilan) — Retour de fin de mentorat.
 *
 * AUCUNE note publique (CA-MENT-09) : la base renvoie
 * `is_public_rating = false` quoi qu'il arrive, et l'écran l'annonce
 * avant le formulaire. Le témoignage n'est publié qu'avec consentement
 * explicite, anonyme si demandé.
 */
export default async function MentorshipReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ mentorshipId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { mentorshipId } = await params;
  if (!isUuid(mentorshipId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorship(mentorshipId, correlationId),
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
        { label: frMentorship.home.myMentorshipTitle, href: mentorshipRoute(mentorshipId) },
        { label: frMentorship.review.title, href: null },
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

  const mentorship = result.data;
  if (mentorship === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frMentorship.errors.not_found}
          description={frMentorship.home.noMentorshipBody}
          action={
            <Link href={MENTORSHIP_ROUTES.home} className={LINK_BUTTON}>
              {frMentorship.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  // Le bilan n'est ouvert qu'apres la fin reelle, une seule fois.
  if (!canSubmitMentorshipFeedback(mentorship.status, mentorship.myFeedbackGiven)) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={
            mentorship.myFeedbackGiven
              ? frMentorship.detail.feedbackGiven
              : frMentorship.errors.invalid_transition
          }
          description={frMentorship.detail.reviewBody}
          action={
            <Link href={mentorshipRoute(mentorship.mentorshipId)} className={LINK_BUTTON}>
              {frMentorship.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader title={frMentorship.review.title} subtitle={frMentorship.review.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <form action={submitFeedbackAction} className="flex flex-col gap-5">
            <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />

            <FormRow id="utilite-bilan" label={frMentorship.review.usefulness}>
              <select id="utilite-bilan" name="usefulness" defaultValue="yes" className={SELECT}>
                <option value="a_lot">{frMentorship.review.usefulnessALot}</option>
                <option value="yes">{frMentorship.review.usefulnessYes}</option>
                <option value="a_little">{frMentorship.review.usefulnessALittle}</option>
                <option value="no">{frMentorship.review.usefulnessNo}</option>
              </select>
            </FormRow>

            <FormRow id="progres-bilan" label={frMentorship.review.progress}>
              <select
                id="progres-bilan"
                name="objectiveProgress"
                defaultValue="yes"
                className={SELECT}
              >
                <option value="a_lot">{frMentorship.review.progressALot}</option>
                <option value="yes">{frMentorship.review.progressYes}</option>
                <option value="a_little">{frMentorship.review.progressALittle}</option>
                <option value="not_yet">{frMentorship.review.progressNotYet}</option>
              </select>
            </FormRow>

            <FormRow id="atteinte-bilan" label={frMentorship.review.reached}>
              <select
                id="atteinte-bilan"
                name="objectiveReached"
                defaultValue="partially"
                className={SELECT}
              >
                <option value="yes">{frMentorship.review.reachedYes}</option>
                <option value="partially">{frMentorship.review.reachedPartially}</option>
                <option value="no">{frMentorship.review.reachedNo}</option>
                <option value="hard_to_assess">{frMentorship.review.reachedHard}</option>
              </select>
            </FormRow>

            <FormRow id="resultat-bilan" label={frMentorship.review.outcome}>
              <select id="resultat-bilan" name="outcomeType" defaultValue="" className={SELECT}>
                <option value="">{frMentorship.review.outcomeNone}</option>
                {OUTCOMES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow id="commentaire-bilan" label={frMentorship.review.comment}>
              <textarea
                id="commentaire-bilan"
                name="comment"
                maxLength={1000}
                className={TEXTAREA}
              />
            </FormRow>

            <FormRow id="plateforme-bilan" label={frMentorship.review.platformFeedback}>
              <textarea
                id="plateforme-bilan"
                name="platformFeedback"
                maxLength={1000}
                className={TEXTAREA}
              />
            </FormRow>

            <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3">
              <input type="checkbox" name="testimonialConsent" />
              {frMentorship.review.testimonialConsent}
            </label>

            <FormRow id="temoignage-bilan" label={frMentorship.review.testimonialText}>
              <textarea
                id="temoignage-bilan"
                name="testimonialText"
                maxLength={1000}
                className={TEXTAREA}
              />
            </FormRow>

            <label className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3">
              <input type="checkbox" name="testimonialAnonymous" />
              {frMentorship.review.testimonialAnonymous}
            </label>

            <p className="flex flex-wrap gap-3">
              <button type="submit" className={PRIMARY_BUTTON}>
                {frMentorship.review.submit}
              </button>
              <Link href={mentorshipRoute(mentorship.mentorshipId)} className={LINK_BUTTON}>
                {frMentorship.common.cancel}
              </Link>
            </p>
          </form>
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.review.noRatingTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frMentorship.review.noRatingBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
