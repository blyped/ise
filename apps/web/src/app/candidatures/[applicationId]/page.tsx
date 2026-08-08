import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { MetaList, StatusTimeline } from '@ise/ui-web/cards';
import { frOpportunities, to } from '@/i18n/opportunities';
import { ROUTES } from '@/lib/routes';
import {
  OPPORTUNITY_ROUTES,
  applicationOutcomeRoute,
  applicationUpdateRoute,
  opportunityRoute,
} from '@/lib/routes/opportunities';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadApplication } from '@/lib/queries/opportunities';
import { formatDate, isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: frOpportunities.application.title };

const LINK =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const ACTOR_LABELS: Record<string, string> = {
  applicant: frOpportunities.application.actorApplicant,
  recruiter: frOpportunities.application.actorRecruiter,
  admin: frOpportunities.application.actorAdmin,
  system: frOpportunities.application.actorSystem,
};

/**
 * ISE-064 — Détail d'une candidature.
 *
 * ECART ASSUME : la maquette affiche une « checklist avant envoi », des
 * « notes personnelles » et un bloc « le réseau dans cette démarche ».
 * Aucun des trois n'a de support en base : les rendre aurait supposé
 * d'inventer un contenu (MASTER PROMPT §78, §98). L'écran rend ce qui
 * existe : la chronologie réelle, les pièces jointes, les réponses aux
 * questions, et les transitions RÉELLEMENT possibles.
 *
 * La chronologie porte l'ATTRIBUTION de chaque étape : constatée par le
 * responsable, ou déclarée par le membre (D-55).
 */
