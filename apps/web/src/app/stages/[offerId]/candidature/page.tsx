import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import {
  INTERNSHIP_ROUTES,
  internshipApplicationRoute,
  internshipHelpRoute,
  internshipOfferRoute,
} from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipApplication, loadInternshipOffer } from '@/lib/queries/internships';
import { formatDate, type InternshipApplicationDetail } from '@/lib/collaborate-view';
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
import { declareSentAction, saveDraftAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.apply.title };

const SUCCESS: Record<string, string> = { draft_saved: frInternships.apply.draftSaved };

/**
 * ISE-074 — Préparer ma candidature.
 *
 * REGLE CARDINALE (D-55) : deux formulaires, deux verbes.
 *   1. « Enregistrer le dossier » prépare — le statut reste `to_prepare`.
 *   2. « Déclarer l'envoi » enregistre ce que l'ÉLÈVE dit avoir fait,
 *      à la date qu'il fournit. Aucun bouton n'« envoie » quoi que ce
 *      soit : la plateforme ne transmet aucun dossier, et l'écran le
 *      répète en toutes lettres.
 */
export default async function InternshipApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ offerId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { offerId } = await params;
  if (!isUuid(offerId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const feedback = readFeedback(await searchParams);
  const correlationId = newCorrelationId();
  const [viewer, offerResult] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipOffer(offerId, correlationId),
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
        { label: frInternships.offer.badge, href: internshipOfferRoute(offerId) },
        { label: frInternships.apply.title, href: null },
      ]}
    />
  );

  if (!offerResult.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        {offerResult.error.code === 'not_authorized' ? (
          <EmptyState
            title={frInternships.common.studentsOnlyTitle}
            description={frInternships.common.studentsOnlyBody}
            action={
              <Link href={INTERNSHIP_ROUTES.alumni} className={PRIMARY_BUTTON}>
                {frInternships.common.studentsOnlyAction}
              </Link>
            }
          />
        ) : (
          <ErrorState
            title={frInternships.common.loadErrorTitle}
            description={offerResult.error.userMessage}
            correlationId={correlationId}
          />
        )}
      </div>,
    );
  }

  const offer = offerResult.data;
  if (offer === null) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.errors.not_found}
          description={frInternships.home.emptyBody}
          action={
            <Link href={INTERNSHIP_ROUTES.home} className={LINK_BUTTON}>
              {frInternships.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  // Dossier existant : on precharge ce que l'eleve a deja saisi.
  let application: InternshipApplicationDetail | null = null;
  if (offer.myApplication !== null) {
    const applicationResult = await loadInternshipApplication(
      offer.myApplication.applicationId,
      correlationId,
    );
    application = applicationResult.ok ? applicationResult.data : null;
  }

  const isSent = application !== null && application.status !== 'to_prepare';
  const hasCv = application?.cvStoragePath !== null && application?.cvStoragePath !== undefined;
  const hasMessage = application?.message !== null && application?.message !== undefined;
  const hasChannel =
    application !== null && application.applicationChannel !== 'platform' ? true : false;

  const checklist: { label: string; done: boolean }[] = [
    { label: frInternships.apply.checklistCv, done: hasCv },
    { label: frInternships.apply.checklistMessage, done: hasMessage },
    { label: frInternships.apply.checklistChannel, done: hasChannel },
  ];

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.apply.title}
        subtitle={frInternships.apply.subtitle
          .replace('{title}', offer.title)
          .replace('{organization}', offer.organization ?? '')}
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      {/* D-55, en toutes lettres et avant les formulaires. */}
      <Alert variant="info" title={frInternships.apply.noTransmissionTitle}>
        {frInternships.apply.noTransmissionBody}
      </Alert>

      {isSent && application !== null ? (
        <Alert
          variant="success"
          title={frInternships.offer.alreadyApplied}
          action={
            <Link
              href={internshipApplicationRoute(application.applicationId)}
              className={LINK_BUTTON}
            >
              {frInternships.offer.seeApplication}
            </Link>
          }
        >
          {''}
        </Alert>
      ) : null}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.apply.fileTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary mb-5">{frInternships.apply.fileBody}</p>
            <form action={saveDraftAction} className="flex flex-col gap-5">
              <input type="hidden" name="offerId" value={offer.offerId} />
              {application === null ? null : (
                <input type="hidden" name="applicationId" value={application.applicationId} />
              )}

              <FormRow id="poste-candidature" label={frInternships.apply.positionTitle}>
                <input
                  id="poste-candidature"
                  name="positionTitle"
                  defaultValue={application?.positionTitle ?? offer.title}
                  className={INPUT}
                />
              </FormRow>

              <FormRow id="canal-candidature" label={frInternships.apply.channel}>
                <select
                  id="canal-candidature"
                  name="channel"
                  defaultValue={application?.applicationChannel ?? 'email'}
                  className={SELECT}
                >
                  <option value="platform">{frInternships.apply.channelPlatform}</option>
                  <option value="email">{frInternships.apply.channelEmail}</option>
                  <option value="external_site">{frInternships.apply.channelExternal}</option>
                  <option value="via_introduction">
                    {frInternships.apply.channelIntroduction}
                  </option>
                  <option value="other">{frInternships.apply.channelOther}</option>
                </select>
              </FormRow>

              <FormRow id="cv-candidature" label={frInternships.apply.cvPath}>
                <input
                  id="cv-candidature"
                  name="cvPath"
                  defaultValue={application?.cvStoragePath ?? ''}
                  className={INPUT}
                />
              </FormRow>

              <FormRow id="message-candidature" label={frInternships.apply.message}>
                <textarea
                  id="message-candidature"
                  name="message"
                  maxLength={600}
                  defaultValue={application?.message ?? ''}
                  className={TEXTAREA}
                />
              </FormRow>

              <p>
                <button type="submit" className={LINK_BUTTON}>
                  {frInternships.apply.saveDraft}
                </button>
              </p>
            </form>
          </Card>

          {isSent ? null : (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frInternships.apply.declareTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary mb-5">
                {frInternships.apply.declareBody}
              </p>
              {application === null ? (
                <p className="text-body-sm text-text-muted">{frInternships.apply.needDraftFirst}</p>
              ) : (
                <form action={declareSentAction} className="flex flex-col gap-5">
                  <input type="hidden" name="offerId" value={offer.offerId} />
                  <input type="hidden" name="applicationId" value={application.applicationId} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormRow id="date-envoi" label={frInternships.apply.declareDate}>
                      <input id="date-envoi" name="sentOn" type="date" required className={INPUT} />
                    </FormRow>
                    <FormRow id="canal-envoi" label={frInternships.apply.channel}>
                      <select
                        id="canal-envoi"
                        name="channel"
                        defaultValue={application.applicationChannel}
                        className={SELECT}
                      >
                        <option value="platform">{frInternships.apply.channelPlatform}</option>
                        <option value="email">{frInternships.apply.channelEmail}</option>
                        <option value="external_site">{frInternships.apply.channelExternal}</option>
                        <option value="via_introduction">
                          {frInternships.apply.channelIntroduction}
                        </option>
                        <option value="other">{frInternships.apply.channelOther}</option>
                      </select>
                    </FormRow>
                  </div>
                  <p>
                    <button type="submit" className={PRIMARY_BUTTON}>
                      {frInternships.apply.declareSubmit}
                    </button>
                  </p>
                </form>
              )}
            </Card>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.apply.checklistTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              {checklist.map((item) => (
                <li
                  key={item.label}
                  className="text-body-sm text-text-secondary flex items-start gap-2"
                >
                  <span
                    aria-hidden="true"
                    className={item.done ? 'text-success' : 'text-text-muted'}
                  >
                    {item.done ? '✓' : '○'}
                  </span>
                  <span>{item.label}</span>
                  <span className="sr-only">{item.done ? ' — fait' : ' — à faire'}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.apply.helpTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frInternships.apply.helpBody}</p>
            <p className="mt-5">
              <Link href={internshipHelpRoute(offer.offerId)} className={LINK_BUTTON}>
                {frInternships.apply.helpAction}
              </Link>
            </p>
          </Card>

          {offer.deadline === null ? null : (
            <Alert
              variant="warning"
              title={frInternships.offer.deadline.replace(
                '{date}',
                formatDate(offer.deadline) ?? '',
              )}
            >
              {''}
            </Alert>
          )}
        </aside>
      </div>
    </div>,
  );
}
