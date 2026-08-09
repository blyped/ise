import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import {
  INTERNSHIP_ROUTES,
  internshipOfferRoute,
  internshipResultRoute,
} from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipApplication } from '@/lib/queries/internships';
import { formatDate } from '@/lib/collaborate-view';
import {
  canRecordInternshipResult,
  internshipChannelLabel,
  internshipNextSteps,
  internshipStatusLabel,
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
} from '@/components/collaborate/CollaborateUI';
import { declareStepAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.tracking.title };

const SUCCESS: Record<string, string> = {
  declared_sent: frInternships.tracking.sentDone,
  step_declared: frInternships.tracking.stepDone,
  result_recorded: frInternships.result.done,
};

const HELP_STATUS: Record<string, string> = {
  sent: frInternships.status.submitted,
  viewed: frInternships.status.reviewed,
  accepted: frInternships.alumni.requestAccept,
  answered: frInternships.alumni.requestAnswer,
};

/**
 * ISE-076 — Suivi d'une candidature de stage.
 *
 * Chaque étape de la chronologie porte son AUTEUR : « déclaré par
 * vous » ou « enregistré par la gestion des stages » (D-55). Le
 * formulaire ne propose que les étapes que la machine d'états SQL
 * acceptera : `internshipNextSteps` en est le miroir exact.
 */
export default async function InternshipApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { applicationId } = await params;
  if (!isUuid(applicationId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipApplication(applicationId, correlationId),
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
      label={frInternships.common.breadcrumb}
      items={[
        { label: frPromotions.hub.title, href: PROMOTION_ROUTES.hub },
        { label: frPromotions.hub.internshipsTitle, href: INTERNSHIP_ROUTES.home },
        { label: frInternships.tracking.listTitle, href: INTERNSHIP_ROUTES.applications },
        { label: frInternships.tracking.title, href: null },
      ]}
    />
  );

  if (!result.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <ErrorState
          title={frInternships.common.loadErrorTitle}
          description={result.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const application = result.data;
  if (application === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.errors.not_found}
          description={frInternships.tracking.listEmptyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.applications} className={LINK_BUTTON}>
              {frInternships.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const nextSteps = internshipNextSteps(application.status);
  const showResultCta = canRecordInternshipResult(
    application.status,
    application.placement !== null,
  );

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.tracking.title}
        subtitle={frInternships.tracking.subtitle
          .replace('{title}', application.positionTitle)
          .replace('{organization}', application.organization ?? '')}
        actions={
          application.offerId === null ? undefined : (
            <Link href={internshipOfferRoute(application.offerId)} className={LINK_BUTTON}>
              {frInternships.home.viewOffer}
            </Link>
          )
        }
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Badge tone="info">{internshipStatusLabel(application.status)}</Badge>
              <p className="text-caption text-text-secondary">
                {internshipChannelLabel(application.applicationChannel)}
                {application.submittedOn === null
                  ? ''
                  : ` · ${formatDate(application.submittedOn) ?? ''}`}
              </p>
            </div>
            {application.nextAction === null ? null : (
              <p className="text-body-sm text-text-secondary">
                <span className="font-medium">{frInternships.tracking.nextTitle} :</span>{' '}
                {application.nextAction}
                {application.nextActionDueOn === null
                  ? ''
                  : ` — ${formatDate(application.nextActionDueOn) ?? ''}`}
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.tracking.historyTitle}</CardTitle>
            </CardHeader>
            {application.timeline.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {frInternships.tracking.historyEmpty}
              </p>
            ) : (
              <ol className="flex flex-col gap-4">
                {application.timeline.map((event, index) => (
                  <li
                    key={`${event.toStatus}-${event.occurredOn}-${index}`}
                    className="flex items-start gap-4"
                  >
                    <span
                      aria-hidden="true"
                      className="bg-primary mt-[6px] h-3 w-3 shrink-0 rounded-full"
                    />
                    <div className="flex flex-col gap-1">
                      <p className="text-body-sm text-text-primary font-semibold">
                        {internshipStatusLabel(event.toStatus)}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {formatDate(event.occurredOn) ?? event.occurredOn} ·{' '}
                        {event.declaredByMe
                          ? frInternships.tracking.declaredByMe
                          : frInternships.tracking.declaredByOther}
                      </p>
                      {event.note === null ? null : (
                        <p className="text-body-sm text-text-secondary">{event.note}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.tracking.updateTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary mb-5">
              {frInternships.tracking.updateBody}
            </p>
            {nextSteps.length === 0 ? (
              <p className="text-body-sm text-text-muted">{frInternships.tracking.updateFinal}</p>
            ) : (
              <form action={declareStepAction} className="flex flex-col gap-5">
                <input type="hidden" name="applicationId" value={application.applicationId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormRow id="etape-suivante" label={frInternships.tracking.updateStatus}>
                    <select id="etape-suivante" name="toStatus" className={SELECT}>
                      {nextSteps.map((step) => (
                        <option key={step} value={step}>
                          {internshipStatusLabel(step)}
                        </option>
                      ))}
                    </select>
                  </FormRow>
                  <FormRow id="date-etape" label={frInternships.tracking.updateDate}>
                    <input id="date-etape" name="occurredOn" type="date" className={INPUT} />
                  </FormRow>
                </div>
                <FormRow id="note-etape" label={frInternships.tracking.updateNote}>
                  <input id="note-etape" name="note" maxLength={300} className={INPUT} />
                </FormRow>
                <p>
                  <button type="submit" className={PRIMARY_BUTTON}>
                    {frInternships.tracking.updateSubmit}
                  </button>
                </p>
              </form>
            )}
          </Card>

          {application.notes === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.tracking.notesTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary whitespace-pre-line">
                {application.notes}
              </p>
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.tracking.helpersTitle}</CardTitle>
            </CardHeader>
            {application.helpers.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {frInternships.tracking.helpersEmpty}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {application.helpers.map((helper) => (
                  <li key={helper.requestId} className="flex flex-col">
                    <span className="text-body-sm text-text-primary font-semibold">
                      {helper.displayName}
                    </span>
                    <span className="text-caption text-text-secondary">
                      {(frInternships.alumni.requestType as Record<string, string>)[
                        helper.requestType
                      ] ?? helper.requestType}{' '}
                      · {HELP_STATUS[helper.status] ?? helper.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {showResultCta ? (
            <Card className="flex flex-col gap-3">
              <CardHeader>
                <CardTitle as="h2">{frInternships.tracking.resultTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frInternships.tracking.resultBody}
              </p>
              <p className="pt-2">
                <Link
                  href={internshipResultRoute(application.applicationId)}
                  className={PRIMARY_BUTTON}
                >
                  {frInternships.tracking.resultAction}
                </Link>
              </p>
            </Card>
          ) : null}

          {application.placement === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.home.placementTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frInternships.result.done}</p>
            </Card>
          )}
        </aside>
      </div>
    </div>,
  );
}
