import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frInternships } from '@/i18n/internships';
import { frPromotions } from '@/i18n/promotions';
import { ROUTES } from '@/lib/routes';
import { PROMOTION_ROUTES } from '@/lib/routes/promotions';
import { INTERNSHIP_ROUTES, internshipApplicationRoute } from '@/lib/routes/internships';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadInternshipApplication } from '@/lib/queries/internships';
import { loadCountries } from '@/lib/queries/reference';
import { canRecordInternshipResult } from '@/lib/collaborate-status';
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
import { recordResultAction } from '../../../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frInternships.result.title };

/**
 * ISE-077 — Enregistrer le résultat du stage.
 *
 * ATTRIBUTION HONNÊTE ([U 93]) : la contribution du réseau est une
 * question posée à l'élève, jamais une déduction. Le choix par défaut
 * est « Je ne sais pas », et sans contribution déclarée, AUCUN impact
 * n'est attribué au réseau — l'aide du champ le dit en toutes lettres.
 * Le membre « ayant contribué » ne peut être choisi que parmi ceux qui
 * ont RÉELLEMENT été sollicités sur cette candidature.
 */
export default async function InternshipResultPage({
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
  const [viewer, result, countries] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadInternshipApplication(applicationId, correlationId),
    loadCountries(correlationId),
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
        { label: frInternships.result.title, href: null },
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

  // Le résultat ne s'enregistre que sur une proposition constatée.
  if (!canRecordInternshipResult(application.status, application.placement !== null)) {
    return shell(
      <div className="flex flex-col gap-8">
        {crumbs}
        <EmptyState
          title={frInternships.errors.invalid_transition}
          description={
            application.placement !== null
              ? frInternships.errors.request_already_sent
              : frInternships.tracking.resultBody
          }
          action={
            <Link
              href={internshipApplicationRoute(application.applicationId)}
              className={LINK_BUTTON}
            >
              {frInternships.offer.seeApplication}
            </Link>
          }
        />
      </div>,
    );
  }

  // Attribution possible uniquement vers un membre réellement sollicité.
  const helperOptions = application.helpers.filter(
    (helper) =>
      helper.alumniProfileId !== null &&
      (helper.status === 'accepted' || helper.status === 'answered'),
  );

  return shell(
    <div className="flex flex-col gap-8">
      {crumbs}

      <PageHeader
        title={frInternships.result.title}
        subtitle={frInternships.result.subtitle
          .replace('{title}', application.positionTitle)
          .replace('{organization}', application.organization ?? '')}
      />

      <FeedbackBanner feedback={feedback} catalog={frInternships.errors} />

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{frInternships.result.detailsTitle}</CardTitle>
          </CardHeader>
          <form action={recordResultAction} className="flex flex-col gap-5">
            <input type="hidden" name="applicationId" value={application.applicationId} />

            <FormRow id="organisation-resultat" label={frInternships.result.organization}>
              <input
                id="organisation-resultat"
                name="organization"
                defaultValue={application.organization ?? ''}
                className={INPUT}
              />
            </FormRow>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="pays-resultat" label={frInternships.result.country}>
                <select id="pays-resultat" name="countryCode" required className={SELECT}>
                  {(countries.ok ? countries.data : []).map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </FormRow>
              <FormRow id="ville-resultat" label={frInternships.result.city}>
                <input id="ville-resultat" name="city" className={INPUT} />
              </FormRow>
            </div>

            <FormRow id="departement-resultat" label={frInternships.result.department}>
              <input id="departement-resultat" name="department" className={INPUT} />
            </FormRow>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="debut-resultat" label={frInternships.result.startDate}>
                <input
                  id="debut-resultat"
                  name="startDate"
                  type="date"
                  required
                  className={INPUT}
                />
              </FormRow>
              <FormRow id="fin-resultat" label={frInternships.result.endDate}>
                <input id="fin-resultat" name="endDate" type="date" required className={INPUT} />
              </FormRow>
            </div>

            <FormRow id="mode-resultat" label={frInternships.result.workMode}>
              <select id="mode-resultat" name="workMode" defaultValue="on_site" className={SELECT}>
                <option value="on_site">{frInternships.preferences.workModeOnSite}</option>
                <option value="hybrid">{frInternships.preferences.workModeHybrid}</option>
                <option value="remote">{frInternships.preferences.workModeRemote}</option>
              </select>
            </FormRow>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormRow id="tuteur-resultat" label={frInternships.result.supervisorName}>
                <input id="tuteur-resultat" name="supervisorName" className={INPUT} />
              </FormRow>
              <FormRow id="fonction-tuteur-resultat" label={frInternships.result.supervisorRole}>
                <input id="fonction-tuteur-resultat" name="supervisorRole" className={INPUT} />
              </FormRow>
            </div>

            <FormRow id="source-resultat" label={frInternships.result.sourceTitle}>
              <select id="source-resultat" name="placementSource" className={SELECT}>
                <option value="ise_offer">{frInternships.result.sourceIseOffer}</option>
                <option value="ise_introduction">
                  {frInternships.result.sourceIseIntroduction}
                </option>
                <option value="alumni_contact">{frInternships.result.sourceAlumniContact}</option>
                <option value="school">{frInternships.result.sourceSchool}</option>
                <option value="personal_search">{frInternships.result.sourcePersonalSearch}</option>
                <option value="external_offer">{frInternships.result.sourceExternalOffer}</option>
                <option value="other">{frInternships.result.sourceOther}</option>
              </select>
            </FormRow>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-body-sm text-text-primary font-medium">
                {frInternships.result.attributionTitle}
              </legend>
              <p id="attribution-aide" className="text-caption text-text-secondary">
                {frInternships.result.attributionHelp}
              </p>
              <div className="grid gap-2 sm:grid-cols-2" aria-describedby="attribution-aide">
                {(
                  [
                    ['unknown', frInternships.result.attributionUnknown],
                    ['direct', frInternships.result.attributionDirect],
                    ['partial', frInternships.result.attributionPartial],
                    ['none', frInternships.result.attributionNone],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="text-body-sm text-text-secondary flex min-h-[44px] items-center gap-3"
                  >
                    <input
                      type="radio"
                      name="networkAttribution"
                      value={value}
                      defaultChecked={value === 'unknown'}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {helperOptions.length === 0 ? null : (
              <FormRow id="contributeur-resultat" label={frInternships.result.helperTitle}>
                <select
                  id="contributeur-resultat"
                  name="helperProfileId"
                  defaultValue=""
                  className={SELECT}
                >
                  <option value="">{frInternships.result.helperNone}</option>
                  {helperOptions.map((helper) => (
                    <option key={helper.requestId} value={helper.alumniProfileId ?? ''}>
                      {helper.displayName}
                    </option>
                  ))}
                </select>
              </FormRow>
            )}

            <FormRow id="convention-resultat" label={frInternships.result.agreementTitle}>
              <select
                id="convention-resultat"
                name="agreementStatus"
                defaultValue="not_started"
                className={SELECT}
              >
                <option value="not_started">{frInternships.result.agreementNotStarted}</option>
                <option value="in_preparation">
                  {frInternships.result.agreementInPreparation}
                </option>
                <option value="signed">{frInternships.result.agreementSigned}</option>
                <option value="not_required">{frInternships.result.agreementNotRequired}</option>
              </select>
            </FormRow>

            <p>
              <button type="submit" className={PRIMARY_BUTTON}>
                {frInternships.result.submit}
              </button>
            </p>
          </form>
        </Card>

        <aside className="flex flex-col gap-7">
          <Alert variant="info" title={frInternships.result.goodNewsTitle}>
            {frInternships.result.goodNewsBody}
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frInternships.result.privacyTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frInternships.result.privacyBody}</p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
