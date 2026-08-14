import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
} from '@ise/ui-web';
import { frContent } from '@/i18n/content';
import { ROUTES } from '@/lib/routes';
import { CONTENT_ROUTES, eventFollowupRoute } from '@/lib/routes/content';
import { memberProfileRoute } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadEvent, loadEventOnlineUrl } from '@/lib/queries/content';
import { formatEventDayBadge, formatEventMoment } from '@/lib/content-view';
import { landingMediaUrl } from '@/lib/public/landing-data';
import { StorageImage } from '@/components/media/StorageImage';
import { AppShell } from '@/components/layout/AppShell';
import { EventRegistrationForm } from '@/components/collab/EventRegistrationForm';
import { CancelRegistrationForm } from '@/components/collab/CancelRegistrationForm';
import { EventListedForm } from '@/components/collab/EventListedForm';
import { ACTION_LINK, CHIP } from '@/components/collab/styles';

export const dynamic = 'force-dynamic';
export const metadata = { title: frContent.events.breadcrumb };

/**
 * ISE-095 — Détail d'un événement.
 *
 * Le lien de connexion n'est JAMAIS dans la projection de l'événement :
 * `events.online_url_private` a son privilège de lecture retiré depuis
 * la migration 0046. Il est demandé séparément, et seulement lorsque la
 * fiche annonce qu'il est disponible (docs/rls.md §10.7).
 *
 * La liste complète des inscrits n'est pas publiée : seules apparaissent
 * les relations confirmées qui ont accepté d'y figurer, conformément à
 * `attendee_list_visibility` et `is_listed`.
 *
 * ÉCART ASSUMÉ : le bloc « networking avant l'événement » (« 12 personnes
 * inscrites travaillent dans votre secteur ») n'est pas rendu. Il
 * supposerait de croiser la liste des inscrits avec les secteurs de
 * chacun, c'est-à-dire d'exploiter des inscriptions que leurs auteurs
 * peuvent avoir choisi de ne pas rendre visibles.
 */
