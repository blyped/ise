import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES, internshipOfferRoute } from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipHelpers, loadInternshipOffer } from '@/lib/queries/internships';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import {
  Breadcrumb,
  FeedbackBanner,
  FormRow,
  PRIMARY_BUTTON,
  PageHeader,
  ReasonList,
  SELECT,
  TEXTAREA,
} from '@/components/collaborate/CollaborateUI';
import { requestHelpAction } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.help.title };

const SUCCESS: Record<string, string> = { help_requested: frInternships.help.done };

/**
 * ISE-075 — Demander une relecture ou un conseil au réseau.
 *
 * Chaque profil proposé porte ses RAISONS (D-43) : un ancien sans lien
 * vérifiable avec l'offre ou la recherche n'apparaît pas — la requête
 * ne le renvoie pas, et l'écran n'invente personne. La demande n'engage
 * jamais l'ancien : il accepte, décline ou répond quand il veut.
 */
export default async function InternshipHelpPage({
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
  const [viewer, offerResult, helpersResult] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipOffer(offerId, correlationId),
    loadInternshipHelpers(offerId, correlationId),
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
        { label: frInternships.help.title, href: null },
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
  if (offer === null) notFound();

  const helpers = helpersResult.ok ? helpersResult.data : [];

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.help.title}
        subtitle={frInternships.help.subtitle
          .replace('{title}', offer.title)
          .replace('{organization}', offer.organization ?? '')}
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} successCatalog={SUCCESS} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <section
          aria-label={frInternships.help.membersTitle}
          className="flex min-w-0 flex-col gap-5"
        >
          <h2 className="text-h3 text-text-primary font-semibold">
            {frInternships.help.membersTitle}
          </h2>

          {!helpersResult.ok ? (
            <ErrorState
              title={frInternships.common.loadErrorTitle}
              description={helpersResult.error.userMessage}
              correlationId={correlationId}
            />
          ) : helpers.length === 0 ? (
            <EmptyState
              title={frInternships.help.membersEmpty}
              description={frInternships.apply.helpBody}
            />
          ) : (
            <ul className="flex flex-col gap-5">
              {helpers.map((helper) => (
                <li key={helper.profileId}>
                  <Card className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col">
                        <p className="text-body text-text-primary font-semibold">
                          {helper.displayName}
                        </p>
                        <p className="text-caption text-text-secondary">
                          {[helper.position, helper.organization, helper.promotion]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                      {helper.available ? (
                        <Badge tone="success">{frInternships.help.availableBadge}</Badge>
                      ) : null}
                    </div>

                    <ReasonList title={frInternships.help.whyTitle} reasons={helper.reasons} />

                    <form action={requestHelpAction} className="flex flex-col gap-4">
                      <input type="hidden" name="offerId" value={offer.offerId} />
                      <input type="hidden" name="alumniProfileId" value={helper.profileId} />

                      <FormRow
                        id={`type-demande-${helper.profileId}`}
                        label={frInternships.help.chooseTitle}
                      >
                        <select
                          id={`type-demande-${helper.profileId}`}
                          name="requestType"
                          defaultValue="cv_review"
                          className={SELECT}
                        >
                          <option value="cv_review">{frInternships.help.typeCvReview}</option>
                          <option value="advice">{frInternships.help.typeAdvice}</option>
                          <option value="organization_info">
                            {frInternships.help.typeOrganizationInfo}
                          </option>
                          <option value="introduction">
                            {frInternships.help.typeIntroduction}
                          </option>
                          <option value="internship_possibility">
                            {frInternships.help.typeInternshipPossibility}
                          </option>
                        </select>
                      </FormRow>

                      <FormRow
                        id={`message-demande-${helper.profileId}`}
                        label={frInternships.help.messageLabel}
                        hint={frInternships.help.messageHelp}
                      >
                        <textarea
                          id={`message-demande-${helper.profileId}`}
                          name="message"
                          required
                          maxLength={600}
                          className={TEXTAREA}
                          aria-describedby={`message-demande-${helper.profileId}-aide`}
                        />
                      </FormRow>

                      <p>
                        <button type="submit" className={PRIMARY_BUTTON}>
                          {frInternships.help.submit}
                        </button>
                      </p>
                    </form>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.help.respectTitle}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-2">
              {frInternships.help.respectRules.map((rule) => (
                <li key={rule} className="text-body-sm text-text-secondary flex items-start gap-2">
                  <span aria-hidden="true" className="text-primary mt-[2px]">
                    •
                  </span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
