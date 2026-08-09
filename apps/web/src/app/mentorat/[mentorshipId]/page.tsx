import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES, mentorshipReviewRoute } from '@/lib/routes/mentorship';
import { composeRoute } from '@/lib/routes/messaging';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorship } from '@/lib/queries/mentorship';
import { formatDate, formatDateTime } from '@/lib/collaborate-view';
import {
  canSubmitMentorshipFeedback,
  mentorshipFormatLabel,
  mentorshipFrequencyLabel,
  mentorshipItemStatusLabel,
  mentorshipStatusBadge,
  mentorshipTransitionOptions,
} from '@/lib/collaborate-status';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  INPUT,
  LINK_BUTTON,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { logSessionAction, setItemAction, transitionAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.home.myMentorshipTitle };

const SUCCESS: Record<string, string> = {
  respond_done: frMentorship.requests.respondDone,
  alternative_answered: frMentorship.requests.alternativeAnswerDone,
  item_saved: frMentorship.detail.itemDone,
  session_saved: frMentorship.detail.sessionDone,
  transition_done: frMentorship.detail.transitionDone,
  review_done: frMentorship.detail.reviewDone,
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning'> = {
  planned: 'info',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  stopped: 'neutral',
  cancelled: 'neutral',
};

/**
 * ISE-083 — Mentorat actif : objectifs, échanges, actions, cycle de vie.
 *
 * Les notes privées rendues ici sont UNIQUEMENT celles de l'appelant
 * (rls.md §10.4) — le binôme ne les lira jamais, et l'aide du champ le
 * dit. Les transitions proposées sont le miroir exact de la machine
 * d'états SQL, et le motif reste TOUJOURS facultatif ([U 102]).
 */
