import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Avatar, Badge, Card, CardHeader, CardTitle, EmptyState } from '@ise/ui-web';
import { frContent } from '@/i18n/content';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, eventRoute } from '@/lib/routes/content';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadEventFollowup } from '@/lib/queries/content';
import { formatEventMoment } from '@/lib/content-view';
import { formatDay } from '@/lib/communities-view';
import { AppShell } from '@/components/layout/AppShell';
import { DeclareOutcomeForm } from '@/components/collab/DeclareOutcomeForm';
import { DeleteOutcomeForm } from '@/components/collab/DeleteOutcomeForm';
import { ACTION_LINK } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContent.followup.title };

/**
 * ISE-096 — Après l'événement.
 *
 * MESURE D'IMPACT RÉELLE, AUCUN CHIFFRE INVENTÉ (MASTER PROMPT §98) :
 *  - « Impact de ma participation » compte exactement les suites que la
 *    personne a elle-même enregistrées, et les ressources auxquelles elle
 *    a réellement accès ;
 *  - l'instantané d'impact global (`event_impact_snapshots`) reste
 *    réservé à l'organisateur, et n'apparaît que s'il existe. En son
 *    absence, l'écran dit qu'aucun relevé n'a été fait — il n'affiche
 *    pas des zéros qui se liraient comme un résultat.
 *
 * ÉCART ASSUMÉ : la maquette montre une liste privée de tâches (« Mes
 * suites à donner », avec dates et cases à cocher). Aucune table ne la
 * porte ; la construire supposerait d'inventer un modèle de données. Ce
 * qui est rendu à la place est la liste réelle des suites déclarées,
 * modifiable, avec la personne concernée quand il y en a une.
 *
 * C-08 : la reprise de contact avec cette personne passait par un lien
 * « Envoyer un message ». La messagerie ISE<->ISE ayant été retirée, il
 * ne reste que l'accès à son profil.
 */
