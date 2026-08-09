import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge, Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frMentorship } from '@/i18n/mentorship';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { MENTORSHIP_ROUTES } from '@/lib/routes/mentorship';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMentorshipRequests } from '@/lib/queries/mentorship';
import { formatDate, type MentorshipRequestRow } from '@/lib/collaborate-view';
import {
  MENTORSHIP_FORMAT_CODES,
  mentorshipExpectationLabel,
  mentorshipFormatLabel,
  mentorshipFrequencyLabel,
  mentorshipObjectiveLabel,
  mentorshipRequestStatusLabel,
} from '@/lib/collaborate-status';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  LINK_BUTTON,
  LoadMoreLink,
  PRIMARY_BUTTON,
  PageHeader,
  SELECT,
  TEXTAREA,
  TabLinks,
} from '@/components/collaborate/CollaborateUI';
import { answerAlternativeAction, cancelRequestAction, respondRequestAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMentorship.requests.title };

const TABS = ['received', 'sent', 'closed'] as const;
type Tab = (typeof TABS)[number];

const SUCCESS: Record<string, string> = {
  request_sent: frMentorship.request.done,
  respond_done: frMentorship.requests.respondDone,
  alternative_sent: frMentorship.requests.alternativeDone,
  alternative_answered: frMentorship.requests.alternativeAnswerDone,
  request_cancelled: frMentorship.requests.cancelDone,
};

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'info',
  alternative_proposed: 'warning',
  accepted: 'success',
  declined: 'neutral',
  cancelled: 'neutral',
  expired: 'neutral',
};

