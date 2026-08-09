import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorRoute } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorProfile, loadMentorshipHome } from '@/lib/queries/mentorship';
import {
  MENTORSHIP_EXPECTATION_CODES,
  MENTORSHIP_FORMAT_CODES,
  MENTORSHIP_OBJECTIVE_CODES,
  mentorshipExpectationLabel,
  mentorshipFormatLabel,
  mentorshipObjectiveLabel,
} from '@/lib/collaborate-status';
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
import { submitRequestAction } from '../../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.request.title };

/**
 * ISE-082 — Envoyer une demande de mentorat.
 *
 * La demande n'ouvre AUCUNE relation : le mentor pourra accepter,
 * proposer un autre format (D-54) ou décliner sans justification
 * ([F 59]) — le bandeau sous le formulaire l'énonce mot pour mot.
 * Un mentor à capacité atteinte n'est pas sollicitable : l'écran
 * l'explique au lieu d'afficher un bouton qui échouerait.
 */
export default async function MentorshipRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, result, home] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMentorProfile(profileId, correlationId),
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
        { label: frPromotions.hub.mentorshipTitle, href: MENTORSHIP_ROUTES.home },
        { label: frMentorship.recommendations.title, href: MENTORSHIP_ROUTES.recommendations },
        { label: frMentorship.request.title, href: null },
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
  if (mentor.isSelf || !mentor.canRequest || !available) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={
            mentor.isSelf
              ? frMentorship.mentor.selfTitle
              : available
                ? frMentorship.errors.request_already_sent
                : frMentorship.mentor.capacityReached
          }
          description={
            available
              ? frMentorship.request.freedomBody.replace('{name}', mentor.displayName)
              : frMentorship.mentor.capacityNote
          }
          action={
            <Link href={mentorRoute(mentor.profileId)} className={LINK_BUTTON}>
              {frMentorship.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const need = home.ok ? home.data.need : null;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader title={frMentorship.request.title} subtitle={frMentorship.request.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col">
          <p className="text-body text-text-primary font-semibold">{mentor.displayName}</p>
          <p className="text-caption text-text-secondary">
            {[mentor.position, mentor.organization, mentor.promotion].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="success">{frMentorship.mentor.available}</Badge>
          <Link href={MENTORSHIP_ROUTES.recommendations} className={LINK_BUTTON}>
            {frMentorship.recommendations.editNeed}
          </Link>
        </div>
      </Card>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <form action={submitRequestAction} className="flex flex-col gap-5">
            <input type="hidden" name="mentorProfileId" value={mentor.profileId} />

            <FormRow id="objectif-type-demande" label={frMentorship.need.objectiveType}>
              <select
                id="objectif-type-demande"
                name="objectiveType"
                defaultValue={need?.objectiveType ?? 'career_progression'}
                className={SELECT}
              >
                {MENTORSHIP_OBJECTIVE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {mentorshipObjectiveLabel(code)}
                  </option>
                ))}
              </select>
            </FormRow>

            <FormRow
              id="objectif-demande"
              label={frMentorship.request.objectiveTitle}
              hint={frMentorship.need.objectiveTextHelp}
            >
              <textarea
                id="objectif-demande"
                name="objectiveText"
                required
                maxLength={250}
                defaultValue={need?.objectiveText ?? ''}
                className={TEXTAREA}
                aria-describedby="objectif-demande-aide"
              />
            </FormRow>

            <FormRow id="situation-demande" label={frMentorship.request.situationTitle}>
              <textarea
                id="situation-demande"
                name="currentSituation"
                maxLength={500}
                className={TEXTAREA}
              />
            </FormRow>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frMentorship.request.expectationsTitle}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {MENTORSHIP_EXPECTATION_CODES.map((code) => (
                  <label
                    key={code}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input type="checkbox" name="expectations" value={code} />
                    {mentorshipExpectationLabel(code)}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="rythme-demande" label={frMentorship.request.frequencyTitle}>
                <select
                  id="rythme-demande"
                  name="requestedFrequency"
                  defaultValue={need?.preferredFrequency ?? ''}
                  className={SELECT}
                >
                  <option value="">{frMentorship.request.frequencyFlexible}</option>
                  <option value="monthly">{frMentorship.request.frequencyMonthly}</option>
                  <option value="twice_monthly">
                    {frMentorship.request.frequencyTwiceMonthly}
                  </option>
                </select>
              </FormRow>
              <FormRow id="format-demande" label={frMentorship.request.formatTitle}>
                <select
                  id="format-demande"
                  name="requestedFormat"
                  defaultValue={need?.preferredFormat ?? 'three_months'}
                  className={SELECT}
                >
                  {MENTORSHIP_FORMAT_CODES.map((code) => (
                    <option key={code} value={code}>
                      {mentorshipFormatLabel(code)}
                    </option>
                  ))}
                </select>
              </FormRow>
            </div>

            <FormRow
              id="message-demande"
              label={frMentorship.request.whyTitle.replace('{name}', mentor.displayName)}
              hint={frMentorship.request.messageHelp}
            >
              <textarea
                id="message-demande"
                name="message"
                maxLength={800}
                className={TEXTAREA}
                aria-describedby="message-demande-aide"
              />
            </FormRow>

            {/* Ce que la demande engage — et n'engage pas (D-54, [F 59]). */}
            <Alert variant="info" title={frMentorship.request.freedomTitle}>
              {frMentorship.request.freedomBody.replace('{name}', mentor.displayName)}
            </Alert>

            <p className="flex flex-wrap gap-3">
              <button type="submit" className={PRIMARY_BUTTON}>
                {frMentorship.request.submit}
              </button>
              <Link href={mentorRoute(mentor.profileId)} className={LINK_BUTTON}>
                {frMentorship.common.cancel}
              </Link>
            </p>
          </form>
        </Card>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.request.beforeTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              {frMentorship.request.beforeItems.map((item) => (
                <li key={item} className="text-body-sm text-text-secondary flex items-start gap-2">
                  <span aria-hidden="true" className="text-success mt-[2px]">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">
                {frMentorship.request.ifAcceptedTitle.replace('{name}', mentor.displayName)}
              </CardTitle>
            </CardHeader>
            <ol className="flex flex-col gap-2">
              {frMentorship.request.ifAcceptedItems.map((item, index) => (
                <li key={item} className="text-body-sm text-text-secondary flex items-start gap-3">
                  <span aria-hidden="true" className="text-primary font-semibold">
                    {index + 1}.
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.request.noSlaTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frMentorship.request.noSlaBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