export default async function MentorshipDetailPage({
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
        { label: frMentorship.home.myMentorshipTitle, href: null },
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

  const transitions = mentorshipTransitionOptions(mentorship.status);
  const reviewOpen = canSubmitMentorshipFeedback(mentorship.status, mentorship.myFeedbackGiven);
  const messageLabel =
    mentorship.myRole === 'mentee'
      ? frMentorship.detail.messageAction
      : frMentorship.detail.messageActionMentee;

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frMentorship.detail.title.replace('{name}', mentorship.counterpartName)}
        subtitle={frMentorship.detail.subtitle}
        actions={
          mentorship.counterpartId === null ? undefined : (
            <Link href={composeRoute(mentorship.counterpartId)} className={LINK_BUTTON}>
              {messageLabel}
            </Link>
          )
        }
      />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} successCatalog={SUCCESS} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={STATUS_TONE[mentorship.status] ?? 'neutral'}>
                {mentorshipStatusBadge(mentorship.status)}
              </Badge>
              {mentorship.startDate === null ? null : (
                <p className="text-caption text-text-secondary">
                  {frMentorship.detail.started
                    .replace('{date}', formatDate(mentorship.startDate) ?? '')
                    .replace('{format}', mentorshipFormatLabel(mentorship.format))}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-body-sm text-text-primary font-semibold">
                {frMentorship.detail.objectiveTitle}
              </h2>
              <p className="text-body-sm text-text-secondary">{mentorship.objective}</p>
            </div>
          </Card>

          {/* Objectifs convenus. */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.goalsTitle}</CardTitle>
            </CardHeader>
            {mentorship.goals.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frMentorship.detail.goalsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {mentorship.goals.map((goal) => (
                  <li
                    key={goal.goalId}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-body-sm text-text-primary font-medium">
                        {goal.title}
                      </span>
                      {goal.targetDate === null ? null : (
                        <span className="text-caption text-text-secondary">
                          {formatDate(goal.targetDate)}
                        </span>
                      )}
                    </div>
                    <form action={setItemAction} className="flex items-center gap-2">
                      <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                      <input type="hidden" name="kind" value="goal" />
                      <input type="hidden" name="itemId" value={goal.goalId} />
                      <label className="sr-only" htmlFor={`statut-objectif-${goal.goalId}`}>
                        {frMentorship.detail.goalTitleLabel}
                      </label>
                      <select
                        id={`statut-objectif-${goal.goalId}`}
                        name="status"
                        defaultValue={goal.status}
                        className={SELECT}
                      >
                        {(['todo', 'in_progress', 'done', 'abandoned'] as const).map((status) => (
                          <option key={status} value={status}>
                            {mentorshipItemStatusLabel('goal', status)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={LINK_BUTTON}>
                        {frMentorship.common.save}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {transitions.length === 0 ? null : (
              <form
                action={setItemAction}
                className="border-border mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                <input type="hidden" name="kind" value="goal" />
                <div className="flex-1">
                  <FormRow id="nouvel-objectif" label={frMentorship.detail.goalAdd}>
                    <input id="nouvel-objectif" name="title" maxLength={200} className={INPUT} />
                  </FormRow>
                </div>
                <p>
                  <button type="submit" className={LINK_BUTTON}>
                    {frMentorship.detail.goalAdd}
                  </button>
                </p>
              </form>
            )}
          </Card>

          {/* Actions convenues. */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.actionsTitle}</CardTitle>
            </CardHeader>
            {mentorship.actions.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frMentorship.detail.actionsEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {mentorship.actions.map((action) => (
                  <li
                    key={action.actionId}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex flex-col">
                      <span className="text-body-sm text-text-primary font-medium">
                        {action.title}
                      </span>
                      {action.dueOn === null ? null : (
                        <span className="text-caption text-text-secondary">
                          {formatDate(action.dueOn)}
                        </span>
                      )}
                    </div>
                    <form action={setItemAction} className="flex items-center gap-2">
                      <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                      <input type="hidden" name="kind" value="action" />
                      <input type="hidden" name="itemId" value={action.actionId} />
                      <label className="sr-only" htmlFor={`statut-action-${action.actionId}`}>
                        {frMentorship.detail.actionsTitle}
                      </label>
                      <select
                        id={`statut-action-${action.actionId}`}
                        name="status"
                        defaultValue={action.status}
                        className={SELECT}
                      >
                        {(['todo', 'done'] as const).map((status) => (
                          <option key={status} value={status}>
                            {mentorshipItemStatusLabel('action', status)}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className={LINK_BUTTON}>
                        {frMentorship.common.save}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}

            {transitions.length === 0 ? null : (
              <form
                action={setItemAction}
                className="border-border mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                <input type="hidden" name="kind" value="action" />
                <div className="flex-1">
                  <FormRow id="nouvelle-action" label={frMentorship.detail.actionAdd}>
                    <input id="nouvelle-action" name="title" maxLength={200} className={INPUT} />
                  </FormRow>
                </div>
                <p>
                  <button type="submit" className={LINK_BUTTON}>
                    {frMentorship.detail.actionAdd}
                  </button>
                </p>
              </form>
            )}
          </Card>

          {/* Echanges : historique + enregistrement. */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.sessionsTitle}</CardTitle>
            </CardHeader>

            {mentorship.nextSession === null ? null : (
              <p className="text-body-sm text-text-secondary mb-4">
                <span className="font-medium">{frMentorship.detail.nextSessionTitle} :</span>{' '}
                {formatDateTime(mentorship.nextSession.scheduledAt) ?? ''}
                {mentorship.nextSession.topic === null ? '' : ` — ${mentorship.nextSession.topic}`}
              </p>
            )}

            {mentorship.sessions.length === 0 ? null : (
              <ol className="mb-5 flex flex-col gap-3">
                {mentorship.sessions.map((session) => (
                  <li key={session.sessionId} className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="bg-primary mt-[6px] h-3 w-3 shrink-0 rounded-full"
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-body-sm text-text-primary font-medium">
                        {formatDateTime(session.scheduledAt) ??
                          formatDateTime(session.completedAt) ??
                          ''}
                        {session.topic === null ? '' : ` — ${session.topic}`}
                      </p>
                      {session.sharedSummary === null ? null : (
                        <p className="text-body-sm text-text-secondary">{session.sharedSummary}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {transitions.length === 0 ? null : (
              <form action={logSessionAction} className="flex flex-col gap-5">
                <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                <h3 className="text-body-sm text-text-primary font-semibold">
                  {frMentorship.detail.sessionSchedule}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormRow id="date-echange" label={frMentorship.detail.sessionDate}>
                    <input
                      id="date-echange"
                      name="scheduledAt"
                      type="datetime-local"
                      className={INPUT}
                    />
                  </FormRow>
                  <FormRow id="format-echange" label={frMentorship.detail.sessionFormat}>
                    <select
                      id="format-echange"
                      name="format"
                      defaultValue="video"
                      className={SELECT}
                    >
                      <option value="video">{frMentorship.becomeMentor.channelVideo}</option>
                      <option value="phone">{frMentorship.becomeMentor.channelPhone}</option>
                      <option value="in_person">{frMentorship.becomeMentor.channelInPerson}</option>
                      <option value="written">{frMentorship.becomeMentor.channelWritten}</option>
                    </select>
                  </FormRow>
                </div>
                <FormRow id="theme-echange" label={frMentorship.detail.sessionTopic}>
                  <input id="theme-echange" name="topic" maxLength={200} className={INPUT} />
                </FormRow>
                <FormRow
                  id="synthese-echange"
                  label={frMentorship.detail.sessionSummary}
                  hint={frMentorship.detail.sessionSummaryHelp}
                >
                  <textarea
                    id="synthese-echange"
                    name="sharedSummary"
                    maxLength={1000}
                    className={TEXTAREA}
                    aria-describedby="synthese-echange-aide"
                  />
                </FormRow>
                <FormRow
                  id="note-privee-echange"
                  label={frMentorship.detail.sessionNote}
                  hint={frMentorship.detail.sessionNoteHelp}
                >
                  <textarea
                    id="note-privee-echange"
                    name="privateNote"
                    maxLength={1000}
                    className={TEXTAREA}
                    aria-describedby="note-privee-echange-aide"
                  />
                </FormRow>
                <FormRow id="statut-echange" label={frMentorship.detail.sessionsTitle}>
                  <select
                    id="statut-echange"
                    name="status"
                    defaultValue="planned"
                    className={SELECT}
                  >
                    <option value="planned">{frMentorship.detail.nextSessionTitle}</option>
                    <option value="completed">{frMentorship.detail.actionStatusDone}</option>
                  </select>
                </FormRow>
                <p>
                  <button type="submit" className={PRIMARY_BUTTON}>
                    {frMentorship.detail.sessionSubmit}
                  </button>
                </p>
              </form>
            )}
          </Card>

          {/* Notes privees de l'appelant, et de lui seul (rls.md §10.4). */}
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.notesTitle}</CardTitle>
            </CardHeader>
            {mentorship.myNotes.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frMentorship.detail.notesEmpty}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {mentorship.myNotes.map((note, index) => (
                  <li
                    key={`${note.sessionId ?? 'libre'}-${index}`}
                    className="text-body-sm text-text-secondary"
                  >
                    {note.note}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-caption text-text-muted mt-4">
              {frMentorship.detail.sessionNoteHelp}
            </p>
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.frameTitle}</CardTitle>
            </CardHeader>
            <dl className="flex flex-col gap-3">
              {mentorship.frequency === null ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frMentorship.detail.frameFrequency}
                  </dt>
                  <dd className="text-body-sm text-text-primary font-medium">
                    {mentorshipFrequencyLabel(mentorship.frequency)}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-text-secondary">
                  {frMentorship.detail.frameDuration}
                </dt>
                <dd className="text-body-sm text-text-primary font-medium">
                  {mentorshipFormatLabel(mentorship.format)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-caption text-text-secondary">
                  {frMentorship.detail.frameSessions}
                </dt>
                <dd className="text-body-sm text-text-primary font-medium">
                  {mentorship.sessionsCompleted}
                </dd>
              </div>
              {mentorship.plannedEndDate === null ? null : (
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-caption text-text-secondary">
                    {frMentorship.detail.frameEnd}
                  </dt>
                  <dd className="text-body-sm text-text-primary font-medium">
                    {formatDate(mentorship.plannedEndDate)}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {transitions.length === 0 ? null : (
            <Card className="flex flex-col gap-4">
              <CardHeader>
                <CardTitle as="h2">{frMentorship.detail.lifecycleTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frMentorship.detail.lifecycleBody}
              </p>
              {transitions.map((option) => (
                <form key={option.to} action={transitionAction} className="flex flex-col gap-2">
                  <input type="hidden" name="mentorshipId" value={mentorship.mentorshipId} />
                  <input type="hidden" name="toStatus" value={option.to} />
                  {option.to === 'stopped' || option.to === 'completed' ? (
                    <label className="text-caption text-text-secondary flex flex-col gap-1">
                      {frMentorship.detail.reasonLabel}
                      <select name="reason" defaultValue="" className={SELECT}>
                        <option value="">{frMentorship.detail.reasonLabel}</option>
                        <option value="objective_reached">
                          {frMentorship.detail.reasonObjectiveReached}
                        </option>
                        <option value="duration_ended">
                          {frMentorship.detail.reasonDurationEnded}
                        </option>
                        <option value="availability">
                          {frMentorship.detail.reasonAvailability}
                        </option>
                        <option value="coordination_difficulty">
                          {frMentorship.detail.reasonCoordination}
                        </option>
                        <option value="objective_changed">
                          {frMentorship.detail.reasonObjectiveChanged}
                        </option>
                        <option value="incompatibility">
                          {frMentorship.detail.reasonIncompatibility}
                        </option>
                        <option value="inactive">{frMentorship.detail.reasonInactive}</option>
                        <option value="other">{frMentorship.detail.reasonOther}</option>
                      </select>
                    </label>
                  ) : null}
                  <button type="submit" className={LINK_BUTTON}>
                    {option.label}
                  </button>
                </form>
              ))}
            </Card>
          )}

          <Card className="flex flex-col gap-3">
            <CardHeader>
              <CardTitle as="h2">{frMentorship.detail.reviewTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frMentorship.detail.reviewBody}</p>
            {mentorship.myFeedbackGiven ? (
              <p className="text-body-sm text-text-muted">{frMentorship.detail.feedbackGiven}</p>
            ) : reviewOpen ? (
              <p>
                <Link
                  href={mentorshipReviewRoute(mentorship.mentorshipId)}
                  className={PRIMARY_BUTTON}
                >
                  {frMentorship.detail.reviewAction}
                </Link>
              </p>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>,
  );
}