export default async function EventDetailPage({
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

  const [viewer, event] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadEvent(eventId, correlationId),
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

  if (!event.ok) {
    return shell(
      <ErrorState
        title={frContent.common.loadErrorTitle}
        description={event.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const detail = event.data;
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

  const onlineUrl = detail.onlineUrlAvailable
    ? await loadEventOnlineUrl(eventId, correlationId)
    : null;
  const onlineUrlValue = onlineUrl !== null && onlineUrl.ok ? onlineUrl.data : null;

  const badge = formatEventDayBadge(detail.startsAt, detail.timezone);
  const isRegistered =
    detail.myRegistration !== null &&
    ['registered', 'pending_approval', 'waitlisted', 'attended'].includes(
      detail.myRegistration.status,
    );
  const isPast = new Date(detail.startsAt).getTime() < Date.now();

  return shell(
    <div className="flex flex-col gap-8">
      <nav aria-label="Fil d’Ariane" className="text-caption text-text-secondary">
        <Link href={CONTENT_ROUTES.events} className="text-primary hover:underline">
          {frContent.events.breadcrumb}
        </Link>{' '}
        <span aria-hidden="true">›</span> <span>{detail.title}</span>
      </nav>

      {/*
        Couverture de l'evenement : EXACTEMENT le media choisi une seule fois
        dans /cms/evenements (`events.cover_media_id`, D-166), celui-la meme
        qui illustre l'encart de la page d'accueil. Aucun second televersement
        « version mobile » : `next/image` derive les resolutions de l'original
        via `sizes` (meme regle que l'actualite, D-172).

        Sans couverture, rien n'est rendu — pas de cadre vide en attente.
      */}
      {detail.cover === null ? null : (
        <div className="bg-surface-muted rounded-base relative aspect-[16/9] w-full overflow-hidden">
          <StorageImage
            src={landingMediaUrl(detail.cover) ?? ''}
            alt={detail.cover.alt}
            sizes="(max-width: 1279px) 100vw, 1200px"
            className="object-cover"
            priority
          />
        </div>
      )}

      <header className="rounded-base bg-[#0F172A] p-7 text-white max-md:p-5">
        <div className="flex flex-wrap items-start gap-5">
          <div
            aria-hidden="true"
            className="rounded-base flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center bg-white text-[#0F172A]"
          >
            <span className="text-caption uppercase">{badge.month}</span>
            <span className="text-h2 font-bold">{badge.day}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-h1 max-w-[30ch] font-bold">{detail.title}</h1>
            <p className="text-body-sm mt-2 text-white/85">
              {formatEventMoment(detail.startsAt, detail.timezone)}
            </p>
            <p className="text-caption mt-1 text-white/75">
              {[
                frContent.events.format[detail.format as 'online' | 'in_person' | 'hybrid'],
                detail.venueName,
                detail.city,
                detail.country,
              ]
                .filter((value) => value !== null && value !== undefined)
                .join(' · ')}
            </p>
            <p className="text-caption mt-1 text-white/75">
              {frContent.eventDetail.organizerTitle} : {detail.organizerLabel ?? '—'}
            </p>
          </div>
        </div>

        {detail.status === 'cancelled' ? (
          <p className="text-body-sm rounded-base mt-5 bg-white/10 p-3">
            {frContent.eventDetail.cancelledNotice}
            {detail.cancellationReason === null ? '' : ` ${detail.cancellationReason}`}
          </p>
        ) : null}

        <p className="text-caption mt-5 text-white/75">
          {detail.registeredCount} {frContent.events.registered}
          {detail.knownRegisteredCount > 0
            ? ` · ${detail.knownRegisteredCount} ${frContent.events.knownRegistered}`
            : ''}
        </p>
      </header>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.eventDetail.whyTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary whitespace-pre-line">
              {detail.description ?? '—'}
            </p>
            {detail.targetAudience === null ? null : (
              <div className="border-border mt-4 border-t pt-4">
                <h3 className="text-body-sm text-text-primary font-semibold">
                  {frContent.eventDetail.audienceTitle}
                </h3>
                <p className="text-body-sm text-text-secondary mt-1">{detail.targetAudience}</p>
              </div>
            )}
            {detail.communities.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {detail.communities.map((community) => (
                  <li key={community.id} className={CHIP}>
                    {community.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          {detail.agenda.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.eventDetail.programTitle}</CardTitle>
              </CardHeader>
              <ol className="flex flex-col gap-4">
                {detail.agenda.map((item) => (
                  <li key={item.itemId} className="flex flex-wrap gap-4">
                    <span className="rounded-base text-caption bg-[#0F172A] px-3 py-1 text-white">
                      {item.startsAt === null
                        ? '—'
                        : new Intl.DateTimeFormat('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: detail.timezone,
                          }).format(new Date(item.startsAt))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary font-medium">{item.title}</p>
                      {item.description === null ? null : (
                        <p className="text-caption text-text-secondary">{item.description}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          ) : null}

          {detail.speakers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.eventDetail.speakersTitle}</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-4">
                {detail.speakers.map((speaker) => (
                  <li key={speaker.speakerId} className="flex items-center gap-3">
                    <Avatar
                      name={speaker.profile?.displayName ?? speaker.externalName ?? '—'}
                      size={32}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm text-text-primary font-medium">
                        {speaker.profile?.displayName ?? speaker.externalName ?? '—'}
                      </p>
                      <p className="text-caption text-text-secondary">
                        {[
                          frContent.eventDetail.speakerRole[
                            speaker.speakerRole as keyof typeof frContent.eventDetail.speakerRole
                          ] ?? speaker.speakerRole,
                          speaker.profile?.currentPosition ?? speaker.externalTitle,
                          speaker.profile?.currentOrganization ?? speaker.externalOrganization,
                        ]
                          .filter((value) => value !== null && value !== undefined)
                          .join(' · ')}
                      </p>
                    </div>
                    {speaker.profile === null ? null : (
                      <Link
                        href={memberProfileRoute(speaker.profile.profileId)}
                        className="text-caption text-primary hover:underline"
                      >
                        {frContent.common.seeProfile}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {isPast ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.eventDetail.afterEvent}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{frContent.followup.subtitle}</p>
              <p className="mt-5">
                <Link href={eventFollowupRoute(eventId)} className={ACTION_LINK}>
                  {frContent.followup.title}
                </Link>
              </p>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.eventDetail.registrationTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">
              {frContent.eventDetail.registrationPolicy[
                detail.registrationPolicy as keyof typeof frContent.eventDetail.registrationPolicy
              ] ?? detail.registrationPolicy}
            </p>
            <p className="text-caption text-text-muted mt-1">
              {detail.capacity === null
                ? frContent.eventDetail.capacityUnlimited
                : `${detail.registeredCount} ${frContent.eventDetail.capacityOf} ${detail.capacity}`}
            </p>

            <div className="mt-5">
              {detail.status === 'cancelled' ? (
                <p className="text-body-sm text-text-secondary">
                  {frContent.eventDetail.cancelledNotice}
                </p>
              ) : isRegistered ? (
                <div className="flex flex-col gap-4">
                  <Badge tone="success">
                    {detail.myRegistration?.status === 'waitlisted'
                      ? frContent.events.waitlistedBadge
                      : detail.myRegistration?.status === 'pending_approval'
                        ? frContent.events.pendingBadge
                        : frContent.events.registeredBadge}
                  </Badge>
                  <EventListedForm
                    eventId={eventId}
                    listed={detail.myRegistration?.isListed ?? true}
                  />
                  <CancelRegistrationForm eventId={eventId} />
                </div>
              ) : detail.registrationPolicy === 'none' ? (
                <p className="text-body-sm text-text-secondary">
                  {frContent.eventDetail.registrationPolicy.none}
                </p>
              ) : (
                <EventRegistrationForm
                  eventId={eventId}
                  questions={detail.questions.map((question) => ({
                    id: question.questionId,
                    label: question.question,
                    required: question.isRequired,
                  }))}
                />
              )}
            </div>
          </Card>

          {detail.format === 'in_person' ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.eventDetail.onlineTitle}</CardTitle>
              </CardHeader>
              {onlineUrlValue === null ? (
                <p className="text-body-sm text-text-secondary">
                  {detail.onlineUrlAvailable
                    ? frContent.eventDetail.onlineLinkMissing
                    : frContent.eventDetail.onlineLinkAfterRegistration}
                </p>
              ) : (
                <p className="text-body-sm">
                  <span className="text-text-secondary">
                    {frContent.eventDetail.onlineLinkLabel} :{' '}
                  </span>
                  <a
                    href={onlineUrlValue}
                    rel="noreferrer noopener"
                    target="_blank"
                    className="text-primary focus-visible:outline-active-blue break-all rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    {onlineUrlValue}
                  </a>
                </p>
              )}
            </Card>
          )}

          {detail.address === null ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frContent.eventDetail.placeTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary whitespace-pre-line">
                {detail.address}
              </p>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frContent.eventDetail.knownAttendeesTitle}</CardTitle>
            </CardHeader>
            {detail.knownAttendees.length === 0 ? (
              <p className="text-body-sm text-text-secondary">
                {frContent.eventDetail.attendeesHiddenBody}
              </p>
            ) : (
              <>
                <p className="text-body-sm text-text-secondary mb-4">
                  {frContent.eventDetail.knownAttendeesBody}
                </p>
                <ul className="flex flex-col gap-3">
                  {detail.knownAttendees.map((attendee) => (
                    <li key={attendee.profileId} className="flex items-center gap-3">
                      <Avatar name={attendee.displayName} size={32} />
                      <Link
                        href={memberProfileRoute(attendee.profileId)}
                        className="text-body-sm text-text-primary hover:underline"
                      >
                        {attendee.displayName}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Alert
            variant="info"
            title={
              detail.landingVisibility === 'visible'
                ? frContent.landing.visibleTitle
                : frContent.landing.hiddenTitle
            }
          >
            {detail.landingVisibility === 'visible'
              ? frContent.landing.visibleBody
              : frContent.landing.hiddenBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