export default async function EventFollowupPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { eventId } = await params;
  const correlationId = newCorrelationId();

  const [viewer, followup] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadEventFollowup(eventId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CONTENT_ROUTES.events}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!followup.ok) {
    return shell(
      <EmptyState
        title={frContent.followup.notParticipantTitle}
        description={`${frContent.followup.notParticipantBody} ${followup.error.userMessage}`}
        action={
          <Link href={eventRoute(eventId)} className={ACTION_LINK}>
            {frContent.events.see}
          </Link>
        }
      />,
    );
  }

  const detail = followup.data;
  if (detail === null) {
    return shell(
      <EmptyState
        title={frContent.eventDetail.notFoundTitle}
        description={frContent.eventDetail.notFoundBody}
        action={
          <Link href={CONTENT_ROUTES.events} className={ACTION_LINK}>
            {frContent.events.breadcrumb}
          </Link>
        }
      />,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={CONTENT_ROUTES.events} className="text-primary hover:underline">
          {frContent.events.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span>{' '}
        <Link href={eventRoute(eventId)} className="text-primary hover:underline">
          {detail.title}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{frContent.followup.breadcrumb}</span>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frContent.followup.title}</h1>
        <p className="text-body text-text-secondary">{frContent.followup.subtitle}</p>
      </div>

      <header className="rounded-base bg-[#0F172A] p-7 text-white max-md:p-5">
        <Badge tone="neutral">
          {detail.completedAt === null
            ? frContent.events.tabPast
            : frContent.events.tabPast.toUpperCase()}
        </Badge>
        <h2 className="text-h2 mt-3 font-bold">{detail.title}</h2>
        <p className="text-body-sm mt-2 text-white/85">
          {formatEventMoment(detail.startsAt, detail.timezone)}
          {detail.city === null ? '' : ` · ${detail.city}`} · {detail.registeredCount}{' '}
          {frContent.events.registered}
        </p>
        <p className="mt-5">
          <Link
            href={eventRoute(eventId)}
            className="rounded-base bg-surface text-body-sm text-text-primary focus-visible:outline-active-blue inline-flex h-[44px] items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {frContent.events.see}
          </Link>
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-3">
        {[
          [detail.myImpact.contacts, frContent.followup.myImpactContacts],
          [detail.myImpact.followUps, frContent.followup.myImpactFollowUps],
          [detail.myImpact.resources, frContent.followup.myImpactResources],
        ].map(([value, label]) => (
          <li key={String(label)}>
            <Card>
              <p className="text-h1 text-primary font-bold">{value}</p>
              <p className="text-caption text-text-secondary">{label}</p>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.followup.outcomesTitle}</CardTitle>
            </CardHeader>
            {detail.myOutcomes.length === 0 ? (
              <EmptyState
                title={frContent.followup.outcomesEmptyTitle}
                description={frContent.followup.outcomesEmptyBody}
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.myOutcomes.map((outcome) => (
                  <li
                    key={outcome.outcomeId}
                    className="border-border rounded-base flex flex-wrap items-center gap-3 border px-4 py-3"
                  >
                    {outcome.targetProfile === null ? null : (
                      <Avatar name={outcome.targetProfile.displayName} size={32} />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary font-medium">
                        {outcome.targetProfile?.displayName ??
                          frContent.followup.outcomeType[
                            outcome.outcomeType as keyof typeof frContent.followup.outcomeType
                          ] ??
                          outcome.outcomeType}
                      </p>
                      <p className="text-caption text-text-secondary">{outcome.notes ?? ''}</p>
                      <p className="text-caption text-text-muted">
                        {formatDay(outcome.declaredAt) ?? ''}
                      </p>
                    </div>
                    {/* C-08 : plus de lien « Envoyer un message » ici. */}
                    {outcome.targetProfile === null ? null : (
                      <span className="flex flex-wrap gap-2">
                        <Link
                          href={memberProfileRoute(outcome.targetProfile.profileId)}
                          className="text-caption text-primary hover:underline"
                        >
                          {frContent.common.seeProfile}
                        </Link>
                      </span>
                    )}
                    <DeleteOutcomeForm eventId={eventId} outcomeId={outcome.outcomeId} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.followup.declareTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary mb-4">
              {frContent.followup.declareBody}
            </p>
            <DeclareOutcomeForm
              eventId={eventId}
              attendees={detail.knownAttendees.map((attendee) => ({
                id: attendee.profileId,
                name: attendee.displayName,
              }))}
            />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.followup.reportTitle}</CardTitle>
            </CardHeader>
            {detail.followup === null ? (
              <>
                <p className="text-body-sm text-text-primary font-medium">
                  {frContent.followup.reportEmptyTitle}
                </p>
                <p className="text-body-sm text-text-secondary mt-1">
                  {frContent.followup.reportEmptyBody}
                </p>
              </>
            ) : (
              <dl className="flex flex-col gap-4">
                {(
                  [
                    [frContent.followup.reportSummary, detail.followup.summary],
                    [frContent.followup.reportConclusions, detail.followup.conclusions],
                    [frContent.followup.reportDecisions, detail.followup.decisions],
                    [frContent.followup.reportNextSteps, detail.followup.nextSteps],
                  ] as const
                )
                  .filter(([, value]) => value !== null && value.length > 0)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-body-sm text-text-primary font-semibold">{label}</dt>
                      <dd className="text-body-sm text-text-secondary whitespace-pre-line">
                        {value}
                      </dd>
                    </div>
                  ))}
                {detail.followup.replayUrl === null ? null : (
                  <div>
                    <dt className="sr-only">{frContent.followup.replay}</dt>
                    <dd>
                      <a
                        href={detail.followup.replayUrl}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-primary text-body-sm hover:underline"
                      >
                        {frContent.followup.replay}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </Card>
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.followup.resourcesTitle}</CardTitle>
            </CardHeader>
            {detail.resources.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {frContent.followup.resourcesEmpty}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {detail.resources.map((resource) => (
                  <li key={resource.resourceId} className="text-body-sm">
                    {resource.externalUrl === null ? (
                      <span className="text-text-secondary">{resource.title}</span>
                    ) : (
                      <a
                        href={resource.externalUrl}
                        rel="noreferrer noopener"
                        target="_blank"
                        className="text-primary focus-visible:outline-active-blue rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                      >
                        {resource.title}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Alert variant="info" title={frContent.followup.myImpactTitle}>
            {frContent.followup.myImpactHelp}
          </Alert>

          <Alert variant="info" title={frContent.followup.privateNotice} />

          {detail.isOrganizer ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.followup.organizerImpactTitle}</CardTitle>
              </CardHeader>
              {detail.eventImpact === null ? (
                <p className="text-body-sm text-text-secondary">
                  {frContent.followup.organizerImpactEmpty}
                </p>
              ) : (
                <>
                  <p className="text-caption text-text-muted mb-3">
                    {frContent.followup.organizerImpactBody} —{' '}
                    {formatDay(detail.eventImpact.snapshotAt) ?? ''}
                  </p>
                  <dl className="flex flex-col gap-2">
                    {(
                      [
                        [
                          frContent.followup.organizerImpact.registered,
                          detail.eventImpact.registeredCount,
                        ],
                        [
                          frContent.followup.organizerImpact.attended,
                          detail.eventImpact.attendedCount,
                        ],
                        [frContent.followup.organizerImpact.noShow, detail.eventImpact.noShowCount],
                        [
                          frContent.followup.organizerImpact.promotions,
                          detail.eventImpact.promotionsRepresented,
                        ],
                        [
                          frContent.followup.organizerImpact.countries,
                          detail.eventImpact.countriesRepresented,
                        ],
                        [
                          frContent.followup.organizerImpact.connections,
                          detail.eventImpact.connectionsCreated,
                        ],
                        [
                          frContent.followup.organizerImpact.projects,
                          detail.eventImpact.projectsInitiated,
                        ],
                        [
                          frContent.followup.organizerImpact.mentorships,
                          detail.eventImpact.mentorshipsInitiated,
                        ],
                        [
                          frContent.followup.organizerImpact.resources,
                          detail.eventImpact.resourcesProduced,
                        ],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-4">
                        <dt className="text-caption text-text-secondary">{label}</dt>
                        <dd className="text-body-sm text-text-primary font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </Card>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