function RequestMeta({ request }: { request: MentorshipRequestRow }) {
  return (
    <dl className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <dt className="text-caption text-text-secondary">{frMentorship.requests.objective}</dt>
        <dd className="text-body-sm text-text-primary">
          {mentorshipObjectiveLabel(request.objectiveType)} — {request.objectiveText}
        </dd>
      </div>
      {request.currentSituation === null ? null : (
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-text-secondary">{frMentorship.requests.situation}</dt>
          <dd className="text-body-sm text-text-secondary">{request.currentSituation}</dd>
        </div>
      )}
      {request.expectations.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-text-secondary">{frMentorship.requests.expectations}</dt>
          <dd className="text-body-sm text-text-secondary">
            {request.expectations.map(mentorshipExpectationLabel).join(' · ')}
          </dd>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <dt className="text-caption text-text-secondary">{frMentorship.requests.format}</dt>
        <dd className="text-body-sm text-text-secondary">
          {mentorshipFormatLabel(request.requestedFormat)}
          {request.requestedFrequency === null
            ? ''
            : ` · ${mentorshipFrequencyLabel(request.requestedFrequency) ?? ''}`}
        </dd>
      </div>
      {request.message === null ? null : (
        <div className="flex flex-col gap-1">
          <dt className="text-caption text-text-secondary">{frMentorship.requests.message}</dt>
          <dd className="text-body-sm text-text-secondary">{request.message}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * ISE-082 (volet réponses) — Demandes reçues et envoyées.
 *
 * Côté mentor, TROIS issues et pas une de plus : accepter, proposer un
 * autre format (D-54), décliner — le motif du refus est FACULTATIF
 * ([F 59]) et l'aide le dit. Côté demandeur, l'alternative proposée
 * s'accepte ou se refuse explicitement (`accept_mentorship_alternative`).
 */
export default async function MentorshipRequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const query = await searchParams;
  const feedback = readFeedback(query);
  const one = (value: string | string[] | undefined): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

  const rawTab = one(query['onglet']) ?? 'received';
  const tab: Tab = (TABS as readonly string[]).includes(rawTab) ? (rawTab as Tab) : 'received';
  const cursor = unsealCursor(one(query['curseur']));

  const correlationId = newCorrelationId();
  const [viewer, received, sent, closedMentor, closedMentee] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    tab === 'received'
      ? loadMentorshipRequests('mentor', 'open', cursor, correlationId)
      : Promise.resolve(null),
    tab === 'sent'
      ? loadMentorshipRequests('mentee', 'open', cursor, correlationId)
      : Promise.resolve(null),
    tab === 'closed'
      ? loadMentorshipRequests('mentor', 'closed', null, correlationId)
      : Promise.resolve(null),
    tab === 'closed'
      ? loadMentorshipRequests('mentee', 'closed', null, correlationId)
      : Promise.resolve(null),
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

  const active = tab === 'received' ? received : tab === 'sent' ? sent : null;
  const failure =
    (active !== null && !active.ok ? active : null) ??
    (closedMentor !== null && !closedMentor.ok ? closedMentor : null) ??
    (closedMentee !== null && !closedMentee.ok ? closedMentee : null);

  return shell(
    <div className="flex flex-col gap-8">
      <Breadcrumb
        label={frMentorship.common.breadcrumb}
        items={[
          { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
          { label: frPromotions.hub.mentorshipTitle, href: MENTORSHIP_ROUTES.home },
          { label: frMentorship.requests.title, href: null },
        ]}
      />

      <PageHeader title={frMentorship.requests.title} subtitle={frMentorship.requests.subtitle} />

      <FeedbackBanner feedback={feedback} catalog={frMentorship.errors} successCatalog={SUCCESS} />

      <TabLinks
        label={frMentorship.requests.title}
        current={tab}
        items={[
          {
            id: 'received',
            label: frMentorship.requests.tabReceived,
            href: MENTORSHIP_ROUTES.requests,
          },
          {
            id: 'sent',
            label: frMentorship.requests.tabSent,
            href: `${MENTORSHIP_ROUTES.requests}?onglet=sent`,
          },
          {
            id: 'closed',
            label: frMentorship.requests.tabClosed,
            href: `${MENTORSHIP_ROUTES.requests}?onglet=closed`,
          },
        ]}
      />

      {failure !== null ? (
        <ErrorState
          title={frMentorship.common.loadErrorTitle}
          description={failure.error.userMessage}
          correlationId={correlationId}
        />
      ) : tab === 'received' && received !== null && received.ok ? (
        received.data.rows.length === 0 ? (
          <EmptyState
            title={frMentorship.requests.emptyReceivedTitle}
            description={frMentorship.requests.emptyReceivedBody}
            action={
              <Link href={MENTORSHIP_ROUTES.becomeMentor} className={LINK_BUTTON}>
                {frMentorship.home.giveAction}
              </Link>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-5">
              {received.data.rows.map((request) => (
                <li key={request.requestId}>
                  <Card className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <p className="text-body text-text-primary font-semibold">
                          {request.counterpartName}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {formatDate(request.createdAt) ?? ''}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[request.status] ?? 'neutral'}>
                        {mentorshipRequestStatusLabel(request.status)}
                      </Badge>
                    </div>

                    <RequestMeta request={request} />

                    {request.status === 'pending' ? (
                      <div className="border-border flex flex-col gap-5 border-t pt-5">
                        <form action={respondRequestAction}>
                          <input type="hidden" name="requestId" value={request.requestId} />
                          <input type="hidden" name="decision" value="accept" />
                          <button type="submit" className={PRIMARY_BUTTON}>
                            {frMentorship.requests.accept}
                          </button>
                        </form>

                        <form
                          action={respondRequestAction}
                          className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                          <input type="hidden" name="requestId" value={request.requestId} />
                          <input type="hidden" name="decision" value="propose_alternative" />
                          <FormRow
                            id={`format-alternative-${request.requestId}`}
                            label={frMentorship.requests.alternativeFormat}
                            hint={frMentorship.requests.alternativeHelp}
                          >
                            <select
                              id={`format-alternative-${request.requestId}`}
                              name="alternativeFormat"
                              defaultValue="single_session"
                              className={SELECT}
                            >
                              {MENTORSHIP_FORMAT_CODES.map((code) => (
                                <option key={code} value={code}>
                                  {mentorshipFormatLabel(code)}
                                </option>
                              ))}
                            </select>
                          </FormRow>
                          <FormRow
                            id={`message-alternative-${request.requestId}`}
                            label={frMentorship.requests.alternativeMessage}
                          >
                            <textarea
                              id={`message-alternative-${request.requestId}`}
                              name="alternativeMessage"
                              maxLength={500}
                              className={TEXTAREA}
                            />
                          </FormRow>
                          <p>
                            <button type="submit" className={LINK_BUTTON}>
                              {frMentorship.requests.alternativeSubmit}
                            </button>
                          </p>
                        </form>

                        <form
                          action={respondRequestAction}
                          className="flex flex-col gap-3 sm:flex-row sm:items-end"
                        >
                          <input type="hidden" name="requestId" value={request.requestId} />
                          <input type="hidden" name="decision" value="decline" />
                          <FormRow
                            id={`motif-refus-${request.requestId}`}
                            label={frMentorship.requests.declineReason}
                            hint={frMentorship.requests.declineHelp}
                          >
                            <select
                              id={`motif-refus-${request.requestId}`}
                              name="declineReason"
                              defaultValue=""
                              className={SELECT}
                            >
                              <option value="">{frMentorship.requests.declineReason}</option>
                              <option value="capacity_reached">
                                {frMentorship.requests.declineReasonCapacity}
                              </option>
                              <option value="outside_expertise">
                                {frMentorship.requests.declineReasonExpertise}
                              </option>
                              <option value="availability">
                                {frMentorship.requests.declineReasonAvailability}
                              </option>
                              <option value="other">
                                {frMentorship.requests.declineReasonOther}
                              </option>
                            </select>
                          </FormRow>
                          <p>
                            <button type="submit" className={LINK_BUTTON}>
                              {frMentorship.requests.decline}
                            </button>
                          </p>
                        </form>
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
            <LoadMoreLink
              href={MENTORSHIP_ROUTES.requests}
              label={frMentorship.requests.loadMore}
              nextCursor={received.data.nextCursor}
            />
          </>
        )
      ) : tab === 'sent' && sent !== null && sent.ok ? (
        sent.data.rows.length === 0 ? (
          <EmptyState
            title={frMentorship.requests.emptySentTitle}
            description={frMentorship.requests.emptySentBody}
            action={
              <Link href={MENTORSHIP_ROUTES.need} className={LINK_BUTTON}>
                {frMentorship.home.seekAction}
              </Link>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-5">
              {sent.data.rows.map((request) => (
                <li key={request.requestId}>
                  <Card className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <p className="text-body text-text-primary font-semibold">
                          {request.counterpartName}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {formatDate(request.createdAt) ?? ''}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[request.status] ?? 'neutral'}>
                        {mentorshipRequestStatusLabel(request.status)}
                      </Badge>
                    </div>

                    <RequestMeta request={request} />

                    {/* D-54 : l'alternative se traite ici, par le demandeur. */}
                    {request.status === 'alternative_proposed' ? (
                      <div className="border-border flex flex-col gap-3 border-t pt-5">
                        <p className="text-body-sm text-text-primary font-semibold">
                          {frMentorship.requests.alternativeReceivedTitle}
                        </p>
                        <p className="text-body-sm text-text-secondary">
                          {request.alternativeFormat === null
                            ? ''
                            : mentorshipFormatLabel(request.alternativeFormat)}
                          {request.alternativeMessage === null
                            ? ''
                            : ` — ${request.alternativeMessage}`}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <form action={answerAlternativeAction}>
                            <input type="hidden" name="requestId" value={request.requestId} />
                            <input type="hidden" name="accept" value="true" />
                            <button type="submit" className={PRIMARY_BUTTON}>
                              {frMentorship.requests.alternativeAccept}
                            </button>
                          </form>
                          <form action={answerAlternativeAction}>
                            <input type="hidden" name="requestId" value={request.requestId} />
                            <input type="hidden" name="accept" value="false" />
                            <button type="submit" className={LINK_BUTTON}>
                              {frMentorship.requests.alternativeRefuse}
                            </button>
                          </form>
                        </div>
                      </div>
                    ) : request.status === 'pending' ? (
                      <div className="border-border border-t pt-5">
                        <form action={cancelRequestAction}>
                          <input type="hidden" name="requestId" value={request.requestId} />
                          <button type="submit" className={LINK_BUTTON}>
                            {frMentorship.requests.cancel}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
            <LoadMoreLink
              href={`${MENTORSHIP_ROUTES.requests}?onglet=sent`}
              label={frMentorship.requests.loadMore}
              nextCursor={sent.data.nextCursor}
            />
          </>
        )
      ) : (
        (() => {
          const closedRows = [
            ...(closedMentor !== null && closedMentor.ok ? closedMentor.data.rows : []),
            ...(closedMentee !== null && closedMentee.ok ? closedMentee.data.rows : []),
          ];
          return closedRows.length === 0 ? (
            <EmptyState
              title={frMentorship.requests.emptySentTitle}
              description={frMentorship.requests.emptySentBody}
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {closedRows.map((request) => (
                <li key={request.requestId}>
                  <Card className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <p className="text-body text-text-primary font-semibold">
                          {request.counterpartName}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {formatDate(request.createdAt) ?? ''}
                        </p>
                      </div>
                      <Badge tone={STATUS_TONE[request.status] ?? 'neutral'}>
                        {mentorshipRequestStatusLabel(request.status)}
                      </Badge>
                    </div>
                    <p className="text-body-sm text-text-secondary">
                      {mentorshipObjectiveLabel(request.objectiveType)} — {request.objectiveText}
                    </p>
                    {request.declineReason === null ? null : (
                      <p className="text-caption text-text-secondary">
                        {frMentorship.requests.declineReason} : {request.declineReason}
                      </p>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          );
        })()
      )}
    </div>,
  );
}