export default async function ApplicationDetailPage({
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

  const query = await searchParams;
  const justSent = query['envoyee'] === '1';
  const justDeclared = query['declaree'] === '1';
  const justUpdated = query['maj'] === '1';

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadApplication(applicationId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={OPPORTUNITY_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok || result.data === null) {
    return shell(
      <ErrorState
        title={frOpportunities.application.notFoundTitle}
        description={
          result.ok ? frOpportunities.application.notFoundBody : result.error.userMessage
        }
        correlationId={correlationId}
        action={
          <Link href={OPPORTUNITY_ROUTES.applications} className={LINK}>
            {frOpportunities.applications.title}
          </Link>
        }
      />,
    );
  }

  const application = result.data;
  const opportunity = application.opportunity;
  const finalStatuses = ['selected', 'not_selected', 'withdrawn'] as const;
  const canUpdate = application.allowedTransitions.length > 0;
  const canRecordOutcome = application.allowedTransitions.some((status) =>
    (finalStatuses as readonly string[]).includes(status),
  );

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-body-sm text-text-muted">
        <Link href={OPPORTUNITY_ROUTES.list} className="hover:text-primary">
          {frOpportunities.common.breadcrumb}
        </Link>
        <span aria-hidden="true"> · </span>
        <Link href={OPPORTUNITY_ROUTES.applications} className="hover:text-primary">
          {frOpportunities.applications.title}
        </Link>
        <span aria-hidden="true"> · </span>
        <span className="text-text-primary font-medium">
          {frOpportunities.application.breadcrumb}
        </span>
      </nav>

      {justSent ? (
        <Alert variant="success" title={frOpportunities.apply.doneTitle}>
          {frOpportunities.apply.doneBody}
        </Alert>
      ) : null}
      {justDeclared ? (
        <Alert variant="success" title={frOpportunities.apply.doneDeclaredTitle}>
          {frOpportunities.apply.doneDeclaredBody}
        </Alert>
      ) : null}
      {justUpdated ? <Alert variant="success" title={frOpportunities.update.doneTitle} /> : null}

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{opportunity?.title ?? '—'}</h1>
        <p className="text-body text-text-secondary">
          {[opportunity?.organization, opportunity?.city, opportunity?.country]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={application.isSelfDeclared ? 'neutral' : 'info'}>
          {application.isSelfDeclared
            ? frOpportunities.applications.channelExternal
            : frOpportunities.applications.channelPlatform}
        </Badge>
        <Badge tone="neutral">
          {frOpportunities.applicationStatus[application.status] ?? application.status}
        </Badge>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Alert
            variant={application.stepsAreSelfDeclared ? 'warning' : 'info'}
            title={
              application.stepsAreSelfDeclared
                ? frOpportunities.application.selfDeclaredTitle
                : frOpportunities.application.platformTitle
            }
          >
            {application.stepsAreSelfDeclared
              ? frOpportunities.application.selfDeclaredBody
              : frOpportunities.application.platformBody}
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.application.timelineTitle}</CardTitle>
            </CardHeader>
            <StatusTimeline
              emptyLabel={frOpportunities.application.noTimeline}
              entries={application.timeline.map((entry, index) => ({
                id: `${entry.toStatus}-${index}`,
                label: frOpportunities.applicationStatus[entry.toStatus] ?? entry.toStatus,
                date: entry.createdAt !== null ? formatDate(entry.createdAt) : undefined,
                attribution: ACTOR_LABELS[entry.actorKind] ?? undefined,
                note: entry.note,
              }))}
            />
          </Card>

          {application.message !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frOpportunities.application.messageTitle}</CardTitle>
              </CardHeader>
              <p className="text-body text-text-secondary whitespace-pre-line">
                {application.message}
              </p>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.application.documentsTitle}</CardTitle>
            </CardHeader>
            {application.documents.length === 0 ? (
              <p className="text-body-sm text-text-muted">
                {frOpportunities.application.noDocuments}
              </p>
            ) : (
              <ul className="text-body-sm text-text-secondary flex flex-col gap-2">
                {application.documents.map((document) => (
                  <li key={document.documentId}>{document.title ?? document.filename}</li>
                ))}
              </ul>
            )}
          </Card>

          {application.answers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frOpportunities.application.answersTitle}</CardTitle>
              </CardHeader>
              <dl className="flex flex-col gap-4">
                {application.answers.map((answer) => (
                  <div key={answer.question}>
                    <dt className="text-body-sm text-text-primary font-medium">
                      {answer.question}
                    </dt>
                    <dd className="text-body-sm text-text-secondary">{answer.answer}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.detail.infoTitle}</CardTitle>
            </CardHeader>
            <MetaList
              items={[
                {
                  label: frOpportunities.applications.sentOn.replace(' le {date}', ''),
                  value:
                    application.submittedAt !== null ? formatDate(application.submittedAt) : null,
                },
                {
                  label: frOpportunities.applications.declaredOn.replace(' le {date}', ''),
                  value:
                    application.declaredAt !== null ? formatDate(application.declaredAt) : null,
                },
                {
                  label: frOpportunities.applications.decidedOn.replace(' le {date}', ''),
                  value: application.decidedAt !== null ? formatDate(application.decidedAt) : null,
                },
                {
                  label: frOpportunities.detail.deadlineLabel,
                  value:
                    opportunity?.deadline !== null && opportunity?.deadline !== undefined
                      ? formatDate(opportunity.deadline)
                      : null,
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frOpportunities.application.update}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-3">
              {canUpdate ? (
                <Link href={applicationUpdateRoute(applicationId)} className={LINK}>
                  {frOpportunities.application.update}
                </Link>
              ) : null}
              {canRecordOutcome ? (
                <Link href={applicationOutcomeRoute(applicationId)} className={LINK}>
                  {frOpportunities.application.outcome}
                </Link>
              ) : null}
              {opportunity !== null ? (
                <Link href={opportunityRoute(opportunity.opportunityId)} className={LINK}>
                  {frOpportunities.list.see}
                </Link>
              ) : null}
            </div>
            {!canUpdate ? (
              <p className="text-caption text-text-muted mt-4">
                {frOpportunities.update.noTransitionBody}
              </p>
            ) : null}
          </Card>

          {opportunity !== null && !opportunity.canApplyInternally ? (
            <Alert variant="info" title={frOpportunities.applications.channelExternal}>
              {to(frOpportunities.applicationModeHint[opportunity.applicationMode] ?? '', {})}
            </Alert>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
